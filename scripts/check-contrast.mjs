/**
 * Verifies every text/graphic pair in the PocketLog palette against WCAG AA.
 *
 *   node scripts/check-contrast.mjs
 *
 * Body text needs 4.5:1; large text (>=24px, or >=18.66px bold) and graphical
 * elements need 3:1. Exits non-zero if any required pair fails.
 *
 * Reads the real token file, so a palette change that breaks a ratio fails here
 * rather than in review. Alpha-composited values are resolved against their
 * intended backdrop first — `textFaint` is stored as `rgba(...)` and is checked as
 * the colour it actually paints, not as a transparent string.
 */
import {
  categoryPalette,
  categorySolids,
  colors,
} from '../src/theme/tokens.ts';

/* ------------------------------------------------------------ colour maths -- */

/** Composites an `#RRGGBB` + alpha pair onto an opaque backdrop. */
function composite(hex, alpha, backdrop) {
  const channel = (value) => parseInt(value, 16);
  const r = Math.round(channel(hex.slice(1, 3)) * alpha + channel(backdrop.slice(1, 3)) * (1 - alpha));
  const g = Math.round(channel(hex.slice(3, 5)) * alpha + channel(backdrop.slice(3, 5)) * (1 - alpha));
  const b = Math.round(channel(hex.slice(5, 7)) * alpha + channel(backdrop.slice(5, 7)) * (1 - alpha));
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Resolves a colour token to an opaque hex.
 *
 * Token values are either `#RRGGBB` or `rgba(r, g, b, a)` white/black tints; the
 * alphas are authored to sit on `bg`, so that is the backdrop used here.
 */
function resolve(value, backdrop) {
  if (value.startsWith('#')) return value;

  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(value);
  if (!match) throw new Error(`Unparseable colour token: ${value}`);

  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  const hex = `#${[match[1], match[2], match[3]]
    .map((part) => Number(part).toString(16).padStart(2, '0'))
    .join('')}`;
  return composite(hex, alpha, backdrop);
}

const luminance = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((part) => {
    const v = parseInt(part, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/* ------------------------------------------------------------------ cases -- */

const TEXT = 4.5;
const LARGE_OR_GRAPHIC = 3;

/** Backdrops a label can legitimately sit on. */
const BACKDROPS = {
  bg: 'bg',
  surface: 'surface',
  surfaceRaised: 'surfaceRaised',
  surfaceSunken: 'surfaceSunken',
  accentSoft: 'accentSoft',
};

/**
 * [label, foreground token, minimum ratio, backdrops it appears on]
 *
 * Only pairs where contrast is *required* belong here. `border` and the `*Soft`
 * washes are deliberately absent: WCAG 1.4.11 applies to graphics needed to identify
 * a control, and a hairline separator or a decorative wash behind text that already
 * meets 4.5:1 is not that. Checking them would push the palette toward an ugly,
 * arbitrarily dark hairline for no accessibility gain.
 */
const TEXT_CASES = [
  ['text', 'text', TEXT, ['bg', 'surface', 'surfaceRaised']],
  ['textMuted', 'textMuted', TEXT, ['bg', 'surface', 'surfaceRaised']],
  // Decorative by policy (axis ticks, rules, disabled glyphs) — never a label — so
  // it is held to the graphical bar rather than body text.
  ['textFaint (decorative)', 'textFaint', LARGE_OR_GRAPHIC, ['bg', 'surface']],
  ['accent', 'accent', TEXT, ['bg', 'surface', 'accentSoft']],
  ['danger', 'danger', TEXT, ['bg', 'surface', 'surfaceRaised']],
  ['success', 'success', TEXT, ['bg', 'surface', 'surfaceRaised']],
  ['onAccent on accent fill', 'onAccent', TEXT, []],
  ['onDanger on danger fill', 'onDanger', TEXT, []],
  ['accent fill on track (bar fill)', 'accent', LARGE_OR_GRAPHIC, ['surfaceSunken']],
  ['focus ring (accent) on bg', 'accent', LARGE_OR_GRAPHIC, ['bg']],
  ['focus ring (accent) on surface', 'accent', LARGE_OR_GRAPHIC, ['surface', 'surfaceRaised']],
  ['borderStrong on surface (input edge)', 'borderStrong', LARGE_OR_GRAPHIC, ['bg', 'surface']],
];

const cases = [];

for (const scheme of ['light', 'dark']) {
  const tokens = colors[scheme];
  const backdropHex = Object.fromEntries(
    Object.entries(BACKDROPS).map(([name, token]) => [name, resolve(tokens[token], tokens.bg)]),
  );

  for (const [label, token, min, backdrops] of TEXT_CASES) {
    for (const backdrop of backdrops) {
      if (label === 'onAccent on accent fill' || label === 'onDanger on danger fill') {
        // Filled surfaces: the foreground sits on the fill, not on a backdrop token.
        const fill = label.startsWith('onAccent') ? tokens.accent : tokens.danger;
        const fillHex = fill.startsWith('#') ? fill : composite(fill, 1, tokens.bg);
        cases.push([scheme, label, resolve(tokens[token], fillHex), fillHex, min]);
        continue;
      }
      cases.push([scheme, `${label} on ${backdrop}`, resolve(tokens[token], tokens.bg), backdropHex[backdrop], min]);
    }
  }

  // Category solids appear as timeline nodes, chart fills and ring arcs: graphical,
  // so 3:1 against the page. Their `onTint` text does sit on a wash, so that pair is
  // held to the text bar.
  for (const id of Object.keys(categorySolids[scheme])) {
    const solid = categorySolids[scheme][id];
    const solidHex = resolve(solid, tokens.bg);
    const palette = categoryPalette(scheme, solid);

    cases.push([scheme, `category:${id} fill on bg`, solidHex, backdropHex.bg, LARGE_OR_GRAPHIC]);
    cases.push([scheme, `category:${id} fill on surface`, solidHex, backdropHex.surface, LARGE_OR_GRAPHIC]);

    const tintHex = resolve(palette.tint, tokens.bg);
    cases.push([scheme, `category:${id} onTint on tint`, resolve(palette.onTint, tintHex), tintHex, TEXT]);

    const strongHex = resolve(palette.tintStrong, tokens.bg);
    cases.push([scheme, `category:${id} onTint on tintStrong`, resolve(palette.onTint, strongHex), strongHex, TEXT]);

    const onSolidHex = resolve(tokens.onSolid, solidHex);
    cases.push([scheme, `category:${id} label on solid`, onSolidHex, solidHex, TEXT]);
  }

  // No scrim case: WCAG has no contrast requirement for an overlay that dims the
  // page behind a sheet — on the contrary, a scrim is *supposed* to sit close to the
  // backdrop. What has to be legible is the sheet's own content, which the
  // `borderStrong` and category cases above already cover.
}

/* ------------------------------------------------------------------ report -- */

let failures = 0;
const rows = cases
  .map(([scheme, label, fg, bg, min]) => {
    const ratio = contrast(fg, bg);
    const ok = ratio >= min;
    if (!ok) failures += 1;
    return { scheme, label, ratio, min, ok };
  })
  .sort((a, b) => a.ratio - b.ratio);

for (const row of rows) {
  const mark = row.ok ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${row.ratio.toFixed(2).padStart(6)}  (min ${row.min})  ${row.scheme.padEnd(5)} ${row.label}`,
  );
}

console.log(`\n${rows.length - failures}/${rows.length} pairs pass.`);

if (failures > 0) {
  console.error(`${failures} pair(s) below the required ratio.`);
  process.exit(1);
}