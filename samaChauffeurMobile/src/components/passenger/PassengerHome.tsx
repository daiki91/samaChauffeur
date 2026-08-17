import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import FloatingIconButton from '@/components/ui/FloatingIconButton';
import MapPreview, { type MapMarker } from '@/components/map/MapPreview';
import { useLocation } from '@/hooks/useLocation';
import { createTrip, estimatePrice, getAvailableChauffeurs, getClientProfile, getMyTrips, getRewardsStatus } from '@/lib/api';
import { haversineKm } from '@/lib/geo';
import { useAuth } from '@/context/AuthContext';
import { PAYMENT_METHODS, VEHICLE_TYPES } from '@/constants/config';
import { colors, fonts, fontSizes, radii, shadows, spacing } from '@/constants/theme';
import type { AvailableChauffeur, LatLng, PendingDiscount, TransactionMethod, VehicleType } from '@/types';

const ONGOING_STATUSES = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED'];
const MAX_STOPS = 2;

type Stop = { id: string; label: string; point: LatLng | null };

export default function PassengerHome() {
  const { user } = useAuth();
  const { position } = useLocation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [drivers, setDrivers] = useState<AvailableChauffeur[]>([]);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [destinationLabel, setDestinationLabel] = useState('');
  const [originLabel, setOriginLabel] = useState('Ma position actuelle');
  const [stops, setStops] = useState<Stop[]>([]);
  // What the next map tap sets — the destination by default, or a specific stop while it's
  // being placed. The map stays full-bleed at all times now, so this is the only thing that
  // needs to change to route a tap to the right target (no more expand/collapse map dance).
  const [pendingTarget, setPendingTarget] = useState<'destination' | string>('destination');
  const [panelOpen, setPanelOpen] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR');
  const [paymentMethod, setPaymentMethod] = useState<TransactionMethod>('CASH');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [androidPickerStep, setAndroidPickerStep] = useState<'date' | 'time' | null>(null);
  const [estimate, setEstimate] = useState<{ price: number; distanceKm: number; priceMin?: number; priceMax?: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingActiveTrip, setCheckingActiveTrip] = useState(true);
  const [nextRideDiscount, setNextRideDiscount] = useState<PendingDiscount>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAvailableChauffeurs(position ? { lat: position.lat, lng: position.lng, radius: 15 } : undefined);
        setDrivers(res.data);
      } catch {
        // silently ignore — the pill's subtitle just shows 0
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
  // a saved promo code (see trips.routes.ts), surfaced both on the gift icon badge and the panel.
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
  // currently armed (the destination, or a specific stop being placed). The map is always
  // full-bleed now, so there's no expand/collapse choreography needed around this anymore —
  // whatever portion of the map isn't covered by the panel is always tappable.
  const handleMapPress = (point: LatLng) => {
    if (pendingTarget === 'destination') {
      setDestination(point);
      setPanelOpen(true);
    } else {
      const stopId = pendingTarget;
      setStops((prev) => prev.map((s) => (s.id === stopId ? { ...s, point } : s)));
      setPendingTarget('destination');
    }
  };

  const editDestinationOnMap = () => setPendingTarget('destination');

  const addStop = () => {
    if (stops.length >= MAX_STOPS) return;
    const id = `${Date.now()}-${Math.random()}`;
    setStops((prev) => [...prev, { id, label: '', point: null }]);
    setPendingTarget(id);
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

  const pickingHint = pendingTarget !== 'destination' ? 'Touchez la carte pour placer cet arrêt' : !destination ? 'Touchez la carte pour choisir votre destination' : null;
  const panelMaxHeight = windowHeight * 0.62;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MapPreview fill myPosition={position} markers={markers} onPress={handleMapPress} />

      {/* Top overlay — gift/rewards icon only, no marketing banner. */}
      <View style={[styles.topOverlay, { top: insets.top + spacing.md }]} pointerEvents="box-none">
        {user?.role === 'CLIENT' && (
          <FloatingIconButton icon="gift-outline" onPress={() => router.push('/(app)/rewards')} badge={nextRideDiscount ? `-${nextRideDiscount.pct}%` : null} />
        )}
      </View>

      {pickingHint && (
        <View style={[styles.hintPill, { top: insets.top + spacing.md }]} pointerEvents="none">
          <Text style={styles.hintPillText}>{pickingHint}</Text>
        </View>
      )}

      {/* Bottom overlay — collapsed search pill, expands in place into the full booking form. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottomOverlay} pointerEvents="box-none">
        <Animated.View layout={LinearTransition.duration(240)} style={styles.panel}>
          <Pressable style={styles.pillRow} onPress={() => setPanelOpen((v) => !v)}>
            <View style={styles.pillIcon}>
              <Ionicons name={destination ? 'flag' : 'search'} size={16} color={colors.brand[700]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pillTitle} numberOfLines={1}>
                {destination ? destinationLabel || 'Destination sélectionnée' : 'Où allez-vous ?'}
              </Text>
              {!panelOpen && <Text style={styles.pillSubtitle}>{drivers.length} chauffeur{drivers.length !== 1 ? 's' : ''} à proximité</Text>}
            </View>
            <Ionicons name={panelOpen ? 'chevron-down' : 'chevron-up'} size={18} color={colors.muted} />
          </Pressable>

          {panelOpen && (
            <ScrollView style={{ maxHeight: panelMaxHeight }} contentContainerStyle={styles.panelBody} keyboardShouldPersistTaps="handled">
              <Input label="Départ" value={originLabel} onChangeText={setOriginLabel} icon={<Ionicons name="locate-outline" size={16} color={colors.muted} />} />
              <Input
                label="Destination"
                value={destinationLabel}
                onChangeText={setDestinationLabel}
                placeholder="Nommez votre destination"
                icon={<Ionicons name="flag-outline" size={16} color={colors.muted} />}
                rightElement={
                  destination ? (
                    <Pressable onPress={editDestinationOnMap} hitSlop={6}>
                      <Ionicons name="locate" size={16} color={pendingTarget === 'destination' ? colors.brand[600] : colors.muted} />
                    </Pressable>
                  ) : undefined
                }
              />
              {!destination && <Text style={styles.hintText}>Touchez la carte pour placer votre destination.</Text>}

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
                  <Pressable style={styles.stopIconBtn} onPress={() => setPendingTarget(stop.id)} hitSlop={6}>
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
              <View style={styles.pillRowWrap}>
                {VEHICLE_TYPES.map((opt) => (
                  <Pressable key={opt.value} onPress={() => setVehicleType(opt.value)} style={[styles.optionPill, vehicleType === opt.value && styles.optionPillActive]}>
                    <Ionicons name={opt.icon} size={14} color={vehicleType === opt.value ? colors.brand[700] : colors.muted} />
                    <Text style={[styles.optionPillText, vehicleType === opt.value && styles.optionPillTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Paiement</Text>
              <View style={styles.pillRowWrap}>
                {PAYMENT_METHODS.map((opt) => (
                  <Pressable key={opt.value} onPress={() => setPaymentMethod(opt.value)} style={[styles.optionPill, paymentMethod === opt.value && styles.optionPillActive]}>
                    <Ionicons name={opt.icon} size={14} color={paymentMethod === opt.value ? colors.brand[700] : colors.muted} />
                    <Text style={[styles.optionPillText, paymentMethod === opt.value && styles.optionPillTextActive]}>{opt.label}</Text>
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
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    position: 'absolute',
    right: spacing.xl,
    flexDirection: 'row',
    gap: spacing.sm,
    zIndex: 2,
  },
  hintPill: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl + 44 + spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  hintPillText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.text, textAlign: 'center' },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl2,
    overflow: 'hidden',
    ...shadows.floating,
  },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  pillIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand[50], alignItems: 'center', justifyContent: 'center' },
  pillTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.text },
  pillSubtitle: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  panelBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  hintText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: -spacing.sm, marginBottom: spacing.md },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stopIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text, marginBottom: spacing.sm },
  fieldHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  pillRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  optionPillActive: { borderColor: colors.brand[500], backgroundColor: colors.brand[50] },
  optionPillText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.muted },
  optionPillTextActive: { color: colors.brand[700] },
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
