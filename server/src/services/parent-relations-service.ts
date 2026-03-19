import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise'

export interface ParentProfileInput {
  fatherName: unknown
  motherName: unknown
  email: unknown
  whatsappNumber: unknown
  homePhone: unknown
  otherPhone: unknown
  homeAddress: unknown
  officeAddress: unknown
}

export interface ParentProfilePayload {
  fatherName: string
  motherName: string
  email: string | null
  whatsappNumber: string | null
  homePhone: string | null
  otherPhone: string | null
  homeAddress: string | null
  officeAddress: string | null
}

export type SqlExecutor = 
  | Pick<Pool, 'execute' | 'query'> 
  | Pick<PoolConnection, 'execute' | 'query'>

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const toNullable = (value: unknown): string | null => {
  const normalized = toText(value).trim()
  return normalized.length > 0 ? normalized : null
}

export const normalizeParentProfileInput = (
  input: ParentProfileInput,
): ParentProfilePayload => ({
  fatherName: toText(input.fatherName).trim(),
  motherName: toText(input.motherName).trim(),
  email: toNullable(input.email),
  whatsappNumber: toNullable(input.whatsappNumber),
  homePhone: toNullable(input.homePhone),
  otherPhone: toNullable(input.otherPhone),
  homeAddress: toNullable(input.homeAddress),
  officeAddress: toNullable(input.officeAddress),
})

export const hasParentProfileIdentity = (
  profile: ParentProfilePayload,
): boolean =>
  profile.fatherName.length > 0 ||
  profile.motherName.length > 0 ||
  profile.email !== null ||
  profile.whatsappNumber !== null ||
  profile.homePhone !== null ||
  profile.otherPhone !== null

const countQuery = async (
  executor: SqlExecutor,
  sql: string,
  values: unknown[] = [],
): Promise<number> => {
  const [rows] = (await executor.execute(sql, values)) as [RowDataPacket[], unknown]
  return Number(rows[0]?.count ?? 0)
}

const hasColumn = async (
  executor: SqlExecutor,
  tableName: string,
  columnName: string,
): Promise<boolean> =>
  (await countQuery(
    executor,
    `SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?`,
    [tableName, columnName],
  )) > 0

const hasIndex = async (
  executor: SqlExecutor,
  tableName: string,
  indexName: string,
): Promise<boolean> =>
  (await countQuery(
    executor,
    `SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?`,
    [tableName, indexName],
  )) > 0

const hasForeignKeyOnColumn = async (
  executor: SqlExecutor,
  tableName: string,
  columnName: string,
): Promise<boolean> =>
  (await countQuery(
    executor,
    `SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
      AND REFERENCED_TABLE_NAME = 'parent_profiles'`,
    [tableName, columnName],
  )) > 0

const ensureChildrenParentProfileColumn = async (
  executor: SqlExecutor,
): Promise<void> => {
  const exists = await hasColumn(executor, 'children', 'parent_profile_id')
  if (!exists) {
    await executor.execute(
      'ALTER TABLE children ADD COLUMN parent_profile_id BIGINT NULL',
    )
  }
}

const ensureChildrenParentProfileIndex = async (
  executor: SqlExecutor,
): Promise<void> => {
  const exists = await hasIndex(executor, 'children', 'idx_children_parent_profile_id')
  if (!exists) {
    await executor.execute(
      'ALTER TABLE children ADD INDEX idx_children_parent_profile_id (parent_profile_id)',
    )
  }
}

const ensureChildrenParentProfileForeignKey = async (
  executor: SqlExecutor,
): Promise<void> => {
  const exists = await hasForeignKeyOnColumn(executor, 'children', 'parent_profile_id')
  if (exists) {
    return
  }

  await executor.execute(
    `UPDATE children c
    LEFT JOIN parent_profiles p ON p.id = c.parent_profile_id
    SET c.parent_profile_id = NULL
    WHERE c.parent_profile_id IS NOT NULL
      AND p.id IS NULL`,
  )

  await executor.execute(
    `ALTER TABLE children
    ADD CONSTRAINT fk_children_parent_profile
    FOREIGN KEY (parent_profile_id)
    REFERENCES parent_profiles(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL`,
  )
}

const findParentProfileId = async (
  executor: SqlExecutor,
  profile: ParentProfilePayload,
): Promise<number | null> => {
  const [rows] = (await executor.execute(
    `SELECT id
    FROM parent_profiles
    WHERE father_name = ?
      AND mother_name = ?
      AND email <=> ?
      AND whatsapp_number <=> ?
      AND home_phone <=> ?
      AND other_phone <=> ?
      AND home_address <=> ?
      AND office_address <=> ?
    LIMIT 1`,
    [
      profile.fatherName,
      profile.motherName,
      profile.email,
      profile.whatsappNumber,
      profile.homePhone,
      profile.otherPhone,
      profile.homeAddress,
      profile.officeAddress,
    ],
  )) as [RowDataPacket[], unknown]

  const match = rows[0]
  if (!match) {
    return null
  }

  const parsedId = Number(match.id)
  return Number.isFinite(parsedId) ? parsedId : null
}

const insertParentProfile = async (
  executor: SqlExecutor,
  profile: ParentProfilePayload,
): Promise<number> => {
  const [result] = (await executor.execute(
    `INSERT INTO parent_profiles (
      father_name,
      mother_name,
      email,
      whatsapp_number,
      home_phone,
      other_phone,
      home_address,
      office_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.fatherName,
      profile.motherName,
      profile.email,
      profile.whatsappNumber,
      profile.homePhone,
      profile.otherPhone,
      profile.homeAddress,
      profile.officeAddress,
    ],
  )) as [ResultSetHeader, unknown]

  return result.insertId
}

export const resolveParentProfileId = async (
  executor: SqlExecutor,
  input: ParentProfileInput,
): Promise<number | null> => {
  const profile = normalizeParentProfileInput(input)
  if (!hasParentProfileIdentity(profile)) {
    return null
  }

  const existingId = await findParentProfileId(executor, profile)
  if (existingId) {
    return existingId
  }

  return insertParentProfile(executor, profile)
}

const ensureChildrenPickupPersonsColumn = async (
  executor: SqlExecutor,
): Promise<void> => {
  const exists = await hasColumn(executor, 'children', 'pickup_persons_json')
  if (!exists) {
    await executor.execute(
      'ALTER TABLE children ADD COLUMN pickup_persons_json LONGTEXT NULL AFTER outside_activities',
    )
  }
}

export const ensureParentRelationshipSchema = async (
  executor: SqlExecutor,
): Promise<void> => {
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS parent_profiles (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      father_name VARCHAR(160) NOT NULL DEFAULT '',
      mother_name VARCHAR(160) NOT NULL DEFAULT '',
      email VARCHAR(191) NULL,
      whatsapp_number VARCHAR(64) NULL,
      home_phone VARCHAR(64) NULL,
      other_phone VARCHAR(64) NULL,
      home_address TEXT NULL,
      office_address TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_parent_profiles_names (father_name, mother_name)
    )`,
  )

  await executor.execute(
    `CREATE TABLE IF NOT EXISTS parent_accounts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      parent_profile_id BIGINT NOT NULL,
      username VARCHAR(120) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_parent_accounts_parent_profile_id (parent_profile_id),
      UNIQUE KEY uq_parent_accounts_username (username),
      CONSTRAINT fk_parent_accounts_profile
        FOREIGN KEY (parent_profile_id)
        REFERENCES parent_profiles(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    )`,
  )

  await ensureChildrenParentProfileColumn(executor)
  await ensureChildrenParentProfileIndex(executor)
  await ensureChildrenParentProfileForeignKey(executor)
  await ensureChildrenPickupPersonsColumn(executor)
}
