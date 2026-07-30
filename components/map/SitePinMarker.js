/*
 * Site marker: a single teardrop drawn as one SVG path, with a hollow core.
 *
 * The previous version was a CSS teardrop wrapping a FontAwesome faLocationDot
 * glyph — a map pin drawn inside a map pin. One shape reads better at every size,
 * and being a real path it stays crisp when the zoom-driven size changes instead
 * of relying on a rotated square tail and two sets of borders lining up.
 *
 * Every site uses the same pin. Selection and "this pin is several merged sites"
 * are the only states it encodes: a site's OSDF node count lives in its detail
 * panel, and /osdf-nodes covers that view.
 */
const VARIANTS = {
  site: {
    fill: '#0284c7', // sky-600
    ring: 'rgba(2, 132, 199, 0.26)',
  },
  osdfCache: {
    fill: '#16a34a', // green-600
    ring: 'rgba(22, 163, 74, 0.26)',
  },
  selected: {
    fill: '#e11d48', // rose-600
    ring: 'rgba(225, 29, 72, 0.8)',
  },
};

/*
 * Geometry: a round head with two straight tangent lines running down to the tip,
 * rather than a curve tapering in from the sides. The head is a true circle of
 * r=10.3 in a 24-wide box — 86% of the width — which keeps the pin as wide and
 * solid as the CSS circle-plus-tail version it replaced. Bézier sides read much
 * narrower for the same box, which is what made the first pass look pinched.
 *
 * The tip sits exactly on the bottom edge so Marker anchor="bottom" lands the
 * point on the site's coordinate. The SVG does not clip, so the white outline and
 * the selected halo can spill past the box.
 */
const HEAD_CENTER_Y = 11.5;
const HEAD_RADIUS = 10.3;
// Tangent points for a tip at (12, 30): 56.2° either side of straight-down.
const PIN_PATH = `M12 30 L3.44 17.23 A${HEAD_RADIUS} ${HEAD_RADIUS} 0 1 1 20.56 17.23 Z`;

/**
 * @param {boolean} [interactive] - false for legend swatches and dropdown rows:
 *   drops the pointer cursor and hover lift, and hides the pin from assistive
 *   tech since the adjacent text already names it.
 * @param {string} [title] - accessible name only. Not set as a `title`
 *   attribute: the map draws its own glass hover card, and the browser's native
 *   tooltip would otherwise fade in on top of it.
 * @param {number} [count] - how many sites this pin stands for. Anything above 1
 *   adds the corner badge; the number is the only thing distinguishing a merged
 *   pin from a single site, so the pin shape itself is deliberately unchanged.
 */
export default function SitePinMarker({
  isSelected,
  isOsdfCache = false,
  size = 26,
  count = 1,
  title,
  interactive = true,
  onMouseEnter,
  onMouseLeave,
}) {
  const variant = isSelected ? VARIANTS.selected : (isOsdfCache ? VARIANTS.osdfCache : VARIANTS.site);
  const isMerged = count > 1;

  return (
    <div
      className={[
        'map-pin-marker',
        isOsdfCache ? 'map-pin-marker--osdf-cache' : '',
        isMerged ? 'map-pin-marker--merged' : '',
        isSelected ? 'map-pin-marker--selected' : '',
        interactive ? '' : 'map-pin-marker--static',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--pin-size': `${size}px` }}
      onMouseEnter={interactive ? onMouseEnter : undefined}
      onMouseLeave={interactive ? onMouseLeave : undefined}
      aria-label={interactive ? title : undefined}
      aria-hidden={interactive ? undefined : true}
    >
      <svg className="map-pin-marker__svg" viewBox="0 0 24 30" role="presentation">
        {isSelected && (
          <circle cx="12" cy={HEAD_CENTER_Y} r={HEAD_RADIUS + 2} fill={variant.ring} />
        )}
        <path
          d={PIN_PATH}
          fill={variant.fill}
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Hollow core, so the pin still reads as a pin at 17px. */}
        <circle cx="12" cy={HEAD_CENTER_Y} r="3.9" fill="#ffffff" fillOpacity="0.95" />
      </svg>

      {/*
        * HTML rather than another <circle>/<text> pair in the SVG: the badge has a
        * legibility floor (see .map-pin-marker__count) that must not shrink with
        * the pin at world zoom, and an SVG child cannot opt out of the viewBox
        * scaling. aria-hidden because the pin's aria-label already says "N sites".
        */}
      {isMerged ? (
        <span className="map-pin-marker__count" aria-hidden="true">
          {count}
        </span>
      ) : null}
    </div>
  );
}
