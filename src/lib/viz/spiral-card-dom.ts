/** Draws a Time Spiral card into the page. Elements are built with textContent, never markup. */
import type { CardModel, Selection } from "./spiral-card";

export interface CardActions {
  select(sel: Selection): void;
  follow(motif: number): void;
  close(): void;
  /** Stop following the current motif (offered on a motif's summary card). */
  unfollow(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", className, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/** One row per quartet: a thin bar with its count at the tip. The counts are also the text. */
function meters(model: CardModel): HTMLElement {
  const list = el("ul", "spiral-card__meters");
  list.setAttribute("aria-label", "Occurrences in each quartet");
  for (const m of model.meters) {
    const row = el("li");
    const track = el("span", "spiral-card__bar");
    const fill = el("i");
    fill.style.width = `${(m.value / Math.max(1, m.max)) * 82}%`;
    fill.hidden = m.value === 0;
    track.append(fill, el("b", undefined, String(m.value)));
    row.append(el("span", "spiral-card__quartet", m.label), track);
    list.append(row);
  }
  return list;
}

export function renderCard(card: HTMLElement, model: CardModel, sel: Selection, actions: CardActions) {
  // Keep keyboard focus on the same step button across the re-render.
  const active = document.activeElement as HTMLElement | null;
  const hadFocus = active && card.contains(active) ? (active.dataset.step ?? "card") : null;

  card.replaceChildren();
  if (model.color) card.style.setProperty("--motif", model.color);
  else card.style.removeProperty("--motif");
  card.classList.toggle("has-motif", model.color !== null);
  card.dataset.kind = sel.kind;

  card.append(button("spiral-card__close", "×", actions.close));
  card.querySelector(".spiral-card__close")!.setAttribute("aria-label", "Close");

  card.append(el("p", "eyebrow spiral-card__eyebrow", model.eyebrow));
  card.append(el("p", "spiral-card__title", model.quoted ? `‘${model.title}’` : model.title));
  card.append(el("p", "spiral-card__where", model.where));
  if (model.body) card.append(el("p", "spiral-card__body", model.body));
  if (model.meters.length) card.append(meters(model));

  if (model.chips.length) {
    const chips = el("div", "spiral-card__chips");
    for (const c of model.chips) {
      const chip = button("motif-chip", c.label, () => actions.follow(c.motif));
      chip.style.setProperty("--motif", c.color);
      chips.append(chip);
    }
    card.append(chips);
  }

  if (model.related.length) {
    const wrap = el("div", "spiral-card__related");
    wrap.append(el("p", "spiral-card__sub", "See also"));
    const list = el("ul");
    for (const r of model.related) {
      const item = el("li");
      item.append(button("spiral-card__link", r.label, () => actions.select(r.to)));
      list.append(item);
    }
    wrap.append(list);
    card.append(wrap);
  }

  const links = el("div", "spiral-card__links");
  for (const l of model.links) {
    const a = el("a", "btn", l.label);
    a.href = l.href;
    links.append(a);
  }
  if (sel.kind === "thread") links.append(button("btn", "Show every motif", actions.unfollow));
  if (links.childElementCount) card.append(links);

  if (model.step) {
    const { prev, next, label } = model.step;
    const nav = el("div", "spiral-card__step");
    nav.setAttribute("role", "group");
    nav.setAttribute("aria-label", "Step along");
    const back = button("icon-btn", "‹", () => prev && actions.select(prev));
    back.dataset.step = "prev";
    back.setAttribute("aria-label", "Previous");
    back.disabled = !prev;
    const forward = button("icon-btn", "›", () => next && actions.select(next));
    forward.dataset.step = "next";
    forward.setAttribute("aria-label", "Next");
    forward.disabled = !next;
    nav.append(back, el("span", "spiral-card__pos", label), forward);
    card.append(nav);
  }
  card.hidden = false;

  if (hadFocus) {
    const order = hadFocus === "prev" ? ["prev", "next"] : ["next", "prev"];
    const target = order.map((s) => card.querySelector<HTMLButtonElement>(`[data-step="${s}"]`)).find((b) => b && !b.disabled);
    (target ?? card).focus({ preventScroll: true });
  }
}
