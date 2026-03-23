CREATE TABLE `issue_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int NOT NULL,
	`userActionId` int,
	`sourceImageUrl` text,
	`resultImageUrl` text,
	`feature` varchar(32),
	`description` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`tokensRefunded` int DEFAULT 0,
	`adminNote` text,
	`reviewedByAdminId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `issue_reports_id` PRIMARY KEY(`id`)
);
