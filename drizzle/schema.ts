import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Usage tracking table (anonymous)
export const usageEvents = mysqlTable("usage_events", {
  id: int("id").autoincrement().primaryKey(),
  /** Type of action performed */
  type: mysqlEnum("type", ["convert", "ai_generate"]).notNull(),
  /** Number of vector segments produced */
  segmentCount: int("segmentCount").default(0),
  /** Anonymized IP (first 3 octets only, e.g. 1.2.3.x) */
  ipAnon: varchar("ipAnon", { length: 20 }),
  /** Country/region hint from IP (optional, filled later) */
  country: varchar("country", { length: 64 }),
  /** Thumbnail URL of the uploaded image (stored in S3) */
  imageUrl: text("imageUrl"),
  /** App user ID (null for anonymous) */
  appUserId: int("appUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UsageEvent = typeof usageEvents.$inferSelect;
export type InsertUsageEvent = typeof usageEvents.$inferInsert;

// App users table (for email/password and Google OAuth registration)
export const appUsers = mysqlTable("app_users", {
  id: int("id").autoincrement().primaryKey(),
  /** Display name */
  name: varchar("name", { length: 128 }),
  /** Email address (unique) */
  email: varchar("email", { length: 320 }).notNull().unique(),
  /** Bcrypt hashed password (null for Google-only users) */
  passwordHash: text("passwordHash"),
  /** Google OAuth subject ID */
  googleId: varchar("googleId", { length: 128 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt").defaultNow().notNull(),
});

export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = typeof appUsers.$inferInsert;

// User actions table — tracks every convert/generate/download per registered user
export const userActions = mysqlTable("user_actions", {
  id: int("id").autoincrement().primaryKey(),
  /** App user who performed the action */
  appUserId: int("appUserId").notNull(),
  /** Action type */
  actionType: mysqlEnum("actionType", ["convert", "ai_generate", "download"]).notNull(),
  /** Short description, e.g. prompt text or filename */
  description: text("description"),
  /** Number of vector segments produced (if applicable) */
  segmentCount: int("segmentCount").default(0),
  /** URL of the generated/converted DXF file */
  dxfUrl: text("dxfUrl"),
  /** URL of the source image or AI-generated image */
  imageUrl: text("imageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserAction = typeof userActions.$inferSelect;
export type InsertUserAction = typeof userActions.$inferInsert;