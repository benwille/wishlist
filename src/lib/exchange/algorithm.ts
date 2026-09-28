type ExclusionPair = { userId1: number; userId2: number };
type HistoryEntry = { giverId: number; receiverId: number; year: number };
export type Assignment = { giverId: number; receiverId: number };

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

export function validateAssignments(
  assignments: Assignment[],
  members: number[],
  exclusions: ExclusionPair[],
  history: HistoryEntry[],
  currentYear: number
) {
  if (assignments.length !== members.length) {
    throw new Error("Assignments must include every group member.");
  }

  const memberIds = new Set(members);
  const givers = new Set<number>();
  const receivers = new Set<number>();
  const exclusionSet = new Set<string>();
  const recentHistory = new Set<string>();

  for (const { userId1, userId2 } of exclusions) {
    exclusionSet.add(`${userId1}-${userId2}`);
    exclusionSet.add(`${userId2}-${userId1}`);
  }

  for (const { giverId, receiverId, year } of history) {
    if (year >= currentYear - 2) {
      recentHistory.add(`${giverId}-${receiverId}`);
    }
  }

  for (const { giverId, receiverId } of assignments) {
    if (!memberIds.has(giverId) || !memberIds.has(receiverId)) {
      throw new Error("Assignments can only include current group members.");
    }
    if (giverId === receiverId) {
      throw new Error("A member cannot be assigned to themselves.");
    }
    if (givers.has(giverId) || receivers.has(receiverId)) {
      throw new Error("Each member must give to and receive from exactly one person.");
    }
    if (exclusionSet.has(`${giverId}-${receiverId}`)) {
      throw new Error("Assignments violate an exclusion rule.");
    }
    if (recentHistory.has(`${giverId}-${receiverId}`)) {
      throw new Error("Assignments repeat a pairing from the last two years.");
    }

    givers.add(giverId);
    receivers.add(receiverId);
  }
}

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
