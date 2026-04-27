import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) { console.log("No DATABASE_URL"); process.exit(1); }

const conn = await createConnection(url);
const [rows] = await conn.query("SHOW TABLES LIKE 'user_click_events'");
console.log("Table exists:", rows.length > 0 ? "YES" : "NO - TABLE MISSING");

if (rows.length > 0) {
  const [cols] = await conn.query("DESCRIBE user_click_events");
  console.log("Columns:", JSON.stringify(cols.map(c => c.Field)));
  const [count] = await conn.query("SELECT COUNT(*) as cnt FROM user_click_events");
  console.log("Row count:", count[0].cnt);
}
await conn.end();
