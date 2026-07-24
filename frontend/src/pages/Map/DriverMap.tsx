import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { Socket } from 'socket.io-client'
import { connectDriverSocket, connectDriversSocket } from '../../lib/socket'

// fix default icon paths for leaflet in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

type Props = {
  initialDrivers?: any[]
  /** 'driver' connects to the write-enabled channel (chauffeur sending its own position).
   *  'viewer' (default) connects to the read-only broadcast channel (clients/admin). */
  role?: 'driver' | 'viewer'
}

export default function DriverMap({ initialDrivers = [], role = 'viewer' }: Props) {
  const [markers, setMarkers] = useState<any[]>(initialDrivers)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = role === 'driver' ? connectDriverSocket() : connectDriversSocket()
    if (!socket) return
    socketRef.current = socket

    socket.on('connect', () => console.log('Realtime socket connected'))
    socket.on('message', (data: any) => {
      if (data.type === 'broadcast.location') {
        setMarkers((m) => [...m.filter((x) => x.driver_id !== data.driver_id), { lat: data.lat, lng: data.lng, driver_id: data.driver_id }])
      }
      if (data.type === 'trip.requested') {
        console.log('Trip requested', data)
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [role])

  const sendLocation = () => {
    const socket = socketRef.current
    if (!socket || !socket.connected) return
    // random position near Dakar for demo
    const lat = 14.7 + (Math.random() - 0.5) * 0.02
    const lng = -17.45 + (Math.random() - 0.5) * 0.02
    socket.emit('location.update', { lat, lng })
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Carte - Positions chauffeurs</h2>
        {role === 'driver' && (
          <button className="mb-3 px-3 py-1 bg-brand-blue-500 text-white rounded" onClick={sendLocation}>Envoyer position (demo)</button>
        )}
        <MapContainer center={[14.7, -17.45]} zoom={13} style={{ height: '60vh', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {markers.map((m) => (
            <Marker key={m.driver_id} position={[m.lat, m.lng]}>
              <Popup>{m.username ? `${m.username} ` : ''}{m.phone ? m.phone : `Driver ${m.driver_id}`}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
