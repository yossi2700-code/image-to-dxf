CREATE TABLE `usage_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('convert','ai_generate') NOT NULL,
	`segmentCount` int DEFAULT 0,
	`ipAnon` varchar(20),
	`country` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usage_events_id` PRIMARY KEY(`id`)
);
