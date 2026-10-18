import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildScene,
  fitBox,
  hitTest,
  placeLabels,
  pointOnArc,
  scenePoints,
  shortName,
  toScreen,
  worldBox,
  wrapLabel,
} from '../../lib/wall';

/*
 * The /wall map: the state outline as SVG, and a canvas over it. The canvas is
 * composed every frame from three layers: the arcs and campus dots, then the
 * moving particles and the home pulse, then the labels, so light never crosses
 * text. The first and last are drawn offscreen, only when the data, the size or
 * the spotlight changes. The SVG (through its viewBox) and the canvas (through
 * fitBox(), the same "xMidYMid meet" transform) share the scene's world box.
 *
 * Pointing at a dot with a mouse shows the institution's name; clicking or
 * tapping one picks it (onPick), which moves the amber highlight there. A tap
 * shows the name too, since a touchscreen has no hover.
 */

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const BLUE = [92, 200, 255];
const AMBER = [255, 181, 71];
const WHITE = [255, 255, 255];
const PARTICLE = [160, 225, 255];
const INK = '#eef3fb';
const MUTED = '#93a3bd';
const HALO = 'rgba(5, 8, 17, 0.92)';
const rgba = ([r, g, b], alpha) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

// Particle speed, in outline pixels per second, and trail length in dots.
const SPEED = 110;
const TRAIL = 5;
const PULSE_MS = 2600;
// Hosts in the 50 states that get a label, besides home. Margin places always do.
const LABELLED_HOSTS = 7;
const MARGIN_CAPTION = 'Outside the US';
// How long a tapped dot's name stays up, and how far a press may move and still be a tap.
const TAP_TIP_MS = 3000;
const TAP_SLOP = 10;
// How far above a margin column's first dot its caption sits, in outline pixels.
const CAPTION_RISE = 30;

const flowKey = (flow) => `${flow.from}\u0000${flow.to}`;

function useContainerSize(ref) {
  const [size, setSize] = useState(null);

  useEffect(() => {
    const element = ref.current;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      setSize((previous) =>
        previous && previous.width === width && previous.height === height && previous.dpr === dpr
          ? previous
          : { width, height, dpr });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Zooming or moving to another screen changes devicePixelRatio, not the box.
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref]);

  return size;
}

const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
};

function strokeArc(ctx, flow, fit) {
  const [ax, ay] = toScreen(flow.a, fit);
  const [cx, cy] = toScreen(flow.c, fit);
  const [bx, by] = toScreen(flow.b, fit);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(cx, cy, bx, by);
  ctx.stroke();
}

const labelFont = (kind, size) => {
  if (kind === 'place') return `500 ${Math.round(size * 0.82)}px ${FONT}`;
  if (kind === 'kicker') return `700 ${size}px ${FONT}`;
  return `600 ${size}px ${FONT}`;
};

const titleLines = (name) => wrapLabel(shortName(name)).map((text) => ({ text, kind: 'title' }));

// A margin caption's box, kept on screen, so labels keep clear of it.
function captionBoxes(ctx, scene, fit, fontSize, size) {
  ctx.font = labelFont('place', fontSize);
  const width = Math.ceil(ctx.measureText(MARGIN_CAPTION.toUpperCase()).width * 1.15);
  const height = Math.round(fontSize * 1.2);
  return Object.values(scene.margins).map(({ x, top }) => {
    const [columnX, cy] = toScreen([x, top - CAPTION_RISE], fit);
    const left = Math.min(Math.max(columnX - width / 2, 4), size.width - 4 - width);
    return { key: 'caption', x: left, y: cy - height / 2, width, height, cx: left + width / 2, cy };
  });
}

function layoutLabels(ctx, scene, fit, size, fontSize, captions) {
  const lineHeight = Math.round(fontSize * 1.25);
  const measure = (lines) => {
    let width = 0;
    for (const line of lines) {
      ctx.font = labelFont(line.kind, fontSize);
      width = Math.max(width, ctx.measureText(line.text).width);
    }
    return { width: Math.ceil(width), height: lines.length * lineHeight };
  };
  const onScreen = (point, r) => {
    const [x, y] = toScreen([point.x, point.y], fit);
    return { x, y, r: r * fit.scale };
  };

  const candidates = [];
  const add = (key, point, r, lines, options = {}) => {
    candidates.push({ key, ...onScreen(point, r), lines, ...measure(lines), ...options });
  };

  // "You are here" only at the real home; a picked campus is named alone.
  const { home } = scene;
  if (home) {
    const kicker = scene.here ? [{ text: 'You are here', kind: 'kicker' }] : [];
    add('home', home, (home.r || 2) + 6, [...kicker, ...titleLines(home.name)], {
      spots: ['above', 'right', 'left', 'below'],
      home: true,
    });
  }
  // Margin places next: a dot out in the ocean means nothing without its label.
  // In a stacked column a label above its dot would read as the label of the dot
  // over it, so these go below only, in at most two lines. The place leads
  // ("Daejeon, South Korea" says more here than the name), and the name follows
  // only if it fits on one line.
  const hosts = scene.sites.filter((site) => !site.isHome);
  const margin = { spots: ['below'] };
  const maxNameWidth = fontSize * 11;
  hosts.filter((site) => site.side).forEach((site) => {
    if (!site.place) {
      add(site.name, site, site.r, titleLines(site.name), margin);
      return;
    }
    const name = { text: shortName(site.name), kind: 'place' };
    const fits = measure([name]).width <= maxNameWidth;
    add(site.name, site, site.r, [{ text: site.place, kind: 'title' }, ...(fits ? [name] : [])], margin);
  });
  scene.origins
    .filter((origin) => origin.side && !origin.isHome)
    .forEach((origin) => add(origin.name, origin, 2, titleLines(origin.name), margin));
  const withPlace = (site) => [...titleLines(site.name), ...(site.place ? [{ text: site.place, kind: 'place' }] : [])];
  hosts.filter((site) => !site.side).slice(0, LABELLED_HOSTS).forEach((site) => add(site.name, site, site.r, withPlace(site)));

  const obstacles = [
    ...scene.sites.map((site) => {
      const { x, y, r } = onScreen(site, site.r);
      return { key: site.isHome ? 'home' : site.name, x: x - r, y: y - r, width: 2 * r, height: 2 * r };
    }),
    ...captions,
  ];
  const placed = placeLabels(candidates, {
    obstacles,
    area: { x: 4, y: 4, width: size.width - 8, height: size.height - 8 },
    gap: Math.max(4, Math.round(fontSize * 0.35)),
  });
  return placed.map((box) => ({ box, ...candidates.find((candidate) => candidate.key === box.key), lineHeight }));
}

function drawLabels(ctx, labels, fontSize) {
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const { box, lines, lineHeight, home } of labels) {
    const align = box.spot === 'right' ? 'left' : box.spot === 'left' ? 'right' : 'center';
    const x = align === 'left' ? box.x : align === 'right' ? box.x + box.width : box.x + box.width / 2;
    ctx.textAlign = align;
    lines.forEach((line, index) => {
      const y = box.y + index * lineHeight + lineHeight / 2;
      ctx.font = labelFont(line.kind, fontSize);
      ctx.lineWidth = Math.max(3, fontSize * 0.28);
      ctx.strokeStyle = HALO;
      ctx.strokeText(line.text, x, y);
      if (line.kind === 'kicker') ctx.fillStyle = rgba(AMBER, 1);
      else if (line.kind === 'place') ctx.fillStyle = MUTED;
      else ctx.fillStyle = home ? '#ffe2b0' : INK;
      ctx.fillText(line.text, x, y);
    });
  }
}

function drawDot(ctx, point, r, fit, color) {
  const [x, y] = toScreen([point.x, point.y], fit);
  const radius = Math.max(1.5, r * fit.scale);
  circle(ctx, x, y, radius);
  ctx.fillStyle = rgba(color, 0.92);
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.8 * fit.scale);
  ctx.strokeStyle = 'rgba(5, 8, 17, 0.75)';
  ctx.stroke();
  circle(ctx, x - radius * 0.25, y - radius * 0.25, radius * 0.35);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fill();
}

// Arcs, origin dots and campus dots: everything under the particles.
function drawBase(ctx, scene, fit, size, spotlightKey) {
  const s = fit.scale;
  const lit = scene.flows.find((flow) => flowKey(flow) === spotlightKey) || null;
  ctx.clearRect(0, 0, size.width, size.height);

  // Arcs, faint; dimmer still while one is in the spotlight.
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(BLUE, lit ? 0.09 : 0.15);
  for (const flow of scene.flows) {
    if (flow === lit) continue;
    ctx.lineWidth = flow.width * s;
    strokeArc(ctx, flow, fit);
  }
  if (lit) {
    ctx.strokeStyle = rgba(WHITE, 0.14);
    ctx.lineWidth = (lit.width * 3 + 5) * s;
    strokeArc(ctx, lit, fit);
    ctx.strokeStyle = rgba([200, 236, 255], 0.95);
    ctx.lineWidth = (lit.width * 1.3 + 0.8) * s;
    strokeArc(ctx, lit, fit);
  }

  // Campuses that only send work: small and dim.
  for (const origin of scene.origins) {
    const [x, y] = toScreen([origin.x, origin.y], fit);
    circle(ctx, x, y, Math.max(1.5, 2.2 * s));
    ctx.fillStyle = origin.isHome ? rgba(AMBER, 0.9) : 'rgba(170, 195, 230, 0.6)';
    ctx.fill();
  }

  // Host campuses: a soft glow, then the dot, largest first so small dots stay visible.
  ctx.globalCompositeOperation = 'lighter';
  for (const site of scene.sites) {
    const [x, y] = toScreen([site.x, site.y], fit);
    const radius = site.r * s * 2.8;
    const color = site.isHome ? AMBER : BLUE;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, rgba(color, 0.42));
    glow.addColorStop(0.4, rgba(color, 0.14));
    glow.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = glow;
    circle(ctx, x, y, radius);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  const ordered = [...scene.sites].sort((a, b) => b.r - a.r);
  for (const site of ordered) if (!site.isHome) drawDot(ctx, site, site.r, fit, BLUE);

  // Home on top: amber dot and a steady ring (the pulse is drawn per frame).
  const { home } = scene;
  if (home) {
    drawDot(ctx, home, home.r || 3, fit, AMBER);
    const [x, y] = toScreen([home.x, home.y], fit);
    circle(ctx, x, y, ((home.r || 3) + 5) * s);
    ctx.strokeStyle = rgba(AMBER, 0.9);
    ctx.lineWidth = Math.max(1.5, 1.6 * s);
    ctx.stroke();
  }

  // The spotlight's two ends.
  if (lit) {
    const ends = [
      { point: lit.a, r: 2.2 },
      { point: lit.b, r: scene.sites.find((site) => site.name === lit.to)?.r || 2.2 },
    ];
    ctx.strokeStyle = rgba(WHITE, 0.85);
    ctx.lineWidth = Math.max(1.5, 1.4 * s);
    for (const { point, r } of ends) {
      const [x, y] = toScreen(point, fit);
      circle(ctx, x, y, (r + 4.5) * s);
      ctx.stroke();
    }
  }

}

// Labels and margin captions: everything over the particles.
function drawTop(ctx, scene, fit, size) {
  ctx.clearRect(0, 0, size.width, size.height);
  const fontSize = Math.round(Math.max(12, Math.min(size.height * 0.03, size.width * 0.017)));
  const captions = captionBoxes(ctx, scene, fit, fontSize, size);
  ctx.font = labelFont('place', fontSize);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = MUTED;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(fontSize * 0.12)}px`;
  for (const { cx, cy } of captions) ctx.fillText(MARGIN_CAPTION.toUpperCase(), cx, cy);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  drawLabels(ctx, layoutLabels(ctx, scene, fit, size, fontSize, captions), fontSize);
}

function drawMotion(ctx, scene, fit, now, spotlightKey) {
  const s = fit.scale;
  const seconds = now / 1000;
  ctx.globalCompositeOperation = 'lighter';
  for (const flow of scene.flows) {
    const lit = flowKey(flow) === spotlightKey;
    const duration = Math.max(1.5, flow.length / SPEED);
    // Trail dots about 3 outline pixels apart.
    const step = 3 / Math.max(1, flow.length);
    const color = lit ? WHITE : PARTICLE;
    const alpha = lit ? 1 : spotlightKey ? 0.45 : 0.7;
    const radius = (lit ? 2.2 : 0.9 + flow.width * 0.3) * s;
    for (let i = 0; i < flow.particles; i++) {
      // The golden-ratio offset keeps flows from moving in step with each other.
      const t = (seconds / duration + i / flow.particles + flow.index * 0.618) % 1;
      const fade = Math.min(1, t / 0.08, (1 - t) / 0.08);
      for (let k = 0; k < TRAIL; k++) {
        const along = t - k * step;
        if (along < 0) break;
        const [x, y] = toScreen(pointOnArc(flow.a, flow.c, flow.b, along), fit);
        ctx.fillStyle = rgba(color, alpha * fade * (1 - k / TRAIL));
        circle(ctx, x, y, Math.max(0.6, radius * (1 - k / (TRAIL + 2))));
        ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawPulse(ctx, home, fit, now) {
  const [x, y] = toScreen([home.x, home.y], fit);
  const base = ((home.r || 3) + 5) * fit.scale;
  for (const offset of [0, 0.5]) {
    const phase = (now / PULSE_MS + offset) % 1;
    circle(ctx, x, y, base + 26 * fit.scale * phase);
    ctx.strokeStyle = rgba(AMBER, 0.7 * (1 - phase));
    ctx.lineWidth = Math.max(1, 2.4 * fit.scale * (1 - phase));
    ctx.stroke();
  }
}

/*
 * The name of the dot under the pointer: shown while a mouse hovers, and for a
 * few seconds after a tap. Picks go to onPick (null: nothing is pickable).
 */
function usePointer({ scene, size, onPick }) {
  const [tip, setTip] = useState(null);
  const press = useRef(null);
  const tapTimer = useRef(0);
  const fit = useMemo(
    () => (scene && size?.width && size?.height ? fitBox(scene.box, size.width, size.height) : null),
    [scene, size],
  );
  const points = useMemo(() => (scene ? scenePoints(scene) : []), [scene]);
  useEffect(() => () => clearTimeout(tapTimer.current), []);
  // A resize moves every dot, so a tip left up would point at nothing.
  useEffect(() => setTip(null), [size]);

  const dotAt = (event) => {
    if (!fit) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    return hitTest(points, fit, [event.clientX - rect.left, event.clientY - rect.top]);
  };

  return {
    tip,
    handlers: {
      onPointerMove: (event) => {
        if (event.pointerType !== 'mouse') return;
        const dot = dotAt(event);
        setTip((previous) => (dot ? { ...dot, touch: false } : previous?.touch ? previous : null));
      },
      onPointerLeave: (event) => {
        if (event.pointerType === 'mouse') setTip((previous) => (previous?.touch ? previous : null));
      },
      onPointerDown: (event) => {
        press.current = { x: event.clientX, y: event.clientY };
      },
      onPointerUp: (event) => {
        const start = press.current;
        press.current = null;
        if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP) return;
        const dot = dotAt(event);
        if (dot && onPick) onPick(dot.name);
        if (event.pointerType === 'mouse') return;
        clearTimeout(tapTimer.current);
        setTip(dot ? { ...dot, touch: true } : null);
        if (dot) tapTimer.current = setTimeout(() => setTip(null), TAP_TIP_MS);
      },
    },
  };
}

// The tip sits above its dot, and leans inward near the map's sides.
function Tip({ tip, width }) {
  const lean = tip.x < width * 0.2 ? 'start' : tip.x > width * 0.8 ? 'end' : 'middle';
  return (
    <div
      className={`wall-tip wall-tip-${lean}`}
      style={{ left: tip.x, top: tip.y - Math.max(tip.r, 4) - 8 }}
      role="status"
    >
      {tip.name}
    </div>
  );
}

export default function WallMap({ wall, outline, spotlight, reducedMotion, focus, onPick }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const baseRef = useRef(null);
  const topRef = useRef(null);
  const size = useContainerSize(containerRef);
  const scene = useMemo(
    () => (wall && outline ? buildScene(wall, outline, focus || wall.home.institution) : null),
    [wall, outline, focus],
  );
  const box = scene?.box || (outline ? worldBox(outline.bounds) : null);
  const spotlightKey = spotlight ? flowKey(spotlight) : null;
  const { tip, handlers } = usePointer({ scene, size, onPick });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!scene || !size || !canvas || size.width === 0 || size.height === 0) return undefined;
    const { width, height, dpr } = size;
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    // Assigning a canvas size clears it, so only do it when the size changed.
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const fit = fitBox(scene.box, width, height);
    const layer = (ref, draw) => {
      const offscreen = ref.current || (ref.current = document.createElement('canvas'));
      offscreen.width = pixelWidth;
      offscreen.height = pixelHeight;
      const layerContext = offscreen.getContext('2d');
      layerContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(layerContext);
      return offscreen;
    };
    const base = layer(baseRef, (layerContext) => drawBase(layerContext, scene, fit, size, spotlightKey));
    const top = layer(topRef, (layerContext) => drawTop(layerContext, scene, fit, size));

    const context = canvas.getContext('2d');
    let frame = 0;
    const render = (now) => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      context.drawImage(base, 0, 0);
      if (!reducedMotion) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawMotion(context, scene, fit, now, spotlightKey);
        if (scene.home) drawPulse(context, scene.home, fit, now);
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
      context.drawImage(top, 0, 0);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [scene, size, spotlightKey, reducedMotion]);

  const label = wall
    ? `Map of the United States: ${wall.flows.length} lines of GPU work moving between campuses on ${wall.day}.`
    : 'Map of the United States.';

  return (
    <div
      ref={containerRef}
      className={tip && !tip.touch && onPick ? 'wall-map wall-map-pointing' : 'wall-map'}
      {...handlers}
    >
      {box && (
        <svg
          viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <path d={outline.land} fill="#0c1628" fillRule="evenodd" />
          <path d={outline.borders} fill="none" stroke="rgba(148, 177, 220, 0.16)" strokeWidth={0.7} strokeLinejoin="round" />
          <path d={outline.coast} fill="none" stroke="rgba(148, 177, 220, 0.4)" strokeWidth={0.9} strokeLinejoin="round" />
        </svg>
      )}
      <canvas ref={canvasRef} role="img" aria-label={label} />
      {tip && size && <Tip tip={tip} width={size.width} />}
    </div>
  );
}
