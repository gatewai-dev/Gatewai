/**
 * svgHelpers.ts
 *
 * A self-contained JavaScript library that is injected verbatim into the
 * QuickJS sandbox.  Everything here runs *inside* the VM — no host imports.
 *
 * Exported as a plain string so the sandbox can eval it before user code runs.
 */

export const SVG_HELPERS_CODE = /* js */ `
// ─────────────────────────────────────────────────────────────
//  MATH & INTERPOLATION
// ─────────────────────────────────────────────────────────────

/** Linear interpolate between a and b by t ∈ [0,1] */
const lerp = (a, b, t) => a + (b - a) * t;

/** Clamp x to [min, max] */
const clamp = (x, min, max) => Math.min(Math.max(x, min), max);

/** Map v from [a,b] range to [c,d] range */
const mapRange = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);

/** Convert degrees to radians */
const toRad = (deg) => (deg * Math.PI) / 180;

/** Convert radians to degrees */
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Random float in [min, max) */
const randFloat = (min, max) => Math.random() * (max - min) + min;

/** Random integer in [min, max] */
const randInt = (min, max) => Math.floor(randFloat(min, max + 1));

/** Seeded pseudo-random (mulberry32) — reproducible between retries */
const seedRand = (seed) => {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ─────────────────────────────────────────────────────────────
//  EASING FUNCTIONS  (all accept t ∈ [0,1] → [0,1])
// ─────────────────────────────────────────────────────────────

const easeInQuad  = (t) => t * t;
const easeOutQuad = (t) => t * (2 - t);
const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => (--t) * t * t + 1;
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeOutElastic = (t) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

// ─────────────────────────────────────────────────────────────
//  COLOR UTILITIES
// ─────────────────────────────────────────────────────────────

/** HSL string → { r, g, b } (0-255) */
const hslToRgb = (h, s, l) => {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
};

/** { r, g, b } → #rrggbb hex string */
const rgbToHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');

/** HSL → #rrggbb */
const hsl = (h, s, l) => rgbToHex(hslToRgb(h, s, l));

/** Linearly interpolate two hex colours */
const lerpColor = (hex1, hex2, t) => {
  const parse = (h) => ({
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  });
  const a = parse(hex1), b = parse(hex2);
  return rgbToHex({
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  });
};

/** Generate an N-stop gradient palette between two hues */
const gradientPalette = (h1, h2, steps, s = 70, l = 55) =>
  Array.from({ length: steps }, (_, i) =>
    hsl(lerp(h1, h2, i / (steps - 1)), s, l)
  );

/** Randomise a palette of n harmonious colours around a base hue */
const harmonicPalette = (baseHue, n, s = 65, l = 55) =>
  Array.from({ length: n }, (_, i) =>
    hsl((baseHue + (360 / n) * i) % 360, s, l)
  );

// ─────────────────────────────────────────────────────────────
//  SVG PATH BUILDERS
// ─────────────────────────────────────────────────────────────

/** Move to */
const M = (x, y) => \`M \${x} \${y}\`;
/** Line to */
const L = (x, y) => \`L \${x} \${y}\`;
/** Cubic bezier */
const C = (x1, y1, x2, y2, x, y) => \`C \${x1} \${y1} \${x2} \${y2} \${x} \${y}\`;
/** Quadratic bezier */
const Q = (cx, cy, x, y) => \`Q \${cx} \${cy} \${x} \${y}\`;
/** Arc */
const A = (rx, ry, xRot, large, sweep, x, y) =>
  \`A \${rx} \${ry} \${xRot} \${large} \${sweep} \${x} \${y}\`;
/** Close path */
const Z = () => 'Z';

/** Build a regular polygon path centred at (cx,cy) with radius r and n sides */
const polygonPath = (cx, cy, r, n, startAngle = -Math.PI / 2) => {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = startAngle + (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return pts.map(([x, y], i) => (i === 0 ? M(x, y) : L(x, y))).join(' ') + ' Z';
};

/** Star path: n points, outer radius r, inner radius ir */
const starPath = (cx, cy, r, ir, n = 5, startAngle = -Math.PI / 2) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = startAngle + (Math.PI * i) / n;
    const radius = i % 2 === 0 ? r : ir;
    pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  return pts.map(([x, y], i) => (i === 0 ? M(x, y) : L(x, y))).join(' ') + ' Z';
};

/** Smooth closed blob path through an array of [x,y] points */
const smoothPath = (points) => {
  const n = points.length;
  let d = \`M \${points[0][0]} \${points[0][1]}\`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += \` C \${cp1x} \${cp1y} \${cp2x} \${cp2y} \${p2[0]} \${p2[1]}\`;
  }
  return d + ' Z';
};

/** Cardinal (catmull-rom) spline through points — open path */
const splinePath = (points, tension = 0.5) => {
  if (points.length < 2) return '';
  let d = \`M \${points[0][0]} \${points[0][1]}\`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const cp1x = p1[0] + ((p2[0] - p0[0]) * tension) / 3;
    const cp1y = p1[1] + ((p2[1] - p0[1]) * tension) / 3;
    const cp2x = p2[0] - ((p3[0] - p1[0]) * tension) / 3;
    const cp2y = p2[1] - ((p3[1] - p1[1]) * tension) / 3;
    d += \` C \${cp1x} \${cp1y} \${cp2x} \${cp2y} \${p2[0]} \${p2[1]}\`;
  }
  return d;
};

// ─────────────────────────────────────────────────────────────
//  SVG ELEMENT BUILDERS  (return XML strings)
// ─────────────────────────────────────────────────────────────

/** Serialize an attribute map to XML attribute string */
const attrs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v != null)
    .map(([k, v]) => \`\${k}="\${v}"\`)
    .join(' ');

/** <linearGradient> definition */
const linearGradient = (id, x1, y1, x2, y2, stops) => {
  const stopEls = stops
    .map(([offset, color, opacity = 1]) =>
      \`<stop offset="\${offset}" stop-color="\${color}" stop-opacity="\${opacity}"/>\`
    )
    .join('');
  return \`<linearGradient id="\${id}" x1="\${x1}" y1="\${y1}" x2="\${x2}" y2="\${y2}" gradientUnits="userSpaceOnUse">\${stopEls}</linearGradient>\`;
};

/** <radialGradient> definition */
const radialGradient = (id, cx, cy, r, stops, fx, fy) => {
  const extra = fx != null ? \` fx="\${fx}" fy="\${fy}"\` : '';
  const stopEls = stops
    .map(([offset, color, opacity = 1]) =>
      \`<stop offset="\${offset}" stop-color="\${color}" stop-opacity="\${opacity}"/>\`
    )
    .join('');
  return \`<radialGradient id="\${id}" cx="\${cx}" cy="\${cy}" r="\${r}"\${extra} gradientUnits="userSpaceOnUse">\${stopEls}</radialGradient>\`;
};

/** Drop-shadow filter */
const dropShadowFilter = (id, dx = 4, dy = 4, blur = 6, color = '#000', opacity = 0.4) =>
  \`<filter id="\${id}" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="\${dx}" dy="\${dy}" stdDeviation="\${blur}" flood-color="\${color}" flood-opacity="\${opacity}"/>
  </filter>\`;

/** Gaussian blur filter */
const blurFilter = (id, stdDeviation = 4) =>
  \`<filter id="\${id}"><feGaussianBlur stdDeviation="\${stdDeviation}"/></filter>\`;

/** Glow filter (dilate + blur + merge) */
const glowFilter = (id, color, blur = 8) =>
  \`<filter id="\${id}" x="-30%" y="-30%" width="160%" height="160%">
    <feFlood flood-color="\${color}" flood-opacity="0.8" result="flood"/>
    <feComposite in="flood" in2="SourceGraphic" operator="in" result="glow"/>
    <feGaussianBlur in="glow" stdDeviation="\${blur}" result="blurGlow"/>
    <feMerge><feMergeNode in="blurGlow"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>\`;

/** Assemble a <svg> root element */
const svgRoot = (w, h, content, defs = '') => {
  const defsBlock = defs ? \`<defs>\${defs}</defs>\` : '';
  return \`<svg xmlns="http://www.w3.org/2000/svg" width="\${w}" height="\${h}" viewBox="0 0 \${w} \${h}">\${defsBlock}\${content}</svg>\`;
};

/** Wrap elements in a <g> group with optional attributes */
const group = (children, attributes = {}) =>
  \`<g \${attrs(attributes)}>\${Array.isArray(children) ? children.join('') : children}</g>\`;

/** Circle element */
const circle = (cx, cy, r, a = {}) =>
  \`<circle cx="\${cx}" cy="\${cy}" r="\${r}" \${attrs(a)}/>\`;

/** Rectangle element, optional rounded corners */
const rect = (x, y, w, h, a = {}) =>
  \`<rect x="\${x}" y="\${y}" width="\${w}" height="\${h}" \${attrs(a)}/>\`;

/** Path element */
const path = (d, a = {}) => \`<path d="\${d}" \${attrs(a)}/>\`;

/** Text element */
const text = (content, x, y, a = {}) =>
  \`<text x="\${x}" y="\${y}" \${attrs(a)}>\${content}</text>\`;

/** <use> element referencing a symbol/def by id */
const use = (id, x, y, a = {}) =>
  \`<use href="#\${id}" x="\${x}" y="\${y}" \${attrs(a)}/>\`;

// ─────────────────────────────────────────────────────────────
//  PATTERN / TEXTURE GENERATORS
// ─────────────────────────────────────────────────────────────

/** Dot grid pattern definition */
const dotGridPattern = (id, spacing = 20, r = 1.5, color = '#ffffff', opacity = 0.15) =>
  \`<pattern id="\${id}" width="\${spacing}" height="\${spacing}" patternUnits="userSpaceOnUse">
    <circle cx="\${spacing / 2}" cy="\${spacing / 2}" r="\${r}" fill="\${color}" fill-opacity="\${opacity}"/>
  </pattern>\`;

/** Line grid pattern definition */
const lineGridPattern = (id, spacing = 20, stroke = '#ffffff', opacity = 0.1, width = 0.5) =>
  \`<pattern id="\${id}" width="\${spacing}" height="\${spacing}" patternUnits="userSpaceOnUse">
    <path d="M \${spacing} 0 L 0 0 0 \${spacing}" fill="none" stroke="\${stroke}" stroke-width="\${width}" stroke-opacity="\${opacity}"/>
  </pattern>\`;

// ─────────────────────────────────────────────────────────────
//  GEOMETRY HELPERS
// ─────────────────────────────────────────────────────────────

/** Point on a circle: (cx,cy) centre, r radius, angle in degrees */
const pointOnCircle = (cx, cy, r, angleDeg) => ({
  x: cx + r * Math.cos(toRad(angleDeg)),
  y: cy + r * Math.sin(toRad(angleDeg)),
});

/** Distance between two points */
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/** Midpoint */
const midpoint = (x1, y1, x2, y2) => ({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 });

/** Rotate point (px,py) around (cx,cy) by angleDeg */
const rotatePoint = (px, py, cx, cy, angleDeg) => {
  const cos = Math.cos(toRad(angleDeg));
  const sin = Math.sin(toRad(angleDeg));
  return {
    x: cos * (px - cx) - sin * (py - cy) + cx,
    y: sin * (px - cx) + cos * (py - cy) + cy,
  };
};

/** Generate n evenly-spaced points on a circle */
const circlePoints = (cx, cy, r, n, startDeg = 0) =>
  Array.from({ length: n }, (_, i) =>
    pointOnCircle(cx, cy, r, startDeg + (360 / n) * i)
  );

// expose everything at top scope — no module system in QuickJS
`;

/**
 * Partial list of identifiers injected so the system prompt can document them.
 */
export const SVG_HELPER_API_DOCS = `
### Math & Interpolation
- \`lerp(a, b, t)\` — linear interpolate
- \`clamp(x, min, max)\`
- \`mapRange(v, a, b, c, d)\` — remap value between ranges
- \`toRad(deg)\` / \`toDeg(rad)\`
- \`randFloat(min, max)\` / \`randInt(min, max)\`
- \`seedRand(seed)\` → seeded PRNG factory, returns \`() => float\`

### Easing
- \`easeInQuad\`, \`easeOutQuad\`, \`easeInOutQuad\`
- \`easeInCubic\`, \`easeOutCubic\`, \`easeInOutSine\`, \`easeOutElastic\`

### Color
- \`hsl(h, s, l)\` → \`"#rrggbb"\`  (h: 0-360, s/l: 0-100)
- \`lerpColor(hex1, hex2, t)\` → interpolated hex
- \`gradientPalette(h1, h2, steps)\` → array of hex strings
- \`harmonicPalette(baseHue, n)\` → evenly-spaced hue array
- \`hslToRgb(h, s, l)\` / \`rgbToHex({r,g,b})\`

### Path Builders (return path segment strings)
- \`M(x,y)\`, \`L(x,y)\`, \`C(x1,y1,x2,y2,x,y)\`, \`Q(cx,cy,x,y)\`, \`A(rx,ry,xRot,large,sweep,x,y)\`, \`Z()\`
- \`polygonPath(cx, cy, r, n, startAngle?)\` — regular polygon
- \`starPath(cx, cy, r, ir, n?)\` — star
- \`smoothPath(points)\` — smooth closed blob through \`[[x,y], ...]\`
- \`splinePath(points, tension?)\` — catmull-rom open spline

### SVG Element Builders (return XML strings)
- \`svgRoot(w, h, content, defs?)\` — full SVG wrapper
- \`group(children, attrs?)\` — \`<g>\` wrapper
- \`circle(cx, cy, r, attrs?)\`
- \`rect(x, y, w, h, attrs?)\`
- \`path(d, attrs?)\`
- \`text(content, x, y, attrs?)\`
- \`use(id, x, y, attrs?)\`
- \`attrs(obj)\` — serialize attribute object to XML string

### Filters & Gradients (return \`<defs>\` content strings)
- \`linearGradient(id, x1, y1, x2, y2, [[offset,color,opacity?], ...])\`
- \`radialGradient(id, cx, cy, r, stops, fx?, fy?)\`
- \`dropShadowFilter(id, dx?, dy?, blur?, color?, opacity?)\`
- \`blurFilter(id, stdDeviation?)\`
- \`glowFilter(id, color, blur?)\`

### Patterns (return \`<defs>\` content strings)
- \`dotGridPattern(id, spacing?, r?, color?, opacity?)\`
- \`lineGridPattern(id, spacing?, stroke?, opacity?, width?)\`

### Geometry
- \`pointOnCircle(cx, cy, r, angleDeg)\` → \`{x, y}\`
- \`circlePoints(cx, cy, r, n, startDeg?)\` → \`[{x,y}, ...]\`
- \`dist(x1, y1, x2, y2)\`
- \`midpoint(x1, y1, x2, y2)\`
- \`rotatePoint(px, py, cx, cy, angleDeg)\`
`.trim();
