from typing import Dict, List, Optional
import os
from sarvamai import SarvamAI

from synthetic_data_kit.utils.config import load_config, get_openai_config

SUPPORTED_LANGUAGE_CODES: Dict[str, str] = {
    "Assamese": "as-IN",
    "Bengali": "bn-IN",
    "Bodo": "brx-IN",
    "Dogri": "doi-IN",
    "English": "en-IN",
    "Gujarati": "gu-IN",
    "Hindi": "hi-IN",
    "Kannada": "kn-IN",
    "Kashmiri": "ks-IN",
    "Konkani": "kok-IN",
    "Maithili": "mai-IN",
    "Malayalam": "ml-IN",
    "Manipuri": "mni-IN",
    "Marathi": "mr-IN",
    "Nepali": "ne-IN",
    "Odia": "od-IN",
    "Punjabi": "pa-IN",
    "Sanskrit": "sa-IN",
    "Santali": "sat-IN",
    "Sindhi": "sd-IN",
    "Tamil": "ta-IN",
    "Telugu": "te-IN",
    "Urdu": "ur-IN",
}

# Allow common short aliases while normalizing to the canonical SarvamAI codes.
LANGUAGE_CODE_MAP: Dict[str, str] = {
    code.lower(): code for code in SUPPORTED_LANGUAGE_CODES.values()
}
LANGUAGE_CODE_MAP.update({
    "as": "as-IN",
    "bn": "bn-IN",
    "brx": "brx-IN",
    "doi": "doi-IN",
    "en": "en-IN",
    "gu": "gu-IN",
    "hi": "hi-IN",
    "kn": "kn-IN",
    "ks": "ks-IN",
    "kok": "kok-IN",
    "mai": "mai-IN",
    "ml": "ml-IN",
    "mni": "mni-IN",
    "mr": "mr-IN",
    "ne": "ne-IN",
    "od": "od-IN",
    "pa": "pa-IN",
    "sa": "sa-IN",
    "sat": "sat-IN",
    "sd": "sd-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "ur": "ur-IN",
})


def _get_sarvamai_client(api_key: Optional[str] = None) -> SarvamAI:
    """Create a SarvamAI client using config.yaml (preferred) or env var."""
    if api_key is None:
        config = load_config()
        openai_cfg = get_openai_config(config)
        api_key = os.environ.get('API_ENDPOINT_KEY')

    if not api_key:
        raise RuntimeError("API key is required for SarvamAI translation (set in config.yaml)")

    return SarvamAI(api_subscription_key=api_key)


def normalize_language_code(code: str) -> str:
    """Normalize a user-provided language code for SarvamAI."""
    if not code:
        return "en-IN"

    normalized = code.strip()
    normalized_lower = normalized.lower()
    if normalized_lower in LANGUAGE_CODE_MAP:
        return LANGUAGE_CODE_MAP[normalized_lower]

    raise ValueError(
        f"Unsupported language code: {code}. Supported codes: {', '.join(SUPPORTED_LANGUAGE_CODES.values())}"
    )


def chunk_text(text: str, max_length: int = 1000) -> List[str]:
    """Splits text into chunks of at most max_length characters while preserving word boundaries."""
    chunks = []
    while len(text) > max_length:
        split_index = text.rfind(" ", 0, max_length)
        if split_index == -1:
            split_index = max_length

        chunks.append(text[:split_index].strip())
        text = text[split_index:].lstrip()

    if text:
        chunks.append(text.strip())

    return chunks


def translate_text(text: str, target_language_code: str, source_language_code: str = "en-IN") -> str:
    """Translates text in chunks using SarvamAI."""
    if not text.strip():
        return ""

    source_language_code = normalize_language_code(source_language_code)
    target_language_code = normalize_language_code(target_language_code)

    text_chunks = chunk_text(text)
    translated_texts: List[str] = []

    client = _get_sarvamai_client()

    for chunk in text_chunks:
        try:
            response = client.text.translate(
                input=chunk,
                source_language_code=source_language_code,
                target_language_code=target_language_code,
                speaker_gender="Male",
                mode="formal",
                model="sarvam-translate:v1",
            )
            translated_texts.append(response.translated_text)
        except Exception as e:
            # Fall back by keeping the original chunk so pipeline continues.
            print(f"Error translating chunk: {e}")
            translated_texts.append(chunk)

    return " ".join(translated_texts)
