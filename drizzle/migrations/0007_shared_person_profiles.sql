CREATE TABLE `group_people` (
	`group_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	PRIMARY KEY(`group_id`, `person_id`),
	FOREIGN KEY (`group_id`) REFERENCES `exchange_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`profile_type` text NOT NULL,
	`account_id` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "person_type" CHECK("people"."profile_type" IN ('adult', 'child'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_account_id_unique` ON `people` (`account_id`);--> statement-breakpoint
CREATE TABLE `person_guardians` (
	`person_id` integer NOT NULL,
	`adult_person_id` integer NOT NULL,
	PRIMARY KEY(`person_id`, `adult_person_id`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`adult_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "guardian_not_self" CHECK("person_guardians"."person_id" <> "person_guardians"."adult_person_id")
);
--> statement-breakpoint
ALTER TABLE `children` ADD `person_id` integer REFERENCES people(id);--> statement-breakpoint
CREATE UNIQUE INDEX `children_person_id_unique` ON `children` (`person_id`);--> statement-breakpoint
ALTER TABLE `exchange_groups` ADD `adult_exchange_enabled` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `exchange_groups` ADD `kids_exchange_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `person_id` integer REFERENCES people(id);
--> statement-breakpoint
-- Keep a count ledger so an invalid backfill aborts the migration rather than
-- publishing partial identities. Existing assignment and claim rows are retained.
CREATE TABLE _person_migration_counts AS SELECT
 (SELECT count(*) FROM users) AS adults,
 (SELECT count(*) FROM children) AS kids,
 (SELECT count(*) FROM exchange_assignments) AS adult_draws,
 (SELECT count(*) FROM child_assignments) AS kid_draws,
 (SELECT count(*) FROM items) AS gifts,
 (SELECT count(*) FROM claim_history) AS claim_events;
--> statement-breakpoint
INSERT INTO people(id,first_name,last_name,profile_type,account_id,active,created_at)
 SELECT id,first_name,last_name,'adult',id,active,created_at FROM users;
--> statement-breakpoint
INSERT INTO people(id,first_name,last_name,profile_type,active,created_at)
 SELECT (SELECT coalesce(max(id),0) FROM users)+id,first_name,last_name,'child',1,CURRENT_TIMESTAMP FROM children;
--> statement-breakpoint
UPDATE children SET person_id=(SELECT coalesce(max(id),0) FROM users)+id;
--> statement-breakpoint
INSERT INTO person_guardians(person_id,adult_person_id)
 SELECT c.person_id,p.id FROM child_adults ca JOIN children c ON c.id=ca.child_id JOIN people p ON p.account_id=ca.adult_id;
--> statement-breakpoint
INSERT INTO group_people(group_id,person_id)
 SELECT m.group_id,p.id FROM exchange_group_members m JOIN people p ON p.account_id=m.user_id
 UNION SELECT m.group_id,c.person_id FROM child_group_members m JOIN children c ON c.id=m.child_id;
--> statement-breakpoint
UPDATE items SET person_id=(SELECT id FROM people WHERE account_id=items.user_id);
--> statement-breakpoint
UPDATE exchange_groups SET kids_exchange_enabled=1 WHERE id IN
 (SELECT group_id FROM child_group_members UNION SELECT group_id FROM child_assignments);
--> statement-breakpoint
CREATE TABLE _person_migration_check(ok INTEGER NOT NULL CHECK(ok=1));
--> statement-breakpoint
INSERT INTO _person_migration_check SELECT
 (SELECT count(*) FROM people)=(SELECT adults+kids FROM _person_migration_counts)
 AND (SELECT count(*) FROM users)=(SELECT adults FROM _person_migration_counts)
 AND (SELECT count(*) FROM children)=(SELECT kids FROM _person_migration_counts)
 AND NOT EXISTS(SELECT 1 FROM users u LEFT JOIN people p ON p.account_id=u.id WHERE p.id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM children WHERE person_id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM items WHERE person_id IS NULL)
 AND (SELECT count(*) FROM person_guardians)=(SELECT count(*) FROM child_adults)
 AND (SELECT count(*) FROM group_people)=(SELECT count(*) FROM exchange_group_members)+(SELECT count(*) FROM child_group_members)
 AND (SELECT count(*) FROM exchange_assignments)=(SELECT adult_draws FROM _person_migration_counts)
 AND (SELECT count(*) FROM child_assignments)=(SELECT kid_draws FROM _person_migration_counts)
 AND (SELECT count(*) FROM items)=(SELECT gifts FROM _person_migration_counts)
 AND (SELECT count(*) FROM claim_history)=(SELECT claim_events FROM _person_migration_counts);
--> statement-breakpoint
DROP TABLE _person_migration_check;
--> statement-breakpoint
DROP TABLE _person_migration_counts;
--> statement-breakpoint
-- Compatibility bridges keep old account URLs, claims and draw IDs stable.
CREATE TRIGGER account_person_insert AFTER INSERT ON users BEGIN
 INSERT INTO people(first_name,last_name,profile_type,account_id,active,created_at)
 VALUES(NEW.first_name,NEW.last_name,'adult',NEW.id,NEW.active,NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER account_person_update AFTER UPDATE OF first_name,last_name,active ON users
 WHEN OLD.first_name IS NOT NEW.first_name OR OLD.last_name IS NOT NEW.last_name OR OLD.active IS NOT NEW.active BEGIN
 UPDATE people SET first_name=NEW.first_name,last_name=NEW.last_name,active=NEW.active WHERE account_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER child_person_insert AFTER INSERT ON children WHEN NEW.person_id IS NULL BEGIN
 INSERT INTO people(first_name,last_name,profile_type,active,created_at) VALUES(NEW.first_name,NEW.last_name,'child',1,CURRENT_TIMESTAMP);
 UPDATE children SET person_id=last_insert_rowid() WHERE id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER child_person_update AFTER UPDATE OF first_name,last_name ON children
 WHEN OLD.first_name IS NOT NEW.first_name OR OLD.last_name IS NOT NEW.last_name BEGIN
 UPDATE people SET first_name=NEW.first_name,last_name=NEW.last_name WHERE id=NEW.person_id;
END;
--> statement-breakpoint
CREATE TRIGGER person_name_update AFTER UPDATE OF first_name,last_name ON people
 WHEN OLD.first_name IS NOT NEW.first_name OR OLD.last_name IS NOT NEW.last_name BEGIN
 UPDATE users SET first_name=NEW.first_name,last_name=NEW.last_name WHERE id=NEW.account_id;
 UPDATE children SET first_name=NEW.first_name,last_name=NEW.last_name WHERE person_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER validate_person_guardian BEFORE INSERT ON person_guardians BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM people WHERE id=NEW.person_id AND profile_type='child')
 OR NOT EXISTS(SELECT 1 FROM people p JOIN users u ON u.id=p.account_id WHERE p.id=NEW.adult_person_id AND p.profile_type='adult' AND p.active=1 AND u.active=1)
 THEN RAISE(ABORT,'Guardian links require a child and an active adult account') END;
END;
--> statement-breakpoint
CREATE TRIGGER child_adult_person_insert AFTER INSERT ON child_adults BEGIN
 INSERT OR IGNORE INTO person_guardians(person_id,adult_person_id)
 SELECT c.person_id,p.id FROM children c,people p WHERE c.id=NEW.child_id AND p.account_id=NEW.adult_id;
END;
--> statement-breakpoint
CREATE TRIGGER child_adult_person_delete AFTER DELETE ON child_adults BEGIN
 DELETE FROM person_guardians WHERE person_id=(SELECT person_id FROM children WHERE id=OLD.child_id)
 AND adult_person_id=(SELECT id FROM people WHERE account_id=OLD.adult_id);
END;
--> statement-breakpoint
CREATE TRIGGER guardian_child_adult_insert AFTER INSERT ON person_guardians BEGIN
 INSERT OR IGNORE INTO child_adults(child_id,adult_id)
 SELECT c.id,p.account_id FROM children c,people p WHERE c.person_id=NEW.person_id AND p.id=NEW.adult_person_id;
END;
--> statement-breakpoint
CREATE TRIGGER guardian_child_adult_delete AFTER DELETE ON person_guardians BEGIN
 DELETE FROM child_adults WHERE child_id=(SELECT id FROM children WHERE person_id=OLD.person_id)
 AND adult_id=(SELECT account_id FROM people WHERE id=OLD.adult_person_id);
END;
--> statement-breakpoint
CREATE TRIGGER adult_group_person_insert AFTER INSERT ON exchange_group_members BEGIN
 INSERT OR IGNORE INTO group_people(group_id,person_id) SELECT NEW.group_id,id FROM people WHERE account_id=NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER adult_group_person_delete AFTER DELETE ON exchange_group_members BEGIN
 DELETE FROM group_people WHERE group_id=OLD.group_id AND person_id=(SELECT id FROM people WHERE account_id=OLD.user_id);
END;
--> statement-breakpoint
CREATE TRIGGER child_group_person_insert AFTER INSERT ON child_group_members BEGIN
 INSERT OR IGNORE INTO group_people(group_id,person_id) SELECT NEW.group_id,person_id FROM children WHERE id=NEW.child_id;
END;
--> statement-breakpoint
CREATE TRIGGER child_group_person_delete AFTER DELETE ON child_group_members BEGIN
 DELETE FROM group_people WHERE group_id=OLD.group_id AND person_id=(SELECT person_id FROM children WHERE id=OLD.child_id);
END;
--> statement-breakpoint
CREATE TRIGGER item_person_insert AFTER INSERT ON items BEGIN
 UPDATE items SET person_id=(SELECT id FROM people WHERE account_id=NEW.user_id) WHERE id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER account_person_delete BEFORE DELETE ON users BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM child_adults WHERE adult_id=OLD.id)
 THEN RAISE(ABORT,'Reassign linked children before deleting an adult account') END;
 UPDATE people SET active=0 WHERE account_id=OLD.id;
END;
