export function parseWranglerOutput(output) {
  // Remote SQL file uploads can print progress even with --json. Only accept
  // a complete JSON result array; never treat progress or partial output as success.
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").replace(/^\uFEFF/, "");
  for (const match of clean.matchAll(/^\s*\[/gm)) {
    try {
      const value = JSON.parse(clean.slice(match.index));
      if (Array.isArray(value)) return value;
    } catch {}
  }
  throw new Error("Wrangler did not return a complete JSON result array");
}
export function verifiedProfileRows(responses) {
  const rows = responses.flatMap((response) => {
    if (response.success !== true || !Array.isArray(response.results))
      throw new Error("Profile verification query failed");
    return response.results;
  });
  const checks = rows.flatMap((row) =>
    Object.entries(row).filter(([key]) => key.startsWith("missing_")),
  );
  const expected = [
    "missing_adult_profiles",
    "missing_child_profiles",
    "missing_guardian_links",
    "missing_group_profiles",
    "missing_wishlist_profiles",
  ];
  if (
    checks.length !== expected.length ||
    expected.some(
      (key) => !checks.some(([name, count]) => name === key && count === 0),
    )
  )
    throw new Error(
      "Profile mappings are incomplete; do not publish the new Worker",
    );
  return rows;
}
