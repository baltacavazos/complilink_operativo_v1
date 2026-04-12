CREATE TABLE `ceo_bridge_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tenantId` varchar(64),
	`name` varchar(120) NOT NULL,
	`description` varchar(255),
	`filtersJson` text NOT NULL,
	`exportFormat` enum('csv','pdf') NOT NULL DEFAULT 'csv',
	`emailRecipientsJson` text,
	`emailMessage` text,
	`smokeThreshold` int NOT NULL DEFAULT 3,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ceo_bridge_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ceo_bridge_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`presetId` int NOT NULL,
	`userId` int NOT NULL,
	`tenantId` varchar(64),
	`cronExpression` varchar(64) NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`nextRunAt` timestamp,
	`lastRunAt` timestamp,
	`lastRunStatus` varchar(32),
	`lastRunError` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ceo_bridge_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ceo_bridge_presets` ADD CONSTRAINT `ceo_bridge_presets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ceo_bridge_presets` ADD CONSTRAINT `ceo_bridge_presets_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ceo_bridge_schedules` ADD CONSTRAINT `ceo_bridge_schedules_presetId_ceo_bridge_presets_id_fk` FOREIGN KEY (`presetId`) REFERENCES `ceo_bridge_presets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ceo_bridge_schedules` ADD CONSTRAINT `ceo_bridge_schedules_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ceo_bridge_schedules` ADD CONSTRAINT `ceo_bridge_schedules_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ceo_bridge_presets_user_idx` ON `ceo_bridge_presets` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `ceo_bridge_presets_tenant_idx` ON `ceo_bridge_presets` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ceo_bridge_schedules_user_active_idx` ON `ceo_bridge_schedules` (`userId`,`isActive`,`nextRunAt`);--> statement-breakpoint
CREATE INDEX `ceo_bridge_schedules_preset_idx` ON `ceo_bridge_schedules` (`presetId`);--> statement-breakpoint
CREATE INDEX `ceo_bridge_schedules_tenant_idx` ON `ceo_bridge_schedules` (`tenantId`);