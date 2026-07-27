export type Theme = 'light' | 'dark'

const THEME_KEY = 'theme'

function getStoredTheme(): Theme | null {
  const t = localStorage.getItem(THEME_KEY)
  return t === 'dark' || t === 'light' ? t : null
}

export function getPreferredTheme(): Theme {
  return getStoredTheme() ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function persistTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

/** Call once, as early as possible, to avoid a flash of the wrong theme on load. */
export function initTheme() {
  applyTheme(getPreferredTheme())
}
