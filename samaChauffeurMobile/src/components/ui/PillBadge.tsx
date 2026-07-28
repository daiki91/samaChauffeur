import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/theme';

export default function PillBadge({ children, light = true }: { children: React.ReactNode; light?: boolean }) {
  return (
    <View style={[styles.wrap, light ? styles.light : styles.dark]}>
      <Text style={[styles.text, light ? styles.textLight : styles.textDark]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginBottom: spacing.md,
  },
  light: { backgroundColor: 'rgba(255,255,255,0.22)' },
  dark: { backgroundColor: 'rgba(0,0,0,0.06)' },
  text: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textLight: { color: colors.white },
  textDark: { color: colors.text },
});
