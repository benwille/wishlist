"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = {
  id: number;
  name: string;
  description: string | null;
  link: string | null;
  priceRange: string | null;
  claimedBy: number | null;
  purchased: number;
  yearAdded: number;
};

export default function ClaimableItemList({
  items,
  currentUserId,
  ownerName,
}: {
  items: Item[];
  currentUserId: number;
  ownerName: string;
}) {
  const router = useRouter();
  const [acting, setActing] = useState<number | null>(null);

  async function handleClaim(itemId: number, action: "claim" | "unclaim" | "purchase") {
    setActing(itemId);
    await fetch(`/api/items/${itemId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
    setActing(null);
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">{ownerName} hasn&apos;t added anything yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isMyClaim = item.claimedBy === currentUserId;
        const isClaimed = !!item.claimedBy;
        const isPurchased = item.purchased === 1;

        return (
          <div
            key={item.id}
            className={`rounded-xl border bg-surface p-4 shadow-sm ${
              isPurchased ? "border-primary/30 bg-primary-light/30" : isClaimed ? "border-yellow-300/50 bg-yellow-50/30" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline">
                      {item.name}
                    </a>
                  ) : (
                    <span className="font-medium">{item.name}</span>
                  )}
                  {item.priceRange && (
                    <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
                      {/^\d/.test(item.priceRange) ? `$${item.priceRange}` : item.priceRange}
                    </span>
                  )}
                  {isPurchased && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                      Purchased
                    </span>
                  )}
                  {isClaimed && !isPurchased && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                      {isMyClaim ? "You claimed this" : "Claimed"}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                )}
              </div>

              <div className="flex shrink-0 gap-1">
                {!isClaimed && (
                  <button
                    onClick={() => handleClaim(item.id, "claim")}
                    disabled={acting === item.id}
                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    Claim
                  </button>
                )}
                {isMyClaim && !isPurchased && (
                  <>
                    <button
                      onClick={() => handleClaim(item.id, "purchase")}
                      disabled={acting === item.id}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark transition-colors"
                    >
                      Bought it
                    </button>
                    <button
                      onClick={() => handleClaim(item.id, "unclaim")}
                      disabled={acting === item.id}
                      className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-accent-light hover:text-accent transition-colors"
                    >
                      Unclaim
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
