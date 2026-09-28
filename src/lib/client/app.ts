/**
 * Client entry. Module scripts run once under the ClientRouter, so everything
 * page-specific is (re)initialised on `astro:page-load` and torn down on
 * `astro:before-swap`.
 */
import { applyPrefs, effectiveTheme, getPrefs, onPrefs, setPref } from "./prefs";
import { initHeader } from "./header";
import { initShortcuts } from "./keyboard";
import { initStage } from "./stage-lite";
import { initSearch } from "./search";
import { initSound } from "./sound";
import type { Density } from "../model";

type Teardown = () => void;
let teardowns: Teardown[] = [];

function bindChrome(): Teardown {
  const offs: Teardown[] = [];

  // Theme toggle
  const themeBtn = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  const syncTheme = () => {
    if (!themeBtn) return;
    const night = effectiveTheme() === "night";
    themeBtn.setAttribute("aria-pressed", String(night));
    themeBtn.title = night ? "Vellum theme" : "Night theme";
    themeBtn.setAttribute("aria-label", "Night theme");
  };
  syncTheme();
  const onTheme = () => setPref("theme", effectiveTheme() === "night" ? "vellum" : "night");
  themeBtn?.addEventListener("click", onTheme);
  offs.push(() => themeBtn?.removeEventListener("click", onTheme));

  // Density radios (header + menu)
  const radios = [...document.querySelectorAll<HTMLInputElement>("[data-density-switch] input[type=radio]")];
  const syncDensity = () => radios.forEach((r) => (r.checked = r.value === getPrefs().density));
  syncDensity();
  const onDensity = (e: Event) => setPref("density", (e.target as HTMLInputElement).value as Density);
  radios.forEach((r) => r.addEventListener("change", onDensity));
  offs.push(() => radios.forEach((r) => r.removeEventListener("change", onDensity)));

  // Boolean settings
  const toggles = [...document.querySelectorAll<HTMLInputElement>("input[data-pref]")];
  const syncToggles = () =>
    toggles.forEach((t) => {
      const k = t.dataset.pref as "scenes" | "shortcuts";
      t.checked = !!getPrefs()[k];
    });
  syncToggles();
  const onToggle = (e: Event) => {
    const t = e.target as HTMLInputElement;
    setPref(t.dataset.pref as "scenes" | "shortcuts", t.checked);
  };
  toggles.forEach((t) => t.addEventListener("change", onToggle));
  offs.push(() => toggles.forEach((t) => t.removeEventListener("change", onToggle)));

  offs.push(
    onPrefs((_p, key) => {
      if (key === "theme") syncTheme();
      if (key === "density") syncDensity();
      if (key === "scenes" || key === "shortcuts") syncToggles();
    }),
  );
  return () => offs.forEach((f) => f());
}

async function onPageLoad() {
  applyPrefs();
  teardowns.push(bindChrome(), initHeader(), initShortcuts(), initStage(), initSearch(), initSound());

  const reader = document.querySelector<HTMLElement>("[data-reader]");
  if (reader) {
    const { initReader } = await import("./reader");
    teardowns.push(initReader(reader));
  }
  document.dispatchEvent(new CustomEvent("sp:page-ready"));
}

function onBeforeSwap() {
  for (const t of teardowns) {
    try {
      t();
    } catch (err) {
      console.warn("teardown failed", err);
    }
  }
  teardowns = [];
}

document.addEventListener("astro:page-load", () => void onPageLoad());
document.addEventListener("astro:before-swap", onBeforeSwap);
