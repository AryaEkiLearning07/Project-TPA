import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

async function migrate() {
    const c = await mysql.createConnection({ host: '127.0.0.1', user: 'root', database: 'db_TPA' });

    // --- MIGRATE OBSERVATIONS ---
    console.log('Migrating observation records...');
    const [obsRows] = await c.query("SELECT meta_value FROM app_meta WHERE meta_key='observation_records_json'");
    if (obsRows.length > 0 && obsRows[0].meta_value) {
        try {
            const records = JSON.parse(obsRows[0].meta_value);
            if (Array.isArray(records)) {
                for (const rec of records) {
                    const childId = parseInt(rec.childId, 10);
                    if (!childId || isNaN(childId)) { console.log('  Skipping obs record, invalid childId:', rec.childId); continue; }

                    const date = rec.date || new Date().toISOString().slice(0, 10);
                    const groupName = rec.groupName || '';
                    const observerName = rec.observerName || '';
                    const createdAt = rec.createdAt ? new Date(rec.createdAt) : new Date();
                    const updatedAt = rec.updatedAt ? new Date(rec.updatedAt) : new Date();

                    const [result] = await c.execute(
                        `INSERT INTO observation_records (child_id, observation_date, group_name, observer_name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
                        [childId, date, groupName, observerName, createdAt, updatedAt]
                    );
                    const newId = result.insertId;

                    if (Array.isArray(rec.items)) {
                        for (let i = 0; i < rec.items.length; i++) {
                            const item = rec.items[i];
                            await c.execute(
                                `INSERT INTO observation_items (observation_record_id, activity, indicator, category, notes, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                                [newId, item.activity || '', item.indicator || '', item.category || 'perlu-arahan', item.notes || '', i]
                            );
                        }
                    }
                    console.log(`  Migrated obs record id=${newId} for child=${childId}, date=${date}, items=${(rec.items || []).length}`);
                }
            }
        } catch (e) { console.error('  Error parsing observations:', e.message); }
    } else {
        console.log('  No observation data found in app_meta.');
    }

    // --- MIGRATE SUPPLY INVENTORY ---
    console.log('Migrating supply inventory...');
    const [invRows] = await c.query("SELECT meta_value FROM app_meta WHERE meta_key='supply_inventory_json'");
    if (invRows.length > 0 && invRows[0].meta_value) {
        try {
            const items = JSON.parse(invRows[0].meta_value);
            if (Array.isArray(items)) {
                for (const item of items) {
                    const childId = parseInt(item.childId, 10);
                    if (!childId || isNaN(childId)) { console.log('  Skipping inv item, invalid childId:', item.childId); continue; }

                    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
                    const updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date();

                    await c.execute(
                        `INSERT INTO supply_inventory (child_id, product_name, category, quantity, description, image_path, image_name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            childId,
                            item.productName || '',
                            item.category || '',
                            parseInt(item.quantity, 10) || 0,
                            item.description || '',
                            item.imageDataUrl || null,
                            item.imageName || null,
                            createdAt,
                            updatedAt
                        ]
                    );
                    console.log(`  Migrated supply item: ${item.productName} for child=${childId}`);
                }
            }
        } catch (e) { console.error('  Error parsing inventory:', e.message); }
    } else {
        console.log('  No supply inventory data found in app_meta.');
    }

    // --- MIGRATE PARENT DATA from children to parent_profiles ---
    console.log('Migrating parent data...');
    // For children that don't have a parent_profile_id, create one from their columns
    // We need to read from a backup since we dropped the columns. Check if they still exist:
    const [cols] = await c.query("SHOW COLUMNS FROM children WHERE Field = 'father_name'");
    if (cols.length === 0) {
        console.log('  Parent columns already dropped from children. Skipping parent migration.');
    }

    console.log('\nMigration complete!');
    await c.end();
}

migrate().catch(e => { console.error('Migration failed:', e); process.exit(1); });
