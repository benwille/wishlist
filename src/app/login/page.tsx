import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const { redirect: redirectTo, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">Wishlist</h1>
          <p className="mt-2 text-sm text-muted">Sign in to manage your wishlist</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-accent-light px-4 py-3 text-sm text-accent">
            {error === "invalid" ? "Invalid email or password." : "Something went wrong."}
          </div>
        )}

        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
