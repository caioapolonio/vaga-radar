'use server'

import { revalidatePath } from 'next/cache'
import { explainAiError, testAi } from '@/lib/ai'
import { isAiProvider, providerInfo, type AiProvider } from '@/lib/ai-fields'
import { readAppConfig, updateAppConfig } from '@/lib/config'
import {
  guessImapHost,
  isEmailTransport,
  type EmailTransport,
  type ImapServer,
  type SmtpServer,
} from '@/lib/config-fields'
import { formatUsd } from '@/lib/format'
import { apifyClient, apifyCredit } from '@/lib/linkedin'
import { sendMail } from '@/lib/mail'
import { writeSettings } from '@/lib/settings'
import { parseSettings, type Settings } from '@/lib/settings-fields'

export type ActionResult =
  { ok: true; message?: string } | { ok: false; error: string }

const failed = (error: unknown): ActionResult => ({
  ok: false,
  error: error instanceof Error ? error.message : 'Erro desconhecido',
})

export async function saveSettings(input: Settings): Promise<ActionResult> {
  const settings = parseSettings(input)
  if (typeof settings === 'string') return { ok: false, error: settings }
  await writeSettings(settings)
  // Every page shows or uses some of these values
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveApifyToken(token: string): Promise<ActionResult> {
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, error: 'Cole o token da Apify' }
  await updateAppConfig((config) => ({ ...config, apifyToken: trimmed }))
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function testApify(): Promise<ActionResult> {
  try {
    const { usedUsd, limitUsd } = await apifyCredit(await apifyClient())
    return {
      ok: true,
      message: `Conectado. Usado este mês: ${formatUsd(usedUsd)} de ${formatUsd(limitUsd)}.`,
    }
  } catch (error) {
    return failed(error)
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validPort = (port: number) =>
  Number.isInteger(port) && port > 0 && port < 65536

export type EmailInput = {
  transport: EmailTransport
  address: string
  smtp: SmtpServer & { user: string }
  saveToSent: boolean
  imap: ImapServer
  // Empty keeps the saved one
  password: string
}

export async function saveEmailConfig(
  input: EmailInput,
): Promise<ActionResult> {
  if (!isEmailTransport(input.transport))
    return { ok: false, error: 'Escolha como enviar' }
  const address = input.address.trim()
  if (!EMAIL.test(address)) return { ok: false, error: 'E-mail inválido' }
  if (input.transport === 'smtp') {
    const { host, port } = input.smtp
    if (!host.trim()) return { ok: false, error: 'Informe o servidor SMTP' }
    if (!validPort(port)) return { ok: false, error: 'Porta SMTP inválida' }
    if (input.saveToSent && !validPort(input.imap.port))
      return { ok: false, error: 'Porta IMAP inválida' }
  }

  await updateAppConfig((config) => {
    const password = input.password.trim() || config.email?.password
    return {
      ...config,
      email: {
        transport: input.transport,
        address,
        ...(input.transport === 'smtp' && {
          smtp: {
            host: input.smtp.host.trim(),
            port: input.smtp.port,
            secure: input.smtp.secure,
            user: input.smtp.user.trim() || undefined,
          },
          saveToSent: input.saveToSent,
          imap: {
            host: input.imap.host.trim() || guessImapHost(input.smtp.host),
            port: input.imap.port,
          },
        }),
        ...(password && { password }),
      },
    }
  })
  revalidatePath('/', 'layout')
  return { ok: true }
}

// Sends a short email to your own saved address, never to anyone else
export async function sendTestEmail(): Promise<ActionResult> {
  try {
    const { email } = await readAppConfig()
    if (!email?.address)
      return { ok: false, error: 'Salve o e-mail antes de testar' }
    const copy = await sendMail({
      to: email.address,
      subject: 'Teste do Vaga Radar',
      body: 'Se este e-mail chegou, o envio do Vaga Radar está funcionando.',
    })
    if (copy === 'failed')
      return {
        ok: false,
        error: `O e-mail saiu para ${email.address}, mas a cópia em Enviados falhou: confira o servidor IMAP`,
      }
    return {
      ok: true,
      message: `E-mail de teste enviado para ${email.address}${
        copy === 'saved' ? ', com cópia em Enviados' : ''
      }`,
    }
  } catch (error) {
    return failed(error)
  }
}

export type AiInput = {
  provider: AiProvider
  // Empty keeps the saved one
  apiKey: string
  analyzeModel: string
  writeModel: string
}

export async function saveAiConfig(input: AiInput): Promise<ActionResult> {
  if (!isAiProvider(input.provider))
    return { ok: false, error: 'Escolha o provedor' }
  const { defaults } = providerInfo(input.provider)
  let missingKey = false
  await updateAppConfig((config) => {
    // A key only works with the provider it came from
    const savedKey =
      config.ai?.provider === input.provider ? config.ai.apiKey : undefined
    const apiKey = input.apiKey.trim() || savedKey
    const { envVar, kind } = providerInfo(input.provider)
    missingKey = kind === 'api' && !apiKey && !(envVar && process.env[envVar])
    return {
      ...config,
      ai: {
        provider: input.provider,
        ...(apiKey && { apiKey }),
        // Empty runs a CLI's own default model
        analyzeModel: input.analyzeModel.trim() || defaults.analyze,
        writeModel: input.writeModel.trim() || defaults.write,
      },
    }
  })
  revalidatePath('/', 'layout')
  return missingKey
    ? { ok: true, message: 'Salvo. Falta colar a chave da API.' }
    : { ok: true }
}

export async function testAiConnection(): Promise<ActionResult> {
  try {
    const models = await testAi()
    return { ok: true, message: `IA funcionando: ${models.join(' e ')}` }
  } catch (error) {
    return { ok: false, error: explainAiError(error) }
  }
}
