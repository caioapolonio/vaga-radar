'use client'

import { ExternalLinkIcon, PlugZapIcon, SaveIcon, SendIcon } from 'lucide-react'
import { useState } from 'react'
import {
  saveAiConfig,
  saveApifyToken,
  saveEmailConfig,
  sendTestEmail,
  testAiConnection,
  testApify,
} from '@/app/ajustes/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AI_PROVIDERS,
  isCliProvider,
  MODEL_PRICES,
  providerInfo,
  type AiProvider,
  type CliStatus,
} from '@/lib/ai-fields'
import {
  EMAIL_TRANSPORTS,
  guessImapHost,
  type EmailTransport,
  type PublicConfig,
} from '@/lib/config-fields'
import { useAction } from './use-action'

const CARD = 'rounded-xl border bg-card p-4 shadow-xs'
const LABEL = 'flex flex-col gap-1.5 text-sm font-medium'
const HINT = 'text-xs font-normal text-muted-foreground'
const LINK = 'inline-flex items-center gap-1 underline underline-offset-4'

export function ConnectionsForm({
  config,
  clis,
}: {
  config: PublicConfig
  clis: Partial<Record<AiProvider, CliStatus>>
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <ApifySection apify={config.apify} />
      <AiSection ai={config.ai} clis={clis} />
      <EmailSection email={config.email} />
    </div>
  )
}

function ApifySection({ apify }: { apify: PublicConfig['apify'] }) {
  const [token, setToken] = useState('')
  const [saving, runSave] = useAction()
  const [testing, runTest] = useAction()

  return (
    <section className={CARD}>
      <h3 className="text-sm font-semibold">Apify</h3>
      <p className={HINT}>
        É quem busca os posts no LinkedIn, na sua conta. O plano grátis dá
        alguns dólares de crédito por mês; cada post custa ~US$ 0,002. Copie o
        token em{' '}
        <a
          href="https://console.apify.com/settings/integrations"
          target="_blank"
          rel="noreferrer"
          className={LINK}
        >
          Settings › API &amp; Integrations
          <ExternalLinkIcon className="size-3" />
        </a>
        .
      </p>
      <p className="mt-3 text-sm">
        {apify.configured
          ? `Token configurado (${apify.hint})${apify.fromEnv ? ' pelo .env.local, que tem prioridade' : ''}.`
          : 'Nenhum token ainda.'}
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          runSave(() => saveApifyToken(token), {
            success: 'Token salvo',
            onDone: () => setToken(''),
          })
        }}
      >
        <Input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={apify.configured ? 'Trocar o token' : 'apify_api_…'}
          aria-label="Token da Apify"
          autoComplete="off"
          className="bg-background"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !token.trim()}>
            <SaveIcon data-icon="inline-start" />
            Salvar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={testing || !apify.configured}
            onClick={() => runTest(testApify)}
          >
            <PlugZapIcon data-icon="inline-start" />
            {testing ? 'Testando…' : 'Testar'}
          </Button>
        </div>
      </form>
    </section>
  )
}

// "claude-haiku-4-5 (US$ 1 / 5 por milhão de tokens)"
const withPrice = (model: string) => {
  const price = MODEL_PRICES[model]
  return price
    ? `${model} (US$ ${price[0]} / ${price[1]} por milhão de tokens de entrada / saída)`
    : model
}

function AiSection({
  ai,
  clis,
}: {
  ai: PublicConfig['ai']
  clis: Partial<Record<AiProvider, CliStatus>>
}) {
  const [provider, setProvider] = useState<AiProvider>(
    ai?.provider ?? 'anthropic',
  )
  const info = providerInfo(provider)
  const isCli = info.kind === 'cli'
  const cli = clis[provider]
  const sameProvider = ai?.provider === provider
  const [apiKey, setApiKey] = useState('')
  const [analyzeModel, setAnalyzeModel] = useState(
    sameProvider ? ai.analyzeModel : info.defaults.analyze,
  )
  const [writeModel, setWriteModel] = useState(
    sameProvider ? ai.writeModel : info.defaults.write,
  )
  const [saving, runSave] = useAction()
  const [testing, runTest] = useAction()

  const choose = (value: AiProvider) => {
    setProvider(value)
    const defaults = providerInfo(value).defaults
    const saved = ai?.provider === value ? ai : null
    setAnalyzeModel(saved?.analyzeModel ?? defaults.analyze)
    setWriteModel(saved?.writeModel ?? defaults.write)
  }

  const options = (kind: 'api' | 'cli') =>
    AI_PROVIDERS.filter((option) => option.kind === kind).map(
      ({ value, label }) => (
        <option key={value} value={value}>
          {label}
          {kind === 'cli' && !clis[value]?.installed ? ' (não instalado)' : ''}
        </option>
      ),
    )

  return (
    <section className={CARD}>
      <h3 className="text-sm font-semibold">IA</h3>
      <p className={HINT}>
        Lê os posts para a página Para você e escreve os e-mails de candidatura.
        Use uma chave de API (paga por uso) ou a assinatura de um CLI já
        instalado e logado neste computador (Claude Code, Codex ou Gemini CLI).
      </p>

      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          runSave(
            () => saveAiConfig({ provider, apiKey, analyzeModel, writeModel }),
            { success: 'IA salva', onDone: () => setApiKey('') },
          )
        }}
      >
        <label className={LABEL}>
          Provedor
          <select
            value={provider}
            onChange={(event) => choose(event.target.value as AiProvider)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <optgroup label="Com chave de API">{options('api')}</optgroup>
            <optgroup label="Com a sua assinatura (CLI)">
              {options('cli')}
            </optgroup>
          </select>
        </label>

        {isCli ? (
          <div className={LABEL}>
            Situação do CLI
            <p
              className={
                cli?.installed && cli.loggedIn !== false
                  ? 'text-sm font-normal'
                  : 'text-sm font-normal text-destructive'
              }
            >
              {!cli?.installed
                ? `${info.command} não encontrado neste computador.`
                : cli.loggedIn === false
                  ? `${info.command} instalado, mas sem login.`
                  : `${cli.version}${cli.detail ? ` · ${cli.detail}` : ''}`}
            </p>
            <span className={HINT}>
              {!cli?.installed ? (
                <>
                  Instale pelo{' '}
                  <a
                    href={info.installUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={LINK}
                  >
                    guia oficial
                    <ExternalLinkIcon className="size-3" />
                  </a>{' '}
                  e recarregue esta página.
                </>
              ) : cli.loggedIn === false ? (
                `${info.loginHint} e recarregue esta página.`
              ) : (
                'Usa a cota da sua assinatura. O CLI roda sem ferramentas: só lê os posts e responde.'
              )}
            </span>
          </div>
        ) : (
          <label className={LABEL}>
            Chave da API
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                sameProvider && ai.hasKey
                  ? `Salva (${ai.hint}). Digite para trocar`
                  : info.keyPlaceholder
              }
              autoComplete="off"
              className="bg-background"
            />
            <span className={HINT}>
              {sameProvider && ai.fromEnv
                ? `Vem de ${info.envVar} no .env.local, que tem prioridade. `
                : ''}
              Crie em{' '}
              <a
                href={info.keyUrl}
                target="_blank"
                rel="noreferrer"
                className={LINK}
              >
                {new URL(info.keyUrl!).hostname}
                <ExternalLinkIcon className="size-3" />
              </a>
              .
            </span>
          </label>
        )}

        <label className={LABEL}>
          Modelo para analisar os posts
          <Input
            value={analyzeModel}
            onChange={(event) => setAnalyzeModel(event.target.value)}
            list={`models-${provider}`}
            placeholder={isCli ? 'Padrão do CLI' : undefined}
            className="bg-background font-mono text-xs"
          />
          <span className={HINT}>
            Lê muitos posts: um modelo rápido e barato basta.
          </span>
        </label>
        <label className={LABEL}>
          Modelo para escrever os e-mails
          <Input
            value={writeModel}
            onChange={(event) => setWriteModel(event.target.value)}
            list={`models-${provider}`}
            placeholder={isCli ? 'Padrão do CLI' : undefined}
            className="bg-background font-mono text-xs"
          />
          <span className={HINT}>Poucos e-mails: vale um modelo melhor.</span>
        </label>
        <datalist id={`models-${provider}`}>
          {info.suggestions.map((model) => (
            <option key={model} value={model}>
              {withPrice(model)}
            </option>
          ))}
        </datalist>
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            disabled={
              testing || !ai || (!ai.hasKey && !isCliProvider(ai.provider))
            }
            title="Faz uma chamada curta com cada modelo salvo"
            onClick={() => runTest(testAiConnection)}
          >
            <PlugZapIcon data-icon="inline-start" />
            {testing ? 'Testando…' : 'Testar'}
          </Button>
          <Button type="submit" disabled={saving || (isCli && !cli?.installed)}>
            <SaveIcon data-icon="inline-start" />
            Salvar
          </Button>
        </div>
      </form>
    </section>
  )
}

function EmailSection({ email }: { email: PublicConfig['email'] }) {
  const [transport, setTransport] = useState<EmailTransport>(
    email?.transport ?? 'gmail',
  )
  const [address, setAddress] = useState(email?.address ?? '')
  const [password, setPassword] = useState('')
  const [host, setHost] = useState(email?.smtp?.host ?? '')
  const [port, setPort] = useState(email?.smtp?.port ?? 465)
  const [secure, setSecure] = useState(email?.smtp?.secure ?? true)
  const [user, setUser] = useState(email?.smtp?.user ?? '')
  const [saveToSent, setSaveToSent] = useState(email?.saveToSent ?? true)
  const [imapHost, setImapHost] = useState(email?.imap?.host ?? '')
  const [imapPort, setImapPort] = useState(email?.imap?.port ?? 993)
  const [saving, runSave] = useAction()
  const [testing, runTest] = useAction()

  return (
    <section className={CARD}>
      <h3 className="text-sm font-semibold">E-mail</h3>
      <p className={HINT}>
        A conta que envia as candidaturas. Nada é enviado sem você clicar em
        Enviar no card.
      </p>

      <fieldset className="mt-3 flex flex-col gap-2">
        <legend className="sr-only">Como enviar</legend>
        {EMAIL_TRANSPORTS.map(({ value, label, hint }) => (
          <label key={value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="transport"
              value={value}
              checked={transport === value}
              onChange={() => setTransport(value)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              {label}
              <span className={`block ${HINT}`}>{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          runSave(
            () =>
              saveEmailConfig({
                transport,
                address,
                password,
                smtp: { host, port, secure, user },
                saveToSent,
                imap: { host: imapHost, port: imapPort },
              }),
            { success: 'E-mail salvo', onDone: () => setPassword('') },
          )
        }}
      >
        <label className={LABEL}>
          Seu e-mail
          <Input
            type="email"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="voce@gmail.com"
            className="bg-background"
          />
        </label>
        <label className={LABEL}>
          {transport === 'gmail' ? 'Senha de app' : 'Senha'}
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={
              email?.hasPassword ? 'Salva. Digite para trocar' : '••••'
            }
            autoComplete="off"
            className="bg-background"
          />
          {transport === 'gmail' && (
            <span className={HINT}>
              Gere em{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className={LINK}
              >
                myaccount.google.com/apppasswords
                <ExternalLinkIcon className="size-3" />
              </a>
              . Não é a senha normal do Gmail. Contas do Google Workspace podem
              não permitir.
            </span>
          )}
        </label>
        {transport === 'smtp' && (
          <>
            <label className={LABEL}>
              Servidor SMTP
              <Input
                value={host}
                onChange={(event) => setHost(event.target.value)}
                placeholder="smtp.seuprovedor.com"
                className="bg-background"
              />
            </label>
            <div className="grid grid-cols-[6rem_1fr] gap-3">
              <label className={LABEL}>
                Porta
                <Input
                  type="number"
                  value={port}
                  onChange={(event) => setPort(event.target.valueAsNumber)}
                  className="bg-background"
                />
              </label>
              <label className={LABEL}>
                Usuário
                <Input
                  value={user}
                  onChange={(event) => setUser(event.target.value)}
                  placeholder="Igual ao e-mail, se vazio"
                  className="bg-background"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={secure}
                onChange={(event) => setSecure(event.target.checked)}
                className="size-4 accent-primary"
              />
              Conexão segura (SSL/TLS), normal na porta 465. Desmarque para a
              porta 587.
            </label>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={saveToSent}
                onChange={(event) => setSaveToSent(event.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Salvar uma cópia na pasta Enviados
                <span className={`block ${HINT}`}>
                  O SMTP só entrega o e-mail. A cópia vai pelo IMAP, como num
                  app de e-mail, com o mesmo usuário e senha.
                </span>
              </span>
            </label>
            {saveToSent && (
              <div className="grid grid-cols-[1fr_6rem] gap-3 sm:col-span-2">
                <label className={LABEL}>
                  Servidor IMAP
                  <Input
                    value={imapHost}
                    onChange={(event) => setImapHost(event.target.value)}
                    placeholder={guessImapHost(host) || 'imap.seuprovedor.com'}
                    className="bg-background"
                  />
                </label>
                <label className={LABEL}>
                  Porta
                  <Input
                    type="number"
                    value={imapPort}
                    onChange={(event) =>
                      setImapPort(event.target.valueAsNumber)
                    }
                    className="bg-background"
                  />
                </label>
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            disabled={testing || !email?.address}
            title={
              email?.address
                ? `Envia um e-mail curto para ${email.address}`
                : 'Salve antes de testar'
            }
            onClick={() => runTest(sendTestEmail)}
          >
            <SendIcon data-icon="inline-start" />
            {testing ? 'Enviando…' : 'Enviar teste para mim'}
          </Button>
          <Button type="submit" disabled={saving || !address.trim()}>
            <SaveIcon data-icon="inline-start" />
            Salvar
          </Button>
        </div>
      </form>
    </section>
  )
}
