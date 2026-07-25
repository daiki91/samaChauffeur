import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, radii } from '@/constants/theme';

export default function MapPlaceholder({ label = 'Carte indisponible' }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="map-outline" size={34} color={colors.brand[300]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: radii.xl,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.brand[400],
  },
});
