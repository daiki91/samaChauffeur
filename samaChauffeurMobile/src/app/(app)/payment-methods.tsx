import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { addPaymentMethod, getPaymentMethods } from '@/lib/api';
import { colors, fonts, fontSizes, spacing } from '@/constants/theme';
import type { PaymentMethod } from '@/types';

const PROVIDERS = ['ORANGE', 'WAVE', 'FREE', 'CARD'];

export default function PaymentMethodsScreen() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getPaymentMethods();
      setMethods(res.data);
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

  const handleAdd = async (provider: string) => {
    setAdding(true);
    try {
      await addPaymentMethod({ provider, is_default: methods.length === 0 });
      load();
    } finally {
      setAdding(false);
    }
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Ionicons name="chevron-back" size={24} color={colors.text} onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Moyens de paiement</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <Spinner style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          {methods.length === 0 && <Text style={styles.emptyText}>Aucun moyen de paiement enregistré.</Text>}
          {methods.map((m) => (
            <Card key={m.id} style={styles.row}>
              <Ionicons name="wallet-outline" size={18} color={colors.brand[600]} />
              <Text style={styles.rowText}>{m.provider}</Text>
              {m.is_default && <Text style={styles.defaultTag}>Par défaut</Text>}
            </Card>
          ))}

          <Text style={styles.sectionTitle}>Ajouter un moyen de paiement</Text>
          <View style={styles.providerGrid}>
            {PROVIDERS.map((p) => (
              <Button key={p} variant="outline" size="sm" onPress={() => handleAdd(p)} loading={adding} style={{ marginBottom: spacing.sm }}>
                {p}
              </Button>
            ))}
          </View>
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
  container: { padding: spacing.xl },
  emptyText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rowText: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  defaultTag: { marginLeft: 'auto', fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.secondary[600] },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.md, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md },
  providerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
