import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "barber"] }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const barbers = sqliteTable("barbers", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => profiles.id),
  name: text("name").notNull(),
  instagram: text("instagram"),
  photoKey: text("photo_key"),
  ownerShareBps: integer("owner_share_bps").notNull().default(4000),
  barberShareBps: integer("barber_share_bps").notNull().default(6000),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const barberServices = sqliteTable("barber_services", {
  barberId: text("barber_id").notNull().references(() => barbers.id),
  serviceId: text("service_id").notNull().references(() => services.id),
  customName: text("custom_name"),
  priceCents: integer("price_cents").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  imageKey: text("image_key"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, table => ({ barberServiceUnique: uniqueIndex("barber_service_unique").on(table.barberId, table.serviceId) }));

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes"),
  consentAt: integer("consent_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  barberId: text("barber_id").notNull().references(() => barbers.id),
  serviceId: text("service_id").notNull().references(() => services.id),
  customerId: text("customer_id").notNull().references(() => customers.id),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "completed", "cancelled", "no_show"] }).notNull().default("pending"),
  priceCents: integer("price_cents").notNull(),
  ownerShareBps: integer("owner_share_bps").notNull(),
  barberShareBps: integer("barber_share_bps").notNull(),
  ownerAmountCents: integer("owner_amount_cents").notNull(),
  barberAmountCents: integer("barber_amount_cents").notNull(),
  publicTokenHash: text("public_token_hash").notNull(),
  paymentMethod: text("payment_method", { enum: ["pix", "cash", "card"] }),
  reminderSentAt: integer("reminder_sent_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => ({ activeBarberStartUnique: uniqueIndex("appointment_active_barber_start_unique").on(table.barberId, table.startsAt).where(sql`${table.status} in ('pending', 'confirmed')`) }));

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["staff", "customer"] }).notNull(),
  profileId: text("profile_id").references(() => profiles.id),
  appointmentId: text("appointment_id").references(() => appointments.id),
  fcmToken: text("fcm_token").notNull().unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
});

export const scheduleBlocks = sqliteTable("schedule_blocks", {
  id: text("id").primaryKey(),
  barberId: text("barber_id").notNull().references(() => barbers.id),
  kind: text("kind", { enum: ["lunch", "personal", "break", "day_off", "vacation"] }).notNull(),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
  recurringRule: text("recurring_rule"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const settlements = sqliteTable("settlements", {
  id: text("id").primaryKey(),
  barberId: text("barber_id").notNull().references(() => barbers.id),
  periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
  periodEnd: integer("period_end", { mode: "timestamp" }).notNull(),
  grossCents: integer("gross_cents").notNull(),
  ownerAmountCents: integer("owner_amount_cents").notNull(),
  barberAmountCents: integer("barber_amount_cents").notNull(),
  paidCents: integer("paid_cents").notNull().default(0),
  status: text("status", { enum: ["open", "partial", "paid"] }).notNull().default("open"),
  paymentMethod: text("payment_method"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  confirmedBy: text("confirmed_by").references(() => profiles.id),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorProfileId: text("actor_profile_id").references(() => profiles.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
