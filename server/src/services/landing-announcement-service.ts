import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import { saveBase64ToDisk } from '../utils/base64-storage.js'

type SqlExecutor = Pick<Pool, 'execute'> | Pick<PoolConnection, 'execute'>

const LANDING_ANNOUNCEMENT_CATEGORIES = [
  'event',
  'dokumentasi',
  'galeri',
  'fasilitas',
  'tim',
  'promosi',
  'ucapan',
] as const
const LANDING_ANNOUNCEMENT_STATUSES = [
  'draft',
  'published',
  'archived',
] as const
const LANDING_ANNOUNCEMENT_DISPLAY_MODES = [
  'section',
  'hero',
  'popup',
] as const

const LANDING_ANNOUNCEMENT_CATEGORY_ALIASES: Record<string, LandingAnnouncementCategory> = {
  team: 'tim',
  staff: 'tim',
  petugas: 'tim',
  'tim kami': 'tim',
  'tim-kami': 'tim',
  'profil petugas': 'tim',
  'profil-petugas': 'tim',
}

export type LandingAnnouncementCategory = (typeof LANDING_ANNOUNCEMENT_CATEGORIES)[number]
export type LandingAnnouncementStatus = (typeof LANDING_ANNOUNCEMENT_STATUSES)[number]
export type LandingAnnouncementDisplayMode = (typeof LANDING_ANNOUNCEMENT_DISPLAY_MODES)[number]

export interface LandingAnnouncement {
  id: string
  slug: string
  title: string
  category: LandingAnnouncementCategory
  displayMode: LandingAnnouncementDisplayMode
  excerpt: string
  content: string
  coverImageDataUrl: string
  coverImageName: string
  ctaLabel: string
  ctaUrl: string
  publishStartDate: string
  publishEndDate: string
  status: LandingAnnouncementStatus
  isPinned: boolean
  publishedAt: string
  authorName: string
  authorEmail: string
  createdAt: string
  updatedAt: string
}

export interface LandingAnnouncementInput {
  title: string
  slug?: string
  category: LandingAnnouncementCategory
  displayMode?: LandingAnnouncementDisplayMode
  excerpt?: string
  content?: string
  coverImageDataUrl?: string
  coverImageName?: string
  ctaLabel?: string
  ctaUrl?: string
  publishStartDate?: string
  publishEndDate?: string
  status?: LandingAnnouncementStatus
  isPinned?: boolean
  authorName?: string
  authorEmail?: string
}

interface LandingAnnouncementRow extends RowDataPacket {
  id: number
  slug: string
  title: string
  category: string
  display_mode: string | null
  excerpt: string | null
  content: string | null
  cover_image_data_url: string | null
  cover_image_name: string | null
  cta_label: string | null
  cta_url: string | null
  publish_start_date: string | Date | null
  publish_end_date: string | Date | null
  status: string
  is_pinned: number
  published_at: string | Date | null
  author_name: string | null
  author_email: string | null
  created_at: string | Date
  updated_at: string | Date
}

interface LandingTeamStaffRow extends RowDataPacket {
  id: number
  full_name: string | null
  staff_photo_data_url: string | null
  staff_photo_name: string | null
  staff_description: string | null
  created_at: string | Date
  updated_at: string | Date
}

export class LandingAnnouncementError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'LandingAnnouncementError'
    this.status = status
  }
}

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const normalizeImageAssetUrl = (value: unknown): string => {
  const normalized = toText(value).trim()
  if (!normalized) return ''
  if (normalized.startsWith('data:image/')) return normalized
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (normalized.startsWith('/landing-media/')) return normalized
  if (normalized.startsWith('landing-media/')) return `/${normalized}`
  if (normalized.startsWith('/uploads/')) {
    return `/landing-media/${normalized.slice('/uploads/'.length)}`
  }
  if (normalized.startsWith('uploads/')) {
    return `/landing-media/${normalized.slice('uploads/'.length)}`
  }
  return ''
}

const normalizeImageStorageReference = (value: unknown): string => {
  const normalized = toText(value).trim()
  if (!normalized) return ''
  if (normalized.startsWith('data:image/')) return normalized
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (normalized.startsWith('/landing-media/')) {
    return `uploads/${normalized.slice('/landing-media/'.length)}`
  }
  if (normalized.startsWith('landing-media/')) {
    return `uploads/${normalized.slice('landing-media/'.length)}`
  }
  if (normalized.startsWith('/uploads/')) return normalized.slice(1)
  if (normalized.startsWith('uploads/')) return normalized
  return ''
}

const toIsoDateTime = (value: Date | string | null | undefined): string => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString()
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withTimezone = /Z|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`
  const parsed = new Date(withTimezone)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toISOString()
}

const toDateKey = (value: Date | string | null | undefined): string => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  const normalized = toText(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString().slice(0, 10)
}

const toDbDateTime = (value: Date | string | null): string | null => {
  if (!value) {
    return null
  }
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  const yyyy = String(parsed.getUTCFullYear())
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getUTCDate()).padStart(2, '0')
  const hh = String(parsed.getUTCHours()).padStart(2, '0')
  const mi = String(parsed.getUTCMinutes()).padStart(2, '0')
  const ss = String(parsed.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

const toNullableTrimmedText = (value: unknown, maxLength: number): string | null => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return null
  }
  return normalized.slice(0, maxLength)
}

const toNullableDateKey = (value: unknown): string | null => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return null
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new LandingAnnouncementError(400, 'Format tanggal pengumuman harus YYYY-MM-DD.')
  }
  return normalized
}

const isLandingAnnouncementCategory = (value: unknown): value is LandingAnnouncementCategory =>
  LANDING_ANNOUNCEMENT_CATEGORIES.some((item) => item === value)

const normalizeLandingAnnouncementCategory = (
  value: unknown,
): LandingAnnouncementCategory | null => {
  const normalized = toText(value).trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (isLandingAnnouncementCategory(normalized)) {
    return normalized
  }

  return LANDING_ANNOUNCEMENT_CATEGORY_ALIASES[normalized] ?? null
}

const isLandingAnnouncementStatus = (value: unknown): value is LandingAnnouncementStatus =>
  LANDING_ANNOUNCEMENT_STATUSES.some((item) => item === value)

const isLandingAnnouncementDisplayMode = (value: unknown): value is LandingAnnouncementDisplayMode =>
  LANDING_ANNOUNCEMENT_DISPLAY_MODES.some((item) => item === value)

const sanitizeSlugFragment = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')

const buildSlug = (title: string, preferred?: string): string => {
  const fromPreferred = sanitizeSlugFragment(toText(preferred))
  if (fromPreferred) {
    return fromPreferred.slice(0, 140)
  }

  const fromTitle = sanitizeSlugFragment(title)
  if (fromTitle) {
    return fromTitle.slice(0, 140)
  }

  return `post-${Date.now()}`
}

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
  }
  return false
}

const mapLandingAnnouncementRow = (row: LandingAnnouncementRow): LandingAnnouncement => ({
  id: String(row.id),
  slug: toText(row.slug),
  title: toText(row.title),
  category: normalizeLandingAnnouncementCategory(row.category) ?? 'event',
  displayMode: isLandingAnnouncementDisplayMode(row.display_mode)
    ? row.display_mode
    : 'section',
  excerpt: toText(row.excerpt),
  content: toText(row.content),
  coverImageDataUrl: normalizeImageAssetUrl(row.cover_image_data_url),
  coverImageName: toText(row.cover_image_name),
  ctaLabel: toText(row.cta_label),
  ctaUrl: toText(row.cta_url),
  publishStartDate: toDateKey(row.publish_start_date),
  publishEndDate: toDateKey(row.publish_end_date),
  status: isLandingAnnouncementStatus(row.status) ? row.status : 'draft',
  isPinned: Number(row.is_pinned) === 1,
  publishedAt: toIsoDateTime(row.published_at),
  authorName: toText(row.author_name),
  authorEmail: toText(row.author_email),
  createdAt: toIsoDateTime(row.created_at),
  updatedAt: toIsoDateTime(row.updated_at),
})

const sanitizeInput = (input: LandingAnnouncementInput): Required<
  Pick<
    LandingAnnouncementInput,
    | 'title'
    | 'slug'
    | 'category'
    | 'displayMode'
    | 'excerpt'
    | 'content'
    | 'coverImageDataUrl'
    | 'coverImageName'
    | 'ctaLabel'
    | 'ctaUrl'
    | 'status'
    | 'isPinned'
    | 'authorName'
    | 'authorEmail'
  >
> & {
  publishStartDate: string | null
  publishEndDate: string | null
} => {
  const title = toText(input.title).trim()
  if (!title) {
    throw new LandingAnnouncementError(400, 'Judul pengumuman wajib diisi.')
  }

  const category = normalizeLandingAnnouncementCategory(input.category)
  if (!category) {
    throw new LandingAnnouncementError(400, 'Kategori pengumuman tidak valid.')
  }

  const status = input.status ?? 'draft'
  if (!isLandingAnnouncementStatus(status)) {
    throw new LandingAnnouncementError(400, 'Status pengumuman tidak valid.')
  }

  const publishStartDate = toNullableDateKey(input.publishStartDate)
  const publishEndDate = toNullableDateKey(input.publishEndDate)

  if (publishStartDate && publishEndDate && publishEndDate < publishStartDate) {
    throw new LandingAnnouncementError(400, 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.')
  }

  const normalizedDisplayMode = isLandingAnnouncementDisplayMode(input.displayMode)
    ? input.displayMode
    : 'section'
  const displayMode: LandingAnnouncementDisplayMode =
    category === 'promosi' || category === 'ucapan'
      ? (normalizedDisplayMode === 'hero' || normalizedDisplayMode === 'popup'
        ? normalizedDisplayMode
        : 'popup')
      : 'section'

  return {
    title: title.slice(0, 180),
    slug: buildSlug(title, input.slug),
    category,
    displayMode,
    excerpt: toText(input.excerpt).trim().slice(0, 320),
    content: toText(input.content).trim(),
    coverImageDataUrl: normalizeImageStorageReference(input.coverImageDataUrl),
    coverImageName: toText(input.coverImageName).trim().slice(0, 255),
    ctaLabel: toNullableTrimmedText(input.ctaLabel, 120) ?? '',
    ctaUrl: toNullableTrimmedText(input.ctaUrl, 512) ?? '',
    publishStartDate,
    publishEndDate,
    status,
    isPinned: toBoolean(input.isPinned),
    authorName: toText(input.authorName).trim().slice(0, 120),
    authorEmail: toText(input.authorEmail).trim().slice(0, 255),
  }
}

const getAnnouncementById = async (
  executor: SqlExecutor,
  announcementId: number,
): Promise<LandingAnnouncementRow | null> => {
  const [rows] = await executor.execute(
    `SELECT
      id,
      slug,
      title,
      category,
      display_mode,
      excerpt,
      content,
      cover_image_data_url,
      cover_image_name,
      cta_label,
      cta_url,
      publish_start_date,
      publish_end_date,
      status,
      is_pinned,
      published_at,
      author_name,
      author_email,
      created_at,
      updated_at
    FROM landing_announcements
    WHERE id = ?
    LIMIT 1`,
    [announcementId],
  ) as [LandingAnnouncementRow[], unknown]

  return rows[0] ?? null
}

const resolveUniqueSlug = async (
  executor: SqlExecutor,
  baseSlug: string,
  excludeId?: number,
): Promise<string> => {
  const cleanedBase = sanitizeSlugFragment(baseSlug) || `post-${Date.now()}`
  const seed = cleanedBase.slice(0, 130)

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const candidate = `${seed}${suffix}`.slice(0, 140)
    const whereExclude = typeof excludeId === 'number' ? ' AND id <> ?' : ''
    const values = typeof excludeId === 'number'
      ? [candidate, excludeId]
      : [candidate]

    const [rows] = await executor.execute(
      `SELECT COUNT(*) AS count
      FROM landing_announcements
      WHERE slug = ?${whereExclude}`,
      values,
    ) as [Array<RowDataPacket & { count: number }>, unknown]

    if (Number(rows[0]?.count ?? 0) === 0) {
      return candidate
    }
  }

  throw new LandingAnnouncementError(500, 'Gagal membuat slug unik untuk pengumuman.')
}

const toSafeLimit = (value: unknown): number => {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(toText(value), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 12
  }
  return Math.min(50, Math.max(1, Math.round(parsed)))
}

const toAnnouncementId = (value: string): number => {
  const normalized = toText(value).trim()
  if (!/^\d+$/.test(normalized)) {
    throw new LandingAnnouncementError(400, 'ID pengumuman tidak valid.')
  }
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new LandingAnnouncementError(400, 'ID pengumuman tidak valid.')
  }
  return parsed
}

export const parseLandingAnnouncementId = (value: string): number => toAnnouncementId(value)

const hasUsersColumn = async (
  executor: SqlExecutor,
  columnName: string,
): Promise<boolean> => {
  const [rows] = await executor.execute(
    `SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = ?`,
    [columnName],
  ) as [Array<RowDataPacket & { count: number }>, unknown]

  return Number(rows[0]?.count ?? 0) > 0
}

const hasDisplayModeColumn = async (executor: SqlExecutor): Promise<boolean> => {
  const [rows] = await executor.execute(
    `SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'landing_announcements'
      AND COLUMN_NAME = 'display_mode'`,
  ) as [Array<RowDataPacket & { count: number }>, unknown]

  return Number(rows[0]?.count ?? 0) > 0
}

const listLandingTeamItemsFromStaffUsers = async (
  executor: SqlExecutor,
): Promise<LandingAnnouncement[]> => {
  const hasPhotoDataUrlColumn = await hasUsersColumn(executor, 'staff_photo_data_url')
  const hasPhotoNameColumn = await hasUsersColumn(executor, 'staff_photo_name')
  const hasDescriptionColumn = await hasUsersColumn(executor, 'staff_description')

  const photoDataUrlExpr = hasPhotoDataUrlColumn ? 'staff_photo_data_url' : "''"
  const photoNameExpr = hasPhotoNameColumn ? 'staff_photo_name' : "''"
  const descriptionExpr = hasDescriptionColumn ? 'staff_description' : "''"

  const [rows] = await executor.execute<LandingTeamStaffRow[]>(
    `SELECT
      id,
      full_name,
      ${photoDataUrlExpr} AS staff_photo_data_url,
      ${photoNameExpr} AS staff_photo_name,
      ${descriptionExpr} AS staff_description,
      created_at,
      updated_at
    FROM users
    WHERE role IN ('PETUGAS', 'STAFF')
      AND is_active = 1
    ORDER BY
      created_at ASC,
      id ASC`,
  )

  return rows.reduce<LandingAnnouncement[]>((result, row) => {
    const title = toText(row.full_name).trim()
    if (!title) {
      return result
    }

    const createdAt = toIsoDateTime(row.created_at)
    const updatedAt = toIsoDateTime(row.updated_at)

    result.push({
      id: `staff-${row.id}`,
      slug: `staff-${row.id}`,
      title,
      category: 'tim',
      displayMode: 'section',
      excerpt: '',
      content: toText(row.staff_description).trim(),
      coverImageDataUrl: normalizeImageAssetUrl(row.staff_photo_data_url),
      coverImageName: toText(row.staff_photo_name),
      ctaLabel: '',
      ctaUrl: '',
      publishStartDate: '',
      publishEndDate: '',
      status: 'published',
      isPinned: false,
      publishedAt: updatedAt || createdAt,
      authorName: '',
      authorEmail: '',
      createdAt,
      updatedAt,
    })

    return result
  }, [])
}

export const ensureLandingAnnouncementSchema = async (
  executor: SqlExecutor,
): Promise<void> => {
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS landing_announcements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(180) NOT NULL,
      title VARCHAR(180) NOT NULL,
      category ENUM('event', 'dokumentasi', 'galeri', 'fasilitas', 'tim', 'promosi', 'ucapan') NOT NULL DEFAULT 'event',
      display_mode ENUM('section', 'hero', 'popup') NOT NULL DEFAULT 'section',
      excerpt VARCHAR(320) NULL,
      content LONGTEXT NULL,
      cover_image_data_url LONGTEXT NULL,
      cover_image_name VARCHAR(255) NULL,
      cta_label VARCHAR(120) NULL,
      cta_url VARCHAR(512) NULL,
      publish_start_date DATE NULL,
      publish_end_date DATE NULL,
      status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      published_at DATETIME NULL,
      author_name VARCHAR(120) NULL,
      author_email VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_landing_announcements_slug (slug),
      INDEX idx_landing_announcements_status_dates (status, publish_start_date, publish_end_date),
      INDEX idx_landing_announcements_order (is_pinned, published_at, updated_at)
    )`,
  )

  await executor.execute(
    `ALTER TABLE landing_announcements
    MODIFY COLUMN category ENUM('event', 'dokumentasi', 'galeri', 'fasilitas', 'tim', 'promosi', 'ucapan') NOT NULL DEFAULT 'event'`,
  )

  const displayModeExists = await hasDisplayModeColumn(executor)
  if (!displayModeExists) {
    await executor.execute(
      `ALTER TABLE landing_announcements
      ADD COLUMN display_mode ENUM('section', 'hero', 'popup') NOT NULL DEFAULT 'section' AFTER category`,
    )
  }
}

const archiveExpiredPublishedAnnouncements = async (executor: SqlExecutor): Promise<void> => {
  await executor.execute(
    `UPDATE landing_announcements
    SET status = 'archived',
      updated_at = CURRENT_TIMESTAMP
    WHERE status = 'published'
      AND publish_end_date IS NOT NULL
      AND publish_end_date < CURDATE()`,
  )
}

export const listLandingAnnouncementsForAdmin = async (): Promise<LandingAnnouncement[]> => {
  await ensureLandingAnnouncementSchema(dbPool)
  await archiveExpiredPublishedAnnouncements(dbPool)

  const [rows] = await dbPool.execute<LandingAnnouncementRow[]>(
    `SELECT
      id,
      slug,
      title,
      category,
      display_mode,
      excerpt,
      content,
      cover_image_data_url,
      cover_image_name,
      cta_label,
      cta_url,
      publish_start_date,
      publish_end_date,
      status,
      is_pinned,
      published_at,
      author_name,
      author_email,
      created_at,
      updated_at
    FROM landing_announcements
    ORDER BY
      is_pinned DESC,
      COALESCE(published_at, updated_at) DESC,
      id DESC`,
  )

  return rows.map(mapLandingAnnouncementRow)
}

export const listLandingAnnouncementsForLanding = async (options?: {
  limit?: number
  category?: LandingAnnouncementCategory
}): Promise<LandingAnnouncement[]> => {
  await ensureLandingAnnouncementSchema(dbPool)
  await archiveExpiredPublishedAnnouncements(dbPool)

  const limit = toSafeLimit(options?.limit)
  const category = options?.category
  const hasCategory = Boolean(category && isLandingAnnouncementCategory(category))

  const [rows] = await dbPool.execute<LandingAnnouncementRow[]>(
    `SELECT
      id,
      slug,
      title,
      category,
      display_mode,
      excerpt,
      content,
      cover_image_data_url,
      cover_image_name,
      cta_label,
      cta_url,
      publish_start_date,
      publish_end_date,
      status,
      is_pinned,
      published_at,
      author_name,
      author_email,
      created_at,
      updated_at
    FROM landing_announcements
    WHERE status = 'published'
      AND (publish_start_date IS NULL OR publish_start_date <= CURDATE())
      AND (publish_end_date IS NULL OR publish_end_date >= CURDATE())
      ${hasCategory ? 'AND category = ?' : ''}
    ORDER BY
      is_pinned DESC,
      COALESCE(published_at, updated_at) DESC,
      id DESC
    LIMIT ?`,
    hasCategory ? [category, limit] : [limit],
  )

  const announcements = rows.map(mapLandingAnnouncementRow)
  if (hasCategory && category !== 'tim') {
    return announcements
  }

  let staffTeamItems: LandingAnnouncement[] = []
  try {
    staffTeamItems = await listLandingTeamItemsFromStaffUsers(dbPool)
  } catch {
    staffTeamItems = []
  }

  if (staffTeamItems.length === 0) {
    return hasCategory && category === 'tim'
      ? []
      : announcements.filter((item) => item.category !== 'tim')
  }

  if (hasCategory && category === 'tim') {
    return staffTeamItems
  }

  const nonTeamItems = announcements.filter((item) => item.category !== 'tim')
  return [...nonTeamItems, ...staffTeamItems]
}

export const createLandingAnnouncement = async (
  input: LandingAnnouncementInput,
): Promise<LandingAnnouncement> => {
  const payload = sanitizeInput(input)
  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureLandingAnnouncementSchema(connection)

    const nextSlug = await resolveUniqueSlug(connection, payload.slug)
    const shouldPublish = payload.status === 'published'
    const publishedAt = shouldPublish ? toDbDateTime(new Date()) : null
    const coverImageDataUrl = await saveBase64ToDisk(
      payload.coverImageDataUrl,
      'landing_announcement',
      {
        quality: 72,
        maxDimension: 1280,
      },
    )

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO landing_announcements (
        slug,
        title,
        category,
        display_mode,
        excerpt,
        content,
        cover_image_data_url,
        cover_image_name,
        cta_label,
        cta_url,
        publish_start_date,
        publish_end_date,
        status,
        is_pinned,
        published_at,
        author_name,
        author_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nextSlug,
        payload.title,
        payload.category,
        payload.displayMode,
        payload.excerpt || null,
        payload.content || null,
        coverImageDataUrl || null,
        payload.coverImageName || null,
        payload.ctaLabel || null,
        payload.ctaUrl || null,
        payload.publishStartDate,
        payload.publishEndDate,
        payload.status,
        payload.isPinned ? 1 : 0,
        publishedAt,
        payload.authorName || null,
        payload.authorEmail || null,
      ],
    )

    const insertedId = Number(result.insertId)
    const inserted = await getAnnouncementById(connection, insertedId)
    if (!inserted) {
      throw new LandingAnnouncementError(500, 'Pengumuman gagal dibuat.')
    }

    await connection.commit()
    return mapLandingAnnouncementRow(inserted)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const updateLandingAnnouncement = async (
  announcementIdRaw: string,
  input: LandingAnnouncementInput,
): Promise<LandingAnnouncement> => {
  const announcementId = toAnnouncementId(announcementIdRaw)
  const payload = sanitizeInput(input)
  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureLandingAnnouncementSchema(connection)

    const existing = await getAnnouncementById(connection, announcementId)
    if (!existing) {
      throw new LandingAnnouncementError(404, 'Pengumuman tidak ditemukan.')
    }

    const nextSlug = await resolveUniqueSlug(connection, payload.slug, announcementId)
    const existingPublishedAt = toDbDateTime(existing.published_at)
    const shouldPublish = payload.status === 'published'
    const nextPublishedAt = shouldPublish
      ? existingPublishedAt ?? toDbDateTime(new Date())
      : null
    const coverImageDataUrl = await saveBase64ToDisk(
      payload.coverImageDataUrl,
      'landing_announcement',
      {
        quality: 72,
        maxDimension: 1280,
      },
    )

    await connection.execute(
      `UPDATE landing_announcements
      SET
        slug = ?,
        title = ?,
        category = ?,
        display_mode = ?,
        excerpt = ?,
        content = ?,
        cover_image_data_url = ?,
        cover_image_name = ?,
        cta_label = ?,
        cta_url = ?,
        publish_start_date = ?,
        publish_end_date = ?,
        status = ?,
        is_pinned = ?,
        published_at = ?,
        author_name = ?,
        author_email = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        nextSlug,
        payload.title,
        payload.category,
        payload.displayMode,
        payload.excerpt || null,
        payload.content || null,
        coverImageDataUrl || null,
        payload.coverImageName || null,
        payload.ctaLabel || null,
        payload.ctaUrl || null,
        payload.publishStartDate,
        payload.publishEndDate,
        payload.status,
        payload.isPinned ? 1 : 0,
        nextPublishedAt,
        payload.authorName || null,
        payload.authorEmail || null,
        announcementId,
      ],
    )

    const updated = await getAnnouncementById(connection, announcementId)
    if (!updated) {
      throw new LandingAnnouncementError(500, 'Pengumuman gagal diperbarui.')
    }

    await connection.commit()
    return mapLandingAnnouncementRow(updated)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const deleteLandingAnnouncement = async (announcementIdRaw: string): Promise<void> => {
  const announcementId = toAnnouncementId(announcementIdRaw)
  await ensureLandingAnnouncementSchema(dbPool)

  const [result] = await dbPool.execute<ResultSetHeader>(
    'DELETE FROM landing_announcements WHERE id = ?',
    [announcementId],
  )

  if (Number(result.affectedRows) === 0) {
    throw new LandingAnnouncementError(404, 'Pengumuman tidak ditemukan.')
  }
}
