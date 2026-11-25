import type { kidsAssignments } from "@/lib/exchange/kids";
export default function KidsAssignments({
  assignments,
  title = "Kids",
}: {
  assignments: Awaited<ReturnType<typeof kidsAssignments>>;
  title?: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {assignments.length === 0 ? (
        <p className="text-sm text-muted">No kids’ assignments yet.</p>
      ) : (
        <div className="space-y-3">
          {[...assignments]
            .sort(
              (a, b) =>
                b.year - a.year ||
                a.giverFirstName.localeCompare(b.giverFirstName),
            )
            .map((a) => (
              <div
                key={`${a.groupId}-${a.year}-${a.giverId}`}
                className="rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <p className="font-medium">
                  {a.giverFirstName} {a.giverLastName} → {a.receiverFirstName}{" "}
                  {a.receiverLastName}
                </p>
                <p className="text-sm text-muted">
                  {a.groupName} · {a.year}
                </p>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
