CREATE TABLE `token_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(32) NOT NULL,
	`cost` int NOT NULL DEFAULT 0,
	`label` varchar(64),
	`isEnabled` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `token_costs_id` PRIMARY KEY(`id`),
	CONSTRAINT `token_costs_action_unique` UNIQUE(`action`)
);
