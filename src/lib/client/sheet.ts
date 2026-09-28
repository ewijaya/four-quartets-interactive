/**
 * A non-modal bottom sheet for notes on small screens. The poem stays readable
 * above it; Esc or the close button dismisses it and focus returns to the anchor.
 */

export class NoteSheet {
  private el: HTMLElement;
  private body: HTMLElement;
  private count: HTMLElement;
  private returnTo: HTMLElement | null = null;
  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this.isOpen) {
      e.stopPropagation();
      this.close(true);
    }
  };
  onClose: (() => void) | null = null;

  constructor(host: HTMLElement = document.body) {
    this.el = document.createElement("section");
    this.el.className = "sheet";
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-modal", "false");
    this.el.setAttribute("aria-labelledby", "sheet-count");
    this.el.dataset.snap = "peek";
    this.el.innerHTML = `
      <div class="sheet__bar">
        <button class="sheet__grip" type="button" aria-label="Expand note"></button>
        <span class="sheet__count" id="sheet-count">Note</span>
        <button class="icon-btn sheet__close" type="button" aria-label="Close note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="sheet__body" tabindex="-1"></div>`;
    this.body = this.el.querySelector(".sheet__body")!;
    this.count = this.el.querySelector(".sheet__count")!;
    host.append(this.el);

    this.el.querySelector(".sheet__close")!.addEventListener("click", () => this.close(true));
    const grip = this.el.querySelector<HTMLButtonElement>(".sheet__grip")!;
    grip.addEventListener("click", () => this.toggleSnap());
    this.bindDrag(grip);
    document.addEventListener("keydown", this.onKey);
  }

  get isOpen() {
    return this.el.classList.contains("is-open");
  }

  open(notes: HTMLElement[], from: HTMLElement | null, focus: boolean) {
    this.returnTo = from;
    this.body.replaceChildren(
      ...notes.map((n) => {
        const c = n.cloneNode(true) as HTMLElement;
        c.removeAttribute("id");
        c.classList.add("is-open");
        c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        c.querySelectorAll(".note__toggle").forEach((b) => {
          b.removeAttribute("aria-controls");
          b.removeAttribute("aria-expanded");
          b.setAttribute("tabindex", "-1");
        });
        return c;
      }),
    );
    this.count.textContent = notes.length > 1 ? `${notes.length} notes` : "Note";
    this.el.dataset.snap = "peek";
    this.el.querySelector(".sheet__grip")!.setAttribute("aria-label", "Expand note");
    this.body.scrollTop = 0;
    this.el.classList.add("is-open");
    if (focus) requestAnimationFrame(() => this.body.focus({ preventScroll: true }));
  }

  close(restoreFocus = false) {
    if (!this.isOpen) return;
    this.el.classList.remove("is-open");
    if (restoreFocus && this.returnTo?.isConnected) this.returnTo.focus({ preventScroll: true });
    this.returnTo = null;
    this.onClose?.();
  }

  contains(n: Node) {
    return this.el.contains(n);
  }

  private toggleSnap() {
    const full = this.el.dataset.snap !== "full";
    this.el.dataset.snap = full ? "full" : "peek";
    this.el.querySelector(".sheet__grip")!.setAttribute("aria-label", full ? "Collapse note" : "Expand note");
  }

  private bindDrag(grip: HTMLElement) {
    let startY = 0;
    let dragging = false;
    grip.addEventListener("pointerdown", (e) => {
      dragging = true;
      startY = e.clientY;
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      const dy = e.clientY - startY;
      if (dy > 60) {
        if (this.el.dataset.snap === "full") this.toggleSnap();
        else this.close(false);
      } else if (dy < -40 && this.el.dataset.snap !== "full") this.toggleSnap();
    });
  }

  destroy() {
    document.removeEventListener("keydown", this.onKey);
    this.el.remove();
  }
}
