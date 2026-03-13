import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Crossdata',
  description: 'Generate curated QA datasets from documents using AI, with credits and payments.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <main>{children}</main>
      </body>
    </html>
  )
}
