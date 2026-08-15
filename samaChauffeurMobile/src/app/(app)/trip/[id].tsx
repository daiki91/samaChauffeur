import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Socket } from 'socket.io-client';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/ui/Avatar';
import StatusStepper from '@/components/ui/StatusStepper';
import Divider from '@/components/ui/Divider';
import MapPreview, { type MapMarker } from '@/components/map/MapPreview';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { acceptTrip, createSupportTicket, endTrip, getTripDetail, rejectTrip, startTrip } from '@/lib/api';
import { connectDriversSocket, connectTripSocket } from '@/lib/socket';
import { colors, fonts, fontSizes, spacing } from '@/constants/theme';
import type { LatLng, Trip } from '@/types';

export default function TripTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mode } = useAuth();
  const { position: myPosition } = useLocation(mode === 'driver');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverPosition, setDriverPosition] = useState<LatLng | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const tripSocketRef = useRef<Socket | null>(null);
  const driversSocketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getTripDetail(id);
      setTrip(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    (async () => {
      const socket = await connectTripSocket(id);
      if (!socket || !active) return;
      tripSocketRef.current = socket;
      socket.on('message', (data: any) => {
        if (data.type === 'trip.update') {
          setTrip((t) => (t ? { ...t, status: data.status } : t));
        }
      });
    })();
    return () => {
      active = false;
      tripSocketRef.current?.disconnect();
    };
  }, [id]);

  // Passenger side: listen to the driver-broadcast channel and keep the assigned driver's dot live.
  useEffect(() => {
    if (mode === 'driver' || !trip?.driver) return;
    let active = true;
    (async () => {
      const socket = await connectDriversSocket();
      if (!socket || !active) return;
      driversSocketRef.current = socket;
      socket.on('message', (data: any) => {
        if (data.type === 'broadcast.location' && data.driver_id === trip.driver) {
          setDriverPosition({ lat: data.lat, lng: data.lng });
        }
      });
    })();
    return () => {
      active = false;
      driversSocketRef.current?.disconnect();
    };
  }, [mode, trip?.driver]);

  const runAction = async (action: () => Promise<unknown>, refresh = true) => {
    setActionLoading(true);
    try {
      await action();
      if (refresh) await load();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.detail || "L'action a échoué");
    } finally {
      setActionLoading(false);
    }
  };

  const requestCancellation = () => {
    Alert.alert('Demander une annulation', "Aucune annulation directe n'est disponible — un ticket sera envoyé au support.", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        style: 'destructive',
        onPress: () =>
          runAction(
            () => createSupportTicket({ title: 'Demande d\'annulation', description: `Le passager demande l'annulation de la course #${id}.`, trip: Number(id) }),
            false,
          ).then(() => Alert.alert('Demande envoyée', 'Le support a été notifié.')),
      },
    ]);
  };

  if (loading || !trip) return <Spinner style={{ flex: 1 }} />;

  const markers: MapMarker[] = [
    ...(driverPosition ? [{ id: 'driver', position: driverPosition, color: colors.brand[600], label: 'Chauffeur' }] : []),
    ...(myPosition && mode === 'driver' ? [{ id: 'me', position: myPosition, color: colors.secondary[600], label: 'Vous' }] : []),
  ];

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Ionicons name="chevron-back" size={24} color={colors.text} onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Suivi de course</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeText}>
                {trip.origin} → {trip.destination}
              </Text>
              <Text style={styles.metaText}>{trip.price ? `${trip.price} XOF` : 'Prix non estimé'}</Text>
            </View>
            <Badge status={trip.status} />
          </View>

          <Divider />
          <StatusStepper status={trip.status} />

          {trip.status !== 'CANCELLED' && trip.status !== 'REQUESTED' && (
            <>
              <Divider />
              <View style={styles.driverRow}>
                <Avatar icon={mode === 'driver' ? 'person' : 'car'} tone="secondary" badge badgeColor={colors.secondary[500]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{mode === 'driver' ? 'Passager' : 'Votre chauffeur'}</Text>
                  <Text style={styles.driverSub}>
                    {trip.status === 'STARTED' ? 'Course en cours' : trip.status === 'COMPLETED' ? 'Course terminée' : 'En route vers vous'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </Card>

        <MapPreview
          myPosition={mode === 'driver' ? myPosition : driverPosition}
          markers={markers}
          height={260}
        />

        {mode === 'driver' && trip.status === 'ASSIGNED' && (
          <View style={styles.actionsRow}>
            <Button variant="outline" style={{ flex: 1 }} onPress={() => runAction(() => rejectTrip(id))} loading={actionLoading}>
              Refuser
            </Button>
            <Button style={{ flex: 1 }} onPress={() => runAction(() => acceptTrip(id))} loading={actionLoading}>
              Accepter
            </Button>
          </View>
        )}
        {mode === 'driver' && trip.status === 'ACCEPTED' && (
          <Button fullWidth size="lg" style={{ marginTop: spacing.lg }} onPress={() => runAction(() => startTrip(id))} loading={actionLoading}>
            Démarrer la course
          </Button>
        )}
        {mode === 'driver' && trip.status === 'STARTED' && (
          <Button fullWidth size="lg" variant="secondary" style={{ marginTop: spacing.lg }} onPress={() => runAction(() => endTrip(id))} loading={actionLoading}>
            Terminer la course
          </Button>
        )}

        {mode === 'passenger' && ['REQUESTED', 'ASSIGNED'].includes(trip.status) && (
          <Button variant="outline" fullWidth style={{ marginTop: spacing.lg }} onPress={requestCancellation} loading={actionLoading}>
            Demander l&apos;annulation
          </Button>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.lg, color: colors.text },
  container: { padding: spacing.xl },
  statusCard: { marginBottom: spacing.lg },
  statusHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.text, maxWidth: 220 },
  metaText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  driverName: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.text },
  driverSub: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
