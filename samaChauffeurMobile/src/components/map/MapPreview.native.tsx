import React, { useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, radii } from '@/constants/theme';
import type { LatLng } from '@/types';
import MapErrorBoundary from './MapErrorBoundary';
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

const DEFAULT_CENTER = { lat: 3.848, lng: 11.5021 }; // Yaoundé fallback

function InnerMap({ myPosition, markers = [], route, onPress, height = 260, fill = false }: Props) {
  const mapRef = useRef<MapView | null>(null);

  const center = myPosition ?? markers[0]?.position ?? DEFAULT_CENTER;

  const region = useMemo(
    () => ({
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }),
    [center.lat, center.lng],
  );

  return (
    <View style={[fill ? styles.wrapFill : styles.wrap, !fill && { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={(e) => onPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.position.lat, longitude: m.position.lng }}
            pinColor={m.color ?? colors.brand[500]}
            title={m.label}
          />
        ))}
        {route && route.length > 1 && (
          <Polyline coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={colors.brand[500]} strokeWidth={4} />
        )}
      </MapView>
    </View>
  );
}

export default function MapPreview(props: Props) {
  return (
    <MapErrorBoundary
      fallback={
        <View style={[props.fill ? styles.wrapFill : styles.wrap, !props.fill && { height: props.height ?? 260 }]}>
          <MapPlaceholder label="Carte momentanément indisponible" />
        </View>
      }
    >
      <InnerMap {...props} />
    </MapErrorBoundary>
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
