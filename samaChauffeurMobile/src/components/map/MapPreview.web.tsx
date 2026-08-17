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
  /** Fills the parent instead of using `height` — no rounded corners/clipping, for a
   *  full-bleed map behind floating overlays (the Uber-style Home screen pattern). */
  fill?: boolean;
};

// react-native-maps relies on native-only RN internals (codegenNativeCommands)
// that cannot be bundled for web. Keep this file free of any import of
// 'react-native-maps' so Metro never pulls it into the web bundle.
export default function MapPreview({ height = 260, fill = false }: Props) {
  return (
    <View style={[fill ? styles.wrapFill : styles.wrap, !fill && { height }]}>
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
  wrapFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brand[50],
  },
});
