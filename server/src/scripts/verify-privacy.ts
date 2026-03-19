import { getAppData, maskSensitiveData } from '../services/app-data-service.js'

const verifyPrivacy = async () => {
    console.log('[Verify] Fetching real data...')
    const originalData = await getAppData()

    if (originalData.children.length === 0) {
        console.log('[Verify] No children found. Creating mock child for test.')
        originalData.children.push({
            id: 'test-1',
            fullName: 'Test Child',
            fatherName: 'Real Father',
            motherName: 'Real Mother',
            homeAddress: 'Real Address',
            homePhone: '08123456789',
            // ... fill other required fields with dummy data if needed, 
            // but maskSensitiveData only cares about the fields it masks.
            // We need to cast or mock specific fields.
        } as any)
    }

    console.log(`[Verify] Applying maskSensitiveData on ${originalData.children.length} children...`)
    const maskedData = maskSensitiveData(originalData)

    let success = true

    for (const child of maskedData.children) {
        const isMasked =
            child.fatherName === '[DISENSOR]' &&
            child.motherName === '[DISENSOR]' &&
            child.homeAddress === '[DISENSOR]' &&
            child.homePhone === '' &&
            child.email === ''

        // Pickup persons should NOT be masked
        const isPickupVisible = child.pickupPersons && Array.isArray(child.pickupPersons)

        if (!isMasked) {
            console.error(`[Verify] FAILURE: Child ${child.fullName} is NOT fully masked!`)
            console.error('Father:', child.fatherName)
            console.error('Phone:', child.homePhone)
            success = false
        }

        if (!isPickupVisible) {
            console.error(`[Verify] FAILURE: Child ${child.fullName} pickup persons are missing or invalid!`)
            success = false
        } else if (child.pickupPersons.length > 0 && child.pickupPersons[0] === '[DISENSOR]') {
            console.error(`[Verify] FAILURE: Child ${child.fullName} pickup persons are STILL MASKED!`)
            success = false
        }
    }

    if (success) {
        console.log('[Verify] SUCCESS: All children data is correctly masked.')
    } else {
        console.error('[Verify] FAILED: Some data leaked.')
        process.exit(1)
    }
}

verifyPrivacy().catch(console.error).then(() => process.exit(0))
