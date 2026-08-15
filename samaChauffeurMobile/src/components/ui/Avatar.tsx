import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes } from '@/constants/theme';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Tone = 'brand' | 'secondary' | 'neutral';

const SIZES: Record<Size, number> = { sm: 32, md: 44, lg: 56, xl: 76 };
const ICON_SIZES: Record<Size, number> = { sm: 16, md: 20, lg: 26, xl: 34 };
const FONT_SIZES: Record<Size, number> = { sm: fontSizes.xs, md: fontSizes.sm, lg: fontSizes.lg, xl: fontSizes.xxl };

const TONES: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: colors.brand[100], fg: colors.brand[700] },
  secondary: { bg: colors.secondary[100], fg: colors.secondary[700] },
  neutral: { bg: colors.border, fg: colors.muted },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Props = {
  name?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: Size;
  tone?: Tone;
  /** small colored dot in the corner — used to show online/available status */
  badge?: boolean;
  badgeColor?: string;
};

export default function Avatar({ name, icon = 'person', size = 'md', tone = 'brand', badge = false, badgeColor }: Props) {
  const dimension = SIZES[size];
  const palette = TONES[tone];
  return (
    <View style={{ width: dimension, height: dimension }}>
      <View
        style={[
          styles.circle,
          { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: palette.bg },
        ]}
      >
        {name ? (
          <Text style={[styles.initials, { color: palette.fg, fontSize: FONT_SIZES[size] }]}>{initials(name)}</Text>
        ) : (
          <Ionicons name={icon} size={ICON_SIZES[size]} color={palette.fg} />
        )}
      </View>
      {badge && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: badgeColor ?? colors.secondary[500],
              width: dimension * 0.28,
              height: dimension * 0.28,
              borderRadius: dimension * 0.14,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.semiBold },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
