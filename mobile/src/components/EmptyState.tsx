import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
} from 'react-native-svg';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';

export type EmptyIllustration =
  | 'assets'
  | 'search'
  | 'network'
  | 'maintenance'
  | 'prediction'
  | 'notifications'
  | 'error'
  | 'lock';

interface EmptyStateProps {
  title: string;
  message?: string;
  illustration?: EmptyIllustration;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}

/** Illustration + copy for empty lists, failed loads, and gated pages. */
export function EmptyState({
  title,
  message,
  illustration = 'assets',
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, compact ? styles.compact : null]}>
      <Illustration variant={illustration} />
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const S = { primary: colors.primary, soft: colors.accentSoft, line: colors.border, muted: '#A5B4FC', white: colors.surface };

function Illustration({ variant }: { variant: EmptyIllustration }) {
  return (
    <Svg
      accessibilityElementsHidden
      height={112}
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 160 120"
      width={150}
    >
      <Ellipse cx="80" cy="104" fill={S.soft} rx="48" ry="8" />
      {variant === 'assets' ? <AssetsArt /> : null}
      {variant === 'search' ? <SearchArt /> : null}
      {variant === 'network' ? <NetworkArt /> : null}
      {variant === 'maintenance' ? <MaintenanceArt /> : null}
      {variant === 'prediction' ? <PredictionArt /> : null}
      {variant === 'notifications' ? <NotificationsArt /> : null}
      {variant === 'error' ? <ErrorArt /> : null}
      {variant === 'lock' ? <LockArt /> : null}
    </Svg>
  );
}

function AssetsArt() {
  return (
    <G>
      <Path d="M80 22 112 38 80 54 48 38Z" fill={S.primary} opacity={0.9} />
      <Path d="M48 38 80 54v30L48 68Z" fill={S.soft} />
      <Path d="M112 38 80 54v30l32-16Z" fill={S.muted} />
      <Path d="M48 38 80 54 112 38" fill="none" stroke={S.white} strokeWidth="1.5" />
      <Rect fill={S.white} height="4" opacity={0.75} rx="2" width="16" x="55" y="58" />
      <Rect fill={S.white} height="4" opacity={0.45} rx="2" width="10" x="55" y="66" />
      <Path d="M92 62h10v10H92z" fill={S.white} opacity={0.5} />
    </G>
  );
}

function SearchArt() {
  return (
    <G>
      <Circle cx="72" cy="52" fill={S.soft} r="28" />
      <Circle cx="72" cy="52" fill="none" r="20" stroke={S.primary} strokeWidth="4" />
      <Line stroke={S.primary} strokeLinecap="round" strokeWidth="6" x1="87" x2="101" y1="67" y2="81" />
      <Line stroke={S.muted} strokeLinecap="round" strokeWidth="3" x1="63" x2="81" y1="46" y2="46" />
      <Line stroke={S.muted} strokeLinecap="round" strokeWidth="3" x1="63" x2="76" y1="54" y2="54" />
    </G>
  );
}

function NetworkArt() {
  return (
    <G>
      <Rect fill={S.soft} height="30" rx="8" width="66" x="47" y="56" />
      <Rect fill={S.primary} height="30" rx="8" width="66" x="47" y="56" opacity={0.18} />
      <Rect fill={S.primary} height="7" rx="3.5" width="66" x="47" y="56" />
      <Circle cx="58" cy="72" fill={S.primary} r="3.5" />
      <Circle cx="70" cy="72" fill={S.muted} r="3.5" />
      <Circle cx="82" cy="72" fill={S.muted} r="3.5" />
      <Path d="M58 42c8-8 22-8 30 0" fill="none" stroke={S.primary} strokeLinecap="round" strokeWidth="3.5" />
      <Path d="M64 49c5-5 14-5 19 0" fill="none" stroke={S.muted} strokeLinecap="round" strokeWidth="3.5" />
      <Circle cx="73" cy="36" fill={S.primary} r="3" />
    </G>
  );
}

function MaintenanceArt() {
  return (
    <G>
      <Circle cx="78" cy="60" fill={S.soft} r="30" />
      <Path
        d="M92 34a14 14 0 0 0-16 18L52 76a7 7 0 0 0 10 10l24-24a14 14 0 0 0 18-16l-9 9-8-8Z"
        fill={S.primary}
      />
      <Path d="M55 79l4 4" stroke={S.white} strokeLinecap="round" strokeWidth="3" />
      <Circle cx="102" cy="84" fill={S.muted} r="8" />
      <Circle cx="102" cy="84" fill={S.white} r="3" />
    </G>
  );
}

function PredictionArt() {
  return (
    <G>
      <Path d="M80 24l26 9v20c0 16-11 27-26 32-15-5-26-16-26-32V33Z" fill={S.primary} />
      <Path d="M80 32l19 6.5V53c0 12-8 20-19 24-11-4-19-12-19-24V38.5Z" fill={S.white} opacity={0.16} />
      <Path d="M68 59l8 8 16-17" fill="none" stroke={S.white} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      <Circle cx="118" cy="32" fill={S.muted} r="3" />
      <Circle cx="42" cy="42" fill={S.muted} r="2.5" />
    </G>
  );
}

function NotificationsArt() {
  return (
    <G>
      <Path
        d="M80 28a21 21 0 0 0-21 21v12l-6 10h54l-6-10V49a21 21 0 0 0-21-21Z"
        fill={S.primary}
      />
      <Path d="M80 28a21 21 0 0 0-21 21v12l-6 10h27Z" fill={S.white} opacity={0.14} />
      <Path d="M72 78a8 8 0 0 0 16 0Z" fill={S.muted} />
      <Circle cx="101" cy="33" fill={colors.warning} r="7" />
      <Circle cx="101" cy="33" fill={S.white} r="2.5" />
    </G>
  );
}

function ErrorArt() {
  return (
    <G>
      <Path
        d="M56 76a16 16 0 0 1-2-32 22 22 0 0 1 42-4 17 17 0 0 1 8 32Z"
        fill={S.soft}
        stroke={S.primary}
        strokeWidth="2"
      />
      <Line stroke={S.primary} strokeLinecap="round" strokeWidth="4" x1="66" x2="98" y1="88" y2="88" />
      <Line stroke={S.muted} strokeLinecap="round" strokeWidth="4" x1="74" x2="90" y1="96" y2="96" />
      <Circle cx="112" cy="36" fill={S.white} r="10" />
      <Path d="M112 31v7" stroke={colors.dangerInk} strokeLinecap="round" strokeWidth="2.5" />
      <Circle cx="112" cy="42" fill={colors.dangerInk} r="1.4" />
    </G>
  );
}

function LockArt() {
  return (
    <G>
      <Rect fill={S.soft} height="34" rx="10" width="52" x="54" y="58" />
      <Rect fill={S.primary} height="34" rx="10" width="52" x="54" y="58" opacity={0.2} />
      <Path d="M66 58v-8a14 14 0 0 1 28 0v8" fill="none" stroke={S.primary} strokeWidth="5" />
      <Circle cx="80" cy="72" fill={S.primary} r="4" />
      <Rect fill={S.primary} height="10" rx="2" width="3" x="78.5" y="74" />
    </G>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
  },
  compact: {
    paddingVertical: spacing.lg,
  },
  title: {
    ...text.heading,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  message: {
    ...text.body,
    marginTop: spacing.xs,
    maxWidth: 320,
    textAlign: 'center',
  },
  action: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
  },
  actionLabel: {
    ...text.captionStrong,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
});
