ALTER TABLE `user_actions` ADD `shareToken` varchar(64);--> statement-breakpoint
ALTER TABLE `user_actions` ADD `shareTitle` varchar(200);--> statement-breakpoint
ALTER TABLE `user_actions` ADD CONSTRAINT `user_actions_shareToken_unique` UNIQUE(`shareToken`);