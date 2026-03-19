import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'e:/Project TPA/server/.env' });

async function test() {
  console.log('Testing connection to:', process.env.DB_HOST, ':', process.env.DB_PORT);
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log('Connection successful!');
    await connection.end();
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

test();
