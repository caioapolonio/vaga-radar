import { connection } from 'next/server'
import { ConnectionsForm } from '@/components/connections-form'
import { SettingsForm } from '@/components/settings-form'
import { cliStatus } from '@/lib/ai-cli'
import { AI_PROVIDERS } from '@/lib/ai-fields'
import { readPublicConfig } from '@/lib/config'
import { readSettings } from '@/lib/settings'

export default async function SettingsPage() {
  // Always read the saved files instead of a build-time snapshot
  await connection()
  const [settings, config, clis] = await Promise.all([
    readSettings(),
    readPublicConfig(),
    // Which agent CLIs are installed and logged in, for the AI section
    Promise.all(
      AI_PROVIDERS.filter(({ kind }) => kind === 'cli').map(
        async ({ value }) => [value, await cliStatus(value)] as const,
      ),
    ).then(Object.fromEntries),
  ])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-8 sm:pb-12">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>

      <h2 className="mt-6 text-sm font-semibold">Conexões</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Chaves e senhas ficam só nesta máquina, em data/config.json, fora do
        git.
      </p>
      {/* Keyed so a save resets the fields to what was stored */}
      <ConnectionsForm
        key={JSON.stringify(config)}
        config={config}
        clis={clis}
      />

      <h2 className="mt-10 text-sm font-semibold">Limites</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Das pesquisas na Apify e das análises de IA. Valem a partir da próxima
        pesquisa ou análise.
      </p>
      {/* Keyed so a save elsewhere (another tab) resets the form */}
      <SettingsForm key={JSON.stringify(settings)} initial={settings} />
    </main>
  )
}
