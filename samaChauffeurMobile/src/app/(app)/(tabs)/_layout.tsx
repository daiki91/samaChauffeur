import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, fontSizes } from '@/constants/theme';

export default function TabsLayout() {
  const { mode } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border, height: 56 + insets.bottom, paddingBottom: insets.bottom + 6, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: fontSizes.xs },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: mode === 'driver' ? 'Chauffeur' : 'Accueil',
          tabBarIcon: ({ color, size }) => <Ionicons name={mode === 'driver' ? 'speedometer-outline' : 'home-outline'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: mode === 'driver' ? 'Revenus' : 'Historique',
          tabBarIcon: ({ color, size }) => <Ionicons name={mode === 'driver' ? 'wallet-outline' : 'time-outline'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
