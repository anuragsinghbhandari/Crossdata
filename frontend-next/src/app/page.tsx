'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { getSessionSafe, supabase } from '@/lib/supabaseClient'
import { ensureUserProfile, formatSupabaseError } from '@/lib/userProfile'

export default function Home() {
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    const syncCredits = async (userId?: string) => {
      if (!userId) {
        setCredits(null)
        return
      }

      const { data: existing } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single()

      setCredits(existing?.credits ?? 0)
    }

    const init = async () => {
      try {
        const session = await getSessionSafe()
        if (session?.user) {
          const profile = await ensureUserProfile(session.user)
          setCredits(profile.credits)
          return
        }
        await syncCredits(session?.user?.id)
      } catch (error) {
        console.error('Homepage credit sync failed:', formatSupabaseError(error))
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const profile = await ensureUserProfile(session.user)
          setCredits(profile.credits)
          return
        }
        await syncCredits(session?.user?.id)
      } catch (error) {
        console.error('Homepage auth listener failed:', formatSupabaseError(error))
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 md:py-32 max-w-4xl mx-auto space-y-8">
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
          Multilingual Dataset Pipeline
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
          Local language datasets are hard to find.
          <br className="hidden md:block" />
          Crossdata helps you build them from source documents.
        </h1>

        <p className="max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-400">
          The hard part is rarely the model idea. It is finding useful training data in the right language, structure, and domain. Most teams already have the knowledge, but it lives inside documents, not datasets.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Link
            href="/pipeline"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 w-full sm:w-auto"
          >
            Start Processing
          </Link>
          <a
            href="https://github.com/anuragbhandari"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 w-full sm:w-auto"
          >
            View Documentation
          </a>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Why this matters</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Good local AI products fail early when the data layer is weak.
            </h2>
            <div className="mt-6 space-y-4 text-base leading-8 text-slate-600 dark:text-slate-400">
              <p>
                If you are building search, copilots, tutoring tools, or domain assistants for regional users, you need examples that sound like the people you serve.
              </p>
              <p>
                Without a pipeline, the work becomes manual: extract text, clean it, translate it, create QA pairs, and reformat everything again. Crossdata turns that into one repeatable flow.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Common pain points</p>
            <div className="mt-6 grid gap-4">
              {[
                'Local datasets are rare or too broad for a specific use case.',
                'Source material is often in English, even when users are not.',
                'Manual translation and cleanup create inconsistent quality.',
                'Teams need structured outputs, not another pile of files.',
              ].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="bg-slate-50 dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">How Crossdata solves it</h2>
            <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-400">
              It converts existing knowledge into structured local-language training data without forcing teams to rebuild the workflow by hand.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded border border-slate-200 bg-white flex items-center justify-center font-mono text-sm font-bold text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">01</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Start with documents you already have</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-7">
                Upload PDFs, text files, or Word documents. Crossdata extracts the text into a clean, normalized stream.
              </p>
            </div>

            <div className="space-y-4">
              <div className="h-12 w-12 rounded border border-slate-200 bg-white flex items-center justify-center font-mono text-sm font-bold text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">02</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Translate and structure for local use</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-7">
                The content is translated into the target language and turned into question-answer style examples for training or evaluation.
              </p>
            </div>

            <div className="space-y-4">
              <div className="h-12 w-12 rounded border border-slate-200 bg-white flex items-center justify-center font-mono text-sm font-bold text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">03</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Export data your stack can actually use</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-7">
                Weak pairs are filtered and the final dataset is exported in formats such as JSONL, ChatML, or Alpaca.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 max-w-6xl mx-auto px-6 w-full">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">The core idea</p>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Finding local datasets is usually a conversion problem, not a search problem.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
                In many domains, the knowledge already exists in circulars, notes, manuals, and internal documents. The missing piece is turning those files into clean, consistent examples at scale.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-900/50">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Existing knowledge</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Your source material already contains the domain context.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-900/50">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Structured conversion</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Crossdata extracts, translates, and formats it into usable records.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-900/50">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Repeatable workflow</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  New corpora can be processed without rebuilding the pipeline.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Section / Pricing */}
      <section id="pricing" className="py-24 max-w-6xl mx-auto px-6 w-full text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Transparent Operational Costs</h2>
        <p className="mt-4 mb-10 text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Pay strictly for compute resources utilized. Credits are mapped precisely to the length of the string translated.
        </p>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Base Rate</p>
              <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">₹3 <span className="text-base font-normal text-slate-500">/ 1,000 chars</span></p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between md:col-span-2">
            <div>
              <p className="text-base font-medium text-slate-900 dark:text-white mb-2">Purchase Credits In-App</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Credits can be bought via secure Razorpay checkout within the standalone pricing portal. Account login is strictly required. No subscriptions.
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              View Billing Setup →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-500 font-mono">
          copyright &copy; 2026 Anurag Singh Bhandari. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
