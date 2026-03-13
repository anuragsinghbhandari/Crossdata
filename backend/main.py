import hmac
import hashlib
import json
import os
import shutil
import sys
import uuid
from pathlib import Path
from typing import Dict, Iterator, List, Optional

import razorpay
from fastapi import FastAPI, Form, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi.responses import FileResponse, StreamingResponse

# Ensure the bundled synthetic-data-kit package is importable.
# The project contains `backend/synthetic_data_kit/synthetic_data_kit`.
kit_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "synthetic_data_kit"))
if kit_root not in sys.path:
    sys.path.insert(0, kit_root)

from synthetic_data_kit.core.ingest import process_file as ingest_file
from synthetic_data_kit.core.create import process_file as create_qa
from synthetic_data_kit.core.curate import curate_qa_pairs
from synthetic_data_kit.core.save_as import convert_format
from synthetic_data_kit.utils.lance_utils import load_lance_dataset

from translate import translate_text

load_dotenv()

app = FastAPI(title="Crossdata Pipeline Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_run_dir(run_id: str) -> str:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "runs"))
    os.makedirs(base_dir, exist_ok=True)
    run_dir = os.path.join(base_dir, run_id)
    os.makedirs(run_dir, exist_ok=True)
    return run_dir


def _find_final_artifact(run_dir: str) -> Optional[str]:
    final_dir = os.path.join(run_dir, "final")
    if not os.path.isdir(final_dir):
        return None

    for entry in os.listdir(final_dir):
        path = os.path.join(final_dir, entry)
        if os.path.isfile(path):
            return path

    return None


def _get_razorpay_credentials() -> Dict[str, str]:
    """Load Razorpay credentials from config or environment."""
    from synthetic_data_kit.utils.config import load_config

    config = load_config() or {}
    payments = config.get("payments", {}) or {}

    key_id = os.getenv("RAZORPAY_KEY_ID") or payments.get("razorpay_key_id")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET") or payments.get("razorpay_key_secret")

    if not key_id or not key_secret:
        raise RuntimeError(
            "Razorpay credentials not configured. Set payments.razorpay_key_id/razorpay_key_secret in config or env vars."
        )

    return {"key_id": key_id, "key_secret": key_secret}


def _pipeline_generator(
    run_id: str,
    input_paths: List[str],
    target_language: str,
    dataset_format: str,
    threshold: float,
    num_pairs: int,
) -> Iterator[str]:
    def emit(event: Dict):
        yield f"data: {json.dumps(event)}\n\n"

    def emit_stage(stage: str, status: str, message: str):
        yield from emit({"stage": stage, "status": status, "message": message})

    try:
        # Load the configured API endpoint settings from the synthetic-data-kit config.yaml
        from synthetic_data_kit.utils.config import load_config, get_openai_config

        config = load_config()
        openai_cfg = get_openai_config(config)

        api_base = openai_cfg.get("api_base")
        model = openai_cfg.get("model")
        api_key = os.environ.get('API_ENDPOINT_KEY')

        if not api_key:
            raise RuntimeError(
                "API key not found. Please set api-endpoint.api_key in synthetic_data_kit/config.yaml."
            )

        # Some internal code paths (e.g. system checks) use the env var.
        os.environ["API_ENDPOINT_KEY"] = api_key

        provider = "api-endpoint"

        # Ingest
        parsed_dir = os.path.join(os.path.dirname(input_paths[0]), "parsed")
        os.makedirs(parsed_dir, exist_ok=True)

        translated_texts: List[str] = []
        for idx, input_path in enumerate(input_paths, start=1):
            yield from emit_stage(
                "ingest",
                "in-progress",
                f"Ingesting file {idx}/{len(input_paths)}: {os.path.basename(input_path)}",
            )
            lance_path = ingest_file(input_path, output_dir=parsed_dir)

            # Extract text for translation
            dataset = load_lance_dataset(lance_path)
            documents = dataset.to_table().to_pylist()
            file_text = "\n\n".join([doc.get("text", "") for doc in documents if doc.get("text")])
            translated_texts.append(file_text)

            yield from emit_stage(
                "ingest",
                "success",
                f"Ingestion complete for {os.path.basename(input_path)}",
            )

        yield from emit_stage("translate", "in-progress", "Translating extracted text.")
        full_text = "\n\n".join([t for t in translated_texts if t.strip()])

        if not full_text.strip():
            raise ValueError("No extractable text found in documents.")

        translated_text = translate_text(full_text, target_language_code=target_language)
        translated_chars = len(translated_text)

        translated_txt_path = os.path.join(os.path.dirname(input_paths[0]), "translated.txt")
        Path(translated_txt_path).write_text(translated_text, encoding="utf-8")
        yield from emit_stage("translate", "success", "Translation complete.")
        yield from emit({
            "stage": "metadata",
            "status": "info",
            "message": f"Translated text length: {translated_chars} chars",
            "translated_chars": translated_chars
        })

        yield from emit_stage("create", "in-progress", "Generating QA pairs.")
        generated_dir = os.path.join(os.path.dirname(input_paths[0]), "generated")

        qa_path = create_qa(
            file_path=translated_txt_path,
            output_dir=generated_dir,
            content_type="qa",
            api_base=api_base,
            model=model,
            num_pairs=num_pairs,
            provider=provider,
            config_path=os.path.join(os.path.dirname(__file__), "synthetic_data_kit", "synthetic_data_kit", "config.yaml"),
        )
        yield from emit_stage("create", "success", "QA pair generation complete.")

        yield from emit_stage("curate", "in-progress", "Curating QA pairs.")
        curated_path = os.path.join(os.path.dirname(input_paths[0]), "curated", "cleaned.json")
        curate_qa_pairs(
            input_path=qa_path,
            output_path=curated_path,
            threshold=threshold,
            api_base=api_base,
            model=model,
            provider=provider,
            config_path=os.path.join(os.path.dirname(__file__), "synthetic_data_kit", "synthetic_data_kit", "config.yaml"),
        )
        yield from emit_stage("curate", "success", "Curation complete.")

        yield from emit_stage("format", "in-progress", f"Formatting dataset as {dataset_format}.")
        final_dir = os.path.join(os.path.dirname(input_paths[0]), "final")
        os.makedirs(final_dir, exist_ok=True)

        # Handle HuggingFace dataset export (storage_format="hf").
        # The synthetic-data-kit `convert_format` function expects a known format_type
        # (jsonl/alpaca/ft/chatml) and a storage_format of "hf" when generating HF datasets.
        storage_format = "json"
        format_type = dataset_format
        if dataset_format == "hf":
            storage_format = "hf"
            format_type = "jsonl"

        final_file = os.path.join(final_dir, f"dataset_{dataset_format}.json")
        if format_type == "jsonl":
            final_file = os.path.join(final_dir, "dataset.jsonl")

        final_output_path = convert_format(
            input_path=curated_path,
            output_path=final_file,
            format_type=format_type,
            storage_format=storage_format,
        )

        # If we produced a HuggingFace dataset, `convert_format` returns a directory.
        # Zip it so the frontend can download a single file.
        if dataset_format == "hf":
            zip_path = os.path.join(final_dir, "dataset_hf.zip")
            # Remove existing zip to avoid stale content
            if os.path.exists(zip_path):
                os.remove(zip_path)
            shutil.make_archive(os.path.splitext(zip_path)[0], "zip", final_output_path)
            final_output_path = zip_path

        yield from emit_stage("format", "success", "Formatting complete.")

        download_url = f"/download/{run_id}"
        yield from emit_stage(
            "done",
            "success",
            "Pipeline completed.",
        )
        yield from emit({
            "stage": "download",
            "status": "success",
            "message": "Ready to download.",
            "download_url": download_url,
        })
    except Exception as e:
        yield from emit({
            "stage": "error",
            "status": "error",
            "message": str(e),
        })


@app.post("/process-stream")
async def process_document_stream(
    files: List[UploadFile] = File(...),
    target_language: str = Form(...),
    dataset_format: str = Form(...),  # jsonl, alpaca, ft, chatml
    threshold: float = Form(7.0),
    num_pairs: int = Form(5),
):
    run_id = str(uuid.uuid4())
    run_dir = _get_run_dir(run_id)

    input_paths: List[str] = []
    for uploaded in files:
        input_path = os.path.join(run_dir, uploaded.filename)
        try:
            with open(input_path, "wb") as f:
                f.write(await uploaded.read())
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        input_paths.append(input_path)

    generator = _pipeline_generator(
        run_id=run_id,
        input_paths=input_paths,
        target_language=target_language,
        dataset_format=dataset_format,
        threshold=threshold,
        num_pairs=num_pairs,
    )

    return StreamingResponse(generator, media_type="text/event-stream")


@app.get("/download/{run_id}")
def download_result(run_id: str):
    run_dir = _get_run_dir(run_id)
    final_file = _find_final_artifact(run_dir)
    if not final_file:
        raise HTTPException(status_code=404, detail="Result file not found")

    filename = os.path.basename(final_file)
    return FileResponse(final_file, filename=filename)


@app.post("/razorpay/create-order")
def create_razorpay_order(order: Dict[str, int]):
    """Create a Razorpay order; returns order details for client checkout."""
    amount = order.get("amount")
    if not amount or not isinstance(amount, int):
        raise HTTPException(status_code=400, detail="Invalid amount")

    creds = _get_razorpay_credentials()
    client = razorpay.Client(auth=(creds["key_id"], creds["key_secret"]))

    razorpay_order = client.order.create(
        {"amount": amount, "currency": "INR", "payment_capture": 1}
    )

    return {
        "order_id": razorpay_order.get("id"),
        "amount": razorpay_order.get("amount"),
        "currency": razorpay_order.get("currency"),
        "key_id": creds["key_id"],
    }


@app.post("/razorpay/verify")
def verify_razorpay_payment(payment: Dict[str, str]):
    """Verify Razorpay payment signature."""
    required = ["razorpay_order_id", "razorpay_payment_id", "razorpay_signature"]
    if not all(k in payment for k in required):
        raise HTTPException(status_code=400, detail="Missing payment fields")

    creds = _get_razorpay_credentials()
    msg = f"{payment['razorpay_order_id']}|{payment['razorpay_payment_id']}".encode()
    generated_sig = hmac.new(
        creds["key_secret"].encode(), msg, hashlib.sha256
    ).hexdigest()

    if generated_sig != payment["razorpay_signature"]:
        raise HTTPException(status_code=400, detail="Signature verification failed")

    return {"status": "ok"}
