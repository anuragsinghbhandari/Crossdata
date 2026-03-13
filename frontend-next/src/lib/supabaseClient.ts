import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
}

let parsedUrl: URL

try {
  parsedUrl = new URL(supabaseUrl)
} catch {
  throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}"`)
}

if (!/^https?:$/.test(parsedUrl.protocol)) {
  throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL protocol: "${parsedUrl.protocol}"`)
}

export const supabase = (() => {
  try {
    return createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    throw new Error(`Failed to initialize Supabase client: ${message}`)
  }
})()

let sessionRequest: Promise<Session | null> | null = null

function isLockAbortError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.toLowerCase().includes('lock request is aborted')
}

async function readSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getSessionSafe() {
  if (!sessionRequest) {
    sessionRequest = (async () => {
      try {
        return await readSession()
      } catch (error) {
        if (!isLockAbortError(error)) {
          throw error
        }

        await Promise.resolve()
        return readSession()
      } finally {
        sessionRequest = null
      }
    })()
  }

  return sessionRequest
}
