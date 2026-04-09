"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ItemForm from "./ItemForm";
import { formatPrice } from "@/lib/formatPrice";

type Item = {
  id: number;
  name: string;
  description: string | null;
  link: string | null;
  priceRange: string | null;
  yearAdded: number;
  userId: number;
};

export default function MyItemList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  async function handleDelete(id: number) {
    if (!confirm("Remove this item?")) return;
    setDeleting(id);
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    router.refresh();
    setDeleting(null);
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">Your list is empty. Add something above!</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          {editing === item.id ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Edit item</h3>
                <button
                  onClick={() => setEditing(null)}
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
              <ItemForm
                userId={item.userId}
                item={item}
                onSaved={() => setEditing(null)}
              />
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline truncate">
                      {item.name}
                    </a>
                  ) : (
                    <span className="font-medium">{item.name}</span>
                  )}
                  {item.priceRange && (
                    <span className="shrink-0 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
                      {formatPrice(item.priceRange)}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                )}
                <p className="mt-1 text-xs text-muted">Added {item.yearAdded}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEditing(item.id)}
                  className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-primary-light hover:text-primary transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-accent-light hover:text-accent transition-colors"
                >
                  {deleting === item.id ? "..." : "Remove"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
