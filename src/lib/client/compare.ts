/**
 * Compare view: proportional scroll-sync between the four columns (desktop), and
 * tab buttons that bring a column into view (mobile swipe panels).
 */
export function initCompare(root: HTMLElement): () => void {
  const texts = [...root.querySelectorAll<HTMLElement>(".compare__text")];
  const cols = [...root.querySelectorAll<HTMLElement>("[data-col]")];
  const sync = root.querySelector<HTMLInputElement>("[data-sync]");
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const strip = root.querySelector<HTMLElement>(".compare__cols");
  let driver: HTMLElement | null = null;
  let release = 0;

  const onScroll = (e: Event) => {
    const src = e.currentTarget as HTMLElement;
    if (!sync?.checked) return;
    if (driver && driver !== src) return;
    driver = src;
    window.clearTimeout(release);
    release = window.setTimeout(() => (driver = null), 120);
    const p = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
    for (const t of texts) {
      if (t === src) continue;
      t.scrollTop = p * (t.scrollHeight - t.clientHeight);
    }
  };
  texts.forEach((t) => t.addEventListener("scroll", onScroll, { passive: true }));

  const setTab = (i: number) => tabs.forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
  const onTab = (e: Event) => {
    const i = Number((e.currentTarget as HTMLElement).dataset.tab);
    cols[i]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setTab(i);
  };
  tabs.forEach((b) => b.addEventListener("click", onTab));
  setTab(0);
  const onStrip = () => {
    if (!strip) return;
    const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
    setTab(Math.min(tabs.length - 1, Math.max(0, i)));
  };
  strip?.addEventListener("scroll", onStrip, { passive: true });

  return () => {
    texts.forEach((t) => t.removeEventListener("scroll", onScroll));
    tabs.forEach((b) => b.removeEventListener("click", onTab));
    strip?.removeEventListener("scroll", onStrip);
    window.clearTimeout(release);
  };
}
