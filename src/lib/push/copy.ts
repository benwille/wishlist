/**
 * Single source of truth for push notification copy.
 * The `variant` slug is sent to GA4 so we can measure which lines drive clicks.
 */

export type PushCopy = {
  title: string;
  body: string;
  url: string;
};

// #1 — Someone claimed from your list. Preserves mystery (no names, no items).
const CLAIM_VARIANTS = {
  admirer: { title: "🎁 Looks like you've got an admirer", body: "Someone just claimed an item from your list." },
  working: { title: "Your wishlist is working", body: "Someone just claimed an item from your list." },
  scheming: { title: "Someone's plotting something nice", body: "An item was just claimed from your list." },
  incoming: { title: "Something good is headed your way", body: "Someone just claimed an item from your list." },
  list_shorter: { title: "Santa's list got a little shorter", body: "Someone just claimed an item from your list." },
  made_day: { title: "Your list just made someone's day", body: "Someone just claimed an item from your list." },
  in_works: { title: "A gift is in the works", body: "Someone just claimed an item from your list." },
} as const;

export type ClaimVariant = keyof typeof CLAIM_VARIANTS;

export function pickClaimCopy(): { variant: ClaimVariant; copy: PushCopy } {
  const keys = Object.keys(CLAIM_VARIANTS) as ClaimVariant[];
  const variant = keys[Math.floor(Math.random() * keys.length)];
  return {
    variant,
    copy: { ...CLAIM_VARIANTS[variant], url: "/my-list" },
  };
}

// #2 — New exchange assignment (to the giver)
export function giverAssignmentCopy(receiverName: string, receiverId: number): PushCopy {
  return {
    title: "You got your person!",
    body: `You're giving to ${receiverName} this year. Time to start scheming.`,
    url: `/lists/${receiverId}`,
  };
}

// #3 — Someone has you (to the receiver)
export function receiverAssignmentCopy(giverName: string): PushCopy {
  return {
    title: `${giverName} has you this year!`,
    body: "Make sure your list is ready for them.",
    url: "/my-list",
  };
}

// #7 — New group member
export function newMemberCopy(memberName: string, groupName: string, groupId: number): PushCopy {
  return {
    title: `${memberName} joined the group!`,
    body: `${memberName} was added to ${groupName}.`,
    url: `/exchange/${groupId}`,
  };
}
