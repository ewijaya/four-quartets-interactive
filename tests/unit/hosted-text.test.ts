import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HOSTED_JSON, openText, sealText } from "../../src/lib/text/hosted";

const key = "12".repeat(32);
const sample = readFileSync(new URL("../../content/text-sample/quartets.json", import.meta.url), "utf8");
const imported = JSON.stringify({ ...JSON.parse(sample), source: "private", edition: "test fixture" });

describe("hosted text encryption", () => {
  it("round-trips text without storing readable verse", () => {
    const text = "The orchard keeps its counsel in the rain.";
    const encrypted = sealText(text, key);
    expect(encrypted).not.toContain(text);
    expect(openText(encrypted, key)).toBe(text);
    expect(sealText(text, key)).not.toBe(encrypted);
  });

  it("rejects a wrong key and altered ciphertext", () => {
    const encrypted = sealText(imported, key);
    expect(() => openText(encrypted, "34".repeat(32))).toThrow("Cannot decrypt");
    const data = JSON.parse(encrypted);
    const bytes = Buffer.from(data.ciphertext, "base64");
    bytes[0] = bytes[0]! ^ 1;
    data.ciphertext = bytes.toString("base64");
    expect(() => openText(JSON.stringify(data), key)).toThrow("Cannot decrypt");
  });
});

describe("hosted text loading without local poem files", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "stillpoint-text-"));
    mkdirSync(join(dir, "content/text-hosted"), { recursive: true });
    mkdirSync(join(dir, "content/text-sample"), { recursive: true });
    writeFileSync(join(dir, HOSTED_JSON), sealText(imported, key));
    writeFileSync(join(dir, "content/text-sample/quartets.json"), sample);
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    vi.stubEnv("STILLPOINT_PUBLIC", "0");
    vi.stubEnv("STILLPOINT_TEXT", "private");
    vi.stubEnv("STILLPOINT_TEXT_KEY", key);
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads the encrypted bundle on a fresh checkout", async () => {
    const { loadText } = await import("../../src/lib/text/load");
    expect(loadText()).toEqual(JSON.parse(imported));
  });

  it("fails production when the key is missing rather than serving placeholders", async () => {
    vi.stubEnv("STILLPOINT_TEXT_KEY", undefined);
    const { loadText } = await import("../../src/lib/text/load");
    expect(() => loadText()).toThrow("requires");
  });

  it("fails production with an incorrect key", async () => {
    vi.stubEnv("STILLPOINT_TEXT_KEY", "34".repeat(32));
    const { loadText } = await import("../../src/lib/text/load");
    expect(() => loadText()).toThrow("Cannot decrypt");
  });

  it("keeps public preview builds on sample text even with a key", async () => {
    vi.stubEnv("STILLPOINT_PUBLIC", "1");
    vi.stubEnv("STILLPOINT_TEXT", "auto");
    const { loadText } = await import("../../src/lib/text/load");
    expect(loadText().source).toBe("sample");
  });

  it("rejects contradictory public and private settings", async () => {
    vi.stubEnv("STILLPOINT_PUBLIC", "1");
    const { loadText } = await import("../../src/lib/text/load");
    expect(() => loadText()).toThrow("forbids");
  });
});
