CREATE TABLE `barber_services` (
	`barber_id` text NOT NULL,
	`service_id` text NOT NULL,
	`price_cents` integer NOT NULL,
	`duration_minutes` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`barber_id`) REFERENCES `barbers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `barber_service_unique` ON `barber_services` (`barber_id`,`service_id`);
--> statement-breakpoint
INSERT INTO `barber_services` (`barber_id`,`service_id`,`price_cents`,`duration_minutes`,`active`)
SELECT `barbers`.`id`,`services`.`id`,`services`.`price_cents`,`services`.`duration_minutes`,1
FROM `barbers` CROSS JOIN `services`;
