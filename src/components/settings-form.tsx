'use client'

import { RotateCcwIcon, SaveIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { saveSettings } from '@/app/ajustes/actions'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_SETTINGS,
  SETTING_FIELDS,
  type Settings,
} from '@/lib/settings-fields'

const INPUT =
  'w-28 rounded-lg border bg-background px-3 py-2 text-sm text-foreground tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

export function SettingsForm({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial)
  // What the number input shows while "no limit" is on, to restore it after
  const [lastLimit, setLastLimit] = useState(initial.triageMaxAgeDays ?? 30)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof Settings, value: number | null) =>
    setSettings((current) => ({ ...current, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const result = await saveSettings(settings)
      if (result.ok) toast.success('Ajustes salvos')
      else toast.error('Não foi possível salvar', { description: result.error })
    } catch {
      toast.error('Não foi possível salvar', {
        description: 'Verifique se o servidor está rodando.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {SETTING_FIELDS.map(
        ({ key, label, hint, min, max, step, unit, unlimitedLabel }) => {
          const value = settings[key]
          const unlimited = value === null
          return (
            <section key={key} className="rounded-xl border bg-card p-4">
              <label className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium">{label}</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={unlimited ? lastLimit : value}
                    disabled={unlimited}
                    onChange={(event) => set(key, event.target.valueAsNumber)}
                    className={INPUT}
                  />
                  {unit}
                </span>
              </label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {hint}
              </p>
              {unlimitedLabel && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={unlimited}
                    onChange={(event) => {
                      if (event.target.checked) {
                        if (typeof value === 'number') setLastLimit(value)
                        set(key, null)
                      } else set(key, lastLimit)
                    }}
                    className="size-4 accent-primary"
                  />
                  {unlimitedLabel}
                </label>
              )}
            </section>
          )
        },
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => setSettings(DEFAULT_SETTINGS)}
          disabled={saving}
        >
          <RotateCcwIcon data-icon="inline-start" />
          Voltar ao padrão
        </Button>
        <Button onClick={save} disabled={saving}>
          <SaveIcon data-icon="inline-start" />
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
