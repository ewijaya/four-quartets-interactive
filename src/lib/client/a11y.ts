/**
 * Announce a short message to assistive technology through the page's live region;
 * with `visual`, also show it briefly as a toast.
 */
let toastTimer = 0;
export function announce(msg: string, visual = false) {
  const live = document.querySelector<HTMLElement>("[data-live]");
  if (live) {
    live.textContent = "";
    window.setTimeout(() => (live.textContent = msg), 60);
  }
  if (!visual) return;
  let el = document.querySelector<HTMLElement>(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("aria-hidden", "true");
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add("is-shown");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove("is-shown"), 2200);
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
