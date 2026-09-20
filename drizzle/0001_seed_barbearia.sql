INSERT OR IGNORE INTO `profiles` (`id`,`email`,`name`,`role`,`active`,`created_at`) VALUES
('profile-lucas','lucas@barbeariaalmeida.local','Lucas Almeida','owner',1,1779836400),
('profile-sinvas','sinvas@barbeariaalmeida.local','Sinvas','barber',1,1779836400);
--> statement-breakpoint
INSERT OR IGNORE INTO `barbers` (`id`,`profile_id`,`name`,`instagram`,`owner_share_bps`,`barber_share_bps`,`active`) VALUES
('lucas','profile-lucas','Lucas','lk_do.corte',0,10000,1),
('sinvas','profile-sinvas','Sinvas','barbeirosinvas',4000,6000,1);
--> statement-breakpoint
INSERT OR IGNORE INTO `services` (`id`,`name`,`duration_minutes`,`price_cents`,`active`,`sort_order`) VALUES
('service-1','Corte',30,3500,1,1),
('service-2','Corte + Barba',60,6000,1,2),
('service-3','Corte + Sobrancelha',30,4500,1,3),
('service-4','VIP Corte Completo',60,7000,1,4),
('service-5','Corte Infantil',30,4500,1,5);
