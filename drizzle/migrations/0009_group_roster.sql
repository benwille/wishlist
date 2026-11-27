CREATE TABLE `group_roster` (
	`group_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	PRIMARY KEY(`group_id`, `person_id`),
	FOREIGN KEY (`group_id`) REFERENCES `exchange_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Preserve every current exchange participant and wishlist-only family member.
INSERT INTO group_roster(group_id, person_id)
 SELECT group_id, person_id FROM group_people
 UNION SELECT f.group_id, p.id FROM family_list_members f JOIN people p ON p.account_id=f.user_id;
--> statement-breakpoint
-- Retain legacy endpoints and all existing profile bridge triggers.
CREATE TRIGGER roster_adult_insert AFTER INSERT ON exchange_group_members BEGIN
 INSERT OR IGNORE INTO group_roster(group_id,person_id) SELECT NEW.group_id,id FROM people WHERE account_id=NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER roster_adult_delete AFTER DELETE ON exchange_group_members BEGIN
 DELETE FROM group_roster WHERE group_id=OLD.group_id AND person_id=(SELECT id FROM people WHERE account_id=OLD.user_id)
 AND NOT EXISTS(SELECT 1 FROM family_list_members WHERE group_id=OLD.group_id AND user_id=OLD.user_id);
END;
--> statement-breakpoint
CREATE TRIGGER roster_child_insert AFTER INSERT ON child_group_members BEGIN
 INSERT OR IGNORE INTO group_roster(group_id,person_id) SELECT NEW.group_id,person_id FROM children WHERE id=NEW.child_id;
END;
--> statement-breakpoint
CREATE TRIGGER roster_child_delete AFTER DELETE ON child_group_members BEGIN
 DELETE FROM group_roster WHERE group_id=OLD.group_id AND person_id=(SELECT person_id FROM children WHERE id=OLD.child_id);
END;
--> statement-breakpoint
CREATE TRIGGER roster_family_insert AFTER INSERT ON family_list_members BEGIN
 INSERT OR IGNORE INTO group_roster(group_id,person_id) SELECT NEW.group_id,id FROM people WHERE account_id=NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER roster_family_delete AFTER DELETE ON family_list_members BEGIN
 DELETE FROM group_roster WHERE group_id=OLD.group_id AND person_id=(SELECT id FROM people WHERE account_id=OLD.user_id)
 AND NOT EXISTS(SELECT 1 FROM exchange_group_members WHERE group_id=OLD.group_id AND user_id=OLD.user_id);
END;
