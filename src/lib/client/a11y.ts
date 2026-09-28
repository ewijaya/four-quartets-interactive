/** Announce a short message to assistive technology through the page's live region. */
export function announce(msg: string) {
  const live = document.querySelector<HTMLElement>("[data-live]");
  if (!live) return;
  live.textContent = "";
  window.setTimeout(() => (live.textContent = msg), 60);
}

/** True when the event target is a text field (single-key shortcuts must not fire). */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "range"].includes(type);
  }
  return false;
}
