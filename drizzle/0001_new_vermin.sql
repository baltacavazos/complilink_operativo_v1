CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64),
	`traceId` varchar(96) NOT NULL,
	`documentId` varchar(64),
	`actorUserId` int,
	`entityType` enum('tenant','case','document','consent','policy','access','system') NOT NULL,
	`entityId` varchar(128) NOT NULL,
	`action` varchar(128) NOT NULL,
	`beforeState` text,
	`afterState` text,
	`hashChain` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `canonical_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64),
	`traceId` varchar(96) NOT NULL,
	`contractType` enum('case','intake','document','classification','consent','audit','shared_engine') NOT NULL,
	`schemaVersion` varchar(32) NOT NULL DEFAULT 'v1',
	`payload` text NOT NULL,
	`status` enum('draft','ready','exported') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `canonical_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`traceId` varchar(96) NOT NULL,
	`userId` int NOT NULL,
	`grantedByUserId` int,
	`accessLevel` enum('owner','editor','reviewer','viewer') NOT NULL DEFAULT 'viewer',
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_access_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`traceId` varchar(96) NOT NULL,
	`documentId` varchar(64) NOT NULL,
	`uploadedByUserId` int,
	`supersedesDocumentId` varchar(64),
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sizeBytes` bigint NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`documentType` enum('payroll_receipt','cfdi','imss','contract','settlement','evidence','other') NOT NULL DEFAULT 'other',
	`sourceChannel` enum('manual','email','api','bulk_import') NOT NULL DEFAULT 'manual',
	`integrityStatus` enum('pending','verified','replaced') NOT NULL DEFAULT 'pending',
	`consentStatus` enum('pending','granted','revoked','not_required') NOT NULL DEFAULT 'pending',
	`visibility` enum('case_team','tenant_legal','tenant_hr','restricted') NOT NULL DEFAULT 'case_team',
	`classificationConfidence` int NOT NULL DEFAULT 0,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `case_documents_document_id_uq` UNIQUE(`documentId`)
);
--> statement-breakpoint
CREATE TABLE `case_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`traceId` varchar(96) NOT NULL,
	`actorUserId` int,
	`eventType` enum('case_created','status_changed','document_uploaded','document_classified','consent_updated','policy_updated','note_added','alert_raised') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`metadata` text,
	`eventAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `case_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`traceId` varchar(96) NOT NULL,
	`documentId` varchar(64),
	`subjectName` varchar(255) NOT NULL,
	`subjectRole` varchar(128),
	`legalBasis` varchar(255),
	`status` enum('pending','granted','revoked','expired','not_required') NOT NULL DEFAULT 'pending',
	`notes` text,
	`grantedAt` timestamp,
	`revokedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consent_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`traceId` varchar(96) NOT NULL,
	`documentId` varchar(64) NOT NULL,
	`policyType` enum('visibility','retention','legal_hold','access_exception') NOT NULL,
	`visibilityScope` enum('case_team','tenant_legal','tenant_hr','restricted') NOT NULL DEFAULT 'case_team',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`ruleText` text NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `labor_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`traceId` varchar(96) NOT NULL,
	`title` varchar(255) NOT NULL,
	`employeeName` varchar(255),
	`employerEntity` varchar(255),
	`jurisdiction` varchar(128) NOT NULL DEFAULT 'México',
	`status` enum('intake','analysis','conciliation','litigation','resolved','archived') NOT NULL DEFAULT 'intake',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`assignedUserId` int,
	`summary` text,
	`canonicalPayload` text,
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`dueAt` timestamp,
	`closedAt` timestamp,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labor_cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `labor_cases_case_id_uq` UNIQUE(`caseId`)
);
--> statement-breakpoint
CREATE TABLE `operational_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64),
	`traceId` varchar(96) NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
	`category` enum('missing_consent','integrity_gap','overdue_case','upload_pending','access_risk') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
	`raisedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`caseId` varchar(64),
	`traceId` varchar(96) NOT NULL,
	`userId` int NOT NULL,
	`role` enum('tenant_admin','manager','reviewer','viewer') NOT NULL DEFAULT 'viewer',
	`accessScope` enum('tenant','case') NOT NULL DEFAULT 'tenant',
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`traceId` varchar(96) NOT NULL,
	`legalName` varchar(255) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`status` enum('pilot','active','inactive') NOT NULL DEFAULT 'pilot',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_tenant_id_uq` UNIQUE(`tenantId`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_documentId_case_documents_documentId_fk` FOREIGN KEY (`documentId`) REFERENCES `case_documents`(`documentId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `canonical_contracts` ADD CONSTRAINT `canonical_contracts_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `canonical_contracts` ADD CONSTRAINT `canonical_contracts_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_access` ADD CONSTRAINT `case_access_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_access` ADD CONSTRAINT `case_access_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_access` ADD CONSTRAINT `case_access_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_access` ADD CONSTRAINT `case_access_grantedByUserId_users_id_fk` FOREIGN KEY (`grantedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_documents` ADD CONSTRAINT `case_documents_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_documents` ADD CONSTRAINT `case_documents_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_documents` ADD CONSTRAINT `case_documents_uploadedByUserId_users_id_fk` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_events` ADD CONSTRAINT `case_events_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_events` ADD CONSTRAINT `case_events_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_events` ADD CONSTRAINT `case_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consent_records` ADD CONSTRAINT `consent_records_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consent_records` ADD CONSTRAINT `consent_records_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consent_records` ADD CONSTRAINT `consent_records_documentId_case_documents_documentId_fk` FOREIGN KEY (`documentId`) REFERENCES `case_documents`(`documentId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_policies` ADD CONSTRAINT `document_policies_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_policies` ADD CONSTRAINT `document_policies_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_policies` ADD CONSTRAINT `document_policies_documentId_case_documents_documentId_fk` FOREIGN KEY (`documentId`) REFERENCES `case_documents`(`documentId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_policies` ADD CONSTRAINT `document_policies_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `labor_cases` ADD CONSTRAINT `labor_cases_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `labor_cases` ADD CONSTRAINT `labor_cases_assignedUserId_users_id_fk` FOREIGN KEY (`assignedUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operational_alerts` ADD CONSTRAINT `operational_alerts_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operational_alerts` ADD CONSTRAINT `operational_alerts_caseId_labor_cases_caseId_fk` FOREIGN KEY (`caseId`) REFERENCES `labor_cases`(`caseId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_tenantId_tenants_tenantId_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`tenantId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_trace_idx` ON `audit_logs` (`traceId`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `canonical_contracts_tenant_case_idx` ON `canonical_contracts` (`tenantId`,`caseId`);--> statement-breakpoint
CREATE INDEX `canonical_contracts_type_idx` ON `canonical_contracts` (`contractType`);--> statement-breakpoint
CREATE INDEX `case_access_case_user_idx` ON `case_access` (`caseId`,`userId`);--> statement-breakpoint
CREATE INDEX `case_access_tenant_idx` ON `case_access` (`tenantId`);--> statement-breakpoint
CREATE INDEX `case_documents_case_type_idx` ON `case_documents` (`caseId`,`documentType`);--> statement-breakpoint
CREATE INDEX `case_documents_trace_idx` ON `case_documents` (`traceId`);--> statement-breakpoint
CREATE INDEX `case_events_case_event_at_idx` ON `case_events` (`caseId`,`eventAt`);--> statement-breakpoint
CREATE INDEX `case_events_trace_idx` ON `case_events` (`traceId`);--> statement-breakpoint
CREATE INDEX `consent_records_case_idx` ON `consent_records` (`caseId`);--> statement-breakpoint
CREATE INDEX `consent_records_document_idx` ON `consent_records` (`documentId`);--> statement-breakpoint
CREATE INDEX `document_policies_document_idx` ON `document_policies` (`documentId`);--> statement-breakpoint
CREATE INDEX `labor_cases_tenant_status_idx` ON `labor_cases` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `labor_cases_tenant_updated_idx` ON `labor_cases` (`tenantId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `operational_alerts_tenant_status_idx` ON `operational_alerts` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `operational_alerts_case_idx` ON `operational_alerts` (`caseId`);--> statement-breakpoint
CREATE INDEX `tenant_memberships_user_idx` ON `tenant_memberships` (`userId`);--> statement-breakpoint
CREATE INDEX `tenant_memberships_tenant_case_idx` ON `tenant_memberships` (`tenantId`,`caseId`);--> statement-breakpoint
CREATE INDEX `tenants_status_idx` ON `tenants` (`status`);