import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, tripSteps } from '@/constants/theme';
import type { TripStatus } from '@/types';

/**
 * Horizontal trip-progress stepper (requested → driver assigned → en route → arrivée), the pattern
 * Uber/Bolt/Yango/inDrive all use on their live trip-tracking screen instead of a plain status badge.
 */
export default function StatusStepper({ status }: { status: TripStatus }) {
  if (status === 'CANCELLED') {
    return (
      <View style={styles.cancelledWrap}>
        <Ionicons name="close-circle" size={18} color={colors.danger} />
        <Text style={styles.cancelledText}>Course annulée</Text>
      </View>
    );
  }

  const activeIndex = tripSteps.findIndex((step) => step.statuses.includes(status));

  return (
    <View style={styles.row}>
      {tripSteps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        const isUpcoming = index > activeIndex;
        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepWrap}>
              <View
                style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isActive && styles.dotActive,
                  isUpcoming && styles.dotUpcoming,
                ]}
              >
                <Ionicons
                  name={(isDone ? 'checkmark' : step.icon) as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={isUpcoming ? colors.muted : colors.white}
                />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive, isUpcoming && styles.labelUpcoming]} numberOfLines={1}>
                {step.label}
              </Text>
            </View>
            {index < tripSteps.length - 1 && <View style={[styles.connector, index < activeIndex && styles.connectorDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  stepWrap: { alignItems: 'center', width: 64 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dotDone: { backgroundColor: colors.secondary[500] },
  dotActive: { backgroundColor: colors.brand[600] },
  dotUpcoming: { backgroundColor: colors.border },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginTop: 14,
    marginHorizontal: -4,
  },
  connectorDone: { backgroundColor: colors.secondary[400] },
  label: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.text, textAlign: 'center' },
  labelActive: { fontFamily: fonts.semiBold, color: colors.brand[700] },
  labelUpcoming: { color: colors.muted },
  cancelledWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  cancelledText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.danger },
});
