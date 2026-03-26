ALTER TABLE `visitor_events` ADD `utmSource` varchar(128);--> statement-breakpoint
ALTER TABLE `visitor_events` ADD `utmMedium` varchar(128);--> statement-breakpoint
ALTER TABLE `visitor_events` ADD `utmCampaign` varchar(128);--> statement-breakpoint
ALTER TABLE `visitor_events` ADD `device` varchar(16);--> statement-breakpoint
ALTER TABLE `visitor_events` ADD `browser` varchar(32);--> statement-breakpoint
ALTER TABLE `visitor_events` ADD `eventType` varchar(32) DEFAULT 'pageview' NOT NULL;--> statement-breakpoint
ALTER TABLE `visitor_events` ADD `element` varchar(64);--> statement-breakpoint
ALTER TABLE `visitor_events` ADD `timeOnPageSec` int;--> statement-breakpoint
ALTER TABLE `visitor_events` ADD `bounced` int DEFAULT 0;