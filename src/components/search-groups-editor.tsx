'use client'

import {
  ArrowDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import {
  createGroup,
  deleteGroup,
  deleteSearch,
  importGroups,
  moveGroup,
  saveSearch,
  updateGroup,
} from '@/app/buscas/actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  MAX_OPERATORS,
  operatorCount,
  queryProblem,
  type Search,
  type SearchGroup,
} from '@/lib/search-config'
import { cn } from '@/lib/utils'
import { useAction } from './use-action'

const EXAMPLE = '("react" OR "next.js") AND ("remoto") AND ("vaga")'

export function SearchGroupsEditor({
  groups,
  postCounts,
}: {
  groups: SearchGroup[]
  // Search id -> posts it has found
  postCounts: Record<string, number>
}) {
  const [name, setName] = useState('')
  const [pending, run] = useAction()
  const fileRef = useRef<HTMLInputElement>(null)

  const create = () =>
    run(() => createGroup(name), {
      success: `Grupo "${name.trim()}" criado`,
      onDone: () => setName(''),
    })

  const importFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    run(() => importGroups(text))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon data-icon="inline-start" />
          Importar buscas
        </Button>
        {groups.length > 0 && (
          <a
            href="/api/searches"
            download
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <DownloadIcon data-icon="inline-start" />
            Exportar buscas
          </a>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          create()
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome do grupo, ex.: Remoto Brasil"
          aria-label="Nome do novo grupo"
          maxLength={40}
          className="bg-background"
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          <PlusIcon data-icon="inline-start" />
          Criar grupo
        </Button>
      </form>

      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhum grupo ainda. Cada grupo vira uma aba na página Vagas, com as
          buscas que você colocar nele.
        </p>
      )}

      {groups.map((group, index) => (
        <GroupCard
          // Resets the name field after it's saved elsewhere
          key={`${group.id}:${group.name}:${group.recentOnly}`}
          group={group}
          postCounts={postCounts}
          isFirst={index === 0}
          isLast={index === groups.length - 1}
        />
      ))}
    </div>
  )
}

function GroupCard({
  group,
  postCounts,
  isFirst,
  isLast,
}: {
  group: SearchGroup
  postCounts: Record<string, number>
  isFirst: boolean
  isLast: boolean
}) {
  const [name, setName] = useState(group.name)
  const [recentOnly, setRecentOnly] = useState(group.recentOnly)
  const [adding, setAdding] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, run] = useAction()
  const changed = name !== group.name || recentOnly !== group.recentOnly

  return (
    <section
      id={group.id}
      className="scroll-mt-6 rounded-xl border bg-card p-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Nome do grupo"
          maxLength={40}
          className="h-9 max-w-xs bg-background font-semibold"
        />
        {changed && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => updateGroup(group.id, { name, recentOnly }), {
                success: 'Grupo salvo',
              })
            }
          >
            Salvar
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mover para cima"
            disabled={pending || isFirst}
            onClick={() => run(() => moveGroup(group.id, -1))}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mover para baixo"
            disabled={pending || isLast}
            onClick={() => run(() => moveGroup(group.id, 1))}
          >
            <ArrowDownIcon />
          </Button>
          {confirmingDelete ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => deleteGroup(group.id), {
                    success: `Grupo "${group.name}" excluído`,
                  })
                }
              >
                Excluir grupo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Excluir grupo"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      </div>
      {confirmingDelete && (
        <p className="mt-2 text-xs text-muted-foreground">
          As buscas do grupo somem. Os posts já encontrados continuam em “Com
          e-mail” e “Para você”.
        </p>
      )}

      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={recentOnly}
          onChange={(event) => setRecentOnly(event.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          Só posts recentes
          <span className="block text-xs text-muted-foreground">
            Na primeira pesquisa, vai menos dias para trás (o limite curto de
            Ajustes). Bom para posts que pedem currículo por e-mail, que
            envelhecem rápido.
          </span>
        </span>
      </label>

      <ul className="mt-4 flex flex-col divide-y border-y">
        {group.searches.map((search) => (
          <SearchRow
            key={search.id}
            groupId={group.id}
            search={search}
            posts={postCounts[search.id] ?? 0}
          />
        ))}
        {!group.searches.length && !adding && (
          <li className="py-3 text-sm text-muted-foreground">
            Nenhuma busca neste grupo.
          </li>
        )}
      </ul>

      {adding ? (
        <SearchForm
          groupId={group.id}
          onClose={() => setAdding(false)}
          className="mt-3"
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setAdding(true)}
        >
          <PlusIcon data-icon="inline-start" />
          Adicionar busca
        </Button>
      )}
    </section>
  )
}

function SearchRow({
  groupId,
  search,
  posts,
}: {
  groupId: string
  search: Search
  posts: number
}) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, run] = useAction()

  if (editing)
    return (
      <li className="py-3">
        <SearchForm
          groupId={groupId}
          search={search}
          onClose={() => setEditing(false)}
        />
      </li>
    )

  return (
    <li className="flex items-start gap-3 py-3">
      <input
        type="checkbox"
        checked={search.enabled}
        disabled={pending}
        aria-label={search.enabled ? 'Desligar busca' : 'Ligar busca'}
        title={
          search.enabled
            ? 'Ligada: roda no Re-pesquisar'
            : 'Desligada: não roda, mas os posts dela continuam'
        }
        onChange={(event) =>
          run(() =>
            saveSearch(groupId, { ...search, enabled: event.target.checked }),
          )
        }
        className="mt-1 size-4 shrink-0 accent-primary"
      />
      <div className={cn('min-w-0 flex-1', !search.enabled && 'opacity-60')}>
        <p className="text-sm font-medium">
          {search.label}
          <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
            {posts} {posts === 1 ? 'post' : 'posts'}
          </span>
        </p>
        <code className="mt-0.5 block font-mono text-xs break-words text-muted-foreground">
          {search.query}
        </code>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {confirmingDelete ? (
          <>
            <Button
              variant="destructive"
              size="xs"
              disabled={pending}
              onClick={() =>
                run(() => deleteSearch(groupId, search.id), {
                  success: `Busca "${search.label}" excluída`,
                })
              }
            >
              Excluir
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Editar busca"
              onClick={() => setEditing(true)}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Excluir busca"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2Icon />
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

function SearchForm({
  groupId,
  search,
  onClose,
  className,
}: {
  groupId: string
  // Missing when adding a new one
  search?: Search
  onClose: () => void
  className?: string
}) {
  const [label, setLabel] = useState(search?.label ?? '')
  const [query, setQuery] = useState(search?.query ?? '')
  const [pending, run] = useAction()
  const operators = operatorCount(query)
  // Only complain once there's something typed
  const problem = query.trim() ? queryProblem(query) : null

  return (
    <form
      className={cn(
        'flex flex-col gap-2 rounded-lg bg-muted/50 p-3',
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault()
        run(
          () =>
            saveSearch(groupId, {
              id: search?.id,
              label,
              query,
              enabled: search?.enabled ?? true,
            }),
          {
            success: search ? 'Busca salva' : 'Busca adicionada',
            onDone: onClose,
          },
        )
      }}
    >
      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Nome da busca, ex.: React remoto"
        aria-label="Nome da busca"
        maxLength={40}
        className="bg-background"
        autoFocus
      />
      <Textarea
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={EXAMPLE}
        aria-label="Busca"
        aria-invalid={!!problem}
        className="bg-background font-mono"
        rows={2}
      />
      <p
        className={cn(
          'text-xs',
          problem ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {problem ??
          `Termos entre aspas, ligados por AND, OR e NOT em maiúsculas · ${operators} de ${MAX_OPERATORS} operadores`}
      </p>
      {search && query.trim() !== search.query && (
        <p className="text-xs text-muted-foreground">
          Mudar a busca faz a próxima pesquisa dela ir de novo até o limite de
          dias de Ajustes.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={pending || !label.trim() || !query.trim() || !!problem}
        >
          {search ? 'Salvar' : 'Adicionar'}
        </Button>
      </div>
    </form>
  )
}
