import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, tokenStore, on } from './api'
const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!tokenStore.get())
  const [notice, setNotice] = useState('')
  useEffect(() => on('expired', () => { setUser(null); setNotice('Session expired, please log in again') }), [])
  useEffect(() => {
    if (!tokenStore.get()) return
    api('/me').then(setUser).catch(() => {}).finally(() => setLoading(false))
  }, [])
  const login = useCallback(async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', json: { email, password }, auth: false })
    tokenStore.set(r.access_token); setNotice(''); setUser(await api('/me'))
  }, [])
  const register = useCallback(async (email, password) => {
    await api('/auth/register', { method: 'POST', json: { email, password }, auth: false })
    await login(email, password)
  }, [login])
  const logout = useCallback(() => { tokenStore.clear(); setUser(null); setNotice('') }, [])
  return <Ctx.Provider value={{ user, loading, notice, login, register, logout }}>{children}</Ctx.Provider>
}
