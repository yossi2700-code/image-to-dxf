CREATE TABLE `persistent_jobs` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','processing','done','error','cancelled') NOT NULL DEFAULT 'pending',
	`tokenAction` varchar(64),
	`tokenDeducted` int NOT NULL DEFAULT 0,
	`noFaceRefundSent` int NOT NULL DEFAULT 0,
	`faceCount` int,
	`step` text,
	`stepEn` text,
	`partialImages` mediumtext,
	`result` mediumtext,
	`error` text,
	`errorCode` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `persistent_jobs_id` PRIMARY KEY(`id`)
);
