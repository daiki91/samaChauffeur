import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import PaymentModal from '@/components/passenger/PaymentModal';
import { useAuth } from '@/context/AuthContext';
import { getMyTrips, getPaymentsSummary, getPendingPaymentsForDriver, makePayment, validateTransaction } from '@/lib/api';
import { colors, fonts, fontSizes, spacing } from '@/constants/theme';
import type { PaymentsSummary, Trip } from '@/types';

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
        <Card style={{ backgroundColor: colors.secondary[50], marginBottom: spacing.lg }}>
          <Text style={styles.summaryLabel}>Total dépensé</Text>
          <Text style={styles.summaryValue}>{summary.total_spent} XOF</Text>
        </Card>
      )}

      {trips.length === 0 && <Text style={styles.emptyText}>Aucune course pour l&apos;instant.</Text>}
      {trips.map((t) => (
        <Card key={t.id} style={styles.row}>
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

function DriverEarnings() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleValidate = async (id: number) => {
    try {
      await validateTransaction(id);
      load();
    } catch {
      // ignore
    }
  };

  if (loading) return <Spinner style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Text style={styles.pageTitle}>Paiements en attente</Text>
      {pending.length === 0 && <Text style={styles.emptyText}>Aucun paiement en attente.</Text>}
      {pending.map((tx) => (
        <Card key={tx.id} style={styles.row}>
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
  summaryLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.secondary[700] },
  summaryValue: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.secondary[800], marginTop: 2 },
  emptyText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', paddingVertical: spacing.huge },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  routeText: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  metaText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
});
