import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  SlideInDown,
} from 'react-native-reanimated';

/**
 * Entering animations, switchable off for reduced motion.
 *
 * The pattern is always "same animation, zero duration" rather than omitting the
 * animation, because Reanimated layouts after mount still need the enter/exit
 * pair to be balanced.
 */

export function fadeIn(reduceMotion: boolean) {
  return reduceMotion ? FadeIn.duration(0) : FadeIn.duration(180);
}

export function fadeInUp(reduceMotion: boolean) {
  return reduceMotion ? FadeInDown.duration(0) : FadeInDown.duration(240);
}

export function slideUpSheet(reduceMotion: boolean) {
  return reduceMotion
    ? SlideInDown.duration(0)
    : SlideInDown.springify().damping(20).stiffness(180).mass(0.6);
}

/** Stagger for list-like content, capped so long lists never feel sluggish. */
export function fadeInStagger(index: number, reduceMotion: boolean) {
  if (reduceMotion) return FadeIn.duration(0);
  return FadeInDown.delay(Math.min(index, 8) * 24).duration(200);
}

/** An inline panel arriving in place — the date and time grids under their rows. */
export function inlineEnter(reduceMotion: boolean) {
  return reduceMotion ? FadeIn.duration(0) : FadeIn.duration(200);
}

export function inlineExit(reduceMotion: boolean) {
  return reduceMotion ? FadeOut.duration(0) : FadeOut.duration(140);
}

/**
 * Height animation for the container a panel was inserted into.
 *
 * Without this the surrounding content snaps to its new layout in one frame, so an
 * inline panel appears to teleport rather than push. Eased out rather than linear:
 * the panel has arrived by roughly the time the eye expects it to.
 */
export function reflow(reduceMotion: boolean) {
  return LinearTransition.duration(reduceMotion ? 0 : 240).easing(Easing.out(Easing.cubic));
}

/** Shared curve for large surfaces, so travel and fade never drift apart. */
export function sheetEase(reduceMotion: boolean) {
  return Easing.out(Easing.cubic);
}