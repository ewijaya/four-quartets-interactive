/**
 * Keyboard shortcuts. Single-key shortcuts can be switched off in the menu
 * (WCAG 2.1.4) and never fire while typing or with modifier keys held.
 */
import { getPrefs, setPref, effectiveTheme } from "./prefs";
import { isTyping } from "./a11y";
import type { Density } from "../model";

export interface Shortcut {
  keys: string[];
  label: string;
  run: (e: KeyboardEvent) => void;
  /** Page-scoped shortcuts are removed on navigation by their owner. */
  scope?: "global" | "page";
}

const registry = new Set<Shortcut>();

export function registerShortcut(s: Shortcut): () => void {
  registry.add(s);
  return () => registry.delete(s);
}

const DENSITIES: Density[] = ["clean", "reader", "scholar"];

registerShortcut({
  keys: ["t"],
  label: "Switch between Vellum and Night",
  run: () => setPref("theme", effectiveTheme() === "night" ? "vellum" : "night"),
});
registerShortcut({
  keys: ["d"],
  label: "Cycle annotation density (Clean · Reader · Scholar)",
  run: () => {
    const i = DENSITIES.indexOf(getPrefs().density);
    setPref("density", DENSITIES[(i + 1) % DENSITIES.length]!);
  },
});
registerShortcut({
  keys: ["?"],
  label: "Show this list of shortcuts",
  run: () => openHelp(),
});

let dialog: HTMLDialogElement | null = null;

function openHelp() {
  dialog?.remove();
  dialog = document.createElement("dialog");
  dialog.className = "help-dialog";
  dialog.setAttribute("aria-labelledby", "help-title");
  const rows = [...registry]
    .map((s) => `<tr><td>${s.keys.map((k) => `<kbd>${k === " " ? "Space" : k}</kbd>`).join(" ")}</td><td>${s.label}</td></tr>`)
    .join("");
  dialog.innerHTML = `
    <h2 id="help-title">Keyboard</h2>
    <table><tbody>${rows}
      <tr><td><kbd>Tab</kbd></td><td>Move between annotated phrases and controls</td></tr>
      <tr><td><kbd>Enter</kbd></td><td>Open the note for a focused phrase</td></tr>
      <tr><td><kbd>Esc</kbd></td><td>Close a note, the menu or a dialog</td></tr>
    </tbody></table>
    <p class="help-dialog__foot">${getPrefs().shortcuts ? "Single-key shortcuts are on." : "Single-key shortcuts are off."} Change this in the menu.</p>
    <form method="dialog"><button class="btn" value="close">Close</button></form>`;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog?.remove());
  dialog.showModal();
}

export function initShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(e.target)) return;
    const key = e.key;
    // "?" is always available so the help can explain how to re-enable shortcuts.
    if (key !== "?" && !getPrefs().shortcuts) return;
    for (const s of registry) {
      if (s.keys.includes(key)) {
        e.preventDefault();
        s.run(e);
        return;
      }
    }
  };
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("keydown", onKey);
    dialog?.close();
  };
}
