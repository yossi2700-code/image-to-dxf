CREATE TABLE `bug_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int,
	`errorType` varchar(32) NOT NULL,
	`errorMessage` text,
	`feature` varchar(32),
	`imageUrl` text,
	`status` varchar(16) NOT NULL DEFAULT 'new',
	`adminNote` text,
	`ipAnon` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bug_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int NOT NULL,
	`usageDate` varchar(10) NOT NULL,
	`conversionsUsed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`emoji` varchar(8),
	`isPublished` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` varchar(32) NOT NULL,
	`name` varchar(64) NOT NULL,
	`dailyConversions` int NOT NULL,
	`priceILS` varchar(16) NOT NULL,
	`priceUSD` varchar(16) NOT NULL,
	`discountPercent` int DEFAULT 0,
	`badge` enum('recommended','best_value','sale'),
	`isActive` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plans_planId_unique` UNIQUE(`planId`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int NOT NULL,
	`planId` varchar(32) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`paypalSubscriptionId` varchar(64),
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`)
);
