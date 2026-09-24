ALTER TABLE `users` ADD `whatsappNotifyOptIn` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `whatsappPhoneE164` varchar(20);--> statement-breakpoint
CREATE TABLE `whatsapp_notification_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dedupeKey` varchar(191) NOT NULL,
	`phoneE164` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_notification_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_notification_deliveries_user_key_uq` UNIQUE(`userId`,`dedupeKey`)
);
--> statement-breakpoint
ALTER TABLE `whatsapp_notification_deliveries` ADD CONSTRAINT `whatsapp_notification_deliveries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
