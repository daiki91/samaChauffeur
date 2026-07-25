import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  floating?: boolean;
  onPress?: () => void;
};

export default function Card({ children, style, padded = true, floating = false, onPress }: Props) {
  const content = (
    <View style={[styles.base, floating ? shadows.floating : shadows.card, padded && { padding: spacing.lg }, style]}>{children}</View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
  },
});
