CREATE TABLE `package_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` varchar(16) NOT NULL,
	`tokenAmount` int NOT NULL,
	`priceUSD` varchar(16) NOT NULL,
	`priceEUR` varchar(16) NOT NULL,
	`priceILS` varchar(16) NOT NULL,
	`priceGBP` varchar(16) NOT NULL,
	`priceAUD` varchar(16) NOT NULL,
	`priceCAD` varchar(16) NOT NULL,
	`priceJPY` varchar(16) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`label` varchar(64),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `package_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `package_prices_packageId_unique` UNIQUE(`packageId`)
);
