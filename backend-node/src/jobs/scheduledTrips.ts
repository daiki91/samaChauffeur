import prisma from '../lib/prisma'
import { broadcastToDrivers } from '../realtime/socket'
import { toTrip } from '../modules/trips/trips.routes'

const CHECK_INTERVAL_MS = 30_000

// Courses programmées are created with status SCHEDULED and stay invisible to drivers
// (the /available/ list only returns REQUESTED trips) until their scheduledAt time arrives —
// this poll promotes them to REQUESTED and broadcasts them, same as an immediate request.
async function promoteDueTrips() {
  const due = await prisma.trip.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
  })
  for (const trip of due) {
    const updated = await prisma.trip.update({ where: { id: trip.id }, data: { status: 'REQUESTED' } })
    broadcastToDrivers({ ...toTrip(updated), type: 'trip.requested', trip_id: updated.id })
  }
}

export function startScheduledTripsJob() {
  setInterval(() => {
    promoteDueTrips().catch((e) => {
      // eslint-disable-next-line no-console
      console.error('scheduledTripsJob error:', e)
    })
  }, CHECK_INTERVAL_MS)
}
