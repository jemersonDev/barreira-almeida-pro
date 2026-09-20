INSERT OR IGNORE INTO `services` (`id`,`name`,`duration_minutes`,`price_cents`,`active`,`sort_order`)
VALUES ('service-6','Barba',30,3500,1,6);
--> statement-breakpoint
INSERT OR IGNORE INTO `barber_services` (`barber_id`,`service_id`,`price_cents`,`duration_minutes`,`active`)
SELECT `id`,'service-6',3500,30,1 FROM `barbers` WHERE `active` = 1;
