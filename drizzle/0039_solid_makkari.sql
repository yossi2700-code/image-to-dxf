CREATE TABLE `visitor_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`appUserId` int,
	`page` varchar(256) NOT NULL DEFAULT '/',
	`country` varchar(4),
	`ipAnon` varchar(20),
	`referrer` varchar(512),
	`userAgent` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitor_events_id` PRIMARY KEY(`id`)
);
