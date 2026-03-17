ALTER TABLE `user_actions` ADD `status` enum('success','failed','cancelled') DEFAULT 'success';--> statement-breakpoint
ALTER TABLE `user_actions` ADD `errorMessage` varchar(500);