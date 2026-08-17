import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import PaymentModal from '@/components/passenger/PaymentModal';
import { useAuth } from '@/context/AuthContext';
import {
  getDriverStats,
  getEarningsSummary,
  getMyPayouts,
  getMyTrips,
  getPaymentsSummary,
  getPendingPaymentsForDriver,
  makePayment,
  requestPayout,
  validateTransaction,
} from '@/lib/api';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/theme';
import type { DriverStats, EarningsSummary, Payout, PaymentsSummary, Trip } from '@/types';

function PassengerHistory() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalTrip, setModalTrip] = useState<Trip | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([getMyTrips(), getPaymentsSummary()]);
      setTrips(t.data);
      setSummary(s.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handlePay = async (amount: number, method: string) => {
    if (!modalTrip) return;
    await makePayment({ amount, currency: 'XOF', method, metadata: { trip_id: modalTrip.id } });
    load();
  };

  if (loading) return <Spinner style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Text style={styles.pageTitle}>Historique des courses</Text>

      {summary && (
        <Card style={styles.summaryCard} floating>
          <View>
            <Text style={styles.summaryLabel}>Total dépensé</Text>
            <Text style={styles.summaryValue}>{summary.total_spent.toLocaleString('fr-FR')} XOF</Text>
          </View>
          <View style={styles.summaryIcon}>
            <Ionicons name="receipt-outline" size={22} color={colors.secondary[700]} />
          </View>
        </Card>
      )}

      {trips.length === 0 && <Text style={styles.emptyText}>Aucune course pour l&apos;instant.</Text>}
      {trips.map((t) => (
        <Card key={t.id} style={styles.row} variant="outlined">
          <View style={styles.routeIcon}>
            <Ionicons name="navigate" size={14} color={colors.brand[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeText} numberOfLines={1}>
              {t.origin} → {t.destination}
            </Text>
            <Text style={styles.metaText}>{t.price ? `${t.price} XOF` : 'Prix non estimé'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
            <Badge status={t.status} />
            {t.status === 'COMPLETED' && (
              <Button size="sm" variant="secondary" onPress={() => setModalTrip(t)}>
                Payer
              </Button>
            )}
          </View>
        </Card>
      ))}

      <PaymentModal visible={!!modalTrip} trip={modalTrip} onClose={() => setModalTrip(null)} onConfirm={handlePay} />
    </ScrollView>
  );
}

type Preset = 'week' | 'month' | 'year';

const PERIOD_OPTIONS: { value: Preset; label: string }[] = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

// Simple rolling window ending now (no calendar-alignment or prev/next navigation, unlike the
// web version's fuller period picker) — trades some precision for a much simpler mobile UI.
function presetRangeIso(preset: Preset): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (preset === 'week') from.setDate(from.getDate() - 7);
  else if (preset === 'month') from.setMonth(from.getMonth() - 1);
  else from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function DriverEarnings() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<Preset>('week');
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutFormOpen, setPayoutFormOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await getPendingPaymentsForDriver();
      setPending(p.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshEarnings = useCallback(() => {
    getEarningsSummary()
      .then((r) => setEarnings(r.data))
      .catch(() => {});
    getMyPayouts()
      .then((r) => setPayouts(r.data))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshEarnings();
    }, [load, refreshEarnings]),
  );

  const { from, to } = useMemo(() => presetRangeIso(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the period-scoped fetch
    setStatsLoading(true);
    getDriverStats(from, to)
      .then((r) => {
        if (!cancelled) setStats(r.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const handleValidate = async (id: number) => {
    try {
      await validateTransaction(id);
      load();
    } catch {
      // ignore
    }
  };

  const handleRequestPayout = async () => {
    const amount = Number(payoutAmount);
    if (!amount || amount <= 0) return;
    setRequestingPayout(true);
    try {
      await requestPayout(amount);
      setPayoutAmount('');
      setPayoutFormOpen(false);
      refreshEarnings();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.detail || 'Erreur lors de la demande de retrait');
    } finally {
      setRequestingPayout(false);
    }
  };

  if (loading) return <Spinner style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { load(); refreshEarnings(); }} />}>
      <Text style={styles.pageTitle}>Espace chauffeur</Text>

      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => (
          <Button key={opt.value} size="sm" variant={preset === opt.value ? 'primary' : 'outline'} onPress={() => setPreset(opt.value)}>
            {opt.label}
          </Button>
        ))}
      </View>

      {statsLoading ? (
        <Spinner />
      ) : (
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{(stats?.total_distance_km ?? 0).toLocaleString('fr-FR')} km</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Gagné</Text>
            <Text style={[styles.statValue, { color: colors.secondary[700] }]}>{(stats?.total_earnings ?? 0).toLocaleString('fr-FR')} XOF</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Courses</Text>
            <Text style={styles.statValue}>{stats?.total_trips ?? 0}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Prix moyen</Text>
            <Text style={styles.statValue}>{(stats?.average_price ?? 0).toLocaleString('fr-FR')} XOF</Text>
          </Card>
        </View>
      )}

      <Card style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
        <View style={styles.balanceHeaderRow}>
          <Text style={styles.sectionTitle}>Solde & retraits</Text>
          <Button size="sm" variant="outline" disabled={!earnings || earnings.available_balance <= 0} onPress={() => setPayoutFormOpen((v) => !v)}>
            Retirer
          </Button>
        </View>
        <View style={styles.balanceGrid}>
          <View style={styles.balanceBox}>
            <Text style={styles.statLabel}>Disponible</Text>
            <Text style={[styles.statValue, { color: colors.secondary[700] }]}>{(earnings?.available_balance ?? 0).toLocaleString('fr-FR')} XOF</Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.statLabel}>Total gagné</Text>
            <Text style={styles.statValue}>{(earnings?.total_earnings ?? 0).toLocaleString('fr-FR')} XOF</Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.statLabel}>Déjà retiré</Text>
            <Text style={styles.statValue}>{(earnings?.total_paid_out ?? 0).toLocaleString('fr-FR')} XOF</Text>
          </View>
        </View>

        {payoutFormOpen && (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input placeholder={`Max ${(earnings?.available_balance ?? 0).toLocaleString('fr-FR')}`} keyboardType="number-pad" value={payoutAmount} onChangeText={setPayoutAmount} />
            </View>
            <Button onPress={handleRequestPayout} loading={requestingPayout} disabled={!payoutAmount || Number(payoutAmount) <= 0}>
              Envoyer
            </Button>
          </View>
        )}

        {payouts.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            {payouts.map((p) => (
              <View key={p.id} style={styles.payoutRow}>
                <Text style={styles.metaText}>{p.amount.toLocaleString('fr-FR')} XOF</Text>
                <Badge status={p.status} />
              </View>
            ))}
          </View>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Paiements en attente</Text>
      {pending.length === 0 && <Text style={styles.emptyText}>Aucun paiement en attente.</Text>}
      {pending.map((tx) => (
        <Card key={tx.id} style={styles.row} variant="outlined">
          <View style={styles.routeIcon}>
            <Ionicons name="wallet-outline" size={14} color={colors.brand[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeText}>Course #{tx.metadata?.trip_id}</Text>
            <Text style={styles.metaText}>
              {tx.amount} {tx.currency}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
            <Badge status={tx.status} />
            <Button size="sm" variant="secondary" onPress={() => handleValidate(tx.id)}>
              Valider
            </Button>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

export default function HistoryTab() {
  const { mode } = useAuth();
  return mode === 'driver' ? <DriverEarnings /> : <PassengerHistory />;
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.huge },
  pageTitle: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.text, marginBottom: spacing.lg },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary[50],
    marginBottom: spacing.lg,
  },
  summaryLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.secondary[700] },
  summaryValue: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.secondary[800], marginTop: 2 },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', paddingVertical: spacing.huge },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  routeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeText: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  metaText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  periodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { flexBasis: '47%', flexGrow: 1 },
  statLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.muted },
  statValue: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.md, color: colors.text, marginBottom: spacing.md },
  balanceHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  balanceGrid: { flexDirection: 'row', gap: spacing.sm },
  balanceBox: { flex: 1, backgroundColor: colors.background, borderRadius: radii.lg, padding: spacing.md },
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
});
