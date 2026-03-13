'use client'

import { useEffect, useState } from 'react'
import type { RazorpayOrderOptions } from 'razorpay'
import { getSessionSafe, supabase } from '../../lib/supabaseClient'
import Navbar from '@/components/Navbar'
import { ensureUserProfile, formatSupabaseError } from '@/lib/userProfile'

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOrderOptions) => { open: () => void }
  }
}

export default function PricingPage() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [credits, setCredits] = useState(0)
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getSessionSafe()
        if (session?.user) {
          setUser({ name: session.user.user_metadata?.name ?? session.user.email ?? '', email: session.user.email ?? '' })
          setSupabaseUserId(session.user.id)
          const profile = await ensureUserProfile(session.user)
          setCredits(profile.credits)
        }
      } catch (error) {
        console.error('Pricing auth init failed:', formatSupabaseError(error))
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          setUser({ name: session.user.user_metadata?.name ?? session.user.email ?? '', email: session.user.email ?? '' })
          setSupabaseUserId(session.user.id)
          const profile = await ensureUserProfile(session.user)
          setCredits(profile.credits)
        } else {
          setUser(null)
          setCredits(0)
          setSupabaseUserId(null)
        }
      } catch (error) {
        console.error('Pricing auth listener failed:', formatSupabaseError(error))
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }

  const buyCredits = async (count: number, amount: number) => {
    if (!user) {
      await signIn()
      return
    }

    const orderResp = await fetch('/api/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount * 100 }),
    })

    const order = await orderResp.json()

    const options: RazorpayOrderOptions = {
      key: order.key_id ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: 'Crossdata',
      description: `${count} credits`,
      handler: async (resp) => {
        const verifyResp = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resp),
        })

        if (verifyResp.ok && supabaseUserId) {
          const next = credits + count
          setCredits(next)
          await supabase.from('users').update({ credits: next }).eq('id', supabaseUserId)
        }
      },
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)

    script.onload = () => {
      if (!window.Razorpay) return
      const rzp = new window.Razorpay(options)
      rzp.open()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans">

      {/* Navbar Section */}
      <Navbar />

      <div className="mx-auto max-w-4xl space-y-12 px-6 py-24 w-full">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Pricing & Credits</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Purchase credits directly to run your data pipelines. 1 credit covers roughly 1,000 translated characters.
          </p>
        </div>

        <div className="space-y-8">
          {user ? (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account Active</p>
                <p className="text-lg font-semibold mt-1">{user.name}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Balance</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{credits} <span className="text-base font-medium text-slate-600 dark:text-slate-300">Credits</span></p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                ₹3 per 1000 character processed.
              </p>
            </div>
          )}

          <div>
            <h3 className="text-xl font-semibold mb-6">Select a Credit Package</h3>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { c: 350, p: 1000, label: "~350,000 chars" },
                { c: 2000, p: 5000, label: "~2M chars" },
                { c: 5000, p: 10000, label: "~5M chars" }
              ].map((o) => (
                <div
                  key={o.c}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{o.c} <span className="text-sm font-medium text-slate-500">Credits</span></p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{o.label}</p>
                  </div>

                  <div className="mt-8">
                    <p className="text-lg font-semibold mb-3">₹{o.p}</p>
                    <button
                      className="w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                      onClick={() => buyCredits(o.c, o.p)}
                    >
                      {user ? 'Checkout' : 'Sign in to Checkout'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-8">
            Payment processing secured by Razorpay. Credits will be applied to your account instantly upon successful payment.
          </p>
        </div>
      </div>
    </div>
  )
}
