import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Screen from '@/components/ui/Screen';
import { colors, fonts, fontSizes, heroGradient, radii, spacing } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** onboarding progress (register → phone → verify) shown as dots under the logo, à la inDrive/Bolt */
  step?: { current: number; total: number };
};

export default function AuthLayout({ title, subtitle, children, footer, step }: Props) {
  return (
    <Screen padded={false}>
      <LinearGradient
        colors={heroGradient.colors}
        locations={heroGradient.locations}
        start={heroGradient.start}
        end={heroGradient.end}
        style={styles.header}
      >
        <View style={styles.logoBadge}>
          <Ionicons name="car-sport" size={22} color={colors.white} />
        </View>
        <Text style={styles.brand}>samaChauffeur</Text>
        {step && (
          <View style={styles.stepRow}>
            {Array.from({ length: step.total }).map((_, i) => (
              <View key={i} style={[styles.stepDot, i < step.current && styles.stepDotActive]} />
            ))}
          </View>
        )}
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={{ marginTop: spacing.xl }}>{children}</View>
        {footer && <View style={styles.footer}>{footer}</View>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.huge,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    borderBottomLeftRadius: radii.xl2,
    borderBottomRightRadius: radii.xl2,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brand: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.white,
  },
  stepRow: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  stepDot: { width: 20, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: colors.white },
  body: {
    padding: spacing.xl,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 21,
  },
  footer: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
});
