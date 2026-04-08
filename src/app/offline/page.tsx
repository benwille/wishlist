export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-muted">Check your connection and try again.</p>
    </main>
  );
}
