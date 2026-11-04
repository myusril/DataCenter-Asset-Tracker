import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { text } from '../theme/typography';

/** Tighter vertical rhythm for grouped label/value rows inside a card. */
export function DataList({ children }: { children: ReactNode }) {
  return <View style={styles.list}>{children}</View>;
}

export function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 26,
    paddingVertical: 2,
  },
  label: {
    ...text.caption,
    color: colors.muted,
    flexShrink: 0,
  },
  value: {
    ...text.captionStrong,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
});
