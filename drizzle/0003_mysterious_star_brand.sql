SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'cl_we_doc_fk'
    AND TABLE_NAME = 'complilink_webhook_events'
);
--> statement-breakpoint
SET @fk_sql := IF(
  @fk_exists = 0,
  'ALTER TABLE `complilink_webhook_events` ADD CONSTRAINT `cl_we_doc_fk` FOREIGN KEY (`documentId`) REFERENCES `case_documents`(`documentId`) ON DELETE no action ON UPDATE no action',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE complilink_fk_stmt FROM @fk_sql;
--> statement-breakpoint
EXECUTE complilink_fk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE complilink_fk_stmt;
