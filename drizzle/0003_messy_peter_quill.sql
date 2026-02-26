CREATE TABLE `app_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128),
	`email` varchar(320) NOT NULL,
	`passwordHash` text,
	`googleId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastLoginAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_users_email_unique` UNIQUE(`email`),
	CONSTRAINT `app_users_googleId_unique` UNIQUE(`googleId`)
);
--> statement-breakpoint
ALTER TABLE `usage_events` ADD `appUserId` int;