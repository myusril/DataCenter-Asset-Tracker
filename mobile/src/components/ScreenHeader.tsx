import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { text } from '../theme/typography';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}

/** Back button + centered title used by pushed (non-tab) screens. */
export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Kembali"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={styles.side}
      >
        <Ionicons color={colors.text} name="arrow-back" size={22} />
      </Pressable>
      <Text ellipsizeMode="tail" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  side: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
  },
  title: {
    ...text.heading,
    flex: 1,
    textAlign: 'center',
  },
});
