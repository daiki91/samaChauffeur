import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '@/constants/theme';

type Variant = 'elevated' | 'outlined' | 'flat';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  floating?: boolean;
  variant?: Variant;
  onPress?: () => void;
};

export default function Card({ children, style, padded = true, floating = false, variant = 'elevated', onPress }: Props) {
  const content = (
    <View
      style={[
        styles.base,
        variant === 'elevated' && (floating ? shadows.floating : shadows.card),
        variant === 'outlined' && styles.outlined,
        padded && { padding: spacing.lg },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: colors.border,
  },
});
