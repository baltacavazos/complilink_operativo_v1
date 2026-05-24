CREATE TABLE `commerce_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`stripeCustomerId` varchar(64),
	`stripeCheckoutSessionId` varchar(64),
	`stripePaymentIntentId` varchar(64),
	`stripeInvoiceId` varchar(64),
	`stripeSubscriptionId` varchar(64),
	`productKey` varchar(64) NOT NULL,
	`productLabel` varchar(255) NOT NULL,
	`productType` enum('subscription','one_shot') NOT NULL,
	`amountTotal` int NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'mxn',
	`paymentStatus` varchar(32) NOT NULL,
	`paidAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commerce_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `commerce_payments_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`),
	CONSTRAINT `commerce_payments_stripePaymentIntentId_unique` UNIQUE(`stripePaymentIntentId`),
	CONSTRAINT `commerce_payments_stripeInvoiceId_unique` UNIQUE(`stripeInvoiceId`)
);
--> statement-breakpoint
CREATE TABLE `commerce_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeCustomerId` varchar(64) NOT NULL,
	`stripeSubscriptionId` varchar(64) NOT NULL,
	`stripePriceId` varchar(64),
	`planKey` enum('free','essential','pro') NOT NULL,
	`status` varchar(32) NOT NULL,
	`latestInvoiceId` varchar(64),
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commerce_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `commerce_subscriptions_subscription_uq` UNIQUE(`stripeSubscriptionId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_stripeCustomerId_unique` UNIQUE(`stripeCustomerId`);--> statement-breakpoint
ALTER TABLE `commerce_payments` ADD CONSTRAINT `commerce_payments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerce_subscriptions` ADD CONSTRAINT `commerce_subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `commerce_payments_user_paid_idx` ON `commerce_payments` (`userId`,`paidAt`);--> statement-breakpoint
CREATE INDEX `commerce_payments_customer_idx` ON `commerce_payments` (`stripeCustomerId`);--> statement-breakpoint
CREATE INDEX `commerce_payments_subscription_idx` ON `commerce_payments` (`stripeSubscriptionId`);--> statement-breakpoint
CREATE INDEX `commerce_subscriptions_user_status_idx` ON `commerce_subscriptions` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `commerce_subscriptions_customer_idx` ON `commerce_subscriptions` (`stripeCustomerId`);