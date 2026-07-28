import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii } from '@/constants/theme';
import type { LatLng } from '@/types';
import MapPlaceholder from './MapPlaceholder';

export type MapMarker = {
  id: string | number;
  position: LatLng;
  color?: string;
  label?: string;
};

type Props = {
  myPosition?: LatLng | null;
  markers?: MapMarker[];
  route?: LatLng[] | null;
  onPress?: (point: LatLng) => void;
  height?: number;
};

// react-native-maps relies on native-only RN internals (codegenNativeCommands)
// that cannot be bundled for web. Keep this file free of any import of
// 'react-native-maps' so Metro never pulls it into the web bundle.
export default function MapPreview({ height = 260 }: Props) {
  return (
    <View style={[styles.wrap, { height }]}>
      <MapPlaceholder label="Carte disponible sur mobile" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.brand[50],
  },
});
