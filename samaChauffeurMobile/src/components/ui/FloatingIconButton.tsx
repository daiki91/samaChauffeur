import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, shadows } from '@/constants/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Small colored dot/label shown in the top-right corner — e.g. an active discount. */
  badge?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

// A single floating circular button — the pattern reused for the gift/rewards icon and the
// map expand/collapse control on the map-first Home screens. 44px default: below that, touch
// targets get uncomfortably small for a control floating over a live map.
export default function FloatingIconButton({ icon, onPress, badge, size = 44, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.45} color={colors.brand[700]} />
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.secondary[500],
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 9, color: colors.white },
});
