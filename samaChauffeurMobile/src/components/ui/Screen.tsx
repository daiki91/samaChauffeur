import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  padded?: boolean;
};

export default function Screen({ children, scroll = true, style, padded = true }: Props) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Body
          style={[{ flex: 1 }, style]}
          contentContainerStyle={scroll ? [padded && styles.padded, { flexGrow: 1 }] : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {scroll ? children : <View style={[{ flex: 1 }, padded && styles.padded]}>{children}</View>}
        </Body>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  padded: { padding: spacing.xl },
});
