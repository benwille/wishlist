import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { people, personGuardians, children, users } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { canEditPerson, profileRows, guardianChoices } from "@/lib/people";
async function context(request: NextRequest) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);
  const token = request.cookies.get(getSessionCookieName())?.value;
  return { env, db, user: token ? await validateSession(db, token) : null };
}
export async function GET(request: NextRequest) {
  const { db, user } = await context(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    people: await profileRows(db, user),
    adults: await guardianChoices(db, user),
  });
}
export async function POST(request: NextRequest) {
  const { env, db, user } = await context(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as {
      action?: string;
      id?: number;
      firstName?: string;
      lastName?: string;
      profileType?: string;
      guardianIds?: number[];
    };
    if (!body || !["create", "edit"].includes(body.action ?? ""))
      throw new Error("Choose a profile action.");
    if (body.action === "create" && !user.isAdmin)
      return NextResponse.json(
        { error: "Only an administrator can create profiles" },
        { status: 403 },
      );
    if (
      body.action === "edit" &&
      (!Number.isSafeInteger(body.id) ||
        !(await canEditPerson(db, user, body.id!)))
    )
      return NextResponse.json(
        { error: "Profile access denied" },
        { status: 403 },
      );
    if (
      !user.isAdmin &&
      (body.guardianIds !== undefined || body.profileType !== undefined)
    )
      return NextResponse.json(
        {
          error:
            "Only an administrator can assign adults or change profile settings",
        },
        { status: 403 },
      );
    if (
      typeof body.firstName !== "string" ||
      !body.firstName.trim() ||
      body.firstName.length > 100 ||
      typeof body.lastName !== "string" ||
      !body.lastName.trim() ||
      body.lastName.length > 100
    )
      throw new Error(
        "First and last name are required (up to 100 characters each).",
      );
    const firstName = body.firstName.trim(),
      lastName = body.lastName.trim();
    const [existing] =
      body.action === "edit"
        ? await db.select().from(people).where(eq(people.id, body.id!))
        : [];
    if (body.action === "edit" && !existing)
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const profileType = existing?.profileType ?? body.profileType;
    if (profileType !== "adult" && profileType !== "child")
      throw new Error("Choose Adult or Child.");
    if (
      existing &&
      body.profileType &&
      body.profileType !== existing.profileType
    )
      throw new Error(
        "Profile conversion will be available in a future update; saved identities and history are retained.",
      );
    const previousGuardians =
      existing && user.isAdmin
        ? (
            await db
              .select()
              .from(personGuardians)
              .where(eq(personGuardians.personId, existing.id))
          ).map((g) => g.adultPersonId)
        : [];
    let guardianIds: number[] | undefined;
    if (
      profileType === "child" &&
      (body.action === "create" || body.guardianIds !== undefined)
    ) {
      if (
        !Array.isArray(body.guardianIds) ||
        !body.guardianIds.length ||
        body.guardianIds.some((id) => !Number.isSafeInteger(id))
      )
        throw new Error("Select at least one linked adult.");
      guardianIds = [...new Set(body.guardianIds)];
      const choices = await guardianChoices(db, user);
      if (
        guardianIds.some(
          (id) =>
            !previousGuardians.includes(id) &&
            !choices.some((a) => a.id === id),
        )
      )
        throw new Error(
          "Choose active adult profiles you are authorized to link.",
        );
    }
    if (body.action === "edit") {
      if (guardianIds) {
        const removed = previousGuardians.filter(
          (id) => !guardianIds.includes(id),
        );
        const added = guardianIds.filter(
          (id) => !previousGuardians.includes(id),
        );
        await db.batch([
          db
            .update(people)
            .set({ firstName, lastName })
            .where(eq(people.id, body.id!)),
          ...(removed.length
            ? [
                db
                  .delete(personGuardians)
                  .where(
                    and(
                      eq(personGuardians.personId, body.id!),
                      inArray(personGuardians.adultPersonId, removed),
                    ),
                  ),
              ]
            : []),
          ...(added.length
            ? [
                db
                  .insert(personGuardians)
                  .values(
                    added.map((adultPersonId) => ({
                      personId: body.id!,
                      adultPersonId,
                    })),
                  ),
              ]
            : []),
        ]);
      } else {
        const changed = await db
          .update(people)
          .set({ firstName, lastName })
          .where(
            and(
              eq(people.id, body.id!),
              ...(user.isAdmin
                ? []
                : [
                    or(
                      eq(people.accountId, user.id),
                      inArray(
                        people.id,
                        db
                          .select({ id: personGuardians.personId })
                          .from(personGuardians)
                          .where(
                            eq(personGuardians.adultPersonId, user.personId),
                          ),
                      ),
                    )!,
                  ]),
            ),
          )
          .returning({ id: people.id });
        if (!changed.length)
          return NextResponse.json(
            { error: "Profile access revoked" },
            { status: 403 },
          );
      }
      return NextResponse.json({ ok: true, id: body.id });
    }
    if (profileType === "adult") {
      // The account record has no credentials until the administrator invites/configures it.
      const [account] = await db
        .insert(users)
        .values({ firstName, lastName })
        .returning();
      const [profile] = await db
        .select()
        .from(people)
        .where(eq(people.accountId, account.id));
      return NextResponse.json({ ok: true, id: profile.id }, { status: 201 });
    }
    // One atomic batch creates a permanent profile, its historical exchange adapter,
    // and all guardian links. No group membership or draw is created here.
    const result = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO people(first_name,last_name,profile_type,active,created_at) VALUES (?,?,'child',1,CURRENT_TIMESTAMP) RETURNING id",
      ).bind(firstName, lastName),
      env.DB.prepare(
        "INSERT INTO children(first_name,last_name,person_id) VALUES (?,?,last_insert_rowid())",
      ).bind(firstName, lastName),
      env.DB.prepare(
        "INSERT INTO person_guardians(person_id,adult_person_id) WITH picked AS MATERIALIZED (SELECT person_id FROM children WHERE id=last_insert_rowid()) SELECT person_id,value FROM picked,json_each(?)",
      ).bind(JSON.stringify(guardianIds)),
    ]);
    return NextResponse.json(
      { ok: true, id: (result[0].results[0] as { id: number }).id },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save profile",
      },
      { status: 400 },
    );
  }
}
