import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  isAdmin: integer("is_admin").notNull().default(0),
  active: integer("active").notNull().default(1),
  shareToken: text("share_token").unique(),
  inviteToken: text("invite_token").unique(),
  inviteExpiresAt: text("invite_expires_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const guestClaimants = sqliteTable("guest_claimants", {
  id: text("id").primaryKey(),
  listOwnerId: integer("list_owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email"),
  mergedInto: text("merged_into"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [uniqueIndex("idx_guest_email_list").on(table.listOwnerId, table.email)]);

export const guestSessions = sqliteTable("guest_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  claimantId: text("claimant_id").notNull().references(() => guestClaimants.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});

export const guestAccessLinks = sqliteTable("guest_access_links", {
  tokenHash: text("token_hash").primaryKey(),
  claimantId: text("claimant_id").notNull().references(() => guestClaimants.id, { onDelete: "cascade" }),
  email: text("email"),
  expiresAt: integer("expires_at").notNull(),
});

export const publicRateLimits = sqliteTable("public_rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_public_limits_expiry").on(table.expiresAt)]);

// History deliberately has no foreign keys: deleting an item or user must not
// erase the evidence needed to investigate or repair a claim change.
export const claimHistory = sqliteTable("claim_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  listOwnerId: integer("list_owner_id").notNull(),
  actorUserId: integer("actor_user_id"),
  actorGuestId: text("actor_guest_id"),
  action: text("action").notNull(),
  beforeState: text("before_state").notNull(),
  afterState: text("after_state"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_claim_history_item_time").on(table.itemId, table.createdAt)]);

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  link: text("link"),
  priceRange: text("price_range"),
  claimedBy: integer("claimed_by").references(() => users.id),
  claimedByGuest: text("claimed_by_guest").references(() => guestClaimants.id),
  purchased: integer("purchased").notNull().default(0),
  receivedAt: text("received_at"),
  yearAdded: integer("year_added").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_items_user_id").on(table.userId),
]);

export const exchangeGroups = sqliteTable("exchange_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const exchangeGroupMembers = sqliteTable("exchange_group_members", {
  groupId: integer("group_id").notNull().references(() => exchangeGroups.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
}, (table) => [
  primaryKey({ columns: [table.groupId, table.userId] }),
]);

export const exchangeExclusions = sqliteTable("exchange_exclusions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => exchangeGroups.id, { onDelete: "cascade" }),
  userId1: integer("user_id_1").notNull().references(() => users.id),
  userId2: integer("user_id_2").notNull().references(() => users.id),
}, (table) => [
  uniqueIndex("idx_exclusions_unique").on(table.groupId, table.userId1, table.userId2),
]);

export const exchangeAssignments = sqliteTable("exchange_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => exchangeGroups.id),
  giverId: integer("giver_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  year: integer("year").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_assignments_group_year").on(table.groupId, table.year),
  uniqueIndex("idx_assignments_giver_year").on(table.groupId, table.giverId, table.year),
]);

export const magicLinks = sqliteTable("magic_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  used: integer("used").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_magic_links_token").on(table.token),
]);

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_push_subs_user_id").on(table.userId),
  uniqueIndex("idx_push_subs_endpoint").on(table.endpoint),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_sessions_user_id").on(table.userId),
]);
