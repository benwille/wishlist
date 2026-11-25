CREATE TABLE `claim_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`list_owner_id` integer NOT NULL,
	`actor_user_id` integer,
	`actor_guest_id` text,
	`action` text NOT NULL,
	`before_state` text NOT NULL,
	`after_state` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_claim_history_item_time` ON `claim_history` (`item_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `guest_access_links` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`claimant_id` text NOT NULL,
	`email` text,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`claimant_id`) REFERENCES `guest_claimants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guest_claimants` (
	`id` text PRIMARY KEY NOT NULL,
	`list_owner_id` integer NOT NULL,
	`email` text,
	`merged_into` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`list_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_guest_email_list` ON `guest_claimants` (`list_owner_id`,`email`);--> statement-breakpoint
CREATE TABLE `guest_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`claimant_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`claimant_id`) REFERENCES `guest_claimants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `public_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_public_limits_expiry` ON `public_rate_limits` (`expires_at`);--> statement-breakpoint
ALTER TABLE `items` ADD `claimed_by_guest` text REFERENCES guest_claimants(id);
--> statement-breakpoint
CREATE TRIGGER items_guest_insert_guard BEFORE INSERT ON items
WHEN NEW.claimed_by_guest IS NOT NULL AND (NEW.claimed_by IS NOT NULL OR NOT EXISTS (
 SELECT 1 FROM guest_claimants WHERE id = NEW.claimed_by_guest AND list_owner_id = NEW.user_id
)) BEGIN SELECT RAISE(ABORT, 'Invalid guest claim'); END;
--> statement-breakpoint
CREATE TRIGGER items_guest_update_guard BEFORE UPDATE OF claimed_by, claimed_by_guest, user_id ON items
WHEN NEW.claimed_by_guest IS NOT NULL AND (NEW.claimed_by IS NOT NULL OR NOT EXISTS (
 SELECT 1 FROM guest_claimants WHERE id = NEW.claimed_by_guest AND list_owner_id = NEW.user_id
)) BEGIN SELECT RAISE(ABORT, 'Invalid guest claim'); END;
--> statement-breakpoint
CREATE TRIGGER items_claim_history_update AFTER UPDATE OF claimed_by, claimed_by_guest, purchased, received_at ON items
WHEN OLD.claimed_by IS NOT NEW.claimed_by OR OLD.claimed_by_guest IS NOT NEW.claimed_by_guest
 OR OLD.purchased IS NOT NEW.purchased OR OLD.received_at IS NOT NEW.received_at
BEGIN
 INSERT INTO claim_history (item_id, list_owner_id, actor_user_id, actor_guest_id, action, before_state, after_state, created_at)
 VALUES (NEW.id, NEW.user_id,
  CASE WHEN OLD.received_at IS NOT NEW.received_at THEN NEW.user_id ELSE COALESCE(NEW.claimed_by, OLD.claimed_by) END,
  CASE WHEN OLD.received_at IS NOT NEW.received_at THEN NULL ELSE COALESCE(NEW.claimed_by_guest, OLD.claimed_by_guest) END,
  CASE WHEN OLD.received_at IS NOT NEW.received_at THEN CASE WHEN NEW.received_at IS NULL THEN 'unreceive' ELSE 'receive' END
   WHEN NEW.claimed_by IS NULL AND NEW.claimed_by_guest IS NULL THEN 'unclaim'
   WHEN OLD.claimed_by_guest IS NOT NULL AND NEW.claimed_by_guest IS NOT NULL AND OLD.claimed_by_guest != NEW.claimed_by_guest THEN 'merge'
   WHEN NEW.purchased = 1 THEN 'purchase' ELSE 'claim' END,
  json_object('userId', OLD.claimed_by, 'guestId', OLD.claimed_by_guest, 'purchased', OLD.purchased, 'receivedAt', OLD.received_at),
  json_object('userId', NEW.claimed_by, 'guestId', NEW.claimed_by_guest, 'purchased', NEW.purchased, 'receivedAt', NEW.received_at),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
--> statement-breakpoint
CREATE TRIGGER items_claim_history_delete AFTER DELETE ON items
WHEN OLD.claimed_by IS NOT NULL OR OLD.claimed_by_guest IS NOT NULL OR OLD.received_at IS NOT NULL
BEGIN
 INSERT INTO claim_history (item_id, list_owner_id, actor_user_id, actor_guest_id, action, before_state, after_state, created_at)
 VALUES (OLD.id, OLD.user_id, OLD.user_id, NULL, 'delete',
  json_object('userId', OLD.claimed_by, 'guestId', OLD.claimed_by_guest, 'purchased', OLD.purchased, 'receivedAt', OLD.received_at),
  NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
