import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthLayout from '@/components/auth/AuthLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, radii, spacing } from '@/constants/theme';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ phone?: string }>();
  const { login } = useAuth();
  const [phone, setPhone] = useState(params.phone ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(phone, password);
      router.replace('/(app)/(tabs)');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Content de vous revoir"
      subtitle="Connectez-vous pour réserver ou prendre le volant."
      footer={
        <Text style={{ fontFamily: fonts.regular, color: colors.muted }}>
          Pas encore de compte ?{' '}
          <Link href="/(auth)/register" style={{ fontFamily: fonts.semiBold, color: colors.brand[600] }}>
            Créer un compte
          </Link>
        </Text>
      }
    >
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
        placeholder="••••••••"
        secureTextEntry
        icon={<Ionicons name="lock-closed-outline" size={16} color={colors.muted} />}
      />
      {error && (
        <View style={{ backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.md }}>
          <Text style={{ color: colors.danger, fontFamily: fonts.regular }}>{error}</Text>
        </View>
      )}
      <Button onPress={handleSubmit} fullWidth size="lg" loading={loading}>
        Se connecter
      </Button>
    </AuthLayout>
  );
}
