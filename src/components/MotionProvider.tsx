'use client'

import { MotionConfig } from 'motion/react'

// reducedMotion="user" makes Framer honor prefers-reduced-motion globally:
// transform/opacity animations are suppressed for users who request reduced motion.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
