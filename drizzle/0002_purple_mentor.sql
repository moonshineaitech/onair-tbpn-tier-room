CREATE TABLE `placements` (
	`roomId` text NOT NULL,
	`itemId` text NOT NULL,
	`tier` text DEFAULT 'U' NOT NULL,
	`score` integer DEFAULT 50 NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`roomId`, `itemId`)
);
--> statement-breakpoint
CREATE TABLE `presence` (
	`userId` text NOT NULL,
	`roomId` text NOT NULL,
	`seenAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `roomId`)
);
--> statement-breakpoint
CREATE INDEX `presence_room` ON `presence` (`roomId`,`seenAt`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `revision` integer DEFAULT 0 NOT NULL;