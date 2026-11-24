/**
 * Chart colors. Categorical slots 1–3 of the dataviz reference palette,
 * validated against this app's white chart surface (#ffffff): lightness band,
 * chroma, CVD (worst adjacent ΔE 9.2) and normal-vision (27.6) all pass;
 * "returned" (#1baf7a) is 2.82:1 vs the surface → every chart ships a legend
 * and a table view. Colors follow the entity, never its rank.
 */
export const SERIES = {
  lost: { label: 'Lost', color: '#2a78d6' },
  found: { label: 'Found', color: '#eb6834' },
  returned: { label: 'Returned', color: '#1baf7a' },
};

export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#ffffff',
};
