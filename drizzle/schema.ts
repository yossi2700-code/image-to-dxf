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
  /** Whether the email has been verified */
  emailVerified: int("emailVerified").default(0).notNull(),
  /** Max number of actions allowed (null = unlimited) */
  maxActions: int("maxActions").default(10),
  /** Token (credit) balance — starts at 20 for new users */
  tokenBalance: int("tokenBalance").default(20).notNull(),
  /** Whether this user is blocked from using the service */
  isBlocked: int("isBlocked").default(0).notNull(),
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
  /** SVG preview string for re-displaying the result */
  svgPreview: text("svgPreview"),
  /** Unique token for public sharing (null = not shared) */
  shareToken: varchar("shareToken", { length: 64 }).unique(),
  /** User-facing prompt/title for the shared design */
  shareTitle: varchar("shareTitle", { length: 200 }),
  /** Groups related variations from the same generation request (e.g. 3 AI variations) */
  groupId: varchar("groupId", { length: 64 }),
  /** Variation label within the group (e.g. 'simple', 'detailed', 'complex') */
  variationLabel: varchar("variationLabel", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserAction = typeof userActions.$inferSelect;
export type InsertUserAction = typeof userActions.$inferInsert;

// Email verification tokens
export const emailVerifications = mysqlTable("email_verifications", {
  id: int("id").autoincrement().primaryKey(),
  appUserId: int("appUserId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerification = typeof emailVerifications.$inferSelect;

// Password reset tokens
export const passwordResets = mysqlTable("password_resets", {
  id: int("id").autoincrement().primaryKey(),
  appUserId: int("appUserId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordReset = typeof passwordResets.$inferSelect;

// Token transactions — every debit/credit of tokens
export const tokenTransactions = mysqlTable("token_transactions", {
  id: int("id").autoincrement().primaryKey(),
  /** App user who owns the tokens */
  appUserId: int("appUserId").notNull(),
  /** Positive = credit (added), Negative = debit (spent) */
  amount: int("amount").notNull(),
  /** Reason: signup_bonus, ai_trace, ai_generate, ai_refine, convert, admin_add */
  reason: varchar("reason", { length: 64 }).notNull(),
  /** Optional description / reference */
  description: text("description"),
  /** Balance after this transaction */
  balanceAfter: int("balanceAfter").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TokenTransaction = typeof tokenTransactions.$inferSelect;
export type InsertTokenTransaction = typeof tokenTransactions.$inferInsert;