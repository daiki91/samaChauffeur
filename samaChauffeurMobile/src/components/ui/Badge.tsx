import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, fontSizes, radii, statusColors, colors } from '@/constants/theme';

export default function Badge({ status }: { status: string }) {
  const s = statusColors[status] ?? { bg: colors.brand[50], fg: colors.brand[700], label: status };
  return (
    <View style={[styles.wrap, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
  },
});
