import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { getRewardsStatus } from '@/lib/api';
import { colors, fonts, fontSizes, heroGradient, radii, spacing } from '@/constants/theme';
import type { RewardsStatus } from '@/types';

export default function RewardsScreen() {
  const [status, setStatus] = useState<RewardsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    getRewardsStatus()
      .then((r) => setStatus(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const span = status ? Math.max(0.001, status.next_checkpoint_km - status.last_checkpoint_km) : 0;
  const progressRatio = status ? Math.min(1, Math.max(0, (status.total_distance_km - status.last_checkpoint_km) / span)) : 0;
  const remainingKm = status ? Math.max(0, status.next_checkpoint_km - status.total_distance_km) : 0;

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Ionicons name="chevron-back" size={24} color={colors.text} onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Cadeaux de route</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <Spinner style={{ flex: 1 }} />
      ) : !status ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{error ? 'Impossible de charger votre progression pour le moment.' : 'Aucune progression pour le moment.'}</Text>
          {error && (
            <Button variant="outline" size="sm" onPress={load} style={{ marginTop: spacing.md }}>
              Réessayer
            </Button>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
          <LinearGradient colors={heroGradient.colors} locations={heroGradient.locations} start={heroGradient.start} end={heroGradient.end} style={styles.hero}>
            <Text style={styles.heroTitle}>
              <Ionicons name="gift" size={18} color={colors.white} /> Chaque km compte
            </Text>
            <Text style={styles.heroSubtitle}>Chaque kilomètre parcouru vous rapproche d&apos;un prochain checkpoint.</Text>
            <Text style={styles.heroValue}>
              {status.total_distance_km.toLocaleString('fr-FR')} <Text style={styles.heroUnit}>km parcourus</Text>
            </Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>{status.last_checkpoint_km.toFixed(0)} km</Text>
              <Text style={styles.progressLabelActive}>{remainingKm < 0.05 ? 'Checkpoint atteint !' : `Encore ${remainingKm.toFixed(1)} km`}</Text>
              <Text style={styles.progressLabel}>{status.next_checkpoint_km.toFixed(0)} km</Text>
            </View>
          </LinearGradient>

          {status.pending_discount && (
            <Card style={styles.discountCard}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="gift-outline" size={16} color={colors.secondary[600]} /> Réduction active
              </Text>
              <Text style={styles.discountText}>
                <Text style={{ fontFamily: fonts.bold, color: colors.secondary[700] }}>-{status.pending_discount.pct}%</Text> — {status.pending_discount.label} — sera appliquée automatiquement à votre prochaine course.
              </Text>
            </Card>
          )}

          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="sparkles-outline" size={16} color={colors.brand[600]} /> Comment ça marche ?
            </Text>
            <Text style={styles.bodyText}>
              Chaque kilomètre parcouru avec samaChauffeur vous rapproche d&apos;un checkpoint — le premier dès votre 1er km, puis les suivants apparaissent de façon aléatoire, un peu plus loin à chaque fois. Certains checkpoints cachent une réduction sur votre prochaine course, d&apos;autres non — la seule façon de savoir, c&apos;est de continuer à rouler !
            </Text>
          </Card>

          <Text style={styles.sectionTitle}>Historique des checkpoints</Text>
          {status.history.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Aucun checkpoint atteint pour l&apos;instant.</Text>
              <Text style={[styles.emptyText, { fontSize: fontSizes.xs, marginTop: 4 }]}>Le premier arrive dès votre 1er kilomètre parcouru !</Text>
            </View>
          ) : (
            status.history.map((h) => (
              <Card key={`${h.km}-${h.created_at}`} style={styles.historyRow} variant="outlined">
                <View style={[styles.historyIcon, h.discount_pct != null && styles.historyIconWon]}>
                  <Ionicons name="gift" size={14} color={h.discount_pct != null ? colors.secondary[700] : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>Checkpoint à {h.km.toFixed(0)} km</Text>
                  <Text style={styles.historyDate}>{new Date(h.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
                </View>
                <Text style={[styles.historyBadge, h.discount_pct != null && styles.historyBadgeWon]}>{h.discount_pct != null ? `-${h.discount_pct}%` : 'Pas de chance'}</Text>
              </Card>
            ))
          )}
        </ScrollView>
      )}
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
  container: { padding: spacing.xl, paddingBottom: spacing.huge },
  hero: { borderRadius: radii.xl2, padding: spacing.xl, marginBottom: spacing.lg },
  heroTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.md, color: colors.white, marginBottom: 4 },
  heroSubtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', marginBottom: spacing.lg },
  heroValue: { fontFamily: fonts.bold, fontSize: fontSizes.xxxl, color: colors.white },
  heroUnit: { fontFamily: fonts.medium, fontSize: fontSizes.md, color: 'rgba(255,255,255,0.75)' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: spacing.lg, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.white },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  progressLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.75)' },
  progressLabelActive: { fontFamily: fonts.semiBold, fontSize: fontSizes.xs, color: colors.white },
  discountCard: { marginBottom: spacing.lg, borderColor: colors.secondary[200], backgroundColor: colors.secondary[50] },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.md, color: colors.text, marginBottom: spacing.sm },
  discountText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.text },
  bodyText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, lineHeight: 20 },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing.huge, paddingHorizontal: spacing.xl },
  emptyText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  historyIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  historyIconWon: { backgroundColor: colors.secondary[100] },
  historyTitle: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  historyDate: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  historyBadge: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.muted,
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  historyBadgeWon: { color: colors.secondary[700], backgroundColor: colors.secondary[100] },
});
