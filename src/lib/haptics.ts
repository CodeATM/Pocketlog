import * as Haptics from 'expo-haptics';

/**
 * The app's entire haptics vocabulary.
 *
 * Four events, no more. A logger that buzzes on every keystroke stops being
 * legible as feedback, so the rule here is: haptics mark *commits and
 * confirmations*, never navigation or scrolling.
 */

function isEnabled(): boolean {
  // Never throws on a device without a taptic engine; the call is simply skipped.
  return true;
}

export const haptics = {
  /** A value changed: selecting a chip, moving a stepper, toggling a segment. */
  selection(): void {
    if (!isEnabled()) return;
    void Haptics.selectionAsync().catch(() => {});
  },

  /** Something was saved. */
  success(): void {
    if (!isEnabled()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },

  /** A destructive action is about to happen. */
  warning(): void {
    if (!isEnabled()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },

  /** A sheet grabbed, a row crossed a threshold. */
  light(): void {
    if (!isEnabled()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
};