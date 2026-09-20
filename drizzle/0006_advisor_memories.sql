CREATE TABLE `case_advisor_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`traceId` varchar(96) NOT NULL,
	`greeting` text,
	`highlightsJson` text,
	`documentsDiscussedJson` text,
	`risksFlaggedJson` text,
	`nextStepsJson` text,
	`recentTurnsJson` text,
	`lastPrompt` text,
	`lastAnswer` text,
	`summaryJson` text,
	`modelUsed` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_advisor_memories_id` PRIMARY KEY(`id`),
	CONSTRAINT `case_advisor_memories_scope_uq` UNIQUE(`tenantId`,`caseId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `case_advisor_memories` ADD CONSTRAINT `case_advisor_memories_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `case_advisor_memories` ADD CONSTRAINT `case_advisor_memories_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `case_advisor_memories` ADD CONSTRAINT `case_advisor_memories_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `case_advisor_memories_case_idx` ON `case_advisor_memories` (`caseId`,`userId`);
--> statement-breakpoint
CREATE INDEX `case_advisor_memories_tenant_idx` ON `case_advisor_memories` (`tenantId`);
