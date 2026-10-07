import type { NextRequest } from 'next/server'
import { explainAiError } from '@/lib/ai'
import {
  analysisEstimate,
  cancelAnalysis,
  isAnalysisKind,
  jobState,
  startAnalysis,
} from '@/lib/analysis/jobs'
import { analysisOverview } from '@/lib/analysis/overview'

const kindOf = (request: NextRequest) => {
  const kind = request.nextUrl.searchParams.get('kind')
  return isAnalysisKind(kind) ? kind : null
}

const invalid = () =>
  Response.json({ error: 'Análise inválida' }, { status: 400 })

// The running job (polled by the page) and what a new run would cost
export async function GET(request: NextRequest) {
  const kind = kindOf(request)
  if (!kind) return invalid()
  return Response.json(await analysisOverview(kind))
}

// A route handler, not a Server Action: a run takes minutes and Server
// Actions run one at a time per page
export async function POST(request: NextRequest) {
  const kind = kindOf(request)
  if (!kind) return invalid()
  try {
    const { pending } = await analysisEstimate(kind)
    if (!pending)
      return Response.json(
        { error: 'Nenhum post esperando análise' },
        { status: 400 },
      )
    return Response.json({ job: await startAnalysis(kind) })
  } catch (error) {
    return Response.json({ error: explainAiError(error) }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const kind = kindOf(request)
  if (!kind) return invalid()
  cancelAnalysis(kind)
  return Response.json({ job: jobState(kind) })
}
