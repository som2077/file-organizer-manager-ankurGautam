CREATE TABLE `files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`filePath` varchar(512) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `files` ADD CONSTRAINT `files_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;