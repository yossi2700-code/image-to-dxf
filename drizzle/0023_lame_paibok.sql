ALTER TABLE `paypal_orders` ADD `packageKey` varchar(64);--> statement-breakpoint
ALTER TABLE `paypal_orders` ADD `amountCents` int;--> statement-breakpoint
ALTER TABLE `paypal_orders` ADD `captureId` varchar(64);--> statement-breakpoint
ALTER TABLE `paypal_orders` ADD `purchaseTermsAccepted` int DEFAULT 0;