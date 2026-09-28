/** Refresh the encrypted bundle after importing text. Never prints the key or poem. */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { HOSTED_JSON, openText, sealText } from "../src/lib/text/hosted";
import { PRIVATE_JSON } from "../src/lib/text/load";
import type { TextBundle } from "../src/lib/model";

const text = readFileSync(PRIVATE_JSON, "utf8");
const bundle = JSON.parse(text) as TextBundle;
if (bundle.source !== "private" || bundle.quartets.length !== 4) {
  throw new Error("Import all four quartets before packing the hosted text.");
}

const keyFile = ".env.hosted";
if (existsSync(keyFile)) process.loadEnvFile(keyFile);
let key = process.env.STILLPOINT_TEXT_KEY;
if (!key) {
  key = randomBytes(32).toString("hex");
  writeFileSync(keyFile, `STILLPOINT_TEXT_KEY=${key}\n`, { mode: 0o600, flag: "wx" });
  console.log("Created a key in .env.hosted (Git-ignored). Configure it as a production build secret.");
}

if (existsSync(HOSTED_JSON) && openText(readFileSync(HOSTED_JSON, "utf8"), key) === text) {
  console.log("Hosted text bundle is already current.");
} else {
  mkdirSync(dirname(HOSTED_JSON), { recursive: true });
  writeFileSync(HOSTED_JSON, sealText(text, key));
  console.log(`Updated ${HOSTED_JSON}. Commit this encrypted file with text changes.`);
}
