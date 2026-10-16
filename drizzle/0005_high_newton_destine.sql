CREATE TABLE `board_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`byline` text NOT NULL,
	`entries` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`automatic` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `board_post_owner` ON `board_posts` (`roomId`,`userId`);--> statement-breakpoint
CREATE INDEX `board_post_room` ON `board_posts` (`roomId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `episodes` (
	`videoId` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`title` text NOT NULL,
	`startedAt` integer NOT NULL,
	`lastLiveAt` integer NOT NULL,
	`offlineSince` integer,
	`endedAt` integer,
	`phase` text DEFAULT 'live' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episode_room` ON `episodes` (`roomId`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`roomId` text NOT NULL,
	`targetType` text NOT NULL,
	`targetId` text NOT NULL,
	`userId` text NOT NULL,
	`value` text NOT NULL,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`roomId`, `targetType`, `targetId`, `userId`, `value`)
);
--> statement-breakpoint
CREATE INDEX `reaction_target` ON `reactions` (`roomId`,`targetType`,`targetId`);--> statement-breakpoint
ALTER TABLE `boards` ADD `title` text DEFAULT 'My show rankings' NOT NULL;--> statement-breakpoint
ALTER TABLE `boards` ADD `byline` text DEFAULT 'Viewer' NOT NULL;--> statement-breakpoint
ALTER TABLE `boards` ADD `autoPublish` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `boards` ADD `publishedId` text;--> statement-breakpoint
ALTER TABLE `boards` ADD `version` integer DEFAULT 0 NOT NULL;