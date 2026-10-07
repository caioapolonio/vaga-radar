import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { readAppConfig } from './config'
import { GMAIL_SMTP, guessImapHost, type EmailConfig } from './config-fields'
import { readProfile } from './profile'

type Message = {
  to: string
  subject: string
  body: string
  // Absolute path of the PDF to attach, read from disk by this server
  attachment?: string
}

// Whether the copy in the Sent folder worked; the email went out either way
export type SentCopy = 'saved' | 'automatic' | 'off' | 'failed'

// Folder names when the server doesn't flag its Sent folder
const SENT_NAMES =
  /^(inbox[./])?(sent|sent items|sent messages|sent mail|enviados|itens enviados|mensagens enviadas)$/i

// Files the exact message that was sent, as a mail app would
async function saveToSent(
  email: EmailConfig,
  auth: { user: string; pass: string },
  raw: Buffer,
) {
  const smtpHost = email.smtp?.host ?? ''
  const client = new ImapFlow({
    host: email.imap?.host || guessImapHost(smtpHost),
    port: email.imap?.port ?? 993,
    secure: true,
    auth,
    logger: false,
  })
  await client.connect()
  try {
    const folders = await client.list()
    const sent =
      folders.find((folder) => folder.specialUse === '\\Sent') ??
      folders.find((folder) => SENT_NAMES.test(folder.path))
    if (!sent) throw new Error('Pasta Enviados não encontrada no servidor')
    await client.append(sent.path, raw, ['\\Seen'])
  } finally {
    await client.logout().catch(() => {})
  }
}

export async function sendMail(message: Message): Promise<SentCopy> {
  const [{ email }, { name }] = await Promise.all([
    readAppConfig(),
    readProfile(),
  ])
  if (!email?.address)
    throw new Error('Configure o envio de e-mails em Ajustes > Conexões')
  if (!email.password)
    throw new Error('Configure a senha do e-mail em Ajustes > Conexões')
  const server = email.transport === 'gmail' ? GMAIL_SMTP : email.smtp
  if (!server?.host) throw new Error('Configure o servidor SMTP em Ajustes')

  const auth = { user: email.smtp?.user || email.address, pass: email.password }
  const cleanName = name.replace(/["<>]/g, '').trim()
  const { to, subject, body, attachment } = message

  // Built once, so the copy in Sent is byte for byte what was delivered
  const composer = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  })
  const { message: raw } = await composer.sendMail({
    // Quotes keep a comma in the name from splitting the address
    from: cleanName ? `"${cleanName}" <${email.address}>` : email.address,
    to,
    subject,
    text: body,
    attachments: attachment ? [{ path: attachment }] : [],
  })

  await nodemailer
    .createTransport({ ...server, auth })
    .sendMail({ envelope: { from: email.address, to: [to] }, raw })

  if (email.transport === 'gmail') return 'automatic'
  if (email.saveToSent === false) return 'off'
  try {
    await saveToSent(email, auth, raw as Buffer)
    return 'saved'
  } catch (error) {
    console.error('Não salvou a cópia em Enviados:', error)
    return 'failed'
  }
}
