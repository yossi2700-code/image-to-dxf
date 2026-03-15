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
  /** Processing duration in milliseconds (null for old records) */
  durationMs: int("durationMs"),
  /** Output file size in kilobytes (null for old records) */
  fileSizeKb: int("fileSizeKb"),
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
  /** Token (credit) balance — starts at 10 for new users */
  tokenBalance: int("tokenBalance").default(10).notNull(),
  /** Whether this user is blocked from using the service */
  isBlocked: int("isBlocked").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt").defaultNow().notNull(),
  /** Timestamp when the 48h bonus reminder email was sent (null = not sent yet) */
  reminderSentAt: bigint("reminderSentAt", { mode: "number" }),
  /** Preferred language for emails: he or en */
  language: varchar("language", { length: 8 }).default("he"),
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
  /** URL of the original uploaded image (for AI from Image feature) */
  sourceImageUrl: text("sourceImageUrl"),
  /** Feature/category: convert | ai_trace | ai_generate | portrait | document_redraw */
  feature: varchar("feature", { length: 32 }),
  /** Processing duration in milliseconds */
  durationMs: int("durationMs"),
  /** Anonymized IP address (last octet removed) */
  ipAnon: varchar("ipAnon", { length: 20 }),
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

// System settings — key/value store for global app configuration
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SystemSetting = typeof systemSettings.$inferSelect;

// Consent records — tracks user agreement to Terms of Service and Privacy Policy
export const consentRecords = mysqlTable("consent_records", {
  id: int("id").autoincrement().primaryKey(),
  /** App user ID (null for anonymous users who accepted before registering) */
  appUserId: int("appUserId"),
  /** Email at time of consent (for pre-registration consent) */
  email: varchar("email", { length: 320 }),
  /** Version of Terms of Service accepted */
  termsVersion: varchar("termsVersion", { length: 32 }).notNull().default("2026-03-10"),
  /** Version of Privacy Policy accepted */
  privacyVersion: varchar("privacyVersion", { length: 32 }).notNull().default("2026-03-10"),
  /** Anonymized IP address at time of consent */
  ipAnon: varchar("ipAnon", { length: 20 }),
  /** User agent string */
  userAgent: text("userAgent"),
  /** Timestamp of consent */
  consentAt: timestamp("consentAt").defaultNow().notNull(),
});

export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertConsentRecord = typeof consentRecords.$inferInsert;
// PayPal orders — tracks token purchases
export const paypalOrders = mysqlTable("paypal_orders", {
  id: int("id").autoincrement().primaryKey(),
  /** App user who made the purchase */
  appUserId: int("appUserId").notNull(),
  /** PayPal order ID returned from createOrder */
  paypalOrderId: varchar("paypalOrderId", { length: 64 }).notNull().unique(),
  /** Package: "tokens_50" or "tokens_100" */
  packageId: varchar("packageId", { length: 16 }).notNull(),
  /** Legacy package key column (kept for DB compatibility) */
  packageKey: varchar("packageKey", { length: 64 }),
  /** Number of tokens purchased */
  tokenAmount: int("tokenAmount").notNull(),
  /** Legacy amount in cents (kept for DB compatibility) */
  amountCents: int("amountCents"),
  /** Amount charged */
  priceAmount: varchar("priceAmount", { length: 16 }).notNull(),
  /** Currency code (USD, EUR, ILS, etc.) */
  currency: varchar("currency", { length: 8 }).notNull(),
  /** Status: pending | completed | cancelled | failed */
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  /** PayPal capture ID */
  captureId: varchar("captureId", { length: 64 }),
  /** Whether tokens have been credited (0/1) */
  tokensCredited: int("tokensCredited").notNull().default(0),
  /** User IP (anonymized) */
  ipAnon: varchar("ipAnon", { length: 20 }),
  /** Legacy purchase terms field */
  purchaseTermsAccepted: int("purchaseTermsAccepted").default(0),
  /** User accepted purchase terms (0/1) */
  termsAccepted: int("termsAccepted").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type PaypalOrder = typeof paypalOrders.$inferSelect;
export type InsertPaypalOrder = typeof paypalOrders.$inferInsert;

// Package prices — admin-configurable pricing per package
export const packagePrices = mysqlTable("package_prices", {
  id: int("id").autoincrement().primaryKey(),
  /** Package identifier: "tokens_50" or "tokens_100" */
  packageId: varchar("packageId", { length: 32 }).notNull().unique(),
  /** Number of tokens in this package */
  tokenAmount: int("tokenAmount").notNull(),
  /** Base price in USD */
  priceUSD: varchar("priceUSD", { length: 16 }).notNull(),
  /** Price in EUR */
  priceEUR: varchar("priceEUR", { length: 16 }).notNull(),
  /** Price in ILS (Israeli Shekel) */
  priceILS: varchar("priceILS", { length: 16 }).notNull(),
  /** Price in GBP */
  priceGBP: varchar("priceGBP", { length: 16 }).notNull(),
  /** Price in AUD */
  priceAUD: varchar("priceAUD", { length: 16 }).notNull(),
  /** Price in CAD */
  priceCAD: varchar("priceCAD", { length: 16 }).notNull(),
  /** Price in JPY */
  priceJPY: varchar("priceJPY", { length: 16 }).notNull(),
  /** Whether this package is active/visible */
  isActive: int("isActive").notNull().default(1),
  /** Comma-separated list of enabled currencies, e.g. "USD,EUR,ILS,GBP" — null means all enabled */
  enabledCurrencies: varchar("enabledCurrencies", { length: 128 }),
  /** Display label (e.g. "Starter", "Pro") */
  label: varchar("label", { length: 64 }),
  /** Discount percentage (0-100). When set, shows original price crossed out + discounted price */
  discountPercent: int("discountPercent").default(0),
  /** Badge label: null | 'recommended' | 'best_value' | 'sale' | 'trial' */
  badge: mysqlEnum("badge", ["recommended", "best_value", "sale", "trial"]),
  /** Optional illustration image URL for the package card */
  imageUrl: varchar("imageUrl", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PackagePrice = typeof packagePrices.$inferSelect;
export type InsertPackagePrice = typeof packagePrices.$inferInsert;

// Token costs per action — admin-configurable
export const tokenCosts = mysqlTable("token_costs", {
  id: int("id").autoincrement().primaryKey(),
  /** Action identifier: ai_trace | ai_generate | ai_refine | face_detect | convert */
  action: varchar("action", { length: 32 }).notNull().unique(),
  /** Number of tokens this action costs */
  cost: int("cost").notNull().default(0),
  /** Human-readable label (legacy) */
  label: varchar("label", { length: 64 }),
  /** Hebrew label shown in pricing tab */
  labelHe: varchar("labelHe", { length: 64 }),
  /** English label shown in pricing tab */
  labelEn: varchar("labelEn", { length: 64 }),
  /** Hebrew description */
  descriptionHe: varchar("descriptionHe", { length: 200 }),
  /** English description */
  descriptionEn: varchar("descriptionEn", { length: 200 }),
  /** Sort order for display */
  sortOrder: int("sortOrder").notNull().default(0),
  /** Whether this action is currently enabled */
  isEnabled: int("isEnabled").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TokenCost = typeof tokenCosts.$inferSelect;
export type InsertTokenCost = typeof tokenCosts.$inferInsert;

// Campaign redemptions — tracks which users already claimed a campaign bonus
export const campaignRedemptions = mysqlTable("campaign_redemptions", {
  id: int("id").autoincrement().primaryKey(),
  /** Campaign code (e.g. "email_bonus_2026_03") */
  campaignCode: varchar("campaignCode", { length: 64 }).notNull(),
  /** App user who redeemed the bonus */
  appUserId: int("appUserId").notNull(),
  /** Number of tokens awarded */
  tokensAwarded: int("tokensAwarded").notNull().default(15),
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
});
export type CampaignRedemption = typeof campaignRedemptions.$inferSelect;
export type InsertCampaignRedemption = typeof campaignRedemptions.$inferInsert;

// Subscription plans — admin-configurable plans with daily conversion limits
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  /** Internal identifier, e.g. "basic", "pro" */
  planId: varchar("planId", { length: 32 }).notNull().unique(),
  /** Display name, e.g. "בסיסי", "מקצועי" */
  name: varchar("name", { length: 64 }).notNull(),
  /** Number of conversions allowed per day */
  dailyConversions: int("dailyConversions").notNull(),
  /** Price in ILS per month */
  priceILS: varchar("priceILS", { length: 16 }).notNull(),
  /** Price in USD per month */
  priceUSD: varchar("priceUSD", { length: 16 }).notNull(),
  /** Optional discount percentage (0-100) */
  discountPercent: int("discountPercent").default(0),
  /** Badge: null | 'recommended' | 'best_value' | 'sale' */
  badge: mysqlEnum("badge", ["recommended", "best_value", "sale"]),
  /** Whether this plan is active/visible */
  isActive: int("isActive").notNull().default(1),
  /** Sort order for display */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// User subscriptions — active subscription per user
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  appUserId: int("appUserId").notNull(),
  planId: varchar("planId", { length: 32 }).notNull(),
  /** Status: active | cancelled | expired */
  status: varchar("status", { length: 16 }).notNull().default("active"),
  /** When the current billing period started */
  periodStart: timestamp("periodStart").notNull(),
  /** When the current billing period ends */
  periodEnd: timestamp("periodEnd").notNull(),
  /** PayPal subscription ID or manual */
  paypalSubscriptionId: varchar("paypalSubscriptionId", { length: 64 }),
  /** Notes from admin */
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// Daily usage tracking — tracks daily conversions per user for subscription quota
export const dailyUsage = mysqlTable("daily_usage", {
  id: int("id").autoincrement().primaryKey(),
  appUserId: int("appUserId").notNull(),
  /** Date in YYYY-MM-DD format */
  usageDate: varchar("usageDate", { length: 10 }).notNull(),
  /** Number of conversions used today */
  conversionsUsed: int("conversionsUsed").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DailyUsage = typeof dailyUsage.$inferSelect;
export type InsertDailyUsage = typeof dailyUsage.$inferInsert;

// Bug reports — tracks failed conversions for admin review
export const bugReports = mysqlTable("bug_reports", {
  id: int("id").autoincrement().primaryKey(),
  appUserId: int("appUserId"),
  /** Type of failure: convert_failed | ai_failed | download_failed */
  errorType: varchar("errorType", { length: 32 }).notNull(),
  /** Error message */
  errorMessage: text("errorMessage"),
  /** Feature that failed */
  feature: varchar("feature", { length: 32 }),
  /** URL of the image that failed (if any) */
  imageUrl: text("imageUrl"),
  /** Status: new | investigating | resolved | ignored */
  status: varchar("status", { length: 16 }).notNull().default("new"),
  /** Admin notes */
  adminNote: text("adminNote"),
  /** User IP (anonymized) */
  ipAnon: varchar("ipAnon", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BugReport = typeof bugReports.$inferSelect;
export type InsertBugReport = typeof bugReports.$inferInsert;

// News/updates items — admin-editable news widget on homepage
export const newsItems = mysqlTable("news_items", {
  id: int("id").autoincrement().primaryKey(),
  /** Title of the news item */
  title: varchar("title", { length: 200 }).notNull(),
  /** Content/body */
  content: text("content").notNull(),
  /** Optional emoji or icon */
  emoji: varchar("emoji", { length: 8 }),
  /** Whether this item is published/visible */
  isPublished: int("isPublished").notNull().default(1),
  /** Sort order (higher = shown first) */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NewsItem = typeof newsItems.$inferSelect;
export type InsertNewsItem = typeof newsItems.$inferInsert;

// Admin tasks / todo list — private notes for the admin dashboard
export const adminTasks = mysqlTable("admin_tasks", {
  id: int("id").autoincrement().primaryKey(),
  /** Task text */
  text: varchar("text", { length: 500 }).notNull(),
  /** Whether the task is completed */
  isDone: int("isDone").notNull().default(0),
  /** Optional priority: 0=normal, 1=high, 2=urgent */
  priority: int("priority").notNull().default(0),
  /** Sort order */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AdminTask = typeof adminTasks.$inferSelect;
export type InsertAdminTask = typeof adminTasks.$inferInsert;

// Failed jobs log — for admin debugging
export const failedJobs = mysqlTable("failed_jobs", {
  id: int("id").autoincrement().primaryKey(),
  /** App user who triggered the job (null for anonymous) */
  appUserId: int("appUserId"),
  /** Feature that failed: ai_trace, portrait, document_redraw, ai_generate */
  feature: varchar("feature", { length: 64 }).notNull(),
  /** How long the job ran before failing (milliseconds) */
  durationMs: int("durationMs").notNull().default(0),
  /** Error message from the caught exception */
  errorMessage: text("errorMessage"),
  /** Source image URL (S3) if available */
  sourceImageUrl: text("sourceImageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FailedJob = typeof failedJobs.$inferSelect;
export type InsertFailedJob = typeof failedJobs.$inferInsert;
