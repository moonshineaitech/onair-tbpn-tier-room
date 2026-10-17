CREATE TABLE `room_hosts` (
	`roomId` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`blockedWords` text DEFAULT '[]' NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `room_hosts_owner` ON `room_hosts` (`ownerId`);