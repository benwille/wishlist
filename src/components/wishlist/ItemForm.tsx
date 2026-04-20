"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics/track";

export default function ItemForm({ userId, item, onSaved }: {
  userId: number;
  item?: { id: number; name: string; description: string | null; link: string | null; priceRange: string | null };
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!item;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      description: (form.get("description") as string) || null,
      link: (form.get("link") as string) || null,
      priceRange: (form.get("priceRange") as string) || null,
    };

    const url = isEdit ? `/api/items/${item.id}` : "/api/items";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      trackEvent(isEdit ? "item_edited" : "item_added", {
        has_link: !!data.link,
        has_price: !!data.priceRange,
      });
      if (!isEdit) (e.target as HTMLFormElement).reset();
      router.refresh();
      onSaved?.();
    } else {
      const r = (await res.json()) as { error?: string };
      setError(r.error || "Something went wrong");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">What do you want?</label>
        <input id="name" name="name" required defaultValue={item?.name}
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
          placeholder="e.g. Wireless headphones" />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium">Details <span className="text-muted font-normal">(optional)</span></label>
        <textarea id="description" name="description" rows={2} defaultValue={item?.description || ""}
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
          placeholder="Size, color, specific model..." />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="link" className="block text-sm font-medium">Link <span className="text-muted font-normal">(optional)</span></label>
          <input id="link" name="link" type="url" defaultValue={item?.link || ""}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
            placeholder="https://..." />
        </div>
        <div>
          <label htmlFor="priceRange" className="block text-sm font-medium">Price <span className="text-muted font-normal">(optional)</span></label>
          <input id="priceRange" name="priceRange" defaultValue={item?.priceRange || ""}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
            placeholder="$25 or $25-50" />
        </div>
      </div>
      <button type="submit" disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
        {loading ? "Saving..." : isEdit ? "Save changes" : "Add to list"}
      </button>
      {error && <p className="text-sm text-accent">{error}</p>}
    </form>
  );
}
