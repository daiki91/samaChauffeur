import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, fontSizes, spacing } from '@/constants/theme';

export default function ProfileTab() {
  const { user, chauffeur, mode, setMode, canDriverMode, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/(auth)/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatarWrap}>
        <Avatar name={user?.username} size="xl" tone="brand" />
        <Text style={styles.name}>{user?.username}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        {mode && (
          <View style={styles.modePill}>
            <Ionicons name={mode === 'driver' ? 'car-sport' : 'person'} size={12} color={colors.brand[700]} />
            <Text style={styles.modePillText}>{mode === 'driver' ? 'Mode chauffeur' : 'Mode passager'}</Text>
          </View>
        )}
      </View>

      {canDriverMode && (
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Mode chauffeur</Text>
            <Text style={styles.rowSubtitle}>Basculez entre passager et chauffeur</Text>
          </View>
          <Switch
            value={mode === 'driver'}
            onValueChange={(v) => setMode(v ? 'driver' : 'passenger')}
            trackColor={{ false: colors.border, true: colors.secondary[400] }}
            thumbColor={colors.white}
          />
        </Card>
      )}

      {user?.role === 'CLIENT' && (
        <Card style={styles.linkRow} onPress={() => router.push('/(app)/become-driver')}>
          <Ionicons name="car-outline" size={20} color={colors.brand[600]} />
          <Text style={styles.linkText}>Devenir chauffeur</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 'auto' }} />
        </Card>
      )}

      {user?.role === 'CHAUFFEUR' && !chauffeur?.is_verified && (
        <Card style={{ backgroundColor: colors.accent[300] + '33', marginBottom: spacing.md }}>
          <Text style={styles.pendingText}>
            <Ionicons name="hourglass-outline" size={14} /> Votre profil chauffeur est en attente de vérification par un administrateur.
          </Text>
        </Card>
      )}

      <Card style={styles.linkRow} onPress={() => router.push('/(app)/payment-methods')}>
        <Ionicons name="card-outline" size={20} color={colors.brand[600]} />
        <Text style={styles.linkText}>Moyens de paiement</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 'auto' }} />
      </Card>

      <Card>
        <Text style={styles.rowTitle}>Langue</Text>
        <Text style={styles.rowSubtitle}>{user?.language === 'wo' ? 'Wolof' : 'Français'}</Text>
      </Card>

      <Button
        variant="outline"
        fullWidth
        size="lg"
        loading={loggingOut}
        onPress={() => Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Déconnexion', style: 'destructive', onPress: handleLogout },
        ])}
        style={{ marginTop: spacing.xl }}
      >
        Se déconnecter
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.huge, gap: spacing.md },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.lg, gap: 4 },
  name: { fontFamily: fonts.semiBold, fontSize: fontSizes.lg, color: colors.text, marginTop: spacing.sm },
  phone: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand[50],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  modePillText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.brand[700] },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  rowSubtitle: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  pendingText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.brand[800], lineHeight: 18 },
});
