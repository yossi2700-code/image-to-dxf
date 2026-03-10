CREATE TABLE `paypal_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int NOT NULL,
	`paypalOrderId` varchar(64) NOT NULL,
	`packageId` varchar(16) NOT NULL,
	`tokenAmount` int NOT NULL,
	`priceAmount` varchar(16) NOT NULL,
	`currency` varchar(8) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`tokensCredited` int NOT NULL DEFAULT 0,
	`ipAnon` varchar(20),
	`termsAccepted` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `paypal_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `paypal_orders_paypalOrderId_unique` UNIQUE(`paypalOrderId`)
);
