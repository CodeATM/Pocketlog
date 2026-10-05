import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';

/**
 * Font assets.
 *
 * `expo-font` registers each asset under the key given here, so `theme/tokens.ts`
 * can name a family (`Poppins_600SemiBold`) without caring where the file came
 * from. Only the weights the type scale actually uses are imported, so nothing
 * extra reaches the bundle.
 *
 * One family does everything. Poppins stands in for Proxima Nova, which is a
 * Commercial Type licence and cannot be redistributed here. It is geometric and
 * circular with a tall x-height, so it reads larger than Inter at the same size;
 * the scale compensates with tighter tracking — see the per-role `letterSpacing`
 * in `theme/tokens.ts`.
 *
 * Loading is awaited before the first screen paints — see `AppProviders` — which
 * is what prevents a system fallback face flashing on launch.
 */

export const fontAssets = {
  Poppins_400Regular,
  Poppins_600SemiBold,
};

export type FontAssetKey = keyof typeof fontAssets;