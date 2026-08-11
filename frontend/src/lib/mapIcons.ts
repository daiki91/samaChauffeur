import L from 'leaflet'

// Shared Leaflet marker icons — used by both the live map (DriverMap.tsx) and the public
// trip-sharing page (SharedTrip.tsx) so a passenger and whoever they share a trip with see
// the same visual language.

// One color per vehicle type so passengers can tell rides apart on the map at a glance.
const VEHICLE_MARKER_COLORS: Record<string, string> = {
  CAR: '#f2590e',
  SEDAN: '#f2590e',
  SUV: '#1f9d65',
  MINIBUS: '#de9a1f',
  BUS: '#de9a1f',
}

const CAR_SVG_PATH =
  'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2'

export const carIcon = (vehicleType?: string) => {
  const color = VEHICLE_MARKER_COLORS[vehicleType || ''] || '#f2590e'
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:34px;">
        <span class="animate-marker-pulse" style="position:absolute;inset:0;border-radius:9999px;background:${color};"></span>
        <div style="position:relative;width:34px;height:34px;border-radius:9999px;background:${color};border:2.5px solid white;box-shadow:0 3px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="${CAR_SVG_PATH}"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

// Classic teardrop pin (lucide MapPin path) shared by origin/destination — same silhouette,
// different fill + inner glyph, so they read as a family while staying easy to tell apart.
const PIN_PATH = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'
const FLAG_PATH = 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z'

export const originIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div class="animate-pin-drop" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,.35));">
        <svg width="32" height="32" viewBox="0 0 24 24">
          <path d="${PIN_PATH}" fill="#1f9d65" stroke="white" stroke-width="1.5"/>
          <circle cx="12" cy="10" r="3.4" fill="white"/>
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 29],
  })

export const destinationIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div class="animate-pin-drop" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,.35));">
        <svg width="32" height="32" viewBox="0 0 24 24">
          <path d="${PIN_PATH}" fill="#f2590e" stroke="white" stroke-width="1.5"/>
          <g transform="translate(7.6,5.6) scale(0.58)">
            <path d="${FLAG_PATH}" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="4" x2="4" y1="22" y2="15" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
          </g>
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 29],
  })

// Smaller, rounder waypoint badges (as opposed to the teardrop origin/destination pins) so
// intermediate stops read as secondary to the two real endpoints.
export const stopIcon = (n: number) =>
  L.divIcon({
    className: '',
    html: `
      <div class="animate-pin-drop" style="width:23px;height:23px;border-radius:9999px;background:#de9a1f;border:2.5px solid white;box-shadow:0 2px 5px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;">
        ${n}
      </div>`,
    iconSize: [23, 23],
    iconAnchor: [11, 11],
  })

export const meIcon = L.divIcon({ className: '', html: `<div class="live-dot"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })
