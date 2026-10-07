const relativeTime = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const weekdayAndDate = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
})

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

export function formatRelative(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of UNITS)
    if (Math.abs(seconds) >= size)
      return relativeTime.format(Math.round(seconds / size), unit)
  return 'agora'
}

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))

export const formatUsd = (value: number) =>
  `US$ ${value.toFixed(2).replace('.', ',')}`

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

export function formatDayHeading(iso: string) {
  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000,
  )
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  return weekdayAndDate.format(new Date(iso))
}
