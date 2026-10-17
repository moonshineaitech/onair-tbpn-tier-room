CREATE TABLE `stream_metadata` (
	`source` text PRIMARY KEY NOT NULL,
	`title` text,
	`thumbnail` text,
	`liveStatus` text DEFAULT 'unknown' NOT NULL,
	`checkedAt` integer DEFAULT 0 NOT NULL,
	`statusCheckedAt` integer DEFAULT 0 NOT NULL,
	`nextCheckAt` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stream_metadata_refresh` ON `stream_metadata` (`nextCheckAt`);