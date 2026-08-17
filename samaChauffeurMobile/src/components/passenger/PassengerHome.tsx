import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { PAYMENT_METHODS, VEHICLE_TYPES } from '@/constants/config';
import { colors, fonts, fontSizes, heroGradient, radii, shadows, spacing } from '@/constants/theme';
import type { AvailableChauffeur, LatLng, PendingDiscount, TransactionMethod, VehicleType } from '@/types';

const ONGOING_STATUSES = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED'];
const MAX_STOPS = 2;
const MAP_EXPANDED_HEIGHT = 240;
const MAP_COLLAPSED_HEIGHT = 110;

type Stop = { id: string; label: string; point: LatLng | null };

export default function PassengerHome() {
  const { user } = useAuth();
  const { position } = useLocation();
  const [drivers, setDrivers] = useState<AvailableChauffeur[]>([]);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [destinationLabel, setDestinationLabel] = useState('');
  const [originLabel, setOriginLabel] = useState('Ma position actuelle');
  const [stops, setStops] = useState<Stop[]>([]);
  // What the next map tap sets — the destination by default, or a specific stop while it's
  // being placed. Keeps a single onPress handler working for every pickable point.
  const [pendingTarget, setPendingTarget] = useState<'destination' | string>('destination');
  const [mapExpanded, setMapExpanded] = useState(true);
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR');
  const [paymentMethod, setPaymentMethod] = useState<TransactionMethod>('CASH');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [androidPickerStep, setAndroidPickerStep] = useState<'date' | 'time' | null>(null);
  const [estimate, setEstimate] = useState<{ price: number; distanceKm: number; priceMin?: number; priceMax?: number } | null>(null);
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

  // Only feed complete stops (a point actually placed) into the route/estimate calculation —
  // a stop row added but not yet placed on the map must not silently break things.
  const stopPoints = useMemo(() => stops.map((s) => s.point).filter((p): p is LatLng => !!p), [stops]);
  const stopsReady = stops.length === stopPoints.length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!position || !destination || !stopsReady) {
        setEstimate(null);
        return;
      }
      setEstimating(true);
      const leg = [position, ...stopPoints, destination];
      let distanceKm = 0;
      for (let i = 0; i < leg.length - 1; i++) distanceKm += haversineKm(leg[i], leg[i + 1]);
      try {
        const res = await estimatePrice({ distance_km: distanceKm, vehicle_type: vehicleType, mode: 'PRIVATE' });
        if (!cancelled) setEstimate({ price: res.data.price, distanceKm, priceMin: res.data.price_min, priceMax: res.data.price_max });
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [position, destination, stopPoints, stopsReady, vehicleType]);

  const markers: MapMarker[] = useMemo(
    () => [
      ...drivers
        .filter((d) => d.latitude != null && d.longitude != null)
        .map((d) => ({ id: `d-${d.id}`, position: { lat: d.latitude as number, lng: d.longitude as number }, color: colors.accent[600], label: d.username })),
      ...stops
        .filter((s) => s.point)
        .map((s, i) => ({ id: `stop-${s.id}`, position: s.point as LatLng, color: colors.accent[600], label: s.label || `Arrêt ${i + 1}` })),
      ...(destination ? [{ id: 'dest', position: destination, color: colors.brand[600], label: destinationLabel || 'Destination' }] : []),
    ],
    [drivers, destination, destinationLabel, stops],
  );

  // Single handler for every map tap — routes the point to whichever pickable target is
  // currently armed (the destination, or a specific stop being placed), then collapses the
  // map back down so the growing form below isn't fighting a full-height map for space.
  const handleMapPress = (point: LatLng) => {
    if (pendingTarget === 'destination') {
      setDestination(point);
    } else {
      const stopId = pendingTarget;
      setStops((prev) => prev.map((s) => (s.id === stopId ? { ...s, point } : s)));
      setPendingTarget('destination');
    }
    if (bookingOpen) setMapExpanded(false);
  };

  const editDestinationOnMap = () => {
    setPendingTarget('destination');
    setMapExpanded(true);
  };

  const addStop = () => {
    if (stops.length >= MAX_STOPS) return;
    const id = `${Date.now()}-${Math.random()}`;
    setStops((prev) => [...prev, { id, label: '', point: null }]);
    setPendingTarget(id);
    setMapExpanded(true);
  };

  const placeStopOnMap = (id: string) => {
    setPendingTarget(id);
    setMapExpanded(true);
  };

  const removeStop = (id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
    if (pendingTarget === id) setPendingTarget('destination');
  };

  const updateStopLabel = (id: string, label: string) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  };

  const handleAndroidPickerChange = (_event: unknown, selected?: Date) => {
    setAndroidPickerStep(null);
    if (!selected) return;
    if (androidPickerStep === 'date') {
      const next = new Date(scheduledAt);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setScheduledAt(next);
      setAndroidPickerStep('time');
    } else {
      const next = new Date(scheduledAt);
      next.setHours(selected.getHours(), selected.getMinutes());
      setScheduledAt(next);
    }
  };

  // The exact "is this still in the future" check happens at submit time (handleConfirm) —
  // Date.now() is impure and must not be called during render (React Compiler purity rule).
  const scheduleReady = !scheduleEnabled || !!estimate;
  const canRequest = !!position && !!destination && stopsReady && scheduleReady && !submitting;

  const handleConfirm = async () => {
    if (!position || !destination) {
      setError('Choisissez une destination sur la carte.');
      return;
    }
    if (!canRequest) {
      setError(scheduleReady ? 'Complétez tous les arrêts sur la carte.' : "Choisissez une date valide pour la course programmée.");
      return;
    }
    if (scheduleEnabled && scheduledAt.getTime() <= Date.now()) {
      setError('Choisissez une date et une heure dans le futur.');
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
        stops: stops.map((s, i) => ({ label: s.label || `Arrêt ${i + 1}`, lat: s.point!.lat, lng: s.point!.lng })),
        mode: 'PRIVATE',
        vehicle_type: vehicleType,
        distance_km: estimate?.distanceKm,
        payment_method: paymentMethod,
        scheduled_at: scheduleEnabled ? scheduledAt.toISOString() : undefined,
      });
      router.push({ pathname: '/(app)/trip/[id]', params: { id: String(res.data.id) } });
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur lors de la demande de course');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingActiveTrip) return <Spinner style={{ flex: 1 }} />;

  const mapHint =
    pendingTarget !== 'destination'
      ? 'Touchez la carte pour placer cet arrêt'
      : !destination
        ? 'Touchez la carte pour choisir votre destination'
        : mapExpanded
          ? 'Touchez la carte pour modifier la destination'
          : null;

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
        <View style={styles.mapWrap}>
          <MapPreview myPosition={position} markers={markers} onPress={handleMapPress} height={mapExpanded ? MAP_EXPANDED_HEIGHT : MAP_COLLAPSED_HEIGHT} />
          {bookingOpen && destination && (
            <Pressable style={styles.mapToggleBtn} onPress={mapExpanded ? () => setMapExpanded(false) : editDestinationOnMap} hitSlop={6}>
              <Ionicons name={mapExpanded ? 'contract-outline' : 'expand-outline'} size={16} color={colors.brand[700]} />
            </Pressable>
          )}
        </View>
        {mapHint && <Text style={styles.mapHint}>{mapHint}</Text>}
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

          {stops.map((stop, i) => (
            <View key={stop.id} style={styles.stopRow}>
              <View style={{ flex: 1 }}>
                <Input
                  value={stop.label}
                  onChangeText={(v) => updateStopLabel(stop.id, v)}
                  placeholder={`Arrêt ${i + 1}`}
                  icon={<Ionicons name="ellipse-outline" size={14} color={stop.point ? colors.secondary[600] : colors.muted} />}
                />
              </View>
              <Pressable style={styles.stopIconBtn} onPress={() => placeStopOnMap(stop.id)} hitSlop={6}>
                <Ionicons name={stop.point ? 'checkmark-circle' : 'location-outline'} size={20} color={stop.point ? colors.secondary[600] : colors.brand[600]} />
              </Pressable>
              <Pressable style={styles.stopIconBtn} onPress={() => removeStop(stop.id)} hitSlop={6}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))}
          {stops.length < MAX_STOPS && (
            <Button variant="ghost" size="sm" onPress={addStop} icon={<Ionicons name="add" size={14} color={colors.brand[700]} />} style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}>
              Ajouter un arrêt
            </Button>
          )}

          <Text style={styles.fieldLabel}>Véhicule</Text>
          <View style={styles.pillRow}>
            {VEHICLE_TYPES.map((opt) => (
              <Pressable key={opt.value} onPress={() => setVehicleType(opt.value)} style={[styles.pill, vehicleType === opt.value && styles.pillActive]}>
                <Ionicons name={opt.icon} size={14} color={vehicleType === opt.value ? colors.brand[700] : colors.muted} />
                <Text style={[styles.pillText, vehicleType === opt.value && styles.pillTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Paiement</Text>
          <View style={styles.pillRow}>
            {PAYMENT_METHODS.map((opt) => (
              <Pressable key={opt.value} onPress={() => setPaymentMethod(opt.value)} style={[styles.pill, paymentMethod === opt.value && styles.pillActive]}>
                <Ionicons name={opt.icon} size={14} color={paymentMethod === opt.value ? colors.brand[700] : colors.muted} />
                <Text style={[styles.pillText, paymentMethod === opt.value && styles.pillTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.scheduleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Programmer pour plus tard</Text>
              <Text style={styles.fieldHint}>Sinon, un chauffeur est recherché immédiatement</Text>
            </View>
            <Switch value={scheduleEnabled} onValueChange={setScheduleEnabled} trackColor={{ false: colors.border, true: colors.secondary[400] }} thumbColor={colors.white} />
          </View>

          {scheduleEnabled &&
            (Platform.OS === 'ios' ? (
              <DateTimePicker value={scheduledAt} mode="datetime" display="inline" minimumDate={new Date()} onChange={(_e, d) => d && setScheduledAt(d)} style={{ marginBottom: spacing.md }} />
            ) : (
              <>
                <Button
                  variant="outline"
                  onPress={() => setAndroidPickerStep('date')}
                  icon={<Ionicons name="calendar-outline" size={14} color={colors.brand[700]} />}
                  style={{ marginBottom: spacing.md, alignSelf: 'flex-start' }}
                >
                  {scheduledAt.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Button>
                {androidPickerStep === 'date' && <DateTimePicker value={scheduledAt} mode="date" display="default" minimumDate={new Date()} onChange={handleAndroidPickerChange} />}
                {androidPickerStep === 'time' && <DateTimePicker value={scheduledAt} mode="time" display="default" onChange={handleAndroidPickerChange} />}
              </>
            ))}

          {nextRideDiscount && (
            <Pressable style={styles.discountBox} onPress={() => router.push('/(app)/rewards')}>
              <Ionicons name="gift-outline" size={16} color={colors.secondary[700]} />
              <Text style={styles.discountText}>
                Réduction de {nextRideDiscount.pct}% ({nextRideDiscount.label}) appliquée à cette course
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.secondary[700]} />
            </Pressable>
          )}

          {estimating && <Spinner />}
          {estimate && !estimating && (
            <View style={styles.estimateBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="speedometer-outline" size={14} color={colors.brand[700]} />
                <Text style={styles.estimateText}>{estimate.distanceKm.toFixed(1)} km</Text>
              </View>
              <Text style={styles.estimatePrice}>
                {estimate.priceMin != null && estimate.priceMax != null && estimate.priceMin !== estimate.priceMax
                  ? `${Math.round(estimate.priceMin).toLocaleString('fr-FR')}–${Math.round(estimate.priceMax).toLocaleString('fr-FR')} XOF`
                  : `~${Math.round(estimate.price).toLocaleString('fr-FR')} XOF`}
              </Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button fullWidth size="lg" onPress={handleConfirm} loading={submitting} disabled={!canRequest} style={{ marginTop: spacing.sm }}>
            {scheduleEnabled ? 'Programmer la course' : 'Confirmer la course'}
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
  mapWrap: { position: 'relative' },
  mapToggleBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
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
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stopIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text, marginBottom: spacing.sm },
  fieldHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillActive: { borderColor: colors.brand[500], backgroundColor: colors.brand[50] },
  pillText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.muted },
  pillTextActive: { color: colors.brand[700] },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
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
