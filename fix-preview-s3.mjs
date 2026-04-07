import { storagePut } from "./server/storage.ts";
import { getDb } from "./server/db.ts";
import { sharedFiles } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import fs from "fs";

const pngBuffer = fs.readFileSync("/tmp/lion-preview.png");
console.log("PNG size:", pngBuffer.length, "bytes");

const key = `freedxf-previews/lion-${Date.now()}.png`;
const { url } = await storagePut(key, pngBuffer, "image/png");
console.log("Uploaded to S3:", url);

const db = await getDb();
await db.update(sharedFiles).set({ previewImageUrl: url }).where(eq(sharedFiles.id, 1));
console.log("Updated DB with URL:", url);

// Verify
const [file] = await db.select({ id: sharedFiles.id, previewImageUrl: sharedFiles.previewImageUrl }).from(sharedFiles).where(eq(sharedFiles.id, 1)).limit(1);
console.log("Verified:", file);
process.exit(0);
