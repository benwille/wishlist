"use client";

type Assignment = {
  year: number;
  giverName: string;
  receiverName: string;
};

export default function AssignmentHistory({ assignments }: { assignments: Assignment[] }) {
  if (assignments.length === 0) {
    return <p className="text-sm text-muted">No exchanges have been run for this group yet.</p>;
  }

  const byYear = new Map<number, Assignment[]>();
  for (const a of assignments) {
    const list = byYear.get(a.year) || [];
    list.push(a);
    byYear.set(a.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      {years.map((year) => (
        <div key={year}>
          <h3 className="text-sm font-semibold mb-2">{year}</h3>
          <div className="space-y-1">
            {byYear.get(year)!.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{a.giverName}</span>
                <span className="text-muted">→</span>
                <span>{a.receiverName}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
