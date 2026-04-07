// Fix the existing shared file by setting the previewImageUrl
// Uses the project's database connection via tsx

import { getDb } from "./server/db.ts";
import { sharedFiles } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const PREVIEW_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/lion-preview_b80c1f3c.png";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to database");
    process.exit(1);
  }
  
  const result = await db
    .update(sharedFiles)
    .set({ previewImageUrl: PREVIEW_URL })
    .where(eq(sharedFiles.id, 1));
  
  console.log("Updated shared file #1 with preview URL");
  console.log("Result:", result);
  
  // Verify
  const [file] = await db
    .select({ id: sharedFiles.id, previewImageUrl: sharedFiles.previewImageUrl })
    .from(sharedFiles)
    .where(eq(sharedFiles.id, 1))
    .limit(1);
  
  console.log("Verified:", file);
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
