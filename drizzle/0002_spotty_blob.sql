CREATE TABLE `complilink_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`traceId` varchar(96) NOT NULL,
	`documentId` varchar(64) NOT NULL,
	`eventKey` varchar(64) NOT NULL,
	`eventName` varchar(128) NOT NULL,
	`compliLinkId` varchar(128),
	`correlationId` varchar(128),
	`sourceTimestamp` varchar(64),
	`sourceSignature` varchar(255),
	`rawPayload` text NOT NULL,
	`status` enum('processing','processed','failed_processing') NOT NULL DEFAULT 'processing',
	`failureReason` varchar(255),
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `complilink_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `complilink_webhook_events_event_key_uq` UNIQUE(`eventKey`)
);
--> statement-breakpoint
ALTER TABLE `complilink_webhook_events` ADD CONSTRAINT `complilink_webhook_events_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complilink_webhook_events` ADD CONSTRAINT `complilink_webhook_events_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `complilink_webhook_events` ADD CONSTRAINT `cl_we_doc_fk` FOREIGN KEY (`documentId`) REFERENCES `case_documents`(`documentId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `complilink_webhook_events_document_idx` ON `complilink_webhook_events` (`documentId`);--> statement-breakpoint
CREATE INDEX `complilink_webhook_events_trace_idx` ON `complilink_webhook_events` (`traceId`);--> statement-breakpoint
CREATE INDEX `complilink_webhook_events_status_idx` ON `complilink_webhook_events` (`status`);