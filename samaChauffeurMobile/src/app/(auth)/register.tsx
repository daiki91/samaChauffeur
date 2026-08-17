import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthLayout from '@/components/auth/AuthLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/theme';
import type { Role } from '@/types';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CLIENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await register({ username, phone, password, role: role as 'CLIENT' | 'CHAUFFEUR' });
      router.push({ pathname: '/(auth)/login', params: { phone } });
    } catch (err: any) {
      const data = err?.response?.data;
      setError(typeof data === 'string' ? data : data?.detail || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Rejoignez samaChauffeur en moins d'une minute."
      footer={
        <Text style={{ fontFamily: fonts.regular, color: colors.muted }}>
          Déjà inscrit ?{' '}
          <Link href="/(auth)/login" style={{ fontFamily: fonts.semiBold, color: colors.brand[600] }}>
            Se connecter
          </Link>
        </Text>
      }
    >
      <Input label="Nom d'utilisateur" value={username} onChangeText={setUsername} icon={<Ionicons name="person-outline" size={16} color={colors.muted} />} />
      <Input
        label="Téléphone"
        value={phone}
        onChangeText={setPhone}
        placeholder="+237 6 00 00 00 00"
        keyboardType="phone-pad"
        icon={<Ionicons name="call-outline" size={16} color={colors.muted} />}
      />
      <Input
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        placeholder="Au moins 6 caractères"
        secureTextEntry
        icon={<Ionicons name="lock-closed-outline" size={16} color={colors.muted} />}
      />

      <Text style={styles.roleLabel}>Je suis...</Text>
      <View style={styles.roleRow}>
        {(
          [
            { value: 'CLIENT', label: 'Passager', icon: 'person-circle-outline' },
            { value: 'CHAUFFEUR', label: 'Chauffeur', icon: 'car-outline' },
          ] as const
        ).map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.roleOption, role === opt.value && styles.roleOptionActive]}
            onPress={() => setRole(opt.value)}
          >
            <Ionicons name={opt.icon} size={20} color={role === opt.value ? colors.brand[700] : colors.muted} />
            <Text style={[styles.roleText, role === opt.value && { color: colors.brand[700] }]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Button onPress={handleSubmit} fullWidth size="lg" loading={loading} style={{ marginTop: spacing.md }}>
        Créer mon compte
      </Button>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  roleLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  roleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
  },
  roleOptionActive: { borderColor: colors.brand[500], backgroundColor: colors.brand[50] },
  roleText: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.muted },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontFamily: fonts.regular, fontSize: fontSizes.sm },
});
