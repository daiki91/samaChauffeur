import React from 'react';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { colors } from '@/constants/theme';

export default function Spinner({ style }: { style?: ViewStyle }) {
  return (
    <View style={[{ paddingVertical: 24, alignItems: 'center' }, style]}>
      <ActivityIndicator color={colors.brand[600]} />
    </View>
  );
}
