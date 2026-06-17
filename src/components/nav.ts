export type NavItem = { href: string; label: string }

export const NAV_ITEMS: NavItem[] = [
  { href: '/home', label: 'Home' },
  { href: '/feed', label: 'Feed' },
  { href: '/study', label: 'Study' },
  { href: '/you', label: 'You' },
]

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
