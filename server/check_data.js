const mysql = require('mysql2/promise');
(async () => {
    const c = await mysql.createConnection({ host: '127.0.0.1', user: 'root', database: 'db_TPA' });
    const [obs] = await c.query("SELECT LENGTH(meta_value) AS len FROM app_meta WHERE meta_key='observation_records_json'");
    console.log('observation_records_json length:', obs[0]?.len || 0);
    const [inv] = await c.query("SELECT LENGTH(meta_value) AS len FROM app_meta WHERE meta_key='supply_inventory_json'");
    console.log('supply_inventory_json length:', inv[0]?.len || 0);
    const [cnt] = await c.query('SELECT COUNT(*) as cnt FROM children');
    console.log('children count:', cnt[0].cnt);
    const [pp] = await c.query('SELECT COUNT(*) as cnt FROM parent_profiles');
    console.log('parent_profiles count:', pp[0].cnt);
    await c.end();
})().catch(console.error);
