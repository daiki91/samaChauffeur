import { useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { getUsers } from '../../lib/api'
import { connectPresenceSocket } from '../../lib/socket'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { Users } from 'lucide-react'

type AdminUser = {
  id: number
  username: string
  phone: string
  role: string
  language: string
  phone_verified: boolean
  is_online: boolean
  last_seen_at: string | null
}

type PresenceEvent = {
  type: 'presence.update'
  user_id: number
  username?: string
  phone?: string
  role?: string
  online: boolean
  last_seen_at?: string
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'jamais connecté'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

const roleLabelsFr: Record<string, string> = {
  CLIENT: 'Passager',
  CHAUFFEUR: 'Chauffeur',
  ADMIN: 'Admin',
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await getUsers()
        if (active) setUsers(res.data)
      } catch (e) {
        // ignore — table just stays empty
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const socket = await connectPresenceSocket()
      if (!socket || !active) return
      socketRef.current = socket
      socket.on('message', (data: PresenceEvent) => {
        if (data.type !== 'presence.update') return
        setUsers((prev) =>
          prev.map((u) =>
            u.id === data.user_id
              ? { ...u, is_online: data.online, last_seen_at: data.online ? u.last_seen_at : data.last_seen_at ?? new Date().toISOString() }
              : u,
          ),
        )
      })
    })()
    return () => {
      active = false
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  const onlineCount = useMemo(() => users.filter((u) => u.is_online).length, [users])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Comptes connectés</h1>
          <p className="text-stone-500 text-sm">Qui est en ligne maintenant, en temps réel.</p>
        </div>
        <Badge>
          <span className="live-dot !w-2.5 !h-2.5 mr-1.5" />
          {onlineCount} en ligne
        </Badge>
      </div>

      <Card padded={false} className="flex flex-col max-h-[60vh] overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <Users size={18} className="text-brand-600" />
          <h2 className="font-semibold text-stone-800">Utilisateurs</h2>
        </div>

        {loading ? (
          <div className="flex-1 min-h-0 overflow-y-auto py-16 grid place-items-center">
            <Spinner size={28} />
          </div>
        ) : users.length === 0 ? (
          <p className="flex-1 min-h-0 overflow-y-auto text-sm text-stone-400 py-10 text-center">Aucun utilisateur.</p>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-stone-400 border-t border-stone-100">
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Utilisateur</th>
                  <th className="px-5 py-3 font-medium">Téléphone</th>
                  <th className="px-5 py-3 font-medium">Rôle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3">
                      {u.is_online ? (
                        <span className="flex items-center gap-2 text-secondary-700 font-medium">
                          <span className="live-dot !w-2.5 !h-2.5" />
                          En ligne
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-stone-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-stone-300 border-2 border-white shadow" />
                          {timeAgo(u.last_seen_at)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-stone-800">{u.username}</td>
                    <td className="px-5 py-3 text-stone-500">{u.phone}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 text-xs font-semibold px-2.5 py-1">
                        {roleLabelsFr[u.role] || u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
