import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { SiteNav } from '@/components/site-nav'
import { Toaster } from '@/components/ui/sonner'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Vaga Radar',
  description:
    'Posts de vagas do LinkedIn, filtrados pelo seu perfil, e candidaturas por e-mail escritas por IA',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-background antialiased`}
    >
      <body className="flex min-h-full flex-col bg-muted/40">
        <SiteNav />
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
