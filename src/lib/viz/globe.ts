/**
 * Atlas globe (d3-geo, SVG): an orthographic globe drawn as ink — coastlines wobbled
 * by an SVG turbulence filter — with the places, and great-circle arcs from each
 * source to the quartet it enters. Drag to turn. Pinch, double-click, Ctrl (⌘) + scroll
 * or the buttons zoom in, to about 400 km across; zoomed in, the globe is seen through a
 * fixed round lens, the coastlines switch to finer data, the graticule tightens and every
 * place in view is labelled where there is room. A plain scroll still scrolls the page, as
 * with a map embedded in a page. Choosing a place flies to it, framing it with the places
 * it is joined to, and shows its card. The place list and cards are the accessible interface.
 */
import { geoCentroid, geoDistance, geoGraticule, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import type { GeoPermissibleObjects } from "d3-geo";
import { select } from "d3-selection";
import type { MultiPolygon, Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";

interface AtlasData {
  places: Array<{ id: string; name: string; lat: number; lng: number; kind: string; precision: string; element: string | null }>;
  links: Array<[string, string]>;
}
type Place = AtlasData["places"][number];
type Pt = [number, number];

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Spot = [dx: number, dy: number, anchor: "start" | "middle" | "end"];
/** Label placement for places close together: the three English quartets are stacked
 *  north to south on the Atlantic side, clear of their halos (r 11) and of the source points to the east. */
const LABEL: Record<string, Spot> = {
  "little-gidding": [-17, -18, "end"],
  "burnt-norton": [-17, 1, "end"],
  "east-coker": [-17, 17, "end"],
  // Centred below its halo, so on a small globe it neither reaches the English stack nor the rim.
  "dry-salvages": [0, 26, "middle"],
};

/** Zoom: 1 shows the whole globe; at MAX_K the lens is about 400 km across. */
const MAX_K = 32;
/** Past this zoom the coastlines come from the 1:50m data (fetched when first needed). */
const FINE_K = 2;
/** From this zoom every place in view is labelled, where labels do not collide. */
const LABEL_ALL_K = 1.8;
const EARTH_KM = 6371;
const PRIORITY: Record<string, number> = { quartet: 0, life: 1, source: 2 };
/** Where else a label may go when its usual place is taken: right, left, above, below. */
const SPOTS: Spot[] = [
  [9, 4, "start"],
  [-9, 4, "end"],
  [0, -10, "middle"],
  [0, 18, "middle"],
];

const clampK = (v: number) => Math.max(1, Math.min(MAX_K, v));
const clampLat = (v: number) => Math.max(-80, Math.min(80, v));
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** The zoom that puts a point `angle` radians from the centre a fifth of the way in from the lens edge. */
const fitK = (angle: number) => clampK(angle >= Math.PI / 2 ? 1 : 0.8 / Math.max(1e-6, Math.sin(angle)));

type Vec = [number, number, number];
const RAD = Math.PI / 180;
const unit = (lng: number, lat: number): Vec => [Math.cos(lat * RAD) * Math.cos(lng * RAD), Math.cos(lat * RAD) * Math.sin(lng * RAD), Math.sin(lat * RAD)];
const angle = (a: Vec, b: Vec) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

/** One land polygon with a circle on the sphere that bounds it (centre, radius in radians). */
interface Piece {
  rings: Position[][];
  c: Vec;
  r: number;
}

/** Cut a land layer into its polygons, so that a zoomed-in view need project only those near it. */
function toPieces(land: ReturnType<typeof feature>): Piece[] {
  const out: Piece[] = [];
  for (const f of "features" in land ? land.features : [land]) {
    const g = f.geometry;
    const polys = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
    for (const rings of polys) {
      const outer = rings[0] ?? [];
      const vs = outer.map(([lng, lat]) => unit(lng!, lat!));
      const sum = vs.reduce<Vec>((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
      const n = Math.hypot(...sum);
      // A ring that encircles the sphere (Antarctica) has no useful centre: always draw it.
      const c: Vec = n > 1e-6 ? [sum[0] / n, sum[1] / n, sum[2] / n] : [0, 0, 1];
      out.push({ rings, c, r: n > 1e-6 ? Math.max(0, ...vs.map((v) => angle(c, v))) : Math.PI });
    }
  }
  return out;
}

/** The polygons that may show within `reach` radians of `centre`. */
function near(pieces: Piece[], [lng, lat]: Pt, reach: number): MultiPolygon {
  const v = unit(lng, lat);
  return { type: "MultiPolygon", coordinates: pieces.filter((p) => angle(v, p.c) < reach + p.r).map((p) => p.rings) };
}

export function initAtlas(root: HTMLElement): () => void {
  // Build the globe after first paint; the map data loads asynchronously.
  let off: (() => void) | null = null;
  let cancelled = false;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const start = () =>
    void import("world-atlas/land-110m.json").then((m) => {
      if (!cancelled) off = setupGlobe(root, m.default as unknown as Topology);
    });
  if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 1500 });
  else window.setTimeout(start, 200);
  return () => {
    cancelled = true;
    off?.();
  };
}

function setupGlobe(root: HTMLElement, topo: Topology): () => void {
  const data = JSON.parse(root.querySelector("[data-atlas-data]")!.textContent!) as AtlasData;
  const host = root.querySelector<HTMLElement>("[data-globe]")!;
  const cards = [...root.querySelectorAll<HTMLElement>("[data-card]")];
  const buttons = [...root.querySelectorAll<HTMLAnchorElement>("[data-place]")];
  const views = [...root.querySelectorAll<HTMLButtonElement>("[data-view]")];
  const tools = root.querySelector<HTMLElement>("[data-globe-tools]");
  const scale = root.querySelector<HTMLElement>("[data-scale]");
  const scaleBar = root.querySelector<HTMLElement>("[data-scale-bar]");
  const scaleLabel = root.querySelector<HTMLElement>("[data-scale-label]");
  const nudge = root.querySelector<HTMLElement>("[data-globe-nudge]");
  const byId = new Map(data.places.map((p) => [p.id, p]));
  const coarse = feature(topo, topo.objects.land as GeometryObject);
  let fine: Piece[] | null = null;
  let fineRequested = false;
  let dead = false;
  const small = window.matchMedia("(max-width: 599px)");

  let size = 560;
  /** Radius of the globe at zoom 1, and of the lens it is seen through when zoomed in. */
  let base = size / 2 - 8;
  /** SVG units per CSS pixel (above 1 when the globe is squeezed below its 280-unit minimum). */
  let cssScale = 1;
  let k = 1;
  const projection = geoOrthographic().precision(0.6);
  const path = geoPath(projection);
  let rotation: Pt = [10, -38];
  let selected = "";
  let raf = 0;
  let autoRotate = !reduced();
  let lastT = 0;

  const svg = select(host).append("svg").attr("class", "globe");
  const node = svg.node()!;
  const defs = svg.append("defs");
  const f = defs.append("filter").attr("id", "ink").attr("x", "-2%").attr("y", "-2%").attr("width", "104%").attr("height", "104%");
  f.append("feTurbulence").attr("type", "fractalNoise").attr("baseFrequency", 0.035).attr("numOctaves", 2).attr("seed", 7).attr("result", "n");
  f.append("feDisplacementMap").attr("in", "SourceGraphic").attr("in2", "n").attr("scale", 2.4);
  const lens = defs.append("clipPath").attr("id", "globe-lens").append("circle");
  const sphere = svg.append("circle").attr("class", "globe__sphere");
  const inLens = svg.append("g").attr("clip-path", "url(#globe-lens)");
  const grat = inLens.append("path").attr("class", "globe__graticule");
  const landPath = inLens.append("path").attr("class", "globe__land").attr("filter", "url(#ink)");
  const rim = svg.append("circle").attr("class", "globe__rim");
  const arcs = svg.append("g").attr("class", "globe__arcs").attr("clip-path", "url(#globe-lens)");
  const marks = svg.append("g").attr("class", "globe__marks");
  const graticule10 = geoGraticule10();

  const resize = () => {
    size = Math.min(620, Math.max(280, host.clientWidth || 560));
    cssScale = size / (host.clientWidth || size);
    base = size / 2 - 8;
    svg.attr("viewBox", `0 0 ${size} ${size}`).attr("width", size).attr("height", size);
    // Clip to the view as well as to the lens (see render), so a zoomed-in path (and its ink filter) stays view-sized.
    projection.translate([size / 2, size / 2]).clipExtent([
      [0, 0],
      [size, size],
    ]);
    for (const c of [lens, sphere, rim]) c.attr("cx", size / 2).attr("cy", size / 2).attr("r", base);
    render();
  };

  /** A 10° graticule for the whole globe; zoomed in, a finer one around the centre. */
  function graticule([lng, lat]: Pt): GeoPermissibleObjects {
    if (k < 4) return graticule10;
    const step = k < 10 ? 2 : k < 20 ? 1 : 0.5;
    const r = Math.asin(1 / k) / RAD + step;
    const lat0 = Math.max(-89, lat - r);
    const lat1 = Math.min(89, lat + r);
    const dl = Math.min(180, r / Math.max(0.05, Math.cos(Math.max(Math.abs(lat0), Math.abs(lat1)) * RAD)));
    return geoGraticule()
      .step([step, step])
      .precision(Math.min(2.5, step))
      .extent([
        [lng - dl, lat0],
        [lng + dl, lat1],
      ])();
  }

  function loadFine() {
    if (fineRequested) return;
    fineRequested = true;
    import("world-atlas/land-50m.json")
      .then((m) => {
        if (dead) return;
        const t = m.default as unknown as Topology;
        fine = toPieces(feature(t, t.objects.land as GeometryObject));
        render();
      })
      // Offline or failed: keep drawing the coarse coastline.
      .catch(() => undefined);
  }

  /**
   * Where to label each place: the chosen place first, then quartets, Eliot's places and sources, each at
   * the first spot inside the lens that clears the labels already placed and the other places' dots. Quartets and the chosen
   * place are always labelled; the rest only where there is room.
   */
  function labels(vis: Place[], at: Map<string, Pt>): Map<string, Spot> {
    type Box = [number, number, number, number];
    const hit = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const fs = small.matches ? 12 : 14;
    const dots = vis.map((p) => {
      const [x, y] = at.get(p.id)!;
      const r = (p.kind === "quartet" ? 5.5 : 3.8) + 1;
      return { id: p.id, box: [x - r, y - r, x + r, y + r] as Box };
    });
    const mid = size / 2;
    const inLens = (b: Box) => [b[0], b[2]].every((bx) => [b[1], b[3]].every((by) => (bx - mid) ** 2 + (by - mid) ** 2 < (base + 4) ** 2));
    const placed: Box[] = [];
    const out = new Map<string, Spot>();
    const order = vis
      .filter((p) => k >= LABEL_ALL_K || p.kind === "quartet" || p.id === selected)
      .sort((a, b) => Number(b.id === selected) - Number(a.id === selected) || (PRIORITY[a.kind] ?? 3) - (PRIORITY[b.kind] ?? 3));
    for (const p of order) {
      const [x, y] = at.get(p.id)!;
      const w = p.name.length * fs * 0.46;
      const boxAt = ([dx, dy, anchor]: Spot): Box => {
        const x0 = x + dx - (anchor === "end" ? w : anchor === "middle" ? w / 2 : 0);
        const y0 = y + dy - fs * 0.8;
        return [x0, y0, x0 + w, y0 + fs];
      };
      const spots = LABEL[p.id] ? [LABEL[p.id]!, ...SPOTS] : SPOTS;
      const free = (s: Spot) => {
        const b = boxAt(s);
        return inLens(b) && !placed.some((o) => hit(o, b)) && !dots.some((d) => d.id !== p.id && hit(d.box, b));
      };
      const spot = spots.find(free) ?? (p.kind === "quartet" || p.id === selected ? spots[0] : undefined);
      if (!spot) continue;
      placed.push(boxAt(spot));
      out.set(p.id, spot);
    }
    return out;
  }

  function updateScale() {
    if (!scale || !scaleBar || !scaleLabel) return;
    // True at the centre of the view; on the whole globe the edges are too foreshortened for a bar to mean much.
    scale.hidden = k <= 1.25;
    if (scale.hidden) return;
    const kmPerPx = (EARTH_KM / (base * k)) * cssScale;
    const max = kmPerPx * 96;
    const pow = 10 ** Math.floor(Math.log10(max));
    const n = max / pow;
    const km = (n >= 5 ? 5 : n >= 2 ? 2 : 1) * pow;
    scaleBar.style.width = `${(km / kmPerPx).toFixed(1)}px`;
    scaleLabel.textContent = `${km.toLocaleString("en-GB")} km`;
  }

  function render() {
    // The lens edge is the small circle asin(1 / k) from the centre, so clipping there (with a little to spare)
    // spares the projection every point outside the lens.
    const clip = Math.min(90, (Math.asin(1 / k) / RAD) * 1.05);
    projection.rotate(rotation).scale(base * k).clipAngle(clip);
    if (k > 1.2) loadFine();
    const centre: Pt = [-rotation[0], -rotation[1]];
    grat.attr("d", path(graticule(centre)) ?? "");
    landPath.attr("d", path(k >= FINE_K && fine ? near(fine, centre, clip * RAD) : coarse) ?? "");
    arcs
      .selectAll<SVGPathElement, [string, string]>("path")
      .data(data.links)
      .join("path")
      .attr("d", ([a, b]) => {
        const pa = byId.get(a)!;
        const pb = byId.get(b)!;
        return path({ type: "LineString", coordinates: [[pa.lng, pa.lat], [pb.lng, pb.lat]] }) ?? "";
      })
      .attr("class", ([a, b]) => (a === selected || b === selected ? "is-on" : ""));
    const mid = size / 2;
    const at = new Map<string, Pt>();
    for (const p of data.places) {
      if (geoDistance([p.lng, p.lat], centre) >= Math.PI / 2 - 0.02) continue;
      const xy = projection([p.lng, p.lat]);
      if (xy && (xy[0] - mid) ** 2 + (xy[1] - mid) ** 2 < (base - 3) ** 2) at.set(p.id, xy);
    }
    const vis = data.places.filter((p) => at.has(p.id));
    const shown = labels(vis, at);
    const g = marks
      .selectAll<SVGGElement, Place>("g")
      .data(vis, (d) => d.id)
      .join((enter) => {
        const e = enter.append("g");
        e.append("circle").attr("class", "halo");
        e.append("circle").attr("class", "dot");
        e.append("text").attr("class", "label");
        return e;
      });
    g.attr("class", (d) => `globe__place globe__place--${d.kind}${d.id === selected ? " is-selected" : ""}`)
      .attr("data-element", (d) => d.element)
      .attr("transform", (d) => {
        const [x, y] = at.get(d.id)!;
        return `translate(${x},${y})`;
      })
      .on("click", (_ev, d) => choose(d.id, true));
    g.select<SVGCircleElement>("circle.halo").attr("r", (d) => (d.precision === "uncertain" ? 16 : d.kind === "quartet" ? 11 : 0));
    g.select<SVGCircleElement>("circle.dot").attr("r", (d) => (d.kind === "quartet" ? 5.5 : 3.8));
    g.select<SVGTextElement>("text.label")
      .text((d) => (shown.has(d.id) ? d.name : ""))
      .attr("x", (d) => shown.get(d.id)?.[0] ?? 9)
      .attr("y", (d) => shown.get(d.id)?.[1] ?? 4)
      .attr("text-anchor", (d) => shown.get(d.id)?.[2] ?? "start");
    host.dataset.zoom = k.toFixed(2);
    updateScale();
  }

  function stopMotion() {
    autoRotate = false;
    cancelAnimationFrame(raf);
  }

  /** The place on the globe under a point of the view, if the point is on the globe and in the lens. */
  function geoAt(xy: Pt): Pt | null {
    const mid = size / 2;
    if ((xy[0] - mid) ** 2 + (xy[1] - mid) ** 2 > base ** 2) return null;
    const p = projection.invert!(xy);
    return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? p : null;
  }

  /** Set the zoom, turning the globe so that `anchor` (a place) stays under `xy` (a point of the view). */
  function zoomAround(next: number, xy: Pt, anchor: Pt | null = geoAt(xy)) {
    k = clampK(next);
    projection.scale(base * k);
    // Nudging the rotation by the drift of the point under `xy` converges in a couple of steps.
    for (let i = 0; anchor && i < 3; i++) {
      projection.rotate(rotation);
      const q = projection.invert!(xy);
      if (!q || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) break;
      rotation = [wrap(rotation[0] + wrap(q[0] - anchor[0])), clampLat(rotation[1] + (q[1] - anchor[1]))];
    }
    render();
  }

  /** Animated zoom about a point of the view (the buttons, double-click). */
  function zoomTo(target: number, xy: Pt) {
    stopMotion();
    const anchor = geoAt(xy);
    const k0 = k;
    const k1 = clampK(target);
    const t0 = performance.now();
    const dur = reduced() ? 1 : 350;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      zoomAround(k0 * (k1 / k0) ** (1 - (1 - t) ** 3), xy, anchor);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /** Fly the centre of the view to a place and zoom to `k1`, pulling back mid-flight when the ends are far apart. */
  function flyTo(to: Pt, k1: number) {
    stopMotion();
    const from: Pt = [-rotation[0], -rotation[1]];
    const interp = geoInterpolate(from, to);
    const l0 = Math.log(k);
    const l1 = Math.log(clampK(k1));
    const dip = Math.max(0, (l0 + l1) / 2 - Math.log(fitK(geoDistance(from, to) / 2)));
    const t0 = performance.now();
    const dur = reduced() ? 1 : 1200;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOut(t);
      const [x, y] = interp(e);
      rotation = [-x, clampLat(-y)];
      k = clampK(Math.exp(l0 + (l1 - l0) * e - 4 * dip * e * (1 - e)));
      render();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /** The view for a place: framed with the places joined to it, or, when those span half the world, the whole globe turned to it. */
  function frame(id: string): { centre: Pt; k: number } {
    const p = byId.get(id)!;
    const here: Pt = [p.lng, p.lat];
    const pts: Pt[] = [here];
    for (const [a, b] of data.links) {
      const q = a === id ? byId.get(b) : b === id ? byId.get(a) : undefined;
      if (q) pts.push([q.lng, q.lat]);
    }
    if (pts.length < 2) return { centre: here, k: Math.max(k, 3) };
    const centre = geoCentroid({ type: "MultiPoint", coordinates: pts }) as Pt;
    const fit = Math.min(6, fitK(Math.max(...pts.map((q) => geoDistance(centre, q)))));
    return fit < 1.5 ? { centre: here, k: 1 } : { centre, k: fit };
  }

  // A slow idle drift: ≤ 30 fps, only while visible, and only for the first 20 s.
  let driftStart = 0;
  let visible = true;
  const drift = (now: number) => {
    if (!autoRotate) return;
    driftStart ||= now;
    if (now - driftStart > 20_000) return;
    raf = requestAnimationFrame(drift);
    if (!visible || now - lastT < 33) return;
    const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0;
    lastT = now;
    rotation = [rotation[0] + dt * 3, rotation[1]];
    render();
  };
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
  io.observe(host);

  function choose(id: string, scroll: boolean) {
    const p = byId.get(id);
    if (!p) return;
    selected = id;
    const view = frame(id);
    flyTo(view.centre, view.k);
    cards.forEach((c) => (c.hidden = c.dataset.card !== id));
    buttons.forEach((b) => b.setAttribute("aria-current", b.dataset.place === id ? "true" : "false"));
    const card = cards.find((c) => c.dataset.card === id);
    if (scroll && card && window.innerWidth < 900) card.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "nearest" });
    history.replaceState(history.state, "", `#place-${id}`);
  }

  const onButton = (e: MouseEvent) => {
    e.preventDefault();
    const id = (e.currentTarget as HTMLElement).dataset.place!;
    choose(id, true);
    cards.find((c) => c.dataset.card === id)?.focus({ preventScroll: true });
  };
  buttons.forEach((b) => b.addEventListener("click", onButton));

  const onView = (e: MouseEvent) => {
    const act = (e.currentTarget as HTMLElement).dataset.view;
    const mid: Pt = [size / 2, size / 2];
    if (act === "in") zoomTo(k * 2, mid);
    else if (act === "out") zoomTo(k / 2, mid);
    else flyTo([-rotation[0], -rotation[1]], 1);
  };
  views.forEach((b) => b.addEventListener("click", onView));

  // ---- Gestures: one pointer turns the globe, two pinch (zoom) and pan.
  const toView = (e: { clientX: number; clientY: number }): Pt => {
    const r = node.getBoundingClientRect();
    return [((e.clientX - r.left) * size) / (r.width || size), ((e.clientY - r.top) * size) / (r.height || size)];
  };
  const pointers = new Map<number, Pt>();
  let pinch: { k0: number; d0: number; anchor: Pt | null } | null = null;
  let moved = 0;
  const pair = () => {
    const [a, b] = [...pointers.values()] as [Pt, Pt];
    return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Pt, d: Math.hypot(a[0] - b[0], a[1] - b[1]) };
  };
  const startPinch = () => {
    const { mid, d } = pair();
    pinch = { k0: k, d0: Math.max(1, d), anchor: geoAt(mid) };
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = toView(e);
    pointers.set(e.pointerId, cur);
    if (pointers.size === 1) {
      const dx = cur[0] - prev[0];
      const dy = cur[1] - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      const s = 75 / projection.scale();
      rotation = [rotation[0] + dx * s, clampLat(rotation[1] - dy * s)];
      render();
    } else if (pinch) {
      moved += 10;
      const { mid, d } = pair();
      zoomAround((pinch.k0 * d) / pinch.d0, mid, pinch.anchor);
    }
  };
  const onUp = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    pinch = null;
    if (pointers.size === 2) startPinch();
    if (pointers.size) return;
    node.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopMotion();
    if (!pointers.size) {
      moved = 0;
      node.classList.add("is-dragging");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    }
    pointers.set(e.pointerId, toView(e));
    if (pointers.size === 2) startPinch();
  };
  // A drag that ends over a place is not a click on it.
  const onClick = (e: MouseEvent) => {
    if (moved > 4) e.stopPropagation();
  };
  const onDblClick = (e: MouseEvent) => {
    if ((e.target as Element).closest(".globe__place")) return;
    e.preventDefault();
    zoomTo(k * (e.shiftKey ? 0.5 : 2), toView(e));
  };

  // Scrolling zooms only with Ctrl or ⌘ held (a trackpad pinch arrives as Ctrl + scroll); a plain scroll moves the page on, with a reminder.
  const mod = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? "⌘" : "Ctrl";
  root.querySelectorAll("[data-mod]").forEach((el) => (el.textContent = mod));
  let nudgeTimer = 0;
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) {
      if (!nudge || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      nudge.classList.add("is-on");
      clearTimeout(nudgeTimer);
      nudgeTimer = window.setTimeout(() => nudge.classList.remove("is-on"), 1400);
      return;
    }
    e.preventDefault();
    stopMotion();
    nudge?.classList.remove("is-on");
    const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002;
    zoomAround(k * 2 ** Math.max(-0.75, Math.min(0.75, -e.deltaY * unit * 10)), toView(e));
  };
  // Safari reports a trackpad pinch as gesture events rather than Ctrl + scroll. On touch screens the pointers handle it.
  type Gesture = Event & { scale: number; clientX: number; clientY: number };
  let gestureK = 1;
  const onGestureStart = (e: Event) => {
    if (pointers.size) return;
    e.preventDefault();
    stopMotion();
    gestureK = k;
  };
  const onGestureChange = (e: Event) => {
    if (pointers.size) return;
    e.preventDefault();
    const g = e as Gesture;
    zoomAround(gestureK * g.scale, toView(g));
  };

  node.addEventListener("pointerdown", onDown);
  node.addEventListener("click", onClick, true);
  node.addEventListener("dblclick", onDblClick);
  node.addEventListener("wheel", onWheel, { passive: false });
  node.addEventListener("gesturestart", onGestureStart);
  node.addEventListener("gesturechange", onGestureChange);

  // With JavaScript, one card at a time; start from the hash or Burnt Norton.
  const initial = location.hash.startsWith("#place-") ? location.hash.slice(7) : "burnt-norton";
  cards.forEach((c) => (c.hidden = c.dataset.card !== initial));
  root.classList.add("atlas--js");
  if (tools) tools.hidden = false;
  resize();
  if (byId.has(initial) && location.hash) choose(initial, false);
  else {
    selected = initial;
    buttons.forEach((b) => b.setAttribute("aria-current", b.dataset.place === initial ? "true" : "false"));
    render();
    raf = requestAnimationFrame(drift);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    clearTimeout(nudgeTimer);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    buttons.forEach((b) => b.removeEventListener("click", onButton));
    views.forEach((b) => b.removeEventListener("click", onView));
    host.replaceChildren();
  };
}
