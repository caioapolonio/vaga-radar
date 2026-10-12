import { modelFor, modelLabel } from '../ai'
import { costUsd, isCliProvider } from '../ai-fields'
import { readAppConfig } from '../config'
import { readSettings } from '../settings'
import { triageWindowLabel } from '../settings-fields'
import { analysisEstimate, jobState, type AnalysisKind } from './jobs'

export type AnalysisOverview = Awaited<ReturnType<typeof analysisOverview>>

// The running job, if any, and what a new run would read and cost
export async function analysisOverview(kind: AnalysisKind, reanalyze = false) {
  const [{ ai }, estimate, settings] = await Promise.all([
    readAppConfig(),
    analysisEstimate(kind, reanalyze),
    readSettings(),
  ])
  const role = kind === 'matches' ? 'analyze' : 'write'
  const subscription = !!ai && isCliProvider(ai.provider)
  const ready = !!ai && (subscription || !!ai.apiKey)
  return {
    job: jobState(kind),
    aiReady: ready,
    model: ready ? modelLabel(ai, role) : null,
    subscription,
    reanalyze,
    // "dos últimos 30 dias", the age limit from /ajustes
    window: triageWindowLabel(settings),
    ...estimate,
    costUsd:
      ready && !subscription
        ? costUsd(
            modelFor(ai, role),
            estimate.inputTokens,
            estimate.outputTokens,
          )
        : null,
  }
}
