CREATE TABLE `moment_timings` (
	`itemId` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`seconds` integer,
	`source` text DEFAULT 'none' NOT NULL,
	`locked` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `timings_room` ON `moment_timings` (`roomId`,`seconds`);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `videoSeconds` integer;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `videoId` text;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `momentId` text;--> statement-breakpoint
CREATE INDEX `chat_moment` ON `chat_messages` (`roomId`,`momentId`,`videoSeconds`);