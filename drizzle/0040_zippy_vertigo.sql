CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128),
	`email` varchar(320),
	`message` text NOT NULL,
	`isRead` int NOT NULL DEFAULT 0,
	`ipAnon` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
