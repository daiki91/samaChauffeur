import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { Socket } from 'socket.io-client';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import MapPreview from '@/components/map/MapPreview';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/context/AuthContext';
import { connectDriverSocket } from '@/lib/socket';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking, setBackgroundLocationSocket } from '@/lib/backgroundLocation';
import { acceptTrip, claimTrip, getAvailableTrips, getMyActiveTrip, setChauffeurAvailability, updateLocation } from '@/lib/api';
import { haversineKm } from '@/lib/geo';
import { colors, fonts, fontSizes, radii, shadows, spacing } from '@/constants/theme';
import type { Trip } from '@/types';

const ACTIVE_STATUSES = ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED'];

// Must match MAX_CLAIM_RADIUS_KM on the backend (backend-node/src/modules/trips/trips.routes.ts) —
// a claim outside this radius is rejected server-side regardless, this just avoids a round-trip.
const MAX_CLAIM_RADIUS_KM = 5;

export default function DriverHome() {
  const { user, chauffeur, updateChauffeur } = useAuth();
  const { position } = useLocation(true);
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(!!chauffeur?.is_available);
  const [toggling, setToggling] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [checkingActiveTrip, setCheckingActiveTrip] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const lastSent = useRef(0);
  const lastPosition = useRef<{ lat: number; lng: number } | null>(null);

  // A driver reopening the app (or switching tabs) mid-course shouldn't land back on the
  // available-trips list — send them straight to the course they already have in flight.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const r = await getMyActiveTrip();
          if (!cancelled && r.data && ACTIVE_STATUSES.includes(r.data.status)) {
            router.replace({ pathname: '/(app)/trip/[id]', params: { id: String(r.data.id) } });
            return;
          }
        } catch {
          // not verified yet, or no active trip — stay on the available-trips list
        } finally {
          if (!cancelled) setCheckingActiveTrip(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
    setClaimingId(id);
    try {
      await claimTrip(id);
      await acceptTrip(id);
      setTrips((t) => t.filter((x) => x.id !== id));
      router.push({ pathname: '/(app)/trip/[id]', params: { id: String(id) } });
    } catch (err: any) {
      Alert.alert('Course non prise', err?.response?.data?.detail || "Impossible d'accepter cette course pour le moment.");
    } finally {
      setClaimingId(null);
    }
  };

  // Sort by distance from the driver (closest first); never hide a trip outright — but the
  // server rejects claims beyond MAX_CLAIM_RADIUS_KM, so grey those out here too.
  const sortedTrips = useMemo(() => {
    if (!position) return trips;
    return [...trips].sort((a, b) => {
      const da = a.origin_lat != null && a.origin_lng != null ? haversineKm(position, { lat: a.origin_lat, lng: a.origin_lng }) : Infinity;
      const db = b.origin_lat != null && b.origin_lng != null ? haversineKm(position, { lat: b.origin_lat, lng: b.origin_lng }) : Infinity;
      return da - db;
    });
  }, [trips, position]);

  if (checkingActiveTrip) return <Spinner style={{ flex: 1 }} />;

  if (!chauffeur?.is_verified) {
    return (
      <View style={styles.pendingWrap}>
        <Ionicons name="hourglass-outline" size={40} color={colors.brand[300]} />
        <Text style={styles.pendingTitle}>Vérification en cours</Text>
        <Text style={styles.pendingText}>Votre profil chauffeur doit être vérifié par un administrateur avant de pouvoir passer en ligne.</Text>
        {(!chauffeur?.permit || !chauffeur?.insurance) && (
          <Button variant="outline" size="sm" onPress={() => router.push('/(app)/driver-documents')} style={{ marginTop: spacing.md }}>
            Compléter mon dossier
          </Button>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MapPreview fill myPosition={position} />

      {/* Top overlay — condensed driver identity, replaces the old full-width header block. */}
      <View style={[styles.topOverlay, { top: insets.top + spacing.md }]} pointerEvents="none">
        <Avatar name={user?.username} size="sm" tone={online ? 'secondary' : 'neutral'} badge badgeColor={online ? colors.secondary[500] : colors.muted} />
        <View>
          <Text style={styles.title}>Espace chauffeur</Text>
          <Text style={styles.subtitle}>{online ? 'Vous êtes en ligne' : 'Vous êtes hors ligne'}</Text>
        </View>
      </View>

      {/* Bottom overlay — available trips (only when there are any) above the online toggle,
          the single persistent primary action. */}
      <View style={[styles.bottomOverlay, { paddingHorizontal: spacing.xl }]}>
        {sortedTrips.length > 0 && (
          <Animated.View layout={LinearTransition.duration(240)} style={styles.tripsPanel}>
            <Text style={styles.sectionTitle}>
              Courses disponibles
              {position ? ` · à moins de ${MAX_CLAIM_RADIUS_KM} km` : ''}
            </Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {sortedTrips.map((t) => {
                const distFromDriver =
                  position && t.origin_lat != null && t.origin_lng != null ? haversineKm(position, { lat: t.origin_lat, lng: t.origin_lng }) : null;
                const outOfRange = distFromDriver != null && distFromDriver > MAX_CLAIM_RADIUS_KM;
                return (
                  <Card key={t.id} style={[styles.tripRow, outOfRange && styles.tripRowOutOfRange]} variant="outlined">
                    <View style={styles.tripRouteIcon}>
                      <Ionicons name="navigate" size={14} color={colors.brand[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tripRoute} numberOfLines={1}>
                        {t.origin} → {t.destination}
                      </Text>
                      <Text style={styles.tripMeta}>
                        {t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : '—'} · {t.price ? `${t.price} XOF` : 'Prix non estimé'}
                        {distFromDriver != null ? ` · à ${distFromDriver.toFixed(1)} km${outOfRange ? ' (hors secteur)' : ''}` : ''}
                      </Text>
                    </View>
                    <Button size="sm" onPress={() => handleClaim(t.id)} loading={claimingId === t.id} disabled={outOfRange}>
                      Prendre
                    </Button>
                  </Card>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        <Card
          style={[styles.onlineToggleCard, online ? styles.onlineToggleCardActive : styles.onlineToggleCardInactive]}
          onPress={toggling ? undefined : toggleOnline}
          padded={false}
        >
          <View style={styles.onlineToggleRow}>
            <View style={styles.onlineToggleLabel}>
              <Ionicons name={online ? 'radio-button-on' : 'power-outline'} size={20} color={online ? colors.white : colors.brand[700]} />
              <Text style={[styles.onlineToggleText, { color: online ? colors.white : colors.brand[700] }]}>
                {online ? 'En ligne — vous recevez des courses' : 'Passer en ligne'}
              </Text>
            </View>
            {toggling ? (
              <ActivityIndicator color={online ? colors.white : colors.brand[600]} />
            ) : (
              <View style={[styles.togglePill, online && styles.togglePillActive]}>
                <View style={[styles.toggleKnob, online && styles.toggleKnobActive]} />
              </View>
            )}
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    position: 'absolute',
    left: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  title: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 1 },
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: spacing.xl, gap: spacing.md },
  tripsPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl2,
    padding: spacing.lg,
    ...shadows.floating,
  },
  onlineToggleCard: { borderRadius: radii.xl2, borderWidth: 1.5 },
  onlineToggleCardActive: { backgroundColor: colors.secondary[600], borderColor: colors.secondary[600] },
  onlineToggleCardInactive: { backgroundColor: colors.surface, borderColor: colors.brand[200] },
  onlineToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  onlineToggleLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  onlineToggleText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm },
  togglePill: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.12)',
    padding: 3,
    justifyContent: 'center',
  },
  togglePillActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  toggleKnobActive: { alignSelf: 'flex-end' },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.text, marginBottom: spacing.sm },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  tripRowOutOfRange: { opacity: 0.6 },
  tripRouteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripRoute: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  tripMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  pendingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.background },
  pendingTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.lg, color: colors.text },
  pendingText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
