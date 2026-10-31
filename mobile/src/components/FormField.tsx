import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing, typography } from '../theme/spacing';
import { Chip } from './Chip';

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  keyboardType,
  multiline = false,
  maxLength,
  autoCapitalize = 'sentences',
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline ? styles.inputMultiline : null, error ? styles.inputError : null]}
        value={value}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  error?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: SelectFieldProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip
            active={option.value === value}
            key={option.value}
            label={option.label}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  field: {
    gap: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.caption,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: typography.small,
  },
  hint: {
    color: colors.muted,
    fontSize: 11,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
