'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSessionSafe, supabase } from '@/lib/supabaseClient'
import { ensureUserProfile, formatSupabaseError } from '@/lib/userProfile'

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getSessionSafe()
        if (session?.user) {
          await ensureUserProfile(session.user)
        }
        setIsLoggedIn(Boolean(session?.user))
      } catch (error) {
        console.error('Navbar auth init failed:', formatSupabaseError(error))
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          await ensureUserProfile(session.user)
        }
        setIsLoggedIn(Boolean(session?.user))
      } catch (error) {
        console.error('Navbar auth sync failed:', formatSupabaseError(error))
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 min-h-16 py-3 flex items-center justify-between gap-4">
        <div className="font-semibold text-lg tracking-tight"><Link href="/">Crossdata</Link></div>
        <div className="flex flex-wrap justify-end gap-3 items-center text-sm font-medium">
          <Link href="/#how-it-works" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors">
            How it Works
          </Link>
          <Link href="/pricing" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors">
            Pricing
          </Link>
          <Link href="/pipeline" className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 rounded-md hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">
            App
          </Link>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              Logout
            </button>
          ) : (
            <button
              type="button"
              onClick={signIn}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
