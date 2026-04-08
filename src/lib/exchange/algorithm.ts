type ExclusionPair = { userId1: number; userId2: number };
type HistoryEntry = { giverId: number; receiverId: number; year: number };
type Assignment = { giverId: number; receiverId: number };

const MAX_ATTEMPTS = 1000;

export function generateAssignments(
  members: number[],
  exclusions: ExclusionPair[],
  history: HistoryEntry[],
  currentYear: number
): Assignment[] {
  if (members.length < 2) {
    throw new Error("Need at least 2 members to run an exchange.");
  }

  const exclusionSet = new Set<string>();
  for (const { userId1, userId2 } of exclusions) {
    exclusionSet.add(`${userId1}-${userId2}`);
    exclusionSet.add(`${userId2}-${userId1}`);
  }

  const recentHistory = new Set<string>();
  for (const { giverId, receiverId, year } of history) {
    if (year >= currentYear - 2) {
      recentHistory.add(`${giverId}-${receiverId}`);
    }
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const shuffled = shuffle([...members]);
    const assignments: Assignment[] = [];
    let valid = true;

    for (let i = 0; i < shuffled.length; i++) {
      const giver = shuffled[i];
      const receiver = shuffled[(i + 1) % shuffled.length];

      if (giver === receiver) {
        valid = false;
        break;
      }

      if (exclusionSet.has(`${giver}-${receiver}`)) {
        valid = false;
        break;
      }

      if (recentHistory.has(`${giver}-${receiver}`)) {
        valid = false;
        break;
      }

      assignments.push({ giverId: giver, receiverId: receiver });
    }

    if (valid) {
      return assignments;
    }
  }

  throw new Error(
    `Could not find valid assignments after ${MAX_ATTEMPTS} attempts. ` +
    "Check your exclusion rules — there may be too many constraints for the group size."
  );
}

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
