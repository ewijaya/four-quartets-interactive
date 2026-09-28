/** Header behaviour: hide while reading down, reveal on scroll up; the site menu. */

export function initHeader(): () => void {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  if (!header) return () => {};
  const menuBtn = header.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  const menu = header.querySelector<HTMLElement>("[data-site-menu]");

  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const dy = y - lastY;
    header.toggleAttribute("data-scrolled", y > 8);
    // Programmatic jumps (deep links, movement links) should not hide the header.
    if (Math.abs(dy) > 320) {
      lastY = y;
      return;
    }
    const menuOpen = menu && !menu.hidden;
    const focusInHeader = header.contains(document.activeElement);
    if (!menuOpen && !focusInHeader && y > 160 && dy > 6) header.setAttribute("data-hidden", "");
    else if (dy < -6 || y < 160) header.removeAttribute("data-hidden");
    lastY = y;
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  update();

  const onFocusIn = () => header.removeAttribute("data-hidden");
  header.addEventListener("focusin", onFocusIn);

  const setMenu = (open: boolean, restoreFocus = false) => {
    if (!menu || !menuBtn) return;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Menu");
    if (open) header.removeAttribute("data-hidden");
    if (!open && restoreFocus) menuBtn.focus();
  };
  const onMenuClick = () => setMenu(menu?.hidden === true);
  menuBtn?.addEventListener("click", onMenuClick);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && menu && !menu.hidden) {
      setMenu(false, true);
      e.stopPropagation();
    }
  };
  document.addEventListener("keydown", onKey);
  const onDocClick = (e: MouseEvent) => {
    if (menu && !menu.hidden && !header.contains(e.target as Node)) setMenu(false);
  };
  document.addEventListener("click", onDocClick);

  return () => {
    window.removeEventListener("scroll", onScroll);
    header.removeEventListener("focusin", onFocusIn);
    menuBtn?.removeEventListener("click", onMenuClick);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("click", onDocClick);
  };
}
