import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { elevation } from '../theme/tokens';
import { text } from '../theme/typography';

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
        <View accessibilityRole="alert" style={styles.card}>
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
                <ActivityIndicator color={colors.onPrimary} size="small" />
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
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  card: {
    ...elevation.floating,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
  },
  title: {
    ...text.title,
  },
  message: {
    ...text.body,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: colors.mutedSurface,
  },
  confirmButton: {
    backgroundColor: colors.danger,
  },
  cancelLabel: {
    ...text.bodyStrong,
  },
  confirmLabel: {
    ...text.button,
  },
  pressed: {
    opacity: 0.85,
  },
});
