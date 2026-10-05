import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Appearance, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Last-resort boundary.
 *
 * Deliberately un-themed in its *failure* path: if the theme context is what threw,
 * anything calling `useTheme()` would throw again inside the fallback and the user
 * would get a white screen from a crashed component tree. So this screen styles from
 * a hardcoded palette pair using plain React Native primitives — no `Text` or `Button`
 * from the design system, no database, no store.
 *
 * The cost is that this one screen does not use tokens, and that is the correct
 * trade: tokens are resolved through a provider that may be the thing that broke.
 *
 * ```tsx
 * <AppErrorBoundary><App /></AppErrorBoundary>
 * ```
 */

type Fallback = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  onAccent: string;
};

const FALLBACK_LIGHT: Fallback = {
  bg: '#F6F3EE',
  surface: '#FBF9F5',
  text: '#1A1816',
  muted: 'rgba(26, 24, 22, 0.64)',
  border: 'rgba(26, 24, 22, 0.17)',
  accent: '#A8482A',
  onAccent: '#FFFFFF',
};

const FALLBACK_DARK: Fallback = {
  bg: '#0F0E0D',
  surface: '#171513',
  text: '#F2EEE8',
  muted: 'rgba(242, 238, 232, 0.55)',
  border: 'rgba(242, 238, 232, 0.2)',
  accent: '#E0855A',
  onAccent: '#1A0F0A',
};

type Props = { children: ReactNode };
type State = { error: Error | null; info: string | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept in state rather than only logged so the details are visible in the
    // built app, where no console is attached.
    this.setState({ info: info.componentStack ?? null });
    console.error('PocketLog render error', error);
  }

  private reset = () => this.setState({ error: null, info: null });

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const palette =
      Appearance.getColorScheme() === 'dark' ? FALLBACK_DARK : FALLBACK_LIGHT;

    return (
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: palette.text }]}>Something came unstuck</Text>

          <Text style={[styles.body, { color: palette.muted }]}>
            Your log is untouched — it lives in the database, not in memory. Nothing was
            lost.
          </Text>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardText, { color: palette.text }]}>{error.message}</Text>
            {info ? (
              <Text style={[styles.stack, { color: palette.muted }]}>{info.trim()}</Text>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try again"
            accessibilityHint="Reopens PocketLog from the last saved state."
            onPress={this.reset}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? palette.bg : palette.accent },
            ]}
          >
            <Text style={[styles.buttonLabel, { color: palette.onAccent }]}>Try again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 20,
    padding: 20,
  },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  stack: { fontSize: 11, lineHeight: 16 },
  // 48pt tall, matching the design system's minimum hit target without importing it.
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});