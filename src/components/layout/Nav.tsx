"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavUser = {
  id: number;
  firstName: string;
  isAdmin: boolean;
} | null;

export default function Nav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const links = [
    { href: "/lists", label: "All Lists" },
    { href: "/my-list", label: "My List" },
    { href: "/exchange", label: "Gift Exchange" },
    { href: "/account", label: "Account" },
  ];

  if (user.isAdmin) {
    links.push({ href: "/admin", label: "Admin" });
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="bg-primary text-white">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Wishlist
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-white/20"
                    : "hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <form action="/api/auth/logout" method="POST" className="ml-2">
              <button
                type="submit"
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10"
              >
                Log out
              </button>
            </form>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive(link.href) ? "bg-white/20" : "hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10"
              >
                Log out
              </button>
            </form>
          </div>
        )}
      </div>
    </nav>
  );
}
