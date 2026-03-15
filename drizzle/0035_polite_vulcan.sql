ALTER TABLE `token_costs` ADD `labelHe` varchar(64);--> statement-breakpoint
ALTER TABLE `token_costs` ADD `labelEn` varchar(64);--> statement-breakpoint
ALTER TABLE `token_costs` ADD `descriptionHe` varchar(200);--> statement-breakpoint
ALTER TABLE `token_costs` ADD `descriptionEn` varchar(200);--> statement-breakpoint
ALTER TABLE `token_costs` ADD `sortOrder` int DEFAULT 0 NOT NULL;