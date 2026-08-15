import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthLayout from '@/components/auth/AuthLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { sendOtp } from '@/lib/api';
import { colors, fonts, radii, spacing } from '@/constants/theme';

export default function PhoneScreen() {
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(params.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setNotRegistered(false);
    try {
      await sendOtp(phone);
      router.push({ pathname: '/(auth)/verify', params: { phone } });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Erreur réseau';
      setError(detail);
      if (detail === 'User not found. Register first.') setNotRegistered(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Vérifier votre numéro"
      subtitle="Entrez le numéro utilisé lors de l'inscription pour recevoir le code de vérification."
      step={{ current: 2, total: 3 }}
    >
      <Input
        label="Téléphone"
        value={phone}
        onChangeText={setPhone}
        placeholder="+237 6 00 00 00 00"
        keyboardType="phone-pad"
        icon={<Ionicons name="call-outline" size={16} color={colors.muted} />}
      />
      {error && (
        <View style={{ backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.md }}>
          <Text style={{ color: colors.danger, fontFamily: fonts.regular }}>{error}</Text>
          {notRegistered && (
            <Link href="/(auth)/register" style={{ fontFamily: fonts.semiBold, color: colors.danger, marginTop: 4 }}>
              S&apos;inscrire
            </Link>
          )}
        </View>
      )}
      <Button onPress={handleSubmit} fullWidth size="lg" loading={loading}>
        Envoyer le code
      </Button>
    </AuthLayout>
  );
}
