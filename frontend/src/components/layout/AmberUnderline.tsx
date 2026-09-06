import React, { useState } from 'react'
import { motion } from 'framer-motion'

export interface AmberUnderlineProps {
  children: React.ReactNode
  className?: string
  active?: boolean
}

/**
 * AmberUnderline Component
 * Follows DESIGN.md Section 6:
 * "Sidebar/text links: amber underline draws left-to-right on hover (~150ms), retracts on hover-out. Never color-only hover."
 * Origin fixed at left (originX: 0) ensures it draws left-to-right on expansion (0→1)
 * and retracts right-to-left on shrink (1→0) in ~150ms ease-out.
 */
export const AmberUnderline: React.FC<AmberUnderlineProps> = ({
  children,
  className = '',
  active = false,
}) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <motion.span
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: active || isHovered ? 1 : 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{ originX: 0 }}
        className="absolute -bottom-0.5 left-0 right-0 h-[1px] bg-accent-primary pointer-events-none"
      />
    </span>
  )
}

export default AmberUnderline
