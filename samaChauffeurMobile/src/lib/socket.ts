import { io, type Socket } from 'socket.io-client';
import { SOCKET_BASE } from '@/constants/config';
import { getAccessToken } from './tokenStorage';

async function connect(namespace: string): Promise<Socket | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return io(`${SOCKET_BASE}${namespace}`, {
    auth: { token },
    transports: ['websocket'],
  });
}

/** Verified chauffeurs only — read + write location (mirrors ws/realtime/driver/) */
export const connectDriverSocket = () => connect('/ws/realtime/driver');

/** Clients/admin — read-only driver location broadcasts (mirrors ws/realtime/drivers/) */
export const connectDriversSocket = () => connect('/ws/realtime/drivers');

/** Passenger/driver/admin of a given trip (mirrors ws/realtime/trip/<id>/) */
export const connectTripSocket = (tripId: number | string) => connect(`/ws/realtime/trip/${tripId}`);
