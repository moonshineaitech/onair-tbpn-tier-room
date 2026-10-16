CREATE TABLE `auth_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`account` text NOT NULL,
	`expires` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`userId` text NOT NULL,
	`ipHash` text NOT NULL,
	`author` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_room` ON `chat_messages` (`roomId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `chat_mutes` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`userId` text NOT NULL,
	`ipHash` text NOT NULL,
	`author` text NOT NULL,
	`until` integer NOT NULL,
	`reason` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_mute_user` ON `chat_mutes` (`roomId`,`userId`);--> statement-breakpoint
CREATE INDEX `chat_mute_network` ON `chat_mutes` (`roomId`,`ipHash`);--> statement-breakpoint
ALTER TABLE `moments` ADD `origin` text;--> statement-breakpoint
CREATE UNIQUE INDEX `moments_source` ON `moments` (`roomId`,`origin`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `chatRevision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `account` text;