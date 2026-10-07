// Connections set up on /ajustes (client-safe: no Node imports)
import type { PublicAiConfig } from './ai-fields'

export const EMAIL_TRANSPORTS = [
  {
    value: 'gmail',
    label: 'Gmail',
    hint: 'Com uma senha de app do Google (precisa da verificação em 2 etapas ligada).',
  },
  {
    value: 'smtp',
    label: 'Outro provedor (SMTP)',
    hint: 'Hostinger, Zoho, o e-mail do seu domínio… Os dados de SMTP e IMAP ficam nas configurações do provedor.',
  },
] as const

export type EmailTransport = (typeof EMAIL_TRANSPORTS)[number]['value']

export type SmtpServer = { host: string; port: number; secure: boolean }

export type ImapServer = { host: string; port: number }

export const GMAIL_SMTP: SmtpServer = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
}

export type EmailConfig = {
  transport: EmailTransport
  // The From address, and the login for Gmail and most SMTP servers
  address: string
  smtp?: SmtpServer & { user?: string }
  // SMTP only delivers: a copy goes to the Sent folder over IMAP, as mail
  // apps do. Gmail files it by itself
  saveToSent?: boolean
  imap?: ImapServer
  password?: string
}

// imap.hostinger.com for smtp.hostinger.com, the usual pairing
export const guessImapHost = (smtpHost: string) =>
  smtpHost.trim().replace(/^smtp(-mail)?\./i, 'imap.')

// What the settings page can show: never the secrets themselves
export type PublicConfig = {
  apify: { configured: boolean; fromEnv: boolean; hint: string | null }
  ai: PublicAiConfig | null
  email: (Omit<EmailConfig, 'password'> & { hasPassword: boolean }) | null
}

export const isEmailTransport = (value: unknown): value is EmailTransport =>
  EMAIL_TRANSPORTS.some((transport) => transport.value === value)

// "…a1b2", enough to tell which key is saved
export const secretHint = (secret: string) => `…${secret.slice(-4)}`
