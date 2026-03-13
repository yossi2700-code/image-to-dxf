CREATE TABLE `admin_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`text` varchar(500) NOT NULL,
	`isDone` int NOT NULL DEFAULT 0,
	`priority` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_tasks_id` PRIMARY KEY(`id`)
);
