import { isCliProvider } from './ai-fields'
import { readAppConfig } from './config'
import { listCvs } from './outreach'
import { isProfileFilled, readProfile } from './profile'
import { readSearchConfig, runnableSearches } from './searches'

export type SetupStep = {
  id: string
  label: string
  href: string
  done: boolean
}

// What a fresh clone still needs before searching and sending
export async function setupSteps(): Promise<SetupStep[]> {
  const [config, profile, searches, cvs] = await Promise.all([
    readAppConfig(),
    readProfile(),
    readSearchConfig(),
    listCvs(),
  ])
  const { email } = config
  return [
    {
      id: 'searches',
      label: 'Crie um grupo com pelo menos uma busca',
      href: '/buscas',
      done: runnableSearches(searches).length > 0,
    },
    {
      id: 'apify',
      label: 'Conecte sua conta da Apify, que busca os posts no LinkedIn',
      href: '/ajustes',
      done: !!config.apifyToken,
    },
    {
      id: 'ai',
      label:
        'Conecte uma IA: chave de API ou a assinatura do Claude Code, Codex ou Gemini CLI',
      href: '/ajustes',
      done:
        !!config.ai &&
        (isCliProvider(config.ai.provider) || !!config.ai.apiKey),
    },
    {
      id: 'profile',
      label: 'Preencha seu perfil: nome e assinatura dos e-mails',
      href: '/perfil',
      done: isProfileFilled(profile),
    },
    {
      id: 'cvs',
      label: 'Adicione seu currículo em PDF',
      href: '/perfil',
      done: cvs.length > 0,
    },
    {
      id: 'email',
      label: 'Configure o envio de e-mails (Gmail ou outro)',
      href: '/ajustes',
      done: !!email?.address && !!email.password,
    },
  ]
}
