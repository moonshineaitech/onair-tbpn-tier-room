CREATE TABLE `boards` (
	`userId` text NOT NULL,
	`roomId` text NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `roomId`)
);
