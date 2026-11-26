import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  people,
  children,
  groupPeople,
  exchangeGroups,
  exchangeGroupMembers,
  childGroupMembers,
  exchangeExclusions,
  childExclusions,
} from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);
  const token = request.cookies.get(getSessionCookieName())?.value;
  const user = token ? await validateSession(db, token) : null;
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin)
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  const groupId = Number((await params).id);
  const [group] = Number.isSafeInteger(groupId)
    ? await db
        .select()
        .from(exchangeGroups)
        .where(eq(exchangeGroups.id, groupId))
    : [];
  if (!group)
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  try {
    const body = (await request.json()) as {
      action?: string;
      personId?: number;
      personId1?: number;
      personId2?: number;
      profileType?: "adult" | "child";
      enabled?: boolean;
    };
    if (!body) throw new Error("Invalid action.");
    if (body.action === "settings") {
      if (
        !["adult", "child"].includes(body.profileType ?? "") ||
        typeof body.enabled !== "boolean"
      )
        throw new Error("Choose an exchange setting.");
      await db
        .update(exchangeGroups)
        .set(
          body.profileType === "child"
            ? { kidsExchangeEnabled: body.enabled ? 1 : 0 }
            : { adultExchangeEnabled: body.enabled ? 1 : 0 },
        )
        .where(eq(exchangeGroups.id, groupId));
    } else if (body.action === "add" || body.action === "remove") {
      const [person] = Number.isSafeInteger(body.personId)
        ? await db.select().from(people).where(eq(people.id, body.personId!))
        : [];
      if (!person) throw new Error("Choose an existing person.");
      if (body.action === "add" && !person.active)
        throw new Error("Choose an active profile.");
      if (person.profileType === "adult") {
        if (!person.accountId)
          throw new Error(
            "This adult needs an account before exchange participation.",
          );
        if (body.action === "add")
          await db
            .insert(exchangeGroupMembers)
            .values({ groupId, userId: person.accountId })
            .onConflictDoNothing();
        else
          await db
            .delete(exchangeGroupMembers)
            .where(
              and(
                eq(exchangeGroupMembers.groupId, groupId),
                eq(exchangeGroupMembers.userId, person.accountId),
              ),
            );
      } else {
        const [child] = await db
          .select()
          .from(children)
          .where(eq(children.personId, person.id));
        if (!child) throw new Error("Child profile is unavailable.");
        if (body.action === "add")
          await db
            .insert(childGroupMembers)
            .values({ groupId, childId: child.id })
            .onConflictDoNothing();
        else
          await db
            .delete(childGroupMembers)
            .where(
              and(
                eq(childGroupMembers.groupId, groupId),
                eq(childGroupMembers.childId, child.id),
              ),
            );
      }
    } else if (body.action === "exclude" || body.action === "include") {
      const ids = [body.personId1, body.personId2];
      if (ids.some((id) => !Number.isSafeInteger(id)) || ids[0] === ids[1])
        throw new Error("Choose two different participants.");
      const participants = await db
        .select()
        .from(people)
        .innerJoin(groupPeople, eq(groupPeople.personId, people.id))
        .where(
          and(
            eq(groupPeople.groupId, groupId),
            inArray(people.id, ids as number[]),
          ),
        );
      const persons =
        body.action === "include"
          ? await db
              .select()
              .from(people)
              .where(inArray(people.id, ids as number[]))
          : participants.map((p) => p.people);
      if (
        persons.length !== 2 ||
        persons[0].profileType !== persons[1].profileType
      )
        throw new Error(
          "Both people must participate in the same exchange in this group.",
        );
      if (persons[0].profileType === "adult") {
        const [userId1, userId2] = persons
          .map((p) => p.accountId!)
          .sort((a, b) => a - b);
        if (body.action === "exclude")
          await db
            .insert(exchangeExclusions)
            .values({ groupId, userId1, userId2 })
            .onConflictDoNothing();
        else
          await db
            .delete(exchangeExclusions)
            .where(
              and(
                eq(exchangeExclusions.groupId, groupId),
                eq(exchangeExclusions.userId1, userId1),
                eq(exchangeExclusions.userId2, userId2),
              ),
            );
      } else {
        const childPair = await db
          .select()
          .from(children)
          .where(
            inArray(
              children.personId,
              persons.map((p) => p.id),
            ),
          );
        if (childPair.length !== 2)
          throw new Error("Child profiles unavailable.");
        const [childId1, childId2] = childPair
          .map((c) => c.id)
          .sort((a, b) => a - b);
        if (body.action === "exclude")
          await db
            .insert(childExclusions)
            .values({ groupId, childId1, childId2 })
            .onConflictDoNothing();
        else
          await db
            .delete(childExclusions)
            .where(
              and(
                eq(childExclusions.groupId, groupId),
                eq(childExclusions.childId1, childId1),
                eq(childExclusions.childId2, childId2),
              ),
            );
      }
    } else throw new Error("Unknown group action.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update group",
      },
      { status: 400 },
    );
  }
}
