import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';

export default function AppGroupLayout() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand[600]} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trip/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="payment-methods" options={{ presentation: 'card' }} />
      <Stack.Screen name="become-driver" options={{ presentation: 'modal' }} />
      <Stack.Screen name="driver-documents" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
