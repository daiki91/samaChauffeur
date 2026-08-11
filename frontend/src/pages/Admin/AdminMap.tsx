import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { Socket } from 'socket.io-client'
import { getUserLocations } from '../../lib/api'
import { connectPresenceSocket } from '../../lib/socket'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import { MapPinned, Car, User as UserIcon } from 'lucide-react'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

type UserLocation = {
  user_id: number
  username: string
  phone: string
  role: string
  is_online: boolean
  is_live: boolean
  latitude: number
  longitude: number
  located_at: string | null
}

type PresenceMsg =
  | { type: 'presence.update'; user_id: number; username?: string; phone?: string; role?: string; online: boolean; last_seen_at?: string }
  | { type: 'presence.location'; user_id: number; username: string; phone: string; role: string; lat: number; lng: number }

const roleLabelsFr: Record<string, string> = { CLIENT: 'Client', CHAUFFEUR: 'Chauffeur', ADMIN: 'Admin' }

function timeAgo(iso: string | null): string {
  if (!iso) return 'position inconnue'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

function markerIcon(role: string, online: boolean) {
  const color = online ? '#1f9d65' : '#a8a29e' // secondary green when online, stone gray when last-seen
  const glyphPath =
    role === 'CHAUFFEUR'
      ? 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2'
      : 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:30px;height:30px;">
        ${online ? `<span class="animate-marker-pulse" style="position:absolute;inset:0;border-radius:9999px;background:${color};"></span>` : ''}
        <div style="position:relative;width:30px;height:30px;border-radius:9999px;background:${color};border:2.5px solid white;box-shadow:0 3px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="${glyphPath}"/>
          </svg>
        </div>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

type RoleFilter = 'ALL' | 'CLIENT' | 'CHAUFFEUR'

export default function AdminMap() {
  const [users, setUsers] = useState<UserLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const socketRef = useRef<Socket | null>(null)

  async function load() {
    try {
      const res = await getUserLocations()
      setUsers(res.data)
    } catch (e) {
      // ignore — map just stays empty/stale until the next poll or reload
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Poll as a safety net on top of the live socket updates below (covers e.g. a chauffeur
    // whose position moved server-side without an admin-visible broadcast).
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const socket = await connectPresenceSocket()
      if (!socket || !active) return
      socketRef.current = socket
      socket.on('message', (data: PresenceMsg) => {
        if (data.type === 'presence.location') {
          setUsers((prev) => {
            const idx = prev.findIndex((u) => u.user_id === data.user_id)
            const updated: UserLocation = {
              user_id: data.user_id,
              username: data.username,
              phone: data.phone,
              role: data.role,
              is_online: true,
              is_live: true,
              latitude: data.lat,
              longitude: data.lng,
              located_at: new Date().toISOString(),
            }
            if (idx === -1) return [...prev, updated]
            const next = [...prev]
            next[idx] = { ...next[idx], ...updated }
            return next
          })
        } else if (data.type === 'presence.update') {
          setUsers((prev) =>
            prev.map((u) =>
              u.user_id === data.user_id
                ? { ...u, is_online: data.online, is_live: data.online ? u.is_live : false, located_at: data.online ? u.located_at : data.last_seen_at ?? u.located_at }
                : u,
            ),
          )
        }
      })
    })()
    return () => {
      active = false
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  const filtered = useMemo(() => (roleFilter === 'ALL' ? users : users.filter((u) => u.role === roleFilter)), [users, roleFilter])
  const onlineCount = useMemo(() => users.filter((u) => u.is_online).length, [users])
  const clientCount = useMemo(() => users.filter((u) => u.role === 'CLIENT').length, [users])
  const chauffeurCount = useMemo(() => users.filter((u) => u.role === 'CHAUFFEUR').length, [users])

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <MapPinned size={22} className="text-brand-600" />
            Carte des utilisateurs
          </h1>
          <p className="text-stone-500 text-sm">
            Position en direct des comptes connectés, et dernière position connue pour les autres — clients comme chauffeurs.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white p-1">
          {([
            ['ALL', `Tous (${users.length})`],
            ['CLIENT', `Clients (${clientCount})`],
            ['CHAUFFEUR', `Chauffeurs (${chauffeurCount})`],
          ] as [RoleFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRoleFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                roleFilter === key ? 'bg-brand-50 text-brand-700' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-5 !py-3">
        <span className="flex items-center gap-1.5 text-sm text-stone-600">
          <span className="live-dot !w-2.5 !h-2.5" />
          {onlineCount} en ligne maintenant
        </span>
        <span className="flex items-center gap-1.5 text-sm text-stone-500">
          <span className="w-2.5 h-2.5 rounded-full bg-stone-300 border-2 border-white shadow" />
          {users.length - onlineCount} hors ligne (dernière position connue)
        </span>
        <span className="flex items-center gap-1.5 text-sm text-stone-500">
          <UserIcon size={14} /> Client
        </span>
        <span className="flex items-center gap-1.5 text-sm text-stone-500">
          <Car size={14} /> Chauffeur
        </span>
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="relative z-0 isolate" style={{ height: '65vh' }}>
          {filtered.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-stone-400 px-6 text-center">
              Aucune position connue pour le moment — elle apparaît dès qu'un client ou un chauffeur se connecte à
              l'application (ou après sa toute première connexion, sous forme de dernière position).
            </div>
          ) : (
            <MapContainer center={[14.7, -17.45]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              {filtered.map((u) => (
                <Marker key={u.user_id} position={[u.latitude, u.longitude]} icon={markerIcon(u.role, u.is_online)}>
                  <Popup>
                    <div className="text-sm min-w-[150px]">
                      <div className="font-semibold text-stone-800">{u.username}</div>
                      <div className="text-stone-500">{roleLabelsFr[u.role] || u.role}</div>
                      <div className="text-stone-500">{u.phone}</div>
                      <div className="mt-1">
                        {u.is_online ? (
                          <span className="text-secondary-700 font-medium">● En ligne</span>
                        ) : (
                          <span className="text-stone-400">Hors ligne · {timeAgo(u.located_at)}</span>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      </Card>
    </div>
  )
}
