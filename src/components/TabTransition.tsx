'use client'

import { motion, useReducedMotion } from 'motion/react'
import { usePathname } from 'next/navigation'

// Enter-fade per tab (keyed by pathname). Not AnimatePresence exit-fade — that
// fights RSC children. Disabled under reduced motion.
export function TabTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reduce = useReducedMotion()

  if (reduce) return <>{children}</>

  return (
    <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      {children}
    </motion.div>
  )
}
