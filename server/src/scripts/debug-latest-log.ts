
import { dbPool } from '../config/database.js';

const checkLogs = async () => {
    try {
        const [rows] = await dbPool.execute('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 5');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error querying logs:', error);
    } finally {
        process.exit();
    }
};

checkLogs();
