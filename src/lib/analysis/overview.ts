import { modelFor, modelLabel } from '../ai'
import { costUsd, isCliProvider } from '../ai-fields'
import { readAppConfig } from '../config'
import { analysisEstimate, jobState, type AnalysisKind } from './jobs'

export type AnalysisOverview = Awaited<ReturnType<typeof analysisOverview>>

// The running job, if any, and what a new run would read and cost
export async function analysisOverview(kind: AnalysisKind) {
  const [{ ai }, estimate] = await Promise.all([
    readAppConfig(),
    analysisEstimate(kind),
  ])
  const role = kind === 'matches' ? 'analyze' : 'write'
  const subscription = !!ai && isCliProvider(ai.provider)
  const ready = !!ai && (subscription || !!ai.apiKey)
  return {
    job: jobState(kind),
    aiReady: ready,
    model: ready ? modelLabel(ai, role) : null,
    subscription,
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
