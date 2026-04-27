import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [users] = await conn.execute('SELECT COUNT(*) as cnt FROM app_users');
const [clicks] = await conn.execute('SELECT COUNT(*) as cnt FROM user_click_events');
const [sampleClicks] = await conn.execute('SELECT * FROM user_click_events LIMIT 5');
console.log('Total users:', users[0].cnt);
console.log('Total clicks:', clicks[0].cnt);
console.log('Sample clicks:', JSON.stringify(sampleClicks, null, 2));
await conn.end();
