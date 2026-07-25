import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/theme';
import type { Trip } from '@/types';

const METHODS = [
  { value: 'ORANGE', label: 'Orange Money', icon: 'phone-portrait-outline' as const },
  { value: 'WAVE', label: 'Wave', icon: 'wallet-outline' as const },
  { value: 'FREE', label: 'Free Money', icon: 'cash-outline' as const },
  { value: 'CASH', label: 'Espèces', icon: 'cash' as const },
  { value: 'CARD', label: 'Carte', icon: 'card-outline' as const },
];

type Props = {
  visible: boolean;
  trip: Trip | null;
  onClose: () => void;
  onConfirm: (amount: number, method: string) => Promise<void>;
};

export default function PaymentModal({ visible, trip, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState('ORANGE');
  const [loading, setLoading] = useState(false);

  if (!trip) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(trip.price ?? 0, method);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Payer la course</Text>
          <Text style={styles.amount}>{trip.price ?? 0} XOF</Text>

          {METHODS.map((m) => (
            <Pressable key={m.value} style={[styles.methodRow, method === m.value && styles.methodRowActive]} onPress={() => setMethod(m.value)}>
              <Ionicons name={m.icon} size={18} color={method === m.value ? colors.brand[700] : colors.muted} />
              <Text style={[styles.methodLabel, method === m.value && { color: colors.brand[700] }]}>{m.label}</Text>
              {method === m.value && <Ionicons name="checkmark-circle" size={18} color={colors.brand[600]} style={{ marginLeft: 'auto' }} />}
            </Pressable>
          ))}

          <View style={styles.actions}>
            <Button variant="outline" onPress={onClose} style={{ flex: 1 }}>
              Annuler
            </Button>
            <Button onPress={handleConfirm} loading={loading} style={{ flex: 1 }}>
              Payer
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,15,10,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl2, borderTopRightRadius: radii.xl2, padding: spacing.xl },
  title: { fontFamily: fonts.semiBold, fontSize: fontSizes.lg, color: colors.text },
  amount: { fontFamily: fonts.bold, fontSize: fontSizes.xxl, color: colors.brand[700], marginBottom: spacing.lg },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  methodRowActive: { borderColor: colors.brand[400], backgroundColor: colors.brand[50] },
  methodLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
