import { useState } from 'react';

/**
 * Press feedback for Pressables.
 *
 * NativeWind's jsx-runtime silently drops function `style` props, so the idiomatic
 * `style={({ pressed }) => ...}` never reaches the native view: the element falls
 * back to an unstyled box (a `position: 'absolute'` FAB stretched across the whole
 * screen, a sized button collapsed down to its icon). Holding the press in state
 * and passing a flat style object keeps the feedback on every component that goes
 * through interop.
 */
export function usePressed(onChange?: (pressed: boolean) => void) {
  const [pressed, setPressed] = useState(false);

  const update = (next: boolean) => {
    setPressed(next);
    onChange?.(next);
  };

  return {
    pressed,
    pressProps: {
      onPressIn: () => update(true),
      onPressOut: () => update(false),
    },
  };
}