CREATE TABLE `user_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int NOT NULL,
	`actionType` enum('convert','ai_generate','download') NOT NULL,
	`description` text,
	`segmentCount` int DEFAULT 0,
	`dxfUrl` text,
	`imageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_actions_id` PRIMARY KEY(`id`)
);
