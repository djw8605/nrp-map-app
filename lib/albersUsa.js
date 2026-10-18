/*
 * Albers USA: the lower 48 states in an Albers equal-area conic, with Alaska and
 * Hawaii moved into insets at the lower left. The parameters are d3-geo's
 * geoAlbersUsa, and scale 1300 / translate [487.5, 305] is the 975×610 frame
 * us-atlas uses for its pre-projected files.
 *
 * Shared by scripts/build-wall-outline.mjs (which projects the state outlines)
 * and the /wall page (which projects the campuses), so the two always line up.
 * Plain node can load this file: no imports.
 */
export const FRAME = { width: 975, height: 610 };

const RAD = Math.PI / 180;

// d3's conicEqualAreaRaw, rotated in longitude only, then centred and scaled.
function conicEqualArea({ parallels: [phi0, phi1], rotate, center: [centerLng, centerLat], scale, translate: [tx, ty] }) {
  const sy0 = Math.sin(phi0 * RAD);
  const n = (sy0 + Math.sin(phi1 * RAD)) / 2;
  const c = 1 + sy0 * (2 * n - sy0);
  const r0 = Math.sqrt(c) / n;
  const raw = (lambda, phi) => {
    const r = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
    return [r * Math.sin(lambda * n), r0 - r * Math.cos(lambda * n)];
  };
  const [cx, cy] = raw(centerLng * RAD, centerLat * RAD);

  return ([lng, lat]) => {
    const lambda = ((((lng + rotate + 180) % 360) + 360) % 360) - 180;
    const [x, y] = raw(lambda * RAD, lat * RAD);
    return [tx + scale * (x - cx), ty - scale * (y - cy)];
  };
}

/*
 * Which inset a point belongs to, by plain latitude/longitude boxes, or null
 * for anywhere off the map (other countries, US territories). The lower-48 box
 * also takes in the edges of Canada and Mexico, which project where they are.
 */
export function partFor([lng, lat]) {
  if (lat >= 51 && lat <= 72 && (lng <= -129 || lng >= 172)) return 'alaska';
  if (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154) return 'hawaii';
  if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) return 'lower48';
  return null;
}

export function albersUsa({ scale = 1300, translate: [x, y] = [487.5, 305] } = {}) {
  const parts = {
    lower48: conicEqualArea({
      parallels: [29.5, 45.5], rotate: 96, center: [-0.6, 38.7], scale, translate: [x, y],
    }),
    alaska: conicEqualArea({
      parallels: [55, 65], rotate: 154, center: [-2, 58.5], scale: scale * 0.35,
      translate: [x - 0.307 * scale, y + 0.201 * scale],
    }),
    hawaii: conicEqualArea({
      parallels: [8, 18], rotate: 157, center: [-3, 19.9], scale,
      translate: [x - 0.205 * scale, y + 0.212 * scale],
    }),
  };

  // [x, y] in the frame, or null for a point off the map.
  const project = (point) => {
    const part = partFor(point);
    return part ? parts[part](point) : null;
  };
  return { ...parts, project };
}
