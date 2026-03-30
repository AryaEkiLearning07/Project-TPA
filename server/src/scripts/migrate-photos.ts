import { dbPool } from '../config/database.js'
import { saveBase64ToDisk } from '../utils/base64-storage.js'
import type { RowDataPacket } from 'mysql2/promise'
import { parseSupplyInventoryJson, toDbSupplyInventoryJson } from '../utils/data-mappers.js'

const hasTable = async (tableName: string): Promise<boolean> => {
    const [rows] = await dbPool.query<RowDataPacket[]>(
        `SELECT 1
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
         LIMIT 1`,
        [tableName]
    )
    return rows.length > 0
}

const hasColumn = async (tableName: string, columnName: string): Promise<boolean> => {
    const [rows] = await dbPool.query<RowDataPacket[]>(
        `SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
    )
    return rows.length > 0
}

async function migrateChildren() {
    console.log('Migrating children photos...')
    if (!(await hasTable('children'))) {
        console.log('Skip children migration: table children not found.')
        return
    }

    const photoColumn = await hasColumn('children', 'photo_path')
        ? 'photo_path'
        : await hasColumn('children', 'photo_data')
            ? 'photo_data'
            : ''

    if (!photoColumn) {
        console.log('Skip children migration: no photo_path/photo_data column found.')
        return
    }

    const [rows] = await dbPool.query<RowDataPacket[]>(
        `SELECT id, ${photoColumn} AS photo_value
         FROM children
         WHERE ${photoColumn} IS NOT NULL`
    )
    let count = 0
    for (const row of rows) {
        const photoValue = typeof row.photo_value === 'string' ? row.photo_value : ''
        if (photoValue.startsWith('data:image')) {
            const path = await saveBase64ToDisk(photoValue, 'child')
            await dbPool.execute(`UPDATE children SET ${photoColumn} = ? WHERE id = ?`, [path, row.id])
            count++
        }
    }
    console.log(`Migrated ${count} children photos.`)
}

async function migrateInventory() {
    console.log('Migrating inventory images...')
    if (!(await hasTable('app_meta'))) {
        console.log('Skip inventory migration: table app_meta not found.')
        return
    }
    if (!(await hasColumn('app_meta', 'meta_key')) || !(await hasColumn('app_meta', 'meta_value'))) {
        console.log('Skip inventory migration: app_meta schema does not match legacy format.')
        return
    }

    const [rows] = await dbPool.query<RowDataPacket[]>('SELECT meta_value FROM app_meta WHERE meta_key = "supply_inventory_json"')
    if (rows.length === 0 || !rows[0].meta_value) return

    const items = parseSupplyInventoryJson(rows[0].meta_value)
    let count = 0
    for (const item of items) {
        if (item.imageDataUrl && item.imageDataUrl.startsWith('data:image')) {
            item.imageDataUrl = await saveBase64ToDisk(item.imageDataUrl, 'inventory')
            count++
        }
    }

    if (count > 0) {
        await dbPool.execute(
            'UPDATE app_meta SET meta_value = ? WHERE meta_key = "supply_inventory_json"',
            [toDbSupplyInventoryJson(items)]
        )
    }
    console.log(`Migrated ${count} inventory images.`)
}

async function migrateAttendance() {
    console.log('Migrating attendance signatures and item photos...')
    if (!(await hasTable('attendance_records'))) {
        console.log('Skip attendance migration: table attendance_records not found.')
        return
    }

    const [rows] = await dbPool.query<RowDataPacket[]>('SELECT id, escort_signature_data, pickup_signature_data, notes FROM attendance_records')
    let countSig = 0
    let countItems = 0

    for (const row of rows) {
        let updateNeeded = false
        const updates: Record<string, string> = {}

        if (row.escort_signature_data && row.escort_signature_data.startsWith('data:image')) {
            updates.escort_signature_data = await saveBase64ToDisk(row.escort_signature_data, 'sig_escort')
            updateNeeded = true
            countSig++
        }

        if (row.pickup_signature_data && row.pickup_signature_data.startsWith('data:image')) {
            updates.pickup_signature_data = await saveBase64ToDisk(row.pickup_signature_data, 'sig_pickup')
            updateNeeded = true
            countSig++
        }

        if (row.notes) {
            try {
                const notes = JSON.parse(row.notes)
                if (notes.carriedItems && Array.isArray(notes.carriedItems)) {
                    for (const item of notes.carriedItems) {
                        if (item.imageDataUrl && item.imageDataUrl.startsWith('data:image')) {
                            item.imageDataUrl = await saveBase64ToDisk(item.imageDataUrl, 'item')
                            updateNeeded = true
                            countItems++
                        }
                    }
                }
                if (updateNeeded) {
                    updates.notes = JSON.stringify(notes)
                }
            } catch (e) {
                console.error(`Error parsing notes for attendance ${row.id}:`, e)
            }
        }

        if (updateNeeded) {
            const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ')
            const values = Object.values(updates)
            await dbPool.execute(`UPDATE attendance_records SET ${setClause} WHERE id = ?`, [...values, row.id])
        }
    }
    console.log(`Migrated ${countSig} signatures and ${countItems} item photos in attendance.`)
}

async function migrateIncidents() {
    console.log('Migrating incident group photos, signatures, and meal equipment...')
    if (!(await hasTable('incident_reports'))) {
        console.log('Skip incident migration: table incident_reports not found.')
        return
    }

    const [rows] = await dbPool.query<RowDataPacket[]>('SELECT id, arrival_signature_data, departure_signature_data, items_json, meal_equipment_json FROM incident_reports')
    let countSig = 0
    let countGroup = 0
    let countMeal = 0

    for (const row of rows) {
        let updateNeeded = false
        const updates: Record<string, string> = {}

        if (row.arrival_signature_data && row.arrival_signature_data.startsWith('data:image')) {
            updates.arrival_signature_data = await saveBase64ToDisk(row.arrival_signature_data, 'sig_arrival')
            updateNeeded = true
            countSig++
        }

        if (row.departure_signature_data && row.departure_signature_data.startsWith('data:image')) {
            updates.departure_signature_data = await saveBase64ToDisk(row.departure_signature_data, 'sig_departure')
            updateNeeded = true
            countSig++
        }

        if (row.items_json) {
            try {
                const itemsJson = JSON.parse(row.items_json)
                if (itemsJson.groupPhotoDataUrl && itemsJson.groupPhotoDataUrl.startsWith('data:image')) {
                    itemsJson.groupPhotoDataUrl = await saveBase64ToDisk(itemsJson.groupPhotoDataUrl, 'incident_group')
                    updateNeeded = true
                    countGroup++
                }
                if (updateNeeded) {
                    updates.items_json = JSON.stringify(itemsJson)
                }
            } catch (e) {
                console.error(`Error parsing items_json for incident ${row.id}:`, e)
            }
        }

        if (row.meal_equipment_json) {
            try {
                const me = JSON.parse(row.meal_equipment_json)
                const categories = ['drinkingBottle', 'milkBottle', 'mealContainer', 'snackContainer']
                let meUpdate = false
                for (const cat of categories) {
                    if (me[cat] && me[cat].imageDataUrl && me[cat].imageDataUrl.startsWith('data:image')) {
                        me[cat].imageDataUrl = await saveBase64ToDisk(me[cat].imageDataUrl, 'meal_' + cat.toLowerCase())
                        updateNeeded = true
                        meUpdate = true
                        countMeal++
                    }
                }
                if (meUpdate) {
                    updates.meal_equipment_json = JSON.stringify(me)
                }
            } catch (e) {
                console.error(`Error parsing meal_equipment_json for incident ${row.id}:`, e)
            }
        }

        if (updateNeeded) {
            const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ')
            const values = Object.values(updates)
            await dbPool.execute(`UPDATE incident_reports SET ${setClause} WHERE id = ?`, [...values, row.id])
        }
    }
    console.log(`Migrated ${countSig} signatures, ${countGroup} group photos, and ${countMeal} meal photos in incidents.`)
}

async function migrateLandingAnnouncementImages() {
    console.log('Migrating landing announcement cover images...')
    if (!(await hasTable('landing_announcements')) || !(await hasColumn('landing_announcements', 'cover_image_data_url'))) {
        console.log('Skip landing announcement migration: table/column not found.')
        return
    }

    const [rows] = await dbPool.query<RowDataPacket[]>(
        `SELECT id, cover_image_data_url
         FROM landing_announcements
         WHERE cover_image_data_url LIKE 'data:image%'`
    )

    let count = 0
    for (const row of rows) {
        const rawImage = typeof row.cover_image_data_url === 'string' ? row.cover_image_data_url : ''
        if (!rawImage.startsWith('data:image')) {
            continue
        }

        const imagePath = await saveBase64ToDisk(rawImage, 'landing_announcement')
        await dbPool.execute(
            'UPDATE landing_announcements SET cover_image_data_url = ? WHERE id = ?',
            [imagePath, row.id]
        )
        count++
    }

    console.log(`Migrated ${count} landing announcement cover images.`)
}

async function migrateBillingPaymentProofs() {
    console.log('Migrating service billing payment proofs...')
    if (!(await hasTable('service_billing_transactions')) || !(await hasColumn('service_billing_transactions', 'payment_proof_data_url'))) {
        console.log('Skip billing migration: table/column not found.')
        return
    }

    const [rows] = await dbPool.query<RowDataPacket[]>(
        `SELECT id, payment_proof_data_url
         FROM service_billing_transactions
         WHERE payment_proof_data_url LIKE 'data:image%'`
    )

    let count = 0
    for (const row of rows) {
        const rawProof = typeof row.payment_proof_data_url === 'string' ? row.payment_proof_data_url : ''
        if (!rawProof.startsWith('data:image')) {
            continue
        }

        const proofPath = await saveBase64ToDisk(rawProof, 'billing_proof')
        await dbPool.execute(
            'UPDATE service_billing_transactions SET payment_proof_data_url = ? WHERE id = ?',
            [proofPath, row.id]
        )
        count++
    }

    console.log(`Migrated ${count} billing payment proof images.`)
}

async function main() {
    try {
        await migrateChildren()
        await migrateInventory()
        await migrateAttendance()
        await migrateIncidents()
        await migrateLandingAnnouncementImages()
        await migrateBillingPaymentProofs()
        console.log('Migration completed successfully.')
    } catch (error) {
        console.error('Migration failed:', error)
    } finally {
        await dbPool.end()
        process.exit(0)
    }
}

main()
