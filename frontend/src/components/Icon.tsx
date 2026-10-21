import type { ReactNode } from 'react'

/** Line icons drawn in the brand's stroke style (no fill, currentColor). */
const PATHS = {
  validate: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  withdraw: <path d="M12 15V3M7 8l5-5 5 5M5 21h14" />,
  deposit: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 0 0 4 0" />,
  undo: <path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />,
  check: <path d="M5 12l5 5L20 7" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  retry: <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  bank: <path d="M12 3l9 5H3zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" />,
  arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
}

export function Icon({ name, size = 18, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  )
}
