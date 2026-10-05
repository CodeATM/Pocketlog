import { Alert } from 'react-native';

type Options = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Renders the confirm action in the destructive colour. */
  destructive?: boolean;
};

/**
 * Promise wrapper around the native alert.
 *
 * The platform dialog is used deliberately: it is the one confirmation surface
 * that is guaranteed to be reachable by TalkBack and to inherit the user's font
 * size and RTL settings, which a hand-rolled modal would not.
 */
export function confirm(options: Options): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    Alert.alert(options.title, options.message, [
      {
        text: options.cancelLabel ?? 'Cancel',
        style: 'cancel',
        onPress: () => finish(false),
      },
      {
        text: options.confirmLabel,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => finish(true),
      },
    ]);
  });
}

/** Shows a non-actionable notification, e.g. "Export cancelled". */
export function notify(title: string, message?: string): void {
  Alert.alert(title, message);
}