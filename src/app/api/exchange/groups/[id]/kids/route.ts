import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  children,
  childAdults,
  childGroupMembers,
  childExclusions,
  childAssignments,
  exchangeGroups,
  users,
} from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { generateKids, validateKids } from "@/lib/exchange/kids-algorithm";
import type { Assignment } from "@/lib/exchange/algorithm";
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
  if (
    !Number.isSafeInteger(groupId) ||
    !(
      await db
        .select()
        .from(exchangeGroups)
        .where(eq(exchangeGroups.id, groupId))
    ).length
  )
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  try {
    const body = (await request.json()) as {
      action?: string;
      childId?: number;
      firstName?: string;
      lastName?: string;
      adultIds?: number[];
      childId1?: number;
      childId2?: number;
      year?: number;
      assignments?: Assignment[];
      replace?: boolean;
    };
    if (!body || typeof body !== "object") throw new Error("Invalid request.");
    const members = await db
      .select({
        id: children.id,
        firstName: children.firstName,
        lastName: children.lastName,
      })
      .from(childGroupMembers)
      .innerJoin(children, eq(children.id, childGroupMembers.childId))
      .where(eq(childGroupMembers.groupId, groupId));
    const ids = members.map((c) => c.id);
    const childId = body.childId ?? 0;
    if (body.action === "create" || body.action === "edit") {
      if (
        typeof body.firstName !== "string" ||
        !body.firstName.trim() ||
        typeof body.lastName !== "string" ||
        !body.lastName.trim() ||
        body.firstName.length > 100 ||
        body.lastName.length > 100
      )
        throw new Error(
          "First and last name are required (100 characters maximum each).",
        );
      if (
        !Array.isArray(body.adultIds) ||
        !body.adultIds.length ||
        body.adultIds.some((id: unknown) => !Number.isSafeInteger(id))
      )
        throw new Error("Select at least one adult.");
      const adultIds = [...new Set<number>(body.adultIds)];
      const adults = await db
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.id, adultIds), eq(users.active, 1)));
      if (adults.length !== adultIds.length)
        throw new Error("Select active adults only.");
      const values = {
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
      };
      if (body.action === "edit") {
        if (!ids.includes(childId))
          throw new Error("Child is not in this group.");
        await db.batch([
          db.update(children).set(values).where(eq(children.id, childId)),
          db.delete(childAdults).where(eq(childAdults.childId, childId)),
          db
            .insert(childAdults)
            .values(adultIds.map((adultId) => ({ childId, adultId }))),
        ]);
      } else {
        // Use D1's transaction-scoped last_insert_rowid through a single SQL batch.
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO children(first_name,last_name) VALUES (?,?)",
          ).bind(values.firstName, values.lastName),
          env.DB.prepare(
            "INSERT INTO child_group_members(group_id,child_id) VALUES (?,last_insert_rowid())",
          ).bind(groupId),
          env.DB.prepare(
            "INSERT INTO child_adults(child_id,adult_id) WITH picked AS MATERIALIZED (SELECT child_id FROM child_group_members WHERE rowid=last_insert_rowid()) SELECT child_id, value FROM picked, json_each(?)",
          ).bind(JSON.stringify(adultIds)),
        ]);
      }
    } else if (body.action === "add") {
      if (
        !Number.isSafeInteger(childId) ||
        !(await db.select().from(children).where(eq(children.id, childId)))
          .length
      )
        throw new Error("Select an existing child.");
      await db
        .insert(childGroupMembers)
        .values({ groupId, childId })
        .onConflictDoNothing();
    } else if (body.action === "remove") {
      if (!ids.includes(childId))
        throw new Error("Child is not in this group.");
      await db.batch([
        db
          .delete(childGroupMembers)
          .where(
            and(
              eq(childGroupMembers.groupId, groupId),
              eq(childGroupMembers.childId, childId),
            ),
          ),
        db
          .delete(childExclusions)
          .where(
            and(
              eq(childExclusions.groupId, groupId),
              or(
                eq(childExclusions.childId1, childId),
                eq(childExclusions.childId2, childId),
              ),
            ),
          ),
      ]);
    } else if (body.action === "exclude" || body.action === "include") {
      const [childId1, childId2] = [
        body.childId1 ?? 0,
        body.childId2 ?? 0,
      ].sort((a, b) => a - b);
      if (
        childId1 === childId2 ||
        !ids.includes(childId1) ||
        !ids.includes(childId2)
      )
        throw new Error("Select two different children from this group.");
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
    } else if (body.action === "preview" || body.action === "save") {
      const [settings]=await db.select().from(exchangeGroups).where(eq(exchangeGroups.id,groupId));
      if(!settings?.kidsExchangeEnabled)return NextResponse.json({error:"Kids exchange is disabled for this group"},{status:409});
      const year = body.year ?? 0;
      if (!Number.isInteger(year) || year < 2000 || year > 9999)
        throw new Error("Enter a valid year.");
      const exclusions = await db
        .select()
        .from(childExclusions)
        .where(eq(childExclusions.groupId, groupId));
      const history = await db
        .select()
        .from(childAssignments)
        .where(eq(childAssignments.groupId, groupId));
      if (body.action === "preview") {
        const assignments = generateKids(ids, exclusions, history, year);
        const names = new Map(
          members.map((c) => [c.id, `${c.firstName} ${c.lastName}`]),
        );
        return NextResponse.json({
          assignments: assignments.map((a) => ({
            ...a,
            giverName: names.get(a.giverId),
            receiverName: names.get(a.receiverId),
          })),
        });
      }
      if (
        ids.length < 2 ||
        !Array.isArray(body.assignments) ||
        body.assignments.some(
          (a: Assignment) =>
            !a ||
            !Number.isInteger(a.giverId) ||
            !Number.isInteger(a.receiverId),
        )
      )
        throw new Error("Generate a preview first.");
      validateKids(body.assignments, ids, exclusions, history, year);
      if (history.some((a) => a.year === year) && body.replace !== true)
        return NextResponse.json(
          {
            error:
              "Assignments already exist for this year. Confirm replacement.",
            needsConfirmation: true,
          },
          { status: 409 },
        );
      await db.batch([
        db
          .delete(childAssignments)
          .where(
            and(
              eq(childAssignments.groupId, groupId),
              eq(childAssignments.year, year),
            ),
          ),
        db
          .insert(childAssignments)
          .values(
            body.assignments.map((a: Assignment) => ({
              groupId,
              year,
              giverId: a.giverId,
              receiverId: a.receiverId,
            })),
          ),
      ]);
    } else throw new Error("Unknown action.");
    // Compatibility for old clients that explicitly create/enroll a child here.
    if(body.action==="create"||body.action==="add")await db.update(exchangeGroups).set({kidsExchangeEnabled:1}).where(eq(exchangeGroups.id,groupId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update kids’ exchange",
      },
      { status: 400 },
    );
  }
}
