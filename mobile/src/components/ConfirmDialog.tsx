import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing, typography } from '../theme/spacing';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** In-app confirmation dialog; works on Android and web alike. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy, disabled: busy }}
              disabled={busy}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                pressed || busy ? styles.pressed : null,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={styles.confirmLabel}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
  },
  confirmButton: {
    backgroundColor: colors.danger,
  },
  cancelLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  confirmLabel: {
    color: colors.surface,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
