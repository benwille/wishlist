import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseWranglerOutput,
  verifiedProfileRows,
} from "../scripts/lib/person-verification.mjs";
const response = [
  { success: true, results: [{ profile_type: "adult", profile_count: 12 }] },
  ...[
    "adult_profiles",
    "child_profiles",
    "guardian_links",
    "group_profiles",
    "wishlist_profiles",
  ].map((key) => ({ success: true, results: [{ ["missing_" + key]: 0 }] })),
];
test("production integrity check accepts complete results after Wrangler upload progress", () => {
  const progress =
    "├ Checking if file needs uploading\n[wrangler:info] Uploading SQL file\n\u001b[32m└ Upload complete\u001b[0m\n";
  assert.deepEqual(
    verifiedProfileRows(
      parseWranglerOutput(progress + JSON.stringify(response, null, 2)),
    ),
    response.flatMap((r) => r.results),
  );
  assert.deepEqual(parseWranglerOutput(JSON.stringify(response)), response);
});
test("production integrity check rejects missing mappings, missing checks and failed queries", () => {
  assert.throws(
    () =>
      verifiedProfileRows([
        { success: true, results: [{ missing_adult_profiles: 1 }] },
      ]),
    /incomplete/,
  );
  const missing = structuredClone(response);
  missing.pop();
  assert.throws(() => verifiedProfileRows(missing), /incomplete/);
  const failed = structuredClone(response);
  failed[0].success = false;
  assert.throws(() => verifiedProfileRows(failed), /query failed/);
  const wrong = structuredClone(response);
  wrong[1].results[0].missing_adult_profiles = 1;
  assert.throws(() => verifiedProfileRows(wrong), /incomplete/);
});
test("upload progress and incomplete JSON never pass the production release gate", () => {
  assert.throws(
    () => parseWranglerOutput("├ Checking if file needs uploading\n"),
    /complete JSON/,
  );
  assert.throws(() => parseWranglerOutput('[{"success":true'), /complete JSON/);
  assert.throws(() => verifiedProfileRows([]), /incomplete/);
  assert.throws(
    () =>
      verifiedProfileRows([
        {
          success: true,
          results: [
            { "Total queries executed": 8, "Rows read": 20, "Rows written": 0 },
          ],
        },
      ]),
    /incomplete/,
  );
});
