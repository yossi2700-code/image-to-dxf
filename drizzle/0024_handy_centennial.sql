CREATE TABLE `campaign_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignCode` varchar(64) NOT NULL,
	`appUserId` int NOT NULL,
	`tokensAwarded` int NOT NULL DEFAULT 15,
	`redeemedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_redemptions_id` PRIMARY KEY(`id`)
);
