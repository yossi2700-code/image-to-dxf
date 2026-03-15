CREATE TABLE `failed_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int,
	`feature` varchar(64) NOT NULL,
	`durationMs` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`sourceImageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `failed_jobs_id` PRIMARY KEY(`id`)
);
