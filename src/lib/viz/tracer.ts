/**
 * Motif Tracer (d3): the sequence as a baseline of lines, bands for quartets and
 * movements, and for each chosen motif a dot per occurrence with arcs joining
 * successive occurrences. Up to three motifs overlaid; state kept in ?m=.
 */
import { select, type Selection } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { navigate } from "astro:transitions/client";

interface Data {
  total: number;
  quartets: Array<{ title: string; element: string; start: number; count: number }>;
  movements: Array<{ roman: string; start: number; count: number }>;
  motifs: Array<{ id: string; name: string; color: string }>;
  occ: Array<{ motif: string; g: number; lemma: string; where: string; href: string; note: { href: string; id: string } | null }>;
}

const MAX = 3;

export function initTracer(root: HTMLElement): () => void {
  const data = JSON.parse(root.querySelector("[data-tracer-data]")!.textContent!) as Data;
  const host = root.querySelector<HTMLElement>("[data-tracer-svg]")!;
  const tip = root.querySelector<HTMLElement>("[data-tracer-tip]")!;
  const chips = [...root.querySelectorAll<HTMLButtonElement>("[data-motif]")];
  const chooser = root.hasAttribute("data-chooser");
  const colorOf = Object.fromEntries(data.motifs.map((m) => [m.id, m.color]));
  const nameOf = Object.fromEntries(data.motifs.map((m) => [m.id, m.name]));

  const fromUrl = new URLSearchParams(location.search).get("m");
  let selected = (fromUrl ?? root.dataset.initial ?? "").split(",").filter((m) => m in colorOf).slice(0, MAX);
  if (!selected.length) selected = (root.dataset.initial ?? "rose").split(",");

  const draw = () => {
    const width = Math.max(720, host.clientWidth || 720);
    const H = 300;
    const base = 232;
    const x = scaleLinear().domain([0, data.total]).range([16, width - 16]);
    host.replaceChildren();
    const svg = select(host).append("svg").attr("viewBox", `0 0 ${width} ${H}`).attr("width", width).attr("height", H);

    // Quartet bands and movement ticks.
    const bands = svg.append("g").attr("class", "tracer__bands");
    data.quartets.forEach((q, i) => {
      const g = bands.append("g").attr("data-element", q.element);
      g.append("rect")
        .attr("x", x(q.start))
        .attr("y", base + 6)
        .attr("width", Math.max(1, x(q.start + q.count) - x(q.start) - 2))
        .attr("height", 6)
        .attr("rx", 3)
        .attr("class", `tracer__band tracer__band--${i}`);
      g.append("text")
        .attr("x", x(q.start) + 2)
        .attr("y", base + 34)
        .attr("class", "tracer__qlabel")
        .text(q.title);
    });
    for (const m of data.movements) {
      bands.append("line").attr("x1", x(m.start)).attr("x2", x(m.start)).attr("y1", base + 2).attr("y2", base + 16).attr("class", "tracer__tick");
      bands
        .append("text")
        .attr("x", x(m.start + m.count / 2))
        .attr("y", base + 50)
        .attr("text-anchor", "middle")
        .attr("class", "tracer__mlabel")
        .text(m.roman);
    }
    svg.append("line").attr("x1", x(0)).attr("x2", x(data.total)).attr("y1", base).attr("y2", base).attr("class", "tracer__base");

    // Arcs, then dots, per selected motif (later motifs drawn on top).
    const maxH = base - 20;
    selected.forEach((id, k) => {
      const occ = data.occ.filter((o) => o.motif === id);
      const color = colorOf[id]!;
      const arcs = svg.append("g").attr("class", "tracer__arcs").attr("data-motif", id);
      for (let i = 1; i < occ.length; i++) {
        const a = x(occ[i - 1]!.g);
        const b = x(occ[i]!.g);
        const rx = Math.max(1, (b - a) / 2);
        const ry = Math.min(maxH, maxH * Math.sqrt((b - a) / (width * 0.9)) + 6);
        arcs
          .append("path")
          .attr("d", `M${a},${base} A${rx},${ry} 0 0,1 ${b},${base}`)
          .attr("stroke", color)
          .attr("class", "tracer__arc")
          .attr("data-from", i - 1)
          .attr("data-to", i);
      }
      const dots: Selection<SVGGElement, unknown, null, undefined> = svg.append("g").attr("class", "tracer__dots");
      occ.forEach((o, i) => {
        const a = dots
          .append("a")
          .attr("href", o.href)
          .attr("tabindex", "-1")
          .attr("class", "tracer__occ")
          .attr("data-i", i)
          .attr("data-motif", id);
        a.append("circle")
          .attr("cx", x(o.g))
          .attr("cy", base - 1 - k * 7)
          .attr("r", 4.2)
          .attr("fill", color);
        a.append("circle")
          .attr("cx", x(o.g))
          .attr("cy", base - 1 - k * 7)
          .attr("r", 11)
          .attr("class", "tracer__hit");
        a.on("mouseenter", (ev: MouseEvent) => showTip(ev, o, id))
          .on("mouseleave", hideTip)
          .on("click", (ev: MouseEvent) => {
            ev.preventDefault();
            void navigate(o.href);
          });
      });
    });
  };

  const showTip = (ev: MouseEvent, o: Data["occ"][number], id: string) => {
    tip.innerHTML = "";
    const t = document.createElement("strong");
    t.textContent = nameOf[id] ?? id;
    const w = document.createElement("span");
    w.textContent = o.where;
    const q = document.createElement("q");
    q.textContent = o.lemma;
    tip.append(t, w, q);
    tip.style.setProperty("--motif", colorOf[id]!);
    const r = root.querySelector(".tracer__figure")!.getBoundingClientRect();
    tip.style.left = `${ev.clientX - r.left + 12}px`;
    tip.style.top = `${ev.clientY - r.top - 12}px`;
    tip.hidden = false;
  };
  const hideTip = () => (tip.hidden = true);

  const syncChips = () => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(selected.includes(c.dataset.motif!))));
    root.querySelectorAll<HTMLDetailsElement>("[data-list]").forEach((d) => {
      if (chooser) d.open = selected.includes(d.dataset.list!);
    });
  };
  const onChip = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.motif!;
    if (selected.includes(id)) selected = selected.filter((m) => m !== id);
    else selected = [...selected, id].slice(-MAX);
    if (!selected.length) selected = [id];
    syncChips();
    draw();
    // Written by hand so the commas stay readable (?m=rose,fire).
    history.replaceState(history.state, "", `${location.pathname}?m=${selected.join(",")}${location.hash}`);
  };
  chips.forEach((c) => c.addEventListener("click", onChip));

  let rt = 0;
  const onResize = () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(draw, 150);
  };
  window.addEventListener("resize", onResize);
  syncChips();
  draw();

  return () => {
    chips.forEach((c) => c.removeEventListener("click", onChip));
    window.removeEventListener("resize", onResize);
    host.replaceChildren();
  };
}
