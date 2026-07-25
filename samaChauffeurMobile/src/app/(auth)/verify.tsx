import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AuthLayout from '@/components/auth/AuthLayout';
import Button from '@/components/ui/Button';
import { verifyOtp } from '@/lib/api';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/theme';

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = params.phone ?? '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(phone, code);
      router.push({ pathname: '/(auth)/login', params: { phone } });
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Vérifiez votre code"
      subtitle={
        <Text>
          Code envoyé au <Text style={{ fontFamily: fonts.semiBold, color: colors.text }}>{phone}</Text>
        </Text>
      }
    >
      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        placeholder="——————"
        keyboardType="number-pad"
        maxLength={6}
      />
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Button onPress={handleSubmit} fullWidth size="lg" loading={loading}>
        Vérifier et continuer
      </Button>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: fontSizes.xxl,
    fontFamily: fonts.semiBold,
    letterSpacing: 8,
    paddingVertical: spacing.md,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontFamily: fonts.regular, fontSize: fontSizes.sm },
});
