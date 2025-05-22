"use client"

import dynamic from 'next/dynamic'

// Import ThemeToggle dynamically within a Client Component, disabling SSR
const ThemeToggle = dynamic(() => import('./ThemeToggle'), { ssr: false })

export default function ClientThemeToggleWrapper() {
  // Render the dynamically imported ThemeToggle
  return <ThemeToggle />
}
