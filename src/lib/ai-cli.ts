import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { providerInfo, type AiProvider, type CliStatus } from './ai-fields'
import type { ModelRole } from './ai'

// The agent CLIs (Claude Code, Codex, Gemini CLI) run headless with the
// subscription their user logged in with, instead of an API key. Every run
// has its tools turned off, so a post can't get the agent to touch the machine

// Where these CLIs install themselves, for servers started without them in PATH
const EXTRA_PATHS = [
  path.join(homedir(), '.local', 'bin'),
  path.join(homedir(), '.bun', 'bin'),
  path.join(homedir(), '.npm-global', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
]

const cliEnv = (provider: AiProvider) => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: [process.env.PATH, ...EXTRA_PATHS]
      .filter(Boolean)
      .join(path.delimiter),
  }
  // With a key in the environment, Claude Code bills the API instead
  if (provider === 'claude-code') delete env.ANTHROPIC_API_KEY
  return env
}

// Thrown when retrying won't help: missing CLI, logged out, usage limit
export class CliError extends Error {
  constructor(
    message: string,
    readonly fatal = false,
  ) {
    super(message)
  }
}

type RunResult = { stdout: string; stderr: string; code: number | null }

function run(
  provider: AiProvider,
  args: string[],
  {
    input = '',
    signal,
    timeoutMs = 6 * 60_000,
    cwd,
  }: { input?: string; signal?: AbortSignal; timeoutMs?: number; cwd?: string },
) {
  const command = providerInfo(provider).command!
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: cliEnv(provider),
      signal,
      timeout: timeoutMs,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (error: NodeJS.ErrnoException) =>
      reject(
        error.code === 'ENOENT'
          ? new CliError(
              `O comando ${command} não foi encontrado: instale e faça login`,
              true,
            )
          : error,
      ),
    )
    child.on('close', (code) => resolve({ stdout, stderr, code }))
    child.stdin.end(input)
  })
}

// An empty folder to run in: no project files, settings or instructions
async function emptyDir() {
  const dir = path.join(tmpdir(), 'vaga-radar-cli')
  await mkdir(dir, { recursive: true })
  return dir
}

const firstLine = (text: string) =>
  text.trim().split('\n').at(-1)?.slice(0, 300) ?? ''

export async function cliStatus(provider: AiProvider): Promise<CliStatus> {
  const version = await run(provider, ['--version'], { timeoutMs: 15_000 })
    .then(({ stdout, code }) => (code === 0 ? stdout.trim() : null))
    .catch(() => null)
  if (!version)
    return { installed: false, version: null, loggedIn: false, detail: null }

  if (provider === 'claude-code') {
    const { stdout } = await run(provider, ['auth', 'status', '--json'], {
      timeoutMs: 15_000,
    }).catch(() => ({ stdout: '' }))
    try {
      const status = JSON.parse(stdout)
      return {
        installed: true,
        version,
        loggedIn: !!status.loggedIn,
        detail:
          status.authMethod === 'claude.ai'
            ? 'assinatura claude.ai'
            : status.authMethod,
      }
    } catch {
      return { installed: true, version, loggedIn: null, detail: null }
    }
  }
  if (provider === 'codex') {
    const { stdout, stderr, code } = await run(provider, ['login', 'status'], {
      timeoutMs: 15_000,
    })
    const text = `${stdout}\n${stderr}`
    return {
      installed: true,
      version,
      loggedIn: code === 0 && /logged in/i.test(text),
      detail: /chatgpt/i.test(text) ? 'conta ChatGPT' : firstLine(text) || null,
    }
  }
  // Gemini CLI has no status command: its Google login leaves this file
  const googleLogin = await readFile(
    path.join(homedir(), '.gemini', 'oauth_creds.json'),
  ).then(
    () => true,
    () => false,
  )
  return {
    installed: true,
    version,
    loggedIn: googleLogin || !!process.env.GEMINI_API_KEY || null,
    detail: googleLogin ? 'conta Google' : null,
  }
}

// Messages from the CLIs that no retry fixes
const FATAL = [
  {
    test: /not logged in|please run \/login|invalid api key|login required|unauthorized|authenticat/i,
    message:
      'Faça login no CLI: rode o comando no terminal e entre com sua conta',
  },
  {
    test: /usage limit|rate limit|limit reached|quota|too many requests/i,
    message:
      'Você bateu o limite de uso da assinatura: tente de novo mais tarde',
  },
]

const failure = (text: string) => {
  const fatal = FATAL.find(({ test }) => test.test(text))
  return fatal
    ? new CliError(fatal.message, true)
    : new CliError(firstLine(text) || 'O CLI falhou sem dizer o motivo')
}

// Gemini wraps JSON in a code fence now and then
const parseJson = (text: string) =>
  JSON.parse(
    text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/, ''),
  )

export type CliCall = {
  provider: AiProvider
  model: string
  role: ModelRole
  instructions: string
  prompt: string
  // JSON Schema of the answer; without it the answer is plain text
  schema?: object
  signal?: AbortSignal
}

export type CliAnswer = {
  output: unknown
  inputTokens: number
  outputTokens: number
}

async function claudeCode(call: CliCall): Promise<CliAnswer> {
  const args = [
    '-p',
    '--output-format',
    'json',
    // No tools, MCP servers, user settings, hooks, skills or saved session
    '--tools',
    '',
    '--strict-mcp-config',
    '--setting-sources',
    'project',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--system-prompt',
    call.instructions,
    ...(call.schema ? ['--json-schema', JSON.stringify(call.schema)] : []),
    ...(call.model ? ['--model', call.model] : []),
  ]
  const { stdout, stderr } = await run(call.provider, args, {
    input: call.prompt,
    signal: call.signal,
    cwd: await emptyDir(),
  })
  let result
  try {
    result = JSON.parse(stdout)
  } catch {
    throw failure(`${stdout}\n${stderr}`)
  }
  if (result.is_error || result.subtype !== 'success')
    throw failure(`${result.result ?? ''} ${result.api_error_status ?? ''}`)
  const usage = result.usage ?? {}
  return {
    output: call.schema ? result.structured_output : result.result,
    inputTokens:
      (usage.input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
  }
}

// Codex's agent tools, all off: it only has to answer
const CODEX_DISABLED = [
  'shell_tool',
  'unified_exec',
  'browser_use',
  'computer_use',
  'in_app_browser',
  'apps',
  'plugins',
  'hooks',
  'multi_agent',
  'image_generation',
  'view_image',
]

async function codex(call: CliCall): Promise<CliAnswer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'vaga-radar-codex-'))
  try {
    const outFile = path.join(dir, 'answer.txt')
    const args = [
      'exec',
      '--skip-git-repo-check',
      '--ephemeral',
      '--ignore-user-config',
      '--sandbox',
      'read-only',
      '-C',
      await emptyDir(),
      '--json',
      '-o',
      outFile,
      ...CODEX_DISABLED.flatMap((feature) => ['--disable', feature]),
      '-c',
      'web_search="disabled"',
      '-c',
      `model_reasoning_effort="${call.role === 'analyze' ? 'low' : 'medium'}"`,
      ...(call.model ? ['-m', call.model] : []),
    ]
    if (call.schema) {
      const schemaFile = path.join(dir, 'schema.json')
      await writeFile(schemaFile, JSON.stringify(call.schema))
      args.push('--output-schema', schemaFile)
    }
    args.push('-')

    const { stdout, stderr, code } = await run(call.provider, args, {
      input: `${call.instructions}\n\n${call.prompt}`,
      signal: call.signal,
    })
    const events = stdout.split('\n').flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
    const errorEvent = events.find(
      (event) => event.type === 'error' || event.type === 'turn.failed',
    )
    const answer = await readFile(outFile, 'utf8').catch(() => '')
    if (code !== 0 || errorEvent || !answer.trim())
      throw failure(
        `${errorEvent?.message ?? errorEvent?.error?.message ?? ''}\n${stderr}`,
      )
    const usage =
      events.findLast((event) => event.type === 'turn.completed')?.usage ?? {}
    return {
      output: call.schema ? parseJson(answer) : answer.trim(),
      inputTokens: usage.input_tokens ?? 0,
      outputTokens:
        (usage.output_tokens ?? 0) + (usage.reasoning_output_tokens ?? 0),
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// Gemini CLI has no schema option: the schema goes in the prompt and the
// app checks the answer like any other
async function geminiCli(call: CliCall): Promise<CliAnswer> {
  const args = [
    '--output-format',
    'json',
    '--extensions',
    'none',
    ...(call.model ? ['-m', call.model] : []),
    // Headless mode; this line is appended to the text sent on stdin
    '-p',
    'Responda agora, seguindo as instruções acima.',
  ]
  const schemaNote = call.schema
    ? `\n\nResponda só com um JSON válido neste formato (JSON Schema), sem texto antes ou depois:\n${JSON.stringify(call.schema)}`
    : ''
  const { stdout, stderr } = await run(call.provider, args, {
    input: `${call.instructions}${schemaNote}\n\n${call.prompt}`,
    signal: call.signal,
    cwd: await emptyDir(),
  })
  let result
  try {
    result = JSON.parse(stdout)
  } catch {
    throw failure(`${stdout}\n${stderr}`)
  }
  if (result.error || typeof result.response !== 'string')
    throw failure(result.error?.message ?? stderr)
  const models = Object.values(result.stats?.models ?? {}) as {
    tokens?: { prompt?: number; candidates?: number }
  }[]
  return {
    output: call.schema ? parseJson(result.response) : result.response.trim(),
    inputTokens: models.reduce((sum, m) => sum + (m.tokens?.prompt ?? 0), 0),
    outputTokens: models.reduce(
      (sum, m) => sum + (m.tokens?.candidates ?? 0),
      0,
    ),
  }
}

export function runCli(call: CliCall) {
  if (call.provider === 'claude-code') return claudeCode(call)
  if (call.provider === 'codex') return codex(call)
  return geminiCli(call)
}
