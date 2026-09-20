CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`profile_id` text,
	`appointment_id` text,
	`fcm_token` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_fcm_token_unique` ON `push_subscriptions` (`fcm_token`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `reminder_sent_at` integer;