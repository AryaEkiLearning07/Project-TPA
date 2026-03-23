import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const testConnection = async () => {
    console.log('Testing connection with:');
    console.log('Host:', process.env.DB_HOST || '127.0.0.1');
    console.log('User:', process.env.DB_USER || 'root');
    console.log('Port:', process.env.DB_PORT || 3306);
    console.log('DB:', process.env.DB_NAME || 'db_TPA');

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            connectTimeout: 10000 // 10 seconds
        });
        console.log('Connection established successfully!');
        await connection.end();
    } catch (err: any) {
        console.error('Connection failed:');
        console.error('Code:', err.code);
        console.error('Error No:', err.errno);
        console.error('SqlState:', err.sqlState);
        console.error('Message:', err.message);
        console.error('Full Error:', JSON.stringify(err, null, 2));
    }
};

testConnection();
