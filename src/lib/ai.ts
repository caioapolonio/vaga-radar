import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogle } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { APICallError, generateText, Output, type LanguageModel } from 'ai'
import { z } from 'zod'
import { CliError, runCli } from './ai-cli'
import { isCliProvider, providerInfo, type AiConfig } from './ai-fields'
import { readAppConfig } from './config'

export type ModelRole = 'analyze' | 'write'

export async function readAiConfig(): Promise<AiConfig> {
  const { ai } = await readAppConfig()
  if (!ai || (!isCliProvider(ai.provider) && !ai.apiKey))
    throw new Error('Configure a IA em Ajustes > Conexões')
  return ai
}

// The model name as set on /ajustes; empty runs a CLI's own default
export const modelFor = (ai: AiConfig, role: ModelRole) =>
  (role === 'analyze' ? ai.analyzeModel : ai.writeModel) ||
  providerInfo(ai.provider).defaults[role]

// "Claude Code · haiku", "claude-haiku-4-5"
export function modelLabel(ai: AiConfig, role: ModelRole) {
  const model = modelFor(ai, role)
  if (!isCliProvider(ai.provider)) return model
  const name = providerInfo(ai.provider).label.replace(/ \(.*\)$/, '')
  return model ? `${name} · ${model}` : name
}

function languageModel(ai: AiConfig, role: ModelRole): LanguageModel {
  const model = modelFor(ai, role)
  const { apiKey } = ai
  if (ai.provider === 'anthropic') return createAnthropic({ apiKey })(model)
  if (ai.provider === 'openai') return createOpenAI({ apiKey })(model)
  return createGoogle({ apiKey })(model)
}

// Structured output for the CLIs: every object closed and every key
// required, as Codex (like OpenAI's API) demands
function strictJsonSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema) as Record<string, unknown>
  delete json.$schema
  const close = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const object = node as Record<string, unknown>
    if (object.type === 'object' && object.properties) {
      object.additionalProperties = false
      object.required = Object.keys(object.properties)
    }
    Object.values(object).forEach(close)
  }
  close(json)
  return json
}

type Call = {
  ai: AiConfig
  role: ModelRole
  instructions: string
  prompt: string
  signal?: AbortSignal
}

export type Usage = { inputTokens: number; outputTokens: number }

export async function generateStructured<T extends z.ZodType>(
  call: Call & { schema: T },
): Promise<{ output: z.infer<T>; usage: Usage }> {
  const { ai, role, instructions, prompt, signal, schema } = call
  if (isCliProvider(ai.provider)) {
    const answer = await runCli({
      provider: ai.provider,
      model: modelFor(ai, role),
      role,
      instructions,
      prompt,
      schema: strictJsonSchema(schema),
      signal,
    })
    const parsed = schema.safeParse(answer.output)
    if (!parsed.success)
      throw new CliError('A resposta do CLI não veio no formato pedido')
    const { inputTokens, outputTokens } = answer
    return { output: parsed.data, usage: { inputTokens, outputTokens } }
  }
  const { output, usage } = await generateText({
    model: languageModel(ai, role),
    instructions,
    prompt,
    output: Output.object({ schema }),
    abortSignal: signal,
  })
  return {
    output: output as z.infer<T>,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
  }
}

export async function generatePlain(call: Call) {
  const { ai, role, instructions, prompt, signal } = call
  if (isCliProvider(ai.provider)) {
    const answer = await runCli({
      provider: ai.provider,
      model: modelFor(ai, role),
      role,
      instructions,
      prompt,
      signal,
    })
    return String(answer.output)
  }
  const { text } = await generateText({
    model: languageModel(ai, role),
    instructions,
    prompt,
    abortSignal: signal,
  })
  return text
}

// Errors that will fail every other call too: stop the whole run
export const isFatalAiError = (error: unknown) =>
  (error instanceof CliError && error.fatal) ||
  (APICallError.isInstance(error) &&
    [400, 401, 403, 404].includes(error.statusCode ?? 0))

// A message people can act on, instead of the provider's raw error
export function explainAiError(error: unknown) {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403)
      return 'A chave da IA foi recusada: confira em Ajustes > Conexões'
    if (error.statusCode === 404)
      return 'Modelo não encontrado: confira o nome em Ajustes > Conexões'
    if (error.statusCode === 429)
      return 'Limite de uso da IA atingido: espere um pouco ou confira o saldo da conta'
    if (
      error.statusCode === 400 &&
      /credit|billing|balance/i.test(error.message)
    )
      return 'Sem crédito na conta da IA'
  }
  return error instanceof Error ? error.message : 'Erro desconhecido na IA'
}

// One tiny call per model, to check the key (or the CLI login) and the names
export async function testAi() {
  const ai = await readAiConfig()
  const tested = new Set<string>()
  for (const role of ['analyze', 'write'] as const) {
    const label = modelLabel(ai, role)
    if (tested.has(label)) continue
    tested.add(label)
    await generatePlain({
      ai,
      role,
      instructions: 'Responda só com a palavra ok.',
      prompt: 'Teste de conexão.',
    })
  }
  return [...tested]
}
