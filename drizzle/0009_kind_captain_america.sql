CREATE TABLE `token_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int NOT NULL,
	`amount` int NOT NULL,
	`reason` varchar(64) NOT NULL,
	`description` text,
	`balanceAfter` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `token_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `app_users` ADD `tokenBalance` int DEFAULT 20 NOT NULL;