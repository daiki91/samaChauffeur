import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

export default function AuthGroupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
