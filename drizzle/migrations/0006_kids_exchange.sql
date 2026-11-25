CREATE TABLE `child_adults` (
	`child_id` integer NOT NULL,
	`adult_id` integer NOT NULL,
	PRIMARY KEY(`child_id`, `adult_id`),
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adult_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_child_adults_adult` ON `child_adults` (`adult_id`);--> statement-breakpoint
CREATE TABLE `child_assignments` (
	`group_id` integer NOT NULL,
	`giver_id` integer NOT NULL,
	`receiver_id` integer NOT NULL,
	`year` integer NOT NULL,
	PRIMARY KEY(`group_id`, `year`, `giver_id`),
	FOREIGN KEY (`group_id`) REFERENCES `exchange_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`giver_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "child_no_self" CHECK("child_assignments"."giver_id" <> "child_assignments"."receiver_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_child_receiver_year` ON `child_assignments` (`group_id`,`year`,`receiver_id`);--> statement-breakpoint
CREATE TABLE `child_exclusions` (
	`group_id` integer NOT NULL,
	`child_id_1` integer NOT NULL,
	`child_id_2` integer NOT NULL,
	PRIMARY KEY(`group_id`, `child_id_1`, `child_id_2`),
	FOREIGN KEY (`group_id`) REFERENCES `exchange_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id_1`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_id_2`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "child_exclusion_order" CHECK("child_exclusions"."child_id_1" < "child_exclusions"."child_id_2")
);
--> statement-breakpoint
CREATE TABLE `child_group_members` (
	`group_id` integer NOT NULL,
	`child_id` integer NOT NULL,
	PRIMARY KEY(`group_id`, `child_id`),
	FOREIGN KEY (`group_id`) REFERENCES `exchange_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `children` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL
);
