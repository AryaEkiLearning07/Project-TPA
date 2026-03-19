import { dbPool } from '../config/database.js'
import type { RowDataPacket } from 'mysql2/promise'

const CLEANUP_OLDER_THAN_DAYS = 30

const cleanupIncidentPhotos = async () => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_OLDER_THAN_DAYS)
    const cutoffIso = cutoffDate.toISOString().slice(0, 10) // YYYY-MM-DD

    console.log(`[Cleanup] Target cut-off date: ${cutoffIso}`)

    // 1. Get incidents older than cutoff
    const [rows] = (await dbPool.query(
        `SELECT id, items_json FROM incident_reports 
     WHERE incident_datetime < ? 
     AND items_json LIKE '%DataUrl%'`,
        [cutoffIso],
    )) as [RowDataPacket[], unknown]

    console.log(`[Cleanup] Found ${rows.length} incident reports to check.`)

    let updatedCount = 0

    for (const row of rows) {
        try {
            const json = JSON.parse(row.items_json)
            let modified = false

            // Check groupPhotoDataUrl
            if (json.groupPhotoDataUrl && json.groupPhotoDataUrl.length > 100) {
                json.groupPhotoDataUrl = ''
                modified = true
            }

            // Check carriedItemsPhotoDataUrl (legacy key)
            if (
                json.carriedItemsPhotoDataUrl &&
                json.carriedItemsPhotoDataUrl.length > 100
            ) {
                json.carriedItemsPhotoDataUrl = ''
                modified = true
            }

            if (modified) {
                await dbPool.query(
                    'UPDATE incident_reports SET items_json = ? WHERE id = ?',
                    [JSON.stringify(json), row.id],
                )
                updatedCount++
            }
        } catch (err) {
            console.error(`[Cleanup] Error processing row ${row.id}:`, err)
        }
    }

    console.log(`[Cleanup] Successfully removed photos from ${updatedCount} reports.`)
}

const main = async () => {
    try {
        console.log('[Cleanup] Starting data cleanup...')
        await cleanupIncidentPhotos()
        console.log('[Cleanup] Done.')
        process.exit(0)
    } catch (error) {
        console.error('[Cleanup] Fatal error:', error)
        process.exit(1)
    }
}

main()
