/**
 * Write dist/sw.js, the service worker that makes the edition an installable,
 * offline-capable app. Runs after `astro build` and the search index.
 *
 * CORE (every visitor): the offline page, icons, manifest, and the files the offline
 * page loads. READER (installed app): the home page and all four quartets, every
 * movement with its notes, the files they load (followed through imports and stylesheets), and
 * the concordance. The version is a hash of the whole build, so any change ships a
 * new worker, which replaces the old caches.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { QUARTETS } from "../src/data/quartets";

const DIST = "dist";
const BASE = (process.env.BASE_PATH ?? "/").replace(/\/$/, "");

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const all = files(DIST).filter((f) => f !== join(DIST, "sw.js"));
/** Site URL → dist path, or undefined if the build has no such file. */
const toFile = (u: string) => {
  const p = u.slice(BASE.length).replace(/^\//, "");
  const f = join(DIST, p.endsWith("/") || p === "" ? `${p}index.html` : p);
  return existsSync(f) ? f : undefined;
};

/**
 * The files some pages need, following stylesheet url()s and script imports. With
 * `lazy`, also the chunks loaded on demand (scenes, the word popover); without it,
 * only the imports every page load fetches anyway.
 */
function closure(pages: string[], lazy: boolean): string[] {
  const seen = new Set<string>();
  const queue = [...pages];
  const add = (u: string) => {
    if (seen.has(u) || !toFile(u)) return;
    seen.add(u);
    queue.push(u);
  };
  pages.forEach((p) => seen.add(p));
  for (let u = queue.shift(); u; u = queue.shift()) {
    const f = toFile(u)!;
    const src = /\.(html|js|css)$/.test(f) ? readFileSync(f, "utf8") : "";
    const here = posix.dirname(u.endsWith("/") ? `${u}x` : u);
    if (f.endsWith(".html")) for (const m of src.matchAll(/["'(]((?:\/[\w.-]+)*\/_astro\/[\w@./-]+?\.(?:js|css|woff2?))/g)) add(m[1]!);
    if (f.endsWith(".js") && lazy) {
      for (const m of src.matchAll(/["'`]\.\/([\w@.-]+\.(?:js|css))["'`]/g)) add(posix.join(here, m[1]!));
      for (const m of src.matchAll(/["'`]\/?_astro\/([\w@./-]+\.(?:js|css))["'`]/g)) add(`${BASE}/_astro/${m[1]}`);
    } else if (f.endsWith(".js")) {
      for (const m of src.matchAll(/\b(?:from|import)\s*["'`]\.\/([\w@.-]+\.js)["'`]/g)) add(posix.join(here, m[1]!));
    }
    if (f.endsWith(".css")) {
      for (const m of src.matchAll(/url\(\s*["']?([^"')]+?\.woff2?)["']?\s*\)/g)) {
        const ref = m[1]!;
        add(ref.startsWith("/") ? ref : posix.join(here, ref));
      }
    }
  }
  return [...seen];
}

const exist = (us: string[]) => us.filter((u) => toFile(u));
const icons = ["/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"].map((u) => BASE + u);
const core = [...new Set([...closure(exist([`${BASE}/offline/`]), false), ...exist(icons)])];
// The home page is the installed app's start page, so it belongs here too.
const readerPages = exist([`${BASE}/`, ...QUARTETS.flatMap((q) => [`${BASE}/${q.id}/`, ...[1, 2, 3, 4, 5].map((n) => `${BASE}/${q.id}/${n}/`)])]);
const reader = [...closure(readerPages, true), ...exist([`${BASE}/concordance.json`])].filter((u) => !core.includes(u));

const template = readFileSync(join(dirname(new URL(import.meta.url).pathname), "sw-template.js"), "utf8");
const hash = createHash("sha256").update(template);
for (const f of all.sort()) hash.update(f).update(readFileSync(f));
const version = hash.digest("hex").slice(0, 12);

const size = (us: string[]) => Math.round(us.reduce((n, u) => n + statSync(toFile(u)!).size, 0) / 1024);
const out = template
  .replace('"__VERSION__"', JSON.stringify(version))
  .replace('"__BASE__"', JSON.stringify(BASE))
  .replace("__CORE__", JSON.stringify(core))
  .replace("__READER__", JSON.stringify(reader));
if (/__[A-Z]+__/.test(out)) throw new Error("build-sw: a placeholder was not filled");
writeFileSync(join(DIST, "sw.js"), out);
console.log(`sw: version ${version}; core ${core.length} files (${size(core)} KB), reader ${reader.length} files (${size(reader)} KB).`);
