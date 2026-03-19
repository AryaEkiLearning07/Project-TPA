
import { hashPassword, verifyPassword } from '../utils/password.js';

const testBcrypt = async () => {
    try {
        const password = 'testpassword';
        console.log('Hashing...');
        const hash = await hashPassword(password);
        console.log('Hash:', hash);
        console.log('Verifying...');
        const match = await verifyPassword(password, hash);
        console.log('Match:', match);
    } catch (error) {
        console.error('Bcrypt error:', error);
    }
};

testBcrypt();
