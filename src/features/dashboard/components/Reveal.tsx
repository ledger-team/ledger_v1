'use client'

import { motion, useReducedMotion, type Variants } from 'motion/react'

// Staggered fade + slide-up entrance. Never gates paint: content is in the DOM;
// this only transitions it in, and under reduced motion it renders at final state.

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

export function RevealList({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  )
}
