import { setAuthToken } from './api'

export function initAuth() {
  const access = localStorage.getItem('access')
  if (access) setAuthToken(access)
}

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem('access', access)
  localStorage.setItem('refresh', refresh)
  setAuthToken(access)
}

export function logout() {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  setAuthToken(null)
}
