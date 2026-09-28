/**
 * Atlas globe (d3-geo, SVG): an orthographic globe drawn as ink — coastlines wobbled
 * by an SVG turbulence filter — with the places, and great-circle arcs from each
 * source to the quartet it enters. Drag to turn; choosing a place turns the globe to it
 * and shows its card. The place list and cards are the accessible interface.
 */
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { drag } from "d3-drag";
import { feature } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";

interface AtlasData {
  places: Array<{ id: string; name: string; lat: number; lng: number; kind: string; precision: string; element: string | null }>;
  links: Array<[string, string]>;
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Label placement for places close together: the three English quartets are stacked
 *  north to south on the Atlantic side, clear of their halos (r 11) and of the source points to the east. */
const LABEL: Record<string, [dx: number, dy: number, anchor: "start" | "middle" | "end"]> = {
  "little-gidding": [-17, -18, "end"],
  "burnt-norton": [-17, 1, "end"],
  "east-coker": [-17, 17, "end"],
  // Centred below its halo, so on a small globe it neither reaches the English stack nor the rim.
  "dry-salvages": [0, 26, "middle"],
};

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
  const byId = new Map(data.places.map((p) => [p.id, p]));
  const land = feature(topo, topo.objects.land as GeometryObject);

  let size = Math.min(620, host.clientWidth || 560);
  const projection = geoOrthographic().clipAngle(90).precision(0.6);
  const path = geoPath(projection);
  let rotation: [number, number] = [10, -38];
  let selected = "";
  let raf = 0;
  let autoRotate = !reduced();
  let lastT = 0;

  const svg = select(host).append("svg").attr("class", "globe");
  const defs = svg.append("defs");
  const f = defs.append("filter").attr("id", "ink").attr("x", "-2%").attr("y", "-2%").attr("width", "104%").attr("height", "104%");
  f.append("feTurbulence").attr("type", "fractalNoise").attr("baseFrequency", 0.035).attr("numOctaves", 2).attr("seed", 7).attr("result", "n");
  f.append("feDisplacementMap").attr("in", "SourceGraphic").attr("in2", "n").attr("scale", 2.4);
  const sphere = svg.append("path").attr("class", "globe__sphere");
  const grat = svg.append("path").attr("class", "globe__graticule");
  const landPath = svg.append("path").attr("class", "globe__land").attr("filter", "url(#ink)");
  const rim = svg.append("path").attr("class", "globe__rim");
  const arcs = svg.append("g").attr("class", "globe__arcs");
  const marks = svg.append("g").attr("class", "globe__marks");
  const graticule = geoGraticule10();

  const resize = () => {
    size = Math.min(620, Math.max(280, host.clientWidth || 560));
    svg.attr("viewBox", `0 0 ${size} ${size}`).attr("width", size).attr("height", size);
    projection.scale(size / 2 - 8).translate([size / 2, size / 2]);
    render();
  };

  function render() {
    projection.rotate([rotation[0], rotation[1]]);
    const sph = { type: "Sphere" } as const;
    sphere.attr("d", path(sph) ?? "");
    rim.attr("d", path(sph) ?? "");
    grat.attr("d", path(graticule) ?? "");
    landPath.attr("d", path(land) ?? "");
    const centre: [number, number] = [-rotation[0], -rotation[1]];
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
    const vis = data.places.filter((p) => geoDistance([p.lng, p.lat], centre) < Math.PI / 2 - 0.02);
    const g = marks
      .selectAll<SVGGElement, AtlasData["places"][number]>("g")
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
        const [x, y] = projection([d.lng, d.lat]) ?? [0, 0];
        return `translate(${x},${y})`;
      })
      .on("click", (_ev, d) => choose(d.id, true));
    g.select<SVGCircleElement>("circle.halo").attr("r", (d) => (d.precision === "uncertain" ? 16 : d.kind === "quartet" ? 11 : 0));
    g.select<SVGCircleElement>("circle.dot").attr("r", (d) => (d.kind === "quartet" ? 5.5 : 3.8));
    g.select<SVGTextElement>("text.label")
      .text((d) => (d.kind === "quartet" || d.id === selected ? d.name : ""))
      .attr("x", (d) => LABEL[d.id]?.[0] ?? 9)
      .attr("y", (d) => LABEL[d.id]?.[1] ?? 4)
      .attr("text-anchor", (d) => LABEL[d.id]?.[2] ?? "start");
  }

  // Turn the globe to a place (eased), or keep a very slow drift when idle.
  function rotateTo(lng: number, lat: number) {
    cancelAnimationFrame(raf);
    const from: [number, number] = [-rotation[0], -rotation[1]];
    const interp = geoInterpolate(from, [lng, lat]);
    const t0 = performance.now();
    const dur = reduced() ? 1 : 1200;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const [x, y] = interp(e);
      rotation = [-x, -y];
      render();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
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
    autoRotate = false;
    rotateTo(p.lng, p.lat);
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

  svg.call(
    drag<SVGSVGElement, unknown>().on("start", () => {
      autoRotate = false;
      cancelAnimationFrame(raf);
    }).on("drag", (ev) => {
      const k = 75 / projection.scale();
      rotation = [rotation[0] + ev.dx * k, Math.max(-80, Math.min(80, rotation[1] - ev.dy * k))];
      render();
    }),
  );

  // With JavaScript, one card at a time; start from the hash or Burnt Norton.
  const initial = location.hash.startsWith("#place-") ? location.hash.slice(7) : "burnt-norton";
  cards.forEach((c) => (c.hidden = c.dataset.card !== initial));
  root.classList.add("atlas--js");
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
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    buttons.forEach((b) => b.removeEventListener("click", onButton));
    host.replaceChildren();
  };
}
