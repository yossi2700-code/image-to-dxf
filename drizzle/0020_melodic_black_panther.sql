ALTER TABLE `package_prices` MODIFY COLUMN `packageId` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `package_prices` ADD `discountPercent` int DEFAULT 0;