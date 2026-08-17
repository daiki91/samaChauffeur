import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { applyChauffeur } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { VEHICLE_TYPES } from '@/constants/config';
import { colors, fonts, fontSizes, radii, shadows, spacing } from '@/constants/theme';
import type { VehicleType } from '@/types';

export default function BecomeDriverScreen() {
  const { refreshMe, refreshChauffeurStatus } = useAuth();
  const [type, setType] = useState<VehicleType>('CAR');
  const [seats, setSeats] = useState('4');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await applyChauffeur({ type, seats: Number(seats) || 1, plate_number: plate });
      await refreshMe();
      await refreshChauffeurStatus();
      router.replace('/(app)/driver-documents');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur lors de la demande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.iconBadge}>
        <Ionicons name="car" size={26} color={colors.white} />
      </View>
      <Text style={styles.title}>Devenir chauffeur</Text>
      <Text style={styles.subtitle}>Renseignez votre véhicule — un admin devra vérifier votre profil avant activation.</Text>

      <Card style={{ marginTop: spacing.xl }}>
        <Text style={styles.label}>Type de véhicule</Text>
        <View style={styles.typeGrid}>
          {VEHICLE_TYPES.map((opt) => (
            <Pressable key={opt.value} onPress={() => setType(opt.value)} style={[styles.typeOption, type === opt.value && styles.typeOptionActive]}>
              <Ionicons name={opt.icon} size={18} color={type === opt.value ? colors.brand[700] : colors.muted} />
              <Text style={[styles.typeLabel, type === opt.value && { color: colors.brand[700] }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <Input label="Nombre de sièges" value={seats} onChangeText={setSeats} keyboardType="number-pad" icon={<Ionicons name="people-outline" size={16} color={colors.muted} />} />
        <Input
          label="Plaque d'immatriculation"
          value={plate}
          onChangeText={setPlate}
          placeholder="LT-1234-A"
          icon={<Ionicons name="pricetag-outline" size={16} color={colors.muted} />}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button fullWidth size="lg" onPress={handleSubmit} loading={loading}>
          Soumettre ma demande
        </Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.text, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', marginTop: spacing.xs },
  label: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text, marginBottom: spacing.sm },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  typeOption: {
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  typeOptionActive: { borderColor: colors.brand[500], backgroundColor: colors.brand[50] },
  typeLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.muted },
  errorText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.danger, marginBottom: spacing.md },
});
