import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'outlineLight' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
};

export default function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && { width: '100%' },
        isDisabled && { opacity: 0.5 },
        // a tactile press-scale (à la Uber/Bolt) instead of a plain opacity fade
        pressed && !isDisabled && { transform: [{ scale: 0.97 }], opacity: 0.92 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'secondary' || variant === 'danger' ? colors.white : colors.brand[600]} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, labelVariantStyles[variant], size === 'sm' && { fontSize: fontSizes.sm }]}>{children}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
  },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { paddingVertical: 8, paddingHorizontal: 16 },
  md: { paddingVertical: 13, paddingHorizontal: 20 },
  lg: { paddingVertical: 16, paddingHorizontal: 24 },
};

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.brand[600] },
  secondary: { backgroundColor: colors.secondary[600] },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.brand[300] },
  outlineLight: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  ghost: { backgroundColor: colors.brand[50] },
  danger: { backgroundColor: colors.danger },
};

const labelVariantStyles: Record<Variant, { color: string }> = {
  primary: { color: colors.white },
  secondary: { color: colors.white },
  outline: { color: colors.brand[700] },
  outlineLight: { color: colors.white },
  ghost: { color: colors.brand[700] },
  danger: { color: colors.white },
};
