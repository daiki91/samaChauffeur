import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PillBadge from '@/components/ui/PillBadge';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import MapPreview, { type MapMarker } from '@/components/map/MapPreview';
import { useLocation } from '@/hooks/useLocation';
import { createTrip, estimatePrice, getAvailableChauffeurs } from '@/lib/api';
import { haversineKm } from '@/lib/geo';
import { colors, fonts, fontSizes, heroGradient, radii, spacing } from '@/constants/theme';
import type { AvailableChauffeur, LatLng } from '@/types';

export default function PassengerHome() {
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
          <View style={styles.liveDot} />
        </View>
      </LinearGradient>

      <View style={styles.mapSection}>
        <MapPreview myPosition={position} markers={markers} onPress={(p) => setDestination(p)} height={240} />
        <Text style={styles.mapHint}>Touchez la carte pour choisir votre destination</Text>
      </View>

      {bookingOpen && (
        <Card style={{ marginHorizontal: spacing.xl, marginTop: spacing.md }}>
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

          {estimating && <Spinner />}
          {estimate && !estimating && (
            <View style={styles.estimateBox}>
              <Text style={styles.estimateText}>{estimate.distanceKm.toFixed(1)} km</Text>
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
  liveDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.secondary[400], borderWidth: 2, borderColor: colors.white },
  mapSection: { padding: spacing.xl },
  mapHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: spacing.sm, textAlign: 'center' },
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
});
