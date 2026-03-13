'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { getSessionSafe, supabase } from '../../lib/supabaseClient'
import { ensureUserProfile, formatSupabaseError } from '@/lib/userProfile'
import { StepKey, StepState, stepsMap } from './steps'

declare global {
  interface Window {
    Razorpay?: any
  }
}

const backendBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const PRICE_PER_1000 = 3
const CHARS_PER_CREDIT = 1000
const LANGUAGE_OPTIONS = [
  { label: 'Assamese', code: 'as-IN' },
  { label: 'Bengali', code: 'bn-IN' },
  { label: 'Bodo', code: 'brx-IN' },
  { label: 'Dogri', code: 'doi-IN' },
  { label: 'English', code: 'en-IN' },
  { label: 'Gujarati', code: 'gu-IN' },
  { label: 'Hindi', code: 'hi-IN' },
  { label: 'Kannada', code: 'kn-IN' },
  { label: 'Kashmiri', code: 'ks-IN' },
  { label: 'Konkani', code: 'kok-IN' },
  { label: 'Maithili', code: 'mai-IN' },
  { label: 'Malayalam', code: 'ml-IN' },
  { label: 'Manipuri', code: 'mni-IN' },
  { label: 'Marathi', code: 'mr-IN' },
  { label: 'Nepali', code: 'ne-IN' },
  { label: 'Odia', code: 'od-IN' },
  { label: 'Punjabi', code: 'pa-IN' },
  { label: 'Sanskrit', code: 'sa-IN' },
  { label: 'Santali', code: 'sat-IN' },
  { label: 'Sindhi', code: 'sd-IN' },
  { label: 'Tamil', code: 'ta-IN' },
  { label: 'Telugu', code: 'te-IN' },
  { label: 'Urdu', code: 'ur-IN' },
] as const

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) return resolve()

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed loading script'))

    document.body.appendChild(script)
  })
}

type User = {
  name: string
  email: string
  picture?: string
}

export default function PipelinePage() {
  const [user, setUser] = useState<User | null>(null)
  const [credits, setCredits] = useState(0)
  const [files, setFiles] = useState<File[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requiredCredits, setRequiredCredits] = useState<number>(0)
  const requiredCreditsRef = useRef<number>(0)

  const [targetLanguage, setTargetLanguage] = useState('hi-IN')
  const [datasetFormat, setDatasetFormat] = useState('alpaca')
  const [numPairs, setNumPairs] = useState(5)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)

  const syncUser = async (supabaseUser: any) => {
    const profile: User = {
      name: supabaseUser.user_metadata?.name ?? supabaseUser.email ?? 'Unknown',
      email: supabaseUser.email ?? '',
      picture: supabaseUser.user_metadata?.picture,
    }

    setUser(profile)
    setSupabaseUserId(supabaseUser.id)

    try {
      const existing = await ensureUserProfile(supabaseUser)
      setCredits(existing.credits)
    } catch (error) {
      setError(formatSupabaseError(error))
      throw error
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getSessionSafe()
        if (session?.user) {
          await syncUser(session.user)
        }
      } catch (error) {
        setError(formatSupabaseError(error))
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncUser(session.user)
      } else {
        setUser(null)
        setCredits(0)
        setSupabaseUserId(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const updateCredits = async (value: number) => {
    setCredits(value)

    if (!supabaseUserId) return
    await supabase.from('users').update({ credits: value }).eq('id', supabaseUserId)
  }

  const addCredits = async (delta: number) => {
    await updateCredits(Math.max(0, credits + delta))
  }

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }



  const [steps, setSteps] = useState<StepState[]>([])

  const updateStep = (key: StepKey, status: StepState['status'], message?: string) => {
    setSteps((prev) => {
      const existing = prev.find((s) => s.key === key)
      const updated = { key, label: stepsMap[key], status, message }
      if (existing) {
        return prev.map((s) => (s.key === key ? { ...s, ...updated } : s))
      }
      return [...prev, updated]
    })
  }

  const reset = () => {
    setIsRunning(false)
    setDownloadUrl(null)
    setPreview(null)
    setError(null)
    setSteps([])
  }

  const handleMessage = (event: any) => {
    const payload = event.data ? JSON.parse(event.data) : event
    if (!payload || typeof payload !== 'object') return

    const { stage, status, message, download_url, translated_chars } = payload as any

    if (translated_chars !== undefined) {
      const actualCreds = Math.ceil(translated_chars / CHARS_PER_CREDIT)
      requiredCreditsRef.current = actualCreds
      setRequiredCredits(actualCreds)
    }

    if (stage && stage !== 'metadata') {
      const key = stage as StepKey
      const normalizedStatus: StepState['status'] =
        status === 'in-progress'
          ? 'in-progress'
          : status === 'success'
            ? 'success'
            : status === 'error'
              ? 'error'
              : 'pending'

      updateStep(key, normalizedStatus, message)
    }

    if (download_url) {
      setDownloadUrl(`${backendBaseUrl}${download_url}`)
    }

    if (status === 'error') {
      setError(message ?? 'Unknown error')
      setIsRunning(false)
    }

    if (stage === 'done') {
      setIsRunning(false)
      setPreview('Your dataset is ready. Use the download button to save it locally.')
      if (requiredCreditsRef.current > 0) {
        setCredits((prev) => {
          const next = prev - requiredCreditsRef.current
          if (supabaseUserId) {
            supabase.from('users').update({ credits: next }).eq('id', supabaseUserId).then()
          }
          return next
        })
      }
    }
  }

  const startPipeline = async () => {
    if (!user) {
      setError('Please sign in before running the pipeline.')
      return
    }

    if (files.length === 0) {
      setError('Select at least one file first.')
      return
    }

    if (credits <= 0) {
      setError('Not enough credits. Please buy credits to run the pipeline.')
      return
    }

    reset()
    setIsRunning(true)

    const form = new FormData()

    files.forEach((f) => form.append('files', f))
    form.append('target_language', targetLanguage)
    form.append('dataset_format', datasetFormat)
    form.append('num_pairs', String(numPairs))

    try {
      const resp = await fetch(`${backendBaseUrl}/process-stream`, {
        method: 'POST',
        body: form,
      })

      if (!resp.ok || !resp.body) {
        const errorText = await resp.text()
        throw new Error(errorText || 'Upload failed')
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const trimmed = part.trim()
          if (!trimmed) continue
          if (!trimmed.startsWith('data:')) continue
          const jsonText = trimmed.replace(/^data:\s*/, '')
          try {
            const payload = JSON.parse(jsonText)
            handleMessage({ data: JSON.stringify(payload) })
          } catch (err) {
            console.warn('failed to parse event', err, jsonText)
          }
        }
      }
    } catch (err) {
      setError((err as Error).message)
      setIsRunning(false)
      updateStep('error', 'error', (err as Error).message)
    }
  }

  const downloadDataset = async () => {
    if (!downloadUrl) return

    try {
      const res = await fetch(downloadUrl)
      if (!res.ok) throw new Error('Failed to download dataset')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crossdata_dataset.${datasetFormat === 'jsonl' ? 'jsonl' : 'json'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError((err as Error).message)
    }
  }


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans">
      <Navbar />
      <header className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold">Crossdata: Translation + QA Dataset Builder</h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Upload documents, translate them to Indic languages, generate question-answer pairs, curate them, and export ready-to-fine-tune datasets.
          </p>
        </div>

        {!user ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-medium">Get started</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Sign in with Google to track credits, purchase additional usage, and run the pipeline.
            </p>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                onClick={signIn}
              >
                Continue with Google
              </button>
            </div>
            <div className="mt-6 grid gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
              <div>
                <strong>Pricing:</strong> ₹{PRICE_PER_1000} per 1,000 characters processed.
              </div>
              <div>
                Example: A 10 KB document costs ~₹30 and requires 10 credits.
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium">Welcome, {user.name?.split(' ')[0]}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Your account is active. Use the pricing page to review and purchase credits.
                </p>
              </div>
              <div className="flex items-center gap-4">
                {user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name ?? 'User'}
                    className="h-12 w-12 rounded-full ring-2 ring-slate-200 dark:ring-slate-800"
                  />
                )}
              </div>
            </div>

            <div className="mt-6">
              <Link href="/pricing" className="inline-flex w-full sm:w-auto items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                Buy more credits →
              </Link>
            </div>
          </section>
        )}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        ) : null}
      </header>

      {user ? (
        <main className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-medium">1) Upload & Pipeline</h2>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">Source documents</span>
                  <div
                    className="mt-2 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-4 py-10 text-center cursor-pointer transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Drag & drop files, or click to select
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        PDF, HTML, TXT, PPT, DOCX, etc.
                      </p>
                      {files.length > 0 ? (
                        <div className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                          <p>Selected {files.length} file{files.length === 1 ? '' : 's'}</p>
                          <ul className="mt-1 list-disc pl-5 text-xs text-left">
                            {files.map((f) => (
                              <li key={f.name}>{f.name}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(event) => {
                      const picked = event.target.files
                      if (picked?.length) {
                        setFiles(Array.from(picked))
                      }
                    }}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium">Target language</span>
                    <select
                      className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                    >
                      {LANGUAGE_OPTIONS.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.label} ({language.code})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">Output format</span>
                    <select
                      className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                      value={datasetFormat}
                      onChange={(e) => setDatasetFormat(e.target.value)}
                    >
                      <option value="alpaca">Alpaca</option>
                      <option value="chatml">ChatML</option>
                      <option value="jsonl">JSONL</option>
                      <option value="hf">HuggingFace Dataset</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium">QA pairs</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                      value={numPairs}
                      onChange={(e) => setNumPairs(Number(e.target.value))}
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                    <p>
                      Credits required: <span className="font-semibold">{requiredCredits > 0 ? requiredCredits : 'Calculated during translation'}</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      (1 credit = {CHARS_PER_CREDIT.toLocaleString()} translated chars, ₹{PRICE_PER_1000} per credit)
                    </p>
                  </div>

                  <button
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={startPipeline}
                    disabled={isRunning || files.length === 0}
                  >
                    {isRunning ? 'Processing…' : 'Start pipeline'}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-medium">2) Progress</h2>
              <div className="mt-4 space-y-3">
                {steps.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No pipeline run yet.</p>
                ) : (
                  steps.map((step) => (
                    <div
                      key={step.key}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {step.label}
                        </p>
                        {step.message ? (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{step.message}</p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${step.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                          : step.status === 'in-progress'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            : step.status === 'error'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200'
                          }`}
                      >
                        {step.status === 'in-progress'
                          ? 'In progress'
                          : step.status === 'success'
                            ? 'Done'
                            : step.status === 'error'
                              ? 'Error'
                              : 'Pending'}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {downloadUrl ? (
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                    onClick={downloadDataset}
                  >
                    Download dataset
                  </button>
                  {preview ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                      {preview}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </main>
      ) : null}
    </div>
  )
}
