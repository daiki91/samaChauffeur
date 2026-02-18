import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// fix default icon paths for leaflet in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export default function DriverMap({ initialDrivers = [] }: { initialDrivers?: any[] }) {
  const [markers, setMarkers] = useState<any[]>(initialDrivers)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access')
    if (!token) return
    const url = `ws://${window.location.hostname}:8000/ws/realtime/drivers/?token=${token}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.addEventListener('open', () => console.log('WS opened'))
    ws.addEventListener('message', (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.type === 'broadcast.location') {
          setMarkers((m) => [...m.filter(x=>x.driver_id !== data.driver_id), { lat: data.lat, lng: data.lng, driver_id: data.driver_id }])
        }
        if (data.type === 'trip.requested') {
          // show popup or toast for available trip on client map page
          console.log('Trip requested', data)
        }
      } catch (e) {
        // ignore
      }
    })

    return () => {
      ws.close()
    }
  }, [])

  const sendLocation = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    // random position near Dakar for demo
    const lat = 14.7 + (Math.random() - 0.5) * 0.02
    const lng = -17.45 + (Math.random() - 0.5) * 0.02
    wsRef.current.send(JSON.stringify({ type: 'location.update', lat, lng }))
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Carte - Positions chauffeurs</h2>
        <button className="mb-3 px-3 py-1 bg-brand-blue-500 text-white rounded" onClick={sendLocation}>Envoyer position (demo)</button>
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
