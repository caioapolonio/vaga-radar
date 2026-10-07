'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Vagas' },
  { href: '/para-voce', label: 'Para você' },
  { href: '/emails', label: 'E-mails' },
  { href: '/buscas', label: 'Buscas' },
  { href: '/perfil', label: 'Perfil' },
  { href: '/ajustes', label: 'Ajustes' },
]

export function SiteNav() {
  const pathname = usePathname()

  return (
    <nav className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-4 pt-6 sm:pt-10">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
            pathname === href && 'bg-background text-foreground shadow-xs',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
