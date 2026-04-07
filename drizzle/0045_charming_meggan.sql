CREATE TABLE `freedxf_downloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` int NOT NULL,
	`sharedFileId` int NOT NULL,
	`fileTitle` varchar(200),
	`fileCategory` varchar(64),
	`previewImageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `freedxf_downloads_id` PRIMARY KEY(`id`)
);
