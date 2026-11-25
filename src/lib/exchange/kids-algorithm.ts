import type { Assignment } from "./algorithm";
type Pair = { childId1: number; childId2: number };
type History = Assignment & { year: number };
function allowed(
  giver: number,
  receiver: number,
  exclusions: Pair[],
  history: History[],
  year: number,
) {
  return (
    giver !== receiver &&
    !exclusions.some(
      (p) =>
        (p.childId1 === giver && p.childId2 === receiver) ||
        (p.childId2 === giver && p.childId1 === receiver),
    ) &&
    !history.some(
      (p) =>
        p.year === year - 1 && p.giverId === giver && p.receiverId === receiver,
    )
  );
}
export function validateKids(
  assignments: Assignment[],
  members: number[],
  exclusions: Pair[],
  history: History[],
  year: number,
) {
  if (
    assignments.length !== members.length ||
    new Set(assignments.map((a) => a.giverId)).size !== members.length ||
    new Set(assignments.map((a) => a.receiverId)).size !== members.length ||
    assignments.some(
      (a) =>
        !members.includes(a.giverId) ||
        !members.includes(a.receiverId) ||
        !allowed(a.giverId, a.receiverId, exclusions, history, year),
    )
  )
    throw new Error(
      "Each child must give and receive once, with no self, excluded, or last-year matches. Generate a fresh preview if the roster or rules changed.",
    );
}
export function generateKids(
  members: number[],
  exclusions: Pair[],
  history: History[],
  year: number,
): Assignment[] {
  if (members.length < 2)
    throw new Error("Add at least two children to run the kids’ exchange.");
  // An augmenting-path matching finds a complete valid draw when one exists.
  const options = new Map(
    members.map((g) => [
      g,
      members
        .filter((r) => allowed(g, r, exclusions, history, year))
        .map((r) => ({ r, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((v) => v.r),
    ]),
  );
  const owners = new Map<number, number>();
  function match(giver: number, seen: Set<number>): boolean {
    for (const receiver of options.get(giver)!) {
      if (seen.has(receiver)) continue;
      seen.add(receiver);
      const previous = owners.get(receiver);
      if (previous === undefined || match(previous, seen)) {
        owners.set(receiver, giver);
        return true;
      }
    }
    return false;
  }
  for (const giver of [...members].sort(
    (a, b) => options.get(a)!.length - options.get(b)!.length,
  )) {
    if (!match(giver, new Set()))
      throw new Error(
        "No valid kids’ draw is possible with this roster, the exclusions, and last year’s recipients. Review participation or exclusions; no assignments were changed.",
      );
  }
  return [...owners].map(([receiverId, giverId]) => ({ giverId, receiverId }));
}
