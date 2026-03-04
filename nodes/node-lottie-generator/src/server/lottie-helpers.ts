/**
 * lottie-helpers.ts
 *
 * Exported as a plain string so the sandbox can eval it before user code runs.
 */

export const LOTTIE_HELPERS_CODE = /* js */ `
const LOTTIE_VERSION = "5.12.1";

// ─── EASINGS ───
const EASE_LINEAR   = { i: { x: [0.5],   y: [0.5]   }, o: { x: [0.5],   y: [0.5]   } };
const EASE_IN       = { i: { x: [0.42],  y: [0]     }, o: { x: [1],     y: [1]     } };
const EASE_OUT      = { i: { x: [0],     y: [0]     }, o: { x: [0.58],  y: [1]     } };
const EASE_IN_OUT   = { i: { x: [0.42],  y: [0]     }, o: { x: [0.58],  y: [1]     } };
const EASE_SPRING   = { i: { x: [0.175], y: [0.885] }, o: { x: [0.32],  y: [1.275] } };

// ─── VALUE BUILDERS ───
const staticVal = (k) => ({ a: 0, k });
const animatedVal = (keyframes) => ({ a: 1, k: keyframes });
const kf = (t, s, e, easing = EASE_IN_OUT) => {
  const frame = { t, s };
  if (e !== undefined) {
    frame.e = e;
    frame.i = easing.i;
    frame.o = easing.o;
  }
  return frame;
};
const kfHold = (t, s) => ({ t, s, h: 1 });
const isLV = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && "a" in v && "k" in v;
const lv = (v) => (isLV(v) ? v : staticVal(v));

// ─── COLOR HELPERS (0..1 range) ───
const rgba = (r, g, b, a = 1) => [r / 255, g / 255, b / 255, a];
const hex = (h, a = 1) => {
  const s = h.replace("#", "");
  const parse = (c) => parseInt(c, 16) / 255;
  return s.length === 3 
    ? [parse(s[0]+s[0]), parse(s[1]+s[1]), parse(s[2]+s[2]), a]
    : [parse(s.slice(0,2)), parse(s.slice(2,4)), parse(s.slice(4,6)), a];
};

// ─── TRANSFORMS ───
const groupTransform = ({ p=[0,0], a=[0,0], s=[100,100], r=0, o=100, sk=0, sa=0 } = {}) => 
  ({ ty: "tr", p: lv(p), a: lv(a), s: lv(s), r: lv(r), o: lv(o), sk: lv(sk), sa: lv(sa) });
const identityTransform = () => groupTransform();
const layerTransform = ({ p=[0,0], a=[0,0], s=[100,100], r=0, o=100, sk=0, sa=0 } = {}) => 
  ({ p: lv(p), a: lv(a), s: lv(s), r: lv(r), o: lv(o), sk: lv(sk), sa: lv(sa) });

// ─── PAINTS ───
const fill = (color, opacity = 100) => ({ ty: "fl", nm: "Fill", r: 1, c: lv(color), o: lv(opacity) });
const stroke = (color, width = 2, opacity = 100, { lc = 2, lj = 2 } = {}) => 
  ({ ty: "st", nm: "Stroke", lc, lj, ml: 4, c: lv(color), o: lv(opacity), w: lv(width) });

// ─── GEOMETRY ───
const ellipse = (p = [0, 0], s = [100, 100]) => ({ ty: "el", d: 1, nm: "Ellipse", p: lv(p), s: lv(s) });
const rect = (p = [0, 0], s = [100, 100], r = 0) => ({ ty: "rc", d: 1, nm: "Rectangle", p: lv(p), s: lv(s), r: lv(r) });
const polystar = ({ p=[0,0], or=50, ir=25, pt=5, r=0, type=1 } = {}) => {
  const s = { ty: "sr", d: 1, sy: type, p: lv(p), r: lv(r), pt: lv(pt), or: lv(or), os: lv(0) };
  if (type === 1) { s.ir = lv(ir); s.is = lv(0); }
  return s;
};

// ─── GROUPS & MACROS ───
const group = (items, tr, nm = "Group") => ({
  ty: "gr", nm,
  it: [...items.filter((x) => x && x.ty !== "tr"), tr ?? identityTransform()],
});

/** MACRO: Bundles a geometry and a paint into a safe group. Use this! */
const makeShape = (geometry, paint, transform) => group([geometry, paint], transform);

// ─── LAYERS ───
// op defaults to 99999 so layers NEVER disappear unexpectedly
const shapeLayer = ({ nm="Shape", ind=1, ip=0, op=99999, st=0, ks, shapes=[], parent, bm=0 } = {}) => {
  const l = { ty: 4, nm, ind, ip, op, st, sr: 1, bm, ks: ks ?? layerTransform(), shapes };
  if (parent) l.parent = parent;
  return l;
};

const solidLayer = ({ nm="BG", ind=1, ip=0, op=99999, st=0, ks, color="#000000", w=512, h=512, parent } = {}) => {
  const l = { ty: 1, nm, ind, ip, op, st, sr: 1, bm: 0, ks: ks ?? layerTransform(), sc: color, sw: w, sh: h };
  if (parent) l.parent = parent;
  return l;
};

// ─── ANIMATION ROOT ───
const createAnimation = ({ nm="Anim", w=512, h=512, fr=30, duration=2, layers=[], assets=[] } = {}) => 
  ({ v: LOTTIE_VERSION, nm, fr, ip: 0, op: Math.round(fr * duration), w, h, ddd: 0, assets, layers, markers: [] });

// ─── PRESETS ───
const fadeIn = (sf, ef, easing = EASE_OUT) => animatedVal([kf(sf, [0], [100], easing), kf(ef, [100])]);
const fadeOut = (sf, ef, easing = EASE_IN) => animatedVal([kf(sf, [100], [0], easing), kf(ef, [0])]);
const scaleTo = (sf, ef, from = [0, 0], to = [100, 100], easing = EASE_SPRING) => animatedVal([kf(sf, from, to, easing), kf(ef, to)]);
const moveTo = (sf, ef, from, to, easing = EASE_IN_OUT) => animatedVal([kf(sf, from, to, easing), kf(ef, to)]);
const rotateTo = (sf, ef, fromDeg, toDeg, easing = EASE_IN_OUT) => animatedVal([kf(sf, [fromDeg], [toDeg], easing), kf(ef, [toDeg])]);

// Math utils
const sec = (seconds, fps) => Math.round(seconds * fps);
`;

export const LOTTIE_HELPER_API_DOCS = `
### Core Factories
- \`createAnimation({ w, h, fr, duration, layers })\`
- \`shapeLayer({ ind, ks, shapes })\` (Note: \`op\` defaults to infinity, don't worry about it)
- \`solidLayer({ ind, color, w, h })\`

### Geometry & Paint
- \`ellipse([x, y], [w, h])\`, \`rect([x, y], [w, h], radius?)\`, \`polystar({ p, or, ir, pt, type })\`
- \`fill(colorArr, opacity?)\`, \`stroke(colorArr, width?)\`
- \`hex("#ff0000")\` -> returns Lottie color array

### Structural Macros (HIGHLY RECOMMENDED)
- \`makeShape(geometry, paint, transform?)\` -> Creates a fully compliant Shape Group.
  *Example*: \`makeShape(ellipse([0,0], [50,50]), fill(hex("#ff0000")))\`

### Transforms & Animation
- \`layerTransform({ p, a, s, r, o })\` -> For Layer \`ks\` properties.
- \`moveTo(startFrame, endFrame, [startX, startY], [endX, endY])\`
- \`scaleTo(startFrame, endFrame, [startW, startH], [endW, endH])\`
- \`fadeIn(startFrame, endFrame)\`, \`rotateTo(startFrame, endFrame, startDeg, endDeg)\`
`.trim();
