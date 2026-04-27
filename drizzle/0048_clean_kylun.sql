CREATE TABLE `user_click_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int,
	`userEmail` varchar(320),
	`userName` varchar(128),
	`action` varchar(128) NOT NULL,
	`label` varchar(200),
	`page` varchar(128),
	`metadata` text,
	`ipAnon` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_click_events_id` PRIMARY KEY(`id`)
);
