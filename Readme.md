# Crossdata

Crossdata is a full-stack app for turning source documents into structured multilingual training datasets. It combines a Next.js frontend, a FastAPI backend, Supabase authentication, and a bundled `synthetic-data-kit` pipeline for ingestion, translation, QA generation, curation, and export.

## Repository Layout

```text
.
├── frontend-next/   # Next.js app, Supabase auth, pricing, pipeline UI
├── backend/         # FastAPI API, document processing pipeline, exports
└── Readme.md        # Root project documentation
```

## What It Does

- Upload one or more source documents.
- Extract text from supported file types through `synthetic-data-kit`.
- Translate extracted content into a target language with SarvamAI.
- Generate QA pairs from the translated text.
- Curate low-quality pairs.
- Export the final dataset in formats such as `jsonl`, `alpaca`, `chatml`, and Hugging Face bundle output.
- Track user credits with Supabase.
- Accept payments with Razorpay.

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript
- Auth and user state: Supabase
- Backend API: FastAPI
- Dataset pipeline: bundled `synthetic-data-kit`
- Translation: SarvamAI
- Payments: Razorpay

## Prerequisites

- Node.js 20+
- npm
- Python 3.14+
- `uv` for Python dependency management
- A Supabase project
- A Razorpay account
- SarvamAI / API endpoint credentials used by the backend pipeline

## Environment Variables

### Frontend (`frontend-next/.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required for auth.
- `NEXT_PUBLIC_API_URL` should point to the FastAPI server.
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are required by the Next.js API routes under `frontend-next/src/app/api/razorpay`.
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` is only used as a fallback in the client checkout flow.

### Backend (`backend/.env`)

```bash
API_ENDPOINT_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Notes:

- `API_ENDPOINT_KEY` is required for translation and QA generation.
- Backend Razorpay variables are required only if you use the backend payment endpoints in `backend/main.py`.
- The backend also loads settings from the bundled `synthetic-data-kit` config file referenced by the pipeline.

## Supabase Setup

The frontend expects a `users` table with at least these columns:

```sql
create table if not exists public.users (
  id uuid primary key,
  email text,
  name text,
  avatar_url text,
  credits integer default 0
);
```

The app creates a row on first sign-in if one does not already exist.

## Local Development

### 1. Start the backend

```bash
cd backend
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`.

### 2. Start the frontend

```bash
cd frontend-next
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## Main Frontend Routes

- `/` landing page
- `/pricing` public pricing page with sign-in required only for checkout
- `/pipeline` document upload and pipeline execution UI

## Main Backend Endpoints

- `POST /process-stream`
  Streams pipeline progress as Server-Sent Events.
- `GET /download/{run_id}`
  Downloads the generated dataset artifact.
- `POST /razorpay/create-order`
  Creates a Razorpay order.
- `POST /razorpay/verify`
  Verifies a Razorpay payment signature.

## Pipeline Flow

1. Files are uploaded to the backend.
2. Documents are ingested into a parsed Lance dataset.
3. Extracted text is translated into the selected target language.
4. QA pairs are generated from translated text.
5. Generated pairs are curated.
6. Output is converted into the requested dataset format.
7. The final artifact is made available for download.

Generated run artifacts are stored under `backend/data/runs/<run-id>/`.

## Supported Output Formats

The frontend currently exposes dataset formats backed by the backend converter, including:

- `jsonl`
- `alpaca`
- `chatml`
- `hf` (exported as a zipped Hugging Face dataset bundle)

## Supported Language Codes

Use these target language codes when configuring translation:

| Language | Code |
| --- | --- |
| Assamese | `as-IN` |
| Bengali | `bn-IN` |
| Bodo | `brx-IN` |
| Dogri | `doi-IN` |
| English | `en-IN` |
| Gujarati | `gu-IN` |
| Hindi | `hi-IN` |
| Kannada | `kn-IN` |
| Kashmiri | `ks-IN` |
| Konkani | `kok-IN` |
| Maithili | `mai-IN` |
| Malayalam | `ml-IN` |
| Manipuri | `mni-IN` |
| Marathi | `mr-IN` |
| Nepali | `ne-IN` |
| Odia | `od-IN` |
| Punjabi | `pa-IN` |
| Sanskrit | `sa-IN` |
| Santali | `sat-IN` |
| Sindhi | `sd-IN` |
| Tamil | `ta-IN` |
| Telugu | `te-IN` |
| Urdu | `ur-IN` |
