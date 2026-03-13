import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

export function formatSupabaseError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const value = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    const parts = [value.message, value.details, value.hint, value.code]
      .filter(Boolean)
      .join(' | ')

    if (parts) {
      return parts
    }
  }

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export async function ensureUserProfile(user: User) {
  const { data: existing, error } = await supabase
    .from('users')
    .select('id, credits')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read user profile: ${formatSupabaseError(error)}`)
  }

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? user.email ?? 'Unknown',
      avatar_url: user.user_metadata?.picture ?? null,
    }).select('credits').single()

    if (insertError) {
      const code = typeof insertError === 'object' && insertError && 'code' in insertError
        ? String(insertError.code)
        : ''

      // Multiple auth listeners can race on first login; if another insert won,
      // read the row that now exists instead of treating it as a fatal error.
      if (code === '23505') {
        const { data: duplicateExisting, error: duplicateReadError } = await supabase
          .from('users')
          .select('id, credits')
          .eq('id', user.id)
          .single()

        if (duplicateReadError) {
          throw new Error(`Failed to read user profile after duplicate insert: ${formatSupabaseError(duplicateReadError)}`)
        }

        return { credits: duplicateExisting?.credits ?? 0 }
      }

      throw new Error(`Failed to create user profile: ${formatSupabaseError(insertError)}`)
    }

    return { credits: inserted?.credits ?? 0 }
  }

  return { credits: existing.credits ?? 0 }
}
