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
    "--file",
    "scripts/verify-person-profiles.sql",
    "--json",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 },
);
const responses = JSON.parse(output);
const rows = responses.flatMap((response) => {
  if (!response.success) throw new Error("Profile verification query failed");
  return response.results;
});
const checks = rows.flatMap((row) =>
  Object.entries(row).filter(([key]) => key.startsWith("missing_")),
);
if (checks.length !== 5 || checks.some(([, count]) => count !== 0))
  throw new Error(
    "Profile mappings are incomplete; do not publish the new Worker",
  );
console.log(
  JSON.stringify({ profileIntegrity: "passed", counts: rows }, null, 2),
);
