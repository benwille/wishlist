import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const db = getDb(env.DB);
    const body = (await request.json()) as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const user = result[0];

    if (!user.active) {
      return NextResponse.json({ error: "Account deactivated" }, { status: 401 });
    }

    if (!user.passwordHash) {
      return NextResponse.json({ error: "No password set. Use email link to log in." }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { sessionId, expires } = await createSession(db, user.id);

    const response = NextResponse.json({ ok: true });
    response.cookies.set("session_id", sessionId, sessionCookieOptions(expires));

    return response;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
