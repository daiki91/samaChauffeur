import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  error?: string | null;
};

export default function Input({ label, icon, rightElement, error, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputRow,
          focused && !error && styles.inputRowFocused,
          error && { borderColor: colors.danger },
        ]}
      >
        {icon && <View style={styles.icon}>{icon}</View>}
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputRowFocused: {
    borderColor: colors.brand[400],
    backgroundColor: colors.brand[50],
  },
  icon: { marginRight: spacing.sm },
  rightElement: { marginLeft: spacing.sm },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  error: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.danger,
  },
});
