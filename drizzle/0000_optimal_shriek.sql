CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`barber_id` text NOT NULL,
	`service_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`price_cents` integer NOT NULL,
	`owner_share_bps` integer NOT NULL,
	`barber_share_bps` integer NOT NULL,
	`owner_amount_cents` integer NOT NULL,
	`barber_amount_cents` integer NOT NULL,
	`public_token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`barber_id`) REFERENCES `barbers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_barber_start_unique` ON `appointments` (`barber_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_profile_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `barbers` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`instagram` text,
	`owner_share_bps` integer DEFAULT 4000 NOT NULL,
	`barber_share_bps` integer DEFAULT 6000 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`notes` text,
	`consent_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_email_unique` ON `profiles` (`email`);--> statement-breakpoint
CREATE TABLE `schedule_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`barber_id` text NOT NULL,
	`kind` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`recurring_rule` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`barber_id`) REFERENCES `barbers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`barber_id` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`gross_cents` integer NOT NULL,
	`owner_amount_cents` integer NOT NULL,
	`barber_amount_cents` integer NOT NULL,
	`paid_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`payment_method` text,
	`paid_at` integer,
	`confirmed_by` text,
	FOREIGN KEY (`barber_id`) REFERENCES `barbers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
