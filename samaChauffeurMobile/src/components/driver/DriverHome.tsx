import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Socket } from 'socket.io-client';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import MapPreview from '@/components/map/MapPreview';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/context/AuthContext';
import { connectDriverSocket } from '@/lib/socket';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking, setBackgroundLocationSocket } from '@/lib/backgroundLocation';
import { getAvailableTrips, claimTrip, setChauffeurAvailability, updateLocation } from '@/lib/api';
import { colors, fonts, fontSizes, spacing } from '@/constants/theme';
import type { Trip } from '@/types';

export default function DriverHome() {
  const { chauffeur, updateChauffeur } = useAuth();
  const { position } = useLocation(true);
  const [online, setOnline] = useState(!!chauffeur?.is_available);
  const [toggling, setToggling] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const lastSent = useRef(0);
  const lastPosition = useRef<{ lat: number; lng: number } | null>(null);

  const loadTrips = useCallback(async () => {
    try {
      const res = await getAvailableTrips();
      setTrips(res.data);
    } catch {
      // not verified yet, or network error
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (!online) return;
    let active = true;
    (async () => {
      const socket = await connectDriverSocket();
      if (!socket || !active) return;
      socketRef.current = socket;
      setBackgroundLocationSocket(socket);
      socket.on('message', (data: any) => {
        if (data.type === 'trip.requested') setTrips((t) => [data, ...t]);
        if (data.type === 'trip.assigned') setTrips((t) => t.filter((x) => x.id !== data.trip_id));
      });
      // A reconnect after a network blip shouldn't leave the passenger-facing map stale —
      // re-emit the last known position as soon as the socket comes back up.
      socket.on('connect', () => {
        if (lastPosition.current) socket.emit('location.update', lastPosition.current);
      });
    })();
    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setBackgroundLocationSocket(null);
    };
  }, [online]);

  useEffect(() => {
    if (!online || !position) return;
    lastPosition.current = { lat: position.lat, lng: position.lng };
    const now = Date.now();
    if (now - lastSent.current < 4000) return;
    lastSent.current = now;
    socketRef.current?.emit('location.update', { lat: position.lat, lng: position.lng });
    updateLocation(position.lat, position.lng).catch(() => {});
  }, [online, position]);

  // Safety net: make sure background tracking never keeps running once this screen is
  // gone (e.g. logout while online), even if toggleOnline's own stop call was missed.
  useEffect(() => {
    return () => {
      stopBackgroundLocationTracking();
    };
  }, []);

  const toggleOnline = async () => {
    setToggling(true);
    const next = !online;
    try {
      const res = await setChauffeurAvailability(next);
      updateChauffeur(res.data);
      setOnline(next);
      if (next) {
        loadTrips();
        startBackgroundLocationTracking();
      } else {
        stopBackgroundLocationTracking();
      }
    } catch {
      // ignore
    } finally {
      setToggling(false);
    }
  };

  const handleClaim = async (id: number) => {
    try {
      await claimTrip(id);
      setTrips((t) => t.filter((x) => x.id !== id));
      router.push({ pathname: '/(app)/trip/[id]', params: { id: String(id) } });
    } catch {
      // ignore
    }
  };

  if (!chauffeur?.is_verified) {
    return (
      <View style={styles.pendingWrap}>
        <Ionicons name="hourglass-outline" size={40} color={colors.brand[300]} />
        <Text style={styles.pendingTitle}>Vérification en cours</Text>
        <Text style={styles.pendingText}>Votre profil chauffeur doit être vérifié par un administrateur avant de pouvoir passer en ligne.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Espace chauffeur</Text>
          <Text style={styles.subtitle}>Gérez vos courses et votre disponibilité.</Text>
        </View>
        <Button variant={online ? 'secondary' : 'outline'} size="sm" onPress={toggleOnline} loading={toggling} icon={<Ionicons name="power" size={14} color={online ? colors.white : colors.brand[700]} />}>
          {online ? 'En ligne' : 'Hors ligne'}
        </Button>
      </View>

      <Card style={{ marginBottom: spacing.lg }} padded={false}>
        {online ? (
          <MapPreview myPosition={position} height={240} />
        ) : (
          <View style={styles.offlineMap}>
            <Ionicons name="moon-outline" size={28} color={colors.muted} />
            <Text style={styles.offlineText}>Passez en ligne pour partager votre position et recevoir des courses.</Text>
          </View>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Courses disponibles</Text>
      {trips.length === 0 && <Text style={styles.emptyText}>Aucune course en attente pour l&apos;instant.</Text>}
      {trips.map((t) => (
        <Card key={t.id} style={styles.tripRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tripRoute} numberOfLines={1}>
              {t.origin} → {t.destination}
            </Text>
            <Text style={styles.tripMeta}>
              {t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : '—'} · {t.price ? `${t.price} XOF` : 'Prix non estimé'}
            </Text>
          </View>
          <Button size="sm" onPress={() => handleClaim(t.id)}>
            Prendre
          </Button>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  offlineMap: { height: 200, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  offlineText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.md, color: colors.text, marginBottom: spacing.md },
  emptyText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
  tripRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  tripRoute: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  tripMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  pendingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.background },
  pendingTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.lg, color: colors.text },
  pendingText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
