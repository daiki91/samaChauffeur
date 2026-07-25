import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';

export default function Index() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand[600]} size="large" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(app)/(tabs)' : '/(auth)/login'} />;
}
