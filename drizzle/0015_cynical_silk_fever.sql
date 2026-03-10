CREATE TABLE `consent_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int,
	`email` varchar(320),
	`termsVersion` varchar(32) NOT NULL DEFAULT '2026-03-10',
	`privacyVersion` varchar(32) NOT NULL DEFAULT '2026-03-10',
	`ipAnon` varchar(20),
	`userAgent` text,
	`consentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consent_records_id` PRIMARY KEY(`id`)
);
