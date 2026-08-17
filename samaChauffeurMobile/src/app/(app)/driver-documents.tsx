import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { updateChauffeurDocuments } from '@/lib/api';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/theme';

async function pickDocument(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission requise', "Autorisez l'accès à vos photos pour ajouter ce document.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
  if (result.canceled || !result.assets[0]?.base64) return null;
  const asset = result.assets[0];
  return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
}

function DocumentSlot({ label, hint, icon, value, onChange }: { label: string; hint: string; icon: keyof typeof Ionicons.glyphMap; value: string | null; onChange: (v: string) => void }) {
  const [picking, setPicking] = useState(false);

  const handlePick = async () => {
    setPicking(true);
    try {
      const dataUrl = await pickDocument();
      if (dataUrl) onChange(dataUrl);
    } finally {
      setPicking(false);
    }
  };

  return (
    <Card variant="outlined" style={[styles.slot, value && styles.slotDone]}>
      <View style={styles.slotRow}>
        <View style={[styles.slotIcon, value && styles.slotIconDone]}>
          <Ionicons name={value ? 'checkmark' : icon} size={16} color={value ? colors.secondary[700] : colors.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.slotLabel}>{label}</Text>
          <Text style={styles.slotHint}>{value ? 'Fichier ajouté' : hint}</Text>
        </View>
        <Button variant="outline" size="sm" onPress={handlePick} loading={picking} icon={<Ionicons name="cloud-upload-outline" size={14} color={colors.brand[700]} />}>
          {value ? 'Changer' : 'Ajouter'}
        </Button>
      </View>
    </Card>
  );
}

export default function DriverDocumentsScreen() {
  const { chauffeur, updateChauffeur } = useAuth();
  const [permit, setPermit] = useState<string | null>(chauffeur?.permit ?? null);
  const [insurance, setInsurance] = useState<string | null>(chauffeur?.insurance ?? null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!permit && !!insurance;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await updateChauffeurDocuments(permit, insurance);
      updateChauffeur(res.data);
      router.back();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.detail || "Erreur lors de l'envoi des documents");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.iconBadge}>
        <Ionicons name="shield-checkmark" size={26} color={colors.white} />
      </View>
      <Text style={styles.title}>Complétez votre dossier</Text>
      <Text style={styles.subtitle}>Dernière étape : ajoutez vos documents pour qu&apos;un admin puisse activer votre compte.</Text>

      <ScrollView contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <DocumentSlot label="Permis de conduire" hint="Photo ou scan lisible" icon="document-text-outline" value={permit} onChange={setPermit} />
        <DocumentSlot label="Assurance du véhicule" hint="Attestation en cours de validité" icon="shield-outline" value={insurance} onChange={setInsurance} />

        <Button fullWidth size="lg" onPress={handleSubmit} loading={submitting} disabled={!canSubmit} style={{ marginTop: spacing.md }}>
          Envoyer mon dossier
        </Button>
        <Button variant="ghost" fullWidth onPress={() => router.back()} disabled={submitting}>
          Plus tard
        </Button>
      </ScrollView>
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
  },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.text, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center', marginTop: spacing.xs },
  slot: { padding: spacing.md },
  slotDone: { borderColor: colors.secondary[200], backgroundColor: colors.secondary[50] },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  slotIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  slotIconDone: { backgroundColor: colors.secondary[100] },
  slotLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  slotHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
});
