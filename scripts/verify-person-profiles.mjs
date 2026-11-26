import { readFileSync } from "node:fs";
import {
  parseWranglerOutput,
  verifiedProfileRows,
} from "./lib/person-verification.mjs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
if (!["--local", "--remote"].includes(mode))
  throw new Error("Choose --local or --remote explicitly");
const output = execFileSync(
  process.execPath,
  [
    resolve(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1",
    "execute",
    "wishlist",
    mode,
    // Remote --file is an import and returns summary metadata, not SELECT rows.
    // Use the query endpoint so every mapping check is actually verified.
    `--command=${readFileSync(resolve(root, "scripts/verify-person-profiles.sql"), "utf8")}`,
    "--json",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 },
);
const rows = verifiedProfileRows(parseWranglerOutput(output));
console.log(
  JSON.stringify({ profileIntegrity: "passed", counts: rows }, null, 2),
);
