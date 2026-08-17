import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
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
import PaymentModal from '@/components/passenger/PaymentModal';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import {
  acceptTrip,
  arriveTrip,
  cancelTrip,
  endTrip,
  getPendingPaymentsForDriver,
  getTransactions,
  getTripDetail,
  makePayment,
  rateTrip,
  rejectTrip,
  shareTrip,
  skipTripRating,
  startTrip,
  triggerDriverSos,
  triggerSos,
  validateTransaction,
} from '@/lib/api';
import { connectDriversSocket, connectTripSocket } from '@/lib/socket';
import { colors, fonts, fontSizes, spacing } from '@/constants/theme';
import { EMERGENCY_PHONE, SHARE_BASE } from '@/constants/config';
import type { LatLng, Trip } from '@/types';

const ONGOING_STATUSES = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED'];

export default function TripTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mode } = useAuth();
  const { position: myPosition } = useLocation(mode === 'driver');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverPosition, setDriverPosition] = useState<LatLng | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [driverPendingPaymentId, setDriverPendingPaymentId] = useState<number | null>(null);
  const [validatingPayment, setValidatingPayment] = useState(false);
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

  // Looks up the passenger's most recent transaction for this trip once it's completed, so
  // the "Payer" button/rating step reflect whether a payment is already pending/paid.
  useEffect(() => {
    if (mode !== 'passenger' || trip?.status !== 'COMPLETED') return;
    let cancelled = false;
    getTransactions()
      .then((t) => {
        if (cancelled) return;
        const mine = t.data.filter((tx: any) => Number(tx.metadata?.trip_id) === Number(id));
        setPaymentStatus(mine[0]?.status ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, trip?.status, id]);

  // Driver side: poll for the passenger's payment on a completed trip so "Le passager a payé"
  // enables itself as soon as one comes in, without a manual refresh.
  useEffect(() => {
    if (mode !== 'driver' || trip?.status !== 'COMPLETED') return;
    let cancelled = false;
    const check = () => {
      getPendingPaymentsForDriver()
        .then((r) => {
          if (cancelled) return;
          const mine = r.data.find((tx: any) => Number(tx.metadata?.trip_id) === Number(id));
          setDriverPendingPaymentId(mine?.id ?? null);
        })
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mode, trip?.status, id]);

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
    Alert.alert('Annuler la course', 'Voulez-vous vraiment annuler cette course ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: () => runAction(() => cancelTrip(id)).then(() => router.replace('/(app)/(tabs)')),
      },
    ]);
  };

  const handleSos = async () => {
    setSosSubmitting(true);
    try {
      await (mode === 'driver' ? triggerDriverSos(id, myPosition?.lat, myPosition?.lng) : triggerSos(id, myPosition?.lat, myPosition?.lng));
    } catch {
      // best-effort — the emergency call below must go through regardless
    } finally {
      setSosSubmitting(false);
      Linking.openURL(`tel:${EMERGENCY_PHONE}`);
    }
  };

  const handleValidatePayment = async () => {
    if (!driverPendingPaymentId) return;
    setValidatingPayment(true);
    try {
      await validateTransaction(driverPendingPaymentId);
      setDriverPendingPaymentId(null);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.detail || 'Erreur lors de la validation du paiement');
    } finally {
      setValidatingPayment(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const r = await shareTrip(id);
      const url = SHARE_BASE ? `${SHARE_BASE}/share/trip/${r.data.share_token}` : null;
      await Share.share({ message: url ? `Suivez ma course samaChauffeur : ${url}` : `Code de suivi samaChauffeur : ${r.data.share_token}` });
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.detail || 'Erreur lors de la création du lien de suivi');
    } finally {
      setSharing(false);
    }
  };

  const handlePay = async (amount: number, method: string) => {
    const resp = await makePayment({ amount, currency: 'XOF', method, metadata: { trip_id: Number(id) } });
    setPaymentStatus(resp.data.status);
  };

  const handleRate = async () => {
    if (!ratingValue) return;
    setRatingSubmitting(true);
    try {
      const resp = await rateTrip(id, ratingValue);
      setTrip((t) => (t ? { ...t, rating: resp.data } : t));
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.detail || "Erreur lors de l'envoi de la note");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleSkipRating = async () => {
    try {
      const resp = await skipTripRating(id);
      setTrip((t) => (t ? { ...t, rating: resp.data } : t));
    } catch {
      // non-blocking — the rating card just stays visible for another try
    }
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
                    {trip.status === 'STARTED'
                      ? 'Course en cours'
                      : trip.status === 'COMPLETED'
                        ? 'Course terminée'
                        : trip.status === 'ARRIVED'
                          ? mode === 'driver'
                            ? 'En attente du passager'
                            : 'Votre chauffeur est arrivé'
                          : 'En route vers vous'}
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
          <Button fullWidth size="lg" icon={<Ionicons name="location" size={16} color={colors.white} />} style={{ marginTop: spacing.lg }} onPress={() => runAction(() => arriveTrip(id))} loading={actionLoading}>
            Je suis arrivé
          </Button>
        )}
        {mode === 'driver' && trip.status === 'ARRIVED' && (
          <Button fullWidth size="lg" icon={<Ionicons name="person-add" size={16} color={colors.white} />} style={{ marginTop: spacing.lg }} onPress={() => runAction(() => startTrip(id))} loading={actionLoading}>
            Client à bord
          </Button>
        )}
        {mode === 'driver' && trip.status === 'STARTED' && (
          <Button fullWidth size="lg" variant="secondary" icon={<Ionicons name="flag" size={16} color={colors.white} />} style={{ marginTop: spacing.lg }} onPress={() => runAction(() => endTrip(id))} loading={actionLoading}>
            Arrivé à destination
          </Button>
        )}
        {mode === 'driver' && ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED'].includes(trip.status) && (
          <Button variant="outline" fullWidth style={{ marginTop: spacing.md, borderColor: colors.danger }} onPress={handleSos} loading={sosSubmitting} icon={<Ionicons name="alert-circle-outline" size={16} color={colors.danger} />}>
            SOS
          </Button>
        )}
        {mode === 'driver' && trip.status === 'COMPLETED' && (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.rateTitle}>Course terminée</Text>
            <Text style={styles.metaText}>Moyen de paiement du client : {trip.payment_method ?? '—'}</Text>
            {!driverPendingPaymentId && <Text style={[styles.metaText, { marginTop: spacing.xs }]}>En attente que le passager règle la course…</Text>}
            <Button fullWidth style={{ marginTop: spacing.md }} variant="secondary" disabled={!driverPendingPaymentId} onPress={handleValidatePayment} loading={validatingPayment}>
              Le passager a payé
            </Button>
          </Card>
        )}

        {mode === 'passenger' && ONGOING_STATUSES.includes(trip.status) && (
          <>
            <View style={styles.actionsRow}>
              <Button variant="outline" style={{ flex: 1 }} onPress={handleShare} loading={sharing} icon={<Ionicons name="share-social-outline" size={16} color={colors.brand[700]} />}>
                Partager
              </Button>
              <Button variant="outline" style={{ flex: 1, borderColor: colors.danger }} onPress={handleSos} loading={sosSubmitting} icon={<Ionicons name="alert-circle-outline" size={16} color={colors.danger} />}>
                SOS
              </Button>
            </View>
            <Button variant="ghost" fullWidth style={{ marginTop: spacing.md }} onPress={requestCancellation} loading={actionLoading}>
              Annuler la course
            </Button>
          </>
        )}

        {mode === 'passenger' && trip.status === 'COMPLETED' && (
          <Card style={{ marginTop: spacing.lg }}>
            {paymentStatus !== 'COMPLETED' ? (
              <>
                <Text style={styles.rateTitle}>Course terminée</Text>
                <Text style={styles.metaText}>{paymentStatus === 'PENDING' ? 'Paiement en attente de validation par le chauffeur.' : 'Réglez cette course pour la clôturer.'}</Text>
                {paymentStatus !== 'PENDING' && (
                  <Button fullWidth style={{ marginTop: spacing.md }} onPress={() => setPaymentModalOpen(true)}>
                    Payer cette course
                  </Button>
                )}
              </>
            ) : trip.rating ? (
              <Text style={styles.rateTitle}>Merci pour votre note !</Text>
            ) : (
              <>
                <Text style={styles.rateTitle}>Notez votre chauffeur</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setRatingValue(n)} hitSlop={6}>
                      <Ionicons name={n <= ratingValue ? 'star' : 'star-outline'} size={30} color={colors.accent[500]} />
                    </Pressable>
                  ))}
                </View>
                <View style={styles.actionsRow}>
                  <Button variant="outline" style={{ flex: 1 }} onPress={handleSkipRating}>
                    Passer
                  </Button>
                  <Button style={{ flex: 1 }} onPress={handleRate} loading={ratingSubmitting} disabled={!ratingValue}>
                    Envoyer
                  </Button>
                </View>
              </>
            )}
          </Card>
        )}
      </ScrollView>

      <PaymentModal visible={paymentModalOpen} trip={trip} onClose={() => setPaymentModalOpen(false)} onConfirm={handlePay} />
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
  rateTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.text, marginBottom: 4 },
  starsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
});
