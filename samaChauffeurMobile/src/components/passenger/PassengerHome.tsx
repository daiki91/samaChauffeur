import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PillBadge from '@/components/ui/PillBadge';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import MapPreview, { type MapMarker } from '@/components/map/MapPreview';
import { useLocation } from '@/hooks/useLocation';
import { createTrip, estimatePrice, getAvailableChauffeurs, getClientProfile, getMyTrips, getRewardsStatus } from '@/lib/api';
import { haversineKm } from '@/lib/geo';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, fontSizes, heroGradient, radii, spacing } from '@/constants/theme';
import type { AvailableChauffeur, LatLng, PendingDiscount } from '@/types';

const ONGOING_STATUSES = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'STARTED'];

export default function PassengerHome() {
  const { user } = useAuth();
  const { position } = useLocation();
  const [drivers, setDrivers] = useState<AvailableChauffeur[]>([]);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [destinationLabel, setDestinationLabel] = useState('');
  const [originLabel, setOriginLabel] = useState('Ma position actuelle');
  const [estimate, setEstimate] = useState<{ price: number; distanceKm: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [checkingActiveTrip, setCheckingActiveTrip] = useState(true);
  const [nextRideDiscount, setNextRideDiscount] = useState<PendingDiscount>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAvailableChauffeurs(position ? { lat: position.lat, lng: position.lng, radius: 15 } : undefined);
        setDrivers(res.data);
      } catch {
        // silently ignore — the hero card just shows 0
      }
    })();
  }, [position]);

  // A passenger reopening the app (or switching tabs) mid-ride shouldn't land on a fresh
  // booking form — send them straight back to the trip they already have in flight, exactly
  // like ClientDashboard on the web keeps the active trip pinned instead of the booking card.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const t = await getMyTrips();
          const ongoing = t.data.find((trip: { status: string }) => ONGOING_STATUSES.includes(trip.status));
          if (!cancelled && ongoing) {
            router.replace({ pathname: '/(app)/trip/[id]', params: { id: String(ongoing.id) } });
            return;
          }
        } catch {
          // ignore — worst case the passenger just sees the booking form
        } finally {
          if (!cancelled) setCheckingActiveTrip(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // What will auto-apply to the next trip — a rewards checkpoint discount takes priority over
  // a saved promo code (see trips.routes.ts), mirrors ClientDashboard's nextRideDiscount banner.
  useEffect(() => {
    if (user?.role !== 'CLIENT') return;
    (async () => {
      try {
        const [rewards, profile] = await Promise.all([getRewardsStatus(), getClientProfile()]);
        const promo = profile.data.pending_promo_code ? { pct: profile.data.pending_promo_discount_pct, label: profile.data.pending_promo_code } : null;
        setNextRideDiscount(rewards.data.pending_discount || promo);
      } catch {
        // non-critical — booking still works without the banner
      }
    })();
  }, [user?.role]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!position || !destination) {
        setEstimate(null);
        return;
      }
      setEstimating(true);
      const distanceKm = haversineKm(position, destination);
      try {
        const res = await estimatePrice({ distance_km: distanceKm, vehicle_type: 'CAR', mode: 'PRIVATE' });
        if (!cancelled) setEstimate({ price: res.data.price, distanceKm });
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [position, destination]);

  const markers: MapMarker[] = useMemo(
    () => [
      ...drivers
        .filter((d) => d.latitude != null && d.longitude != null)
        .map((d) => ({ id: `d-${d.id}`, position: { lat: d.latitude as number, lng: d.longitude as number }, color: colors.accent[600], label: d.username })),
      ...(destination ? [{ id: 'dest', position: destination, color: colors.brand[600], label: destinationLabel || 'Destination' }] : []),
    ],
    [drivers, destination, destinationLabel],
  );

  const handleConfirm = async () => {
    if (!position || !destination) {
      setError('Choisissez une destination sur la carte.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await createTrip({
        origin: originLabel,
        origin_lat: position.lat,
        origin_lng: position.lng,
        destination: destinationLabel || 'Destination sélectionnée',
        dest_lat: destination.lat,
        dest_lng: destination.lng,
        mode: 'PRIVATE',
      });
      router.push({ pathname: '/(app)/trip/[id]', params: { id: String(res.data.id) } });
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur lors de la demande de course');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingActiveTrip) return <Spinner style={{ flex: 1 }} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={heroGradient.colors} locations={heroGradient.locations} start={heroGradient.start} end={heroGradient.end} style={styles.hero}>
        <PillBadge>Covoiturage &amp; Transport</PillBadge>
        <Text style={styles.headline}>Où que vous alliez, on vous y emmène.</Text>
        <Text style={styles.subtext}>Réservez une course fiable, à prix juste, partout au Cameroun.</Text>

        <View style={styles.heroButtons}>
          <Button variant="secondary" size="md" onPress={() => setBookingOpen(true)}>
            Réserver une course
          </Button>
          <Button variant="outlineLight" size="md" onPress={() => router.push('/(app)/become-driver')}>
            Devenir chauffeur
          </Button>
        </View>

        <View style={styles.liveCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.liveCount}>{drivers.length}</Text>
            <Text style={styles.liveLabel}>chauffeurs disponibles autour de vous</Text>
          </View>
          <View style={styles.liveIconWrap}>
            <Ionicons name="car-sport" size={20} color={colors.white} />
            <View style={styles.liveDot} />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.mapSection}>
        <MapPreview myPosition={position} markers={markers} onPress={(p) => setDestination(p)} height={240} />
        <Text style={styles.mapHint}>Touchez la carte pour choisir votre destination</Text>
      </View>

      {bookingOpen && (
        <Card style={styles.sheetCard} floating>
          <View style={styles.sheetHandle} />
          <Text style={styles.cardTitle}>
            <Ionicons name="navigate-outline" size={16} color={colors.brand[600]} /> Demander une course
          </Text>
          <Input label="Départ" value={originLabel} onChangeText={setOriginLabel} icon={<Ionicons name="locate-outline" size={16} color={colors.muted} />} />
          <Input
            label="Destination"
            value={destinationLabel}
            onChangeText={setDestinationLabel}
            placeholder="Nommez votre destination"
            icon={<Ionicons name="flag-outline" size={16} color={colors.muted} />}
          />
          {!destination && <Text style={styles.hintText}>Touchez la carte ci-dessus pour placer votre destination.</Text>}

          {nextRideDiscount && (
            <View style={styles.discountBox}>
              <Ionicons name="gift-outline" size={16} color={colors.secondary[700]} />
              <Text style={styles.discountText}>
                Réduction de {nextRideDiscount.pct}% ({nextRideDiscount.label}) appliquée à cette course
              </Text>
            </View>
          )}

          {estimating && <Spinner />}
          {estimate && !estimating && (
            <View style={styles.estimateBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="speedometer-outline" size={14} color={colors.brand[700]} />
                <Text style={styles.estimateText}>{estimate.distanceKm.toFixed(1)} km</Text>
              </View>
              <Text style={styles.estimatePrice}>~{Math.round(estimate.price).toLocaleString('fr-FR')} XOF</Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button fullWidth size="lg" onPress={handleConfirm} loading={submitting} disabled={!destination} style={{ marginTop: spacing.sm }}>
            Confirmer la course
          </Button>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: spacing.huge,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radii.xl2,
    borderBottomRightRadius: radii.xl2,
  },
  headline: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxxl,
    color: colors.white,
    lineHeight: 36,
    marginBottom: spacing.sm,
  },
  subtext: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  heroButtons: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', marginBottom: spacing.xl },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  liveCount: { fontFamily: fonts.bold, fontSize: fontSizes.xxl, color: colors.white },
  liveLabel: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.85)' },
  liveIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    position: 'absolute',
    right: -1,
    top: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.secondary[400],
    borderWidth: 2,
    borderColor: colors.brand[600],
  },
  mapSection: { padding: spacing.xl, paddingBottom: spacing.md },
  mapHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: spacing.sm, textAlign: 'center' },
  // pulled up over the map + rounded top corners so it reads as a bottom-sheet, the pattern
  // Uber/Bolt/Yango/inDrive all use for the booking step instead of a plain inline form card
  sheetCard: {
    marginHorizontal: spacing.xl,
    marginTop: -spacing.md,
    borderTopLeftRadius: radii.xl2,
    borderTopRightRadius: radii.xl2,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.md, color: colors.text, marginBottom: spacing.lg },
  hintText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: -spacing.sm, marginBottom: spacing.md },
  estimateBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.brand[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  estimateText: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.brand[800] },
  estimatePrice: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.brand[700] },
  errorText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.danger, marginBottom: spacing.md },
  discountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  discountText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.secondary[700] },
});
