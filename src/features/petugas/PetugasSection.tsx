import {
  CheckCircle2,
  Clock3,
  LogOut,
  Menu,
  RefreshCw,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import BeritaAcaraPage from './berita-acara/BeritaAcaraPage'
import DataAnakPage from './data-anak/DataAnakPage'
import InventoriPage from './inventori/InventoriPage'
import KehadiranPage from './kehadiran/KehadiranPage'
import ObservasiPage from './observasi/ObservasiPage'
import {
  attendanceApi,
  incidentApi,
  observationApi,
  staffAttendanceApi,
  supplyInventoryApi,
  childApi,
} from '../../services/api'
import type {
  AppData,
  AuthUser,
  AttendanceRecord,
  AttendanceRecordInput,
  ChildProfile,
  ConfirmDialogOptions,
  IncidentReport,
  IncidentReportInput,
  ObservationRecord,
  ObservationRecordInput,
  StaffAttendanceStatus,
  SupplyInventoryItem,
  SupplyInventoryItemInput,
} from '../../types'
import { createEmptyAppData } from '../../utils/storage'
import {
  parseNavigationState,
  pushNavigationState,
  readNavigationState,
  replaceNavigationState,
} from '../../utils/browser-history'
import { useHideOnScroll } from '../../utils/useHideOnScroll'
import {
  type PetugasMenuKey,
  type PetugasDataSegment,
  type ConfirmDialogState,
  normalizeAttendanceRecord,
  normalizeIncidentReport,
  normalizeObservationRecord,
  getErrorMessage,
  menuTitles,
  menuDataSegments,
  petugasMenus,
  isPetugasNavigationState,
  buildPetugasNavigationState,
} from './petugasHelpers'

interface PetugasSectionProps {
  user: AuthUser
  onLogout: () => Promise<void>
}

const PETUGAS_BACKGROUND_SYNC_INTERVAL_MS = 20000
const PETUGAS_POPUP_STORAGE_PREFIX = 'tpa:petugas:popup'

const buildPetugasPopupStorageKey = (
  staffUserId: string,
  attendanceDate: string,
  popupType: 'checkin' | 'checkout',
): string =>
  `${PETUGAS_POPUP_STORAGE_PREFIX}:${popupType}:${staffUserId}:${attendanceDate}`

function PetugasSection({ user, onLogout }: PetugasSectionProps) {
  const [appData, setAppData] = useState<AppData>(() => createEmptyAppData())
  const [staffAttendanceStatus, setStaffAttendanceStatus] = useState<StaffAttendanceStatus | null>(null)
  const [isAttendanceStatusLoading, setAttendanceStatusLoading] = useState(true)
  const [isAttendanceStatusRefreshing, setAttendanceStatusRefreshing] = useState(false)
  const [attendanceStatusError, setAttendanceStatusError] = useState<string | null>(null)
  const [attendanceClockLabel, setAttendanceClockLabel] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  )
  const appDataRef = useRef<AppData>(createEmptyAppData())
  const [activeMenu, setActiveMenu] = useState<PetugasMenuKey>('kehadiran')
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [isSyncing, setSyncing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(
    null,
  )
  const [isCheckInPopupVisible, setCheckInPopupVisible] = useState(false)
  const [checkInPopupCloseCountdown, setCheckInPopupCloseCountdown] = useState(0)
  const [checkInPopupStorageKey, setCheckInPopupStorageKey] = useState<string | null>(null)
  const [isCheckOutPopupVisible, setCheckOutPopupVisible] = useState(false)
  const [checkOutPopupStorageKey, setCheckOutPopupStorageKey] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const confirmResolveRef = useRef<((result: boolean) => void) | null>(null)
  const initialMenuRef = useRef<PetugasMenuKey>(activeMenu)
  const isApplyingNavigationHistoryRef = useRef(false)
  const hasInitializedNavigationHistoryRef = useRef(false)
  const isTopbarHidden = useHideOnScroll()
  const loadRequestIdRef = useRef(0)
  const loadedSegmentsRef = useRef<Set<PetugasDataSegment>>(new Set())

  const refreshAttendanceStatus = useCallback(
    async (options?: { manual?: boolean; quiet?: boolean }): Promise<void> => {
      if (options?.manual) {
        setAttendanceStatusRefreshing(true)
      } else {
        setAttendanceStatusLoading(true)
      }

      try {
        const status = await staffAttendanceApi.getStatus()
        setStaffAttendanceStatus(status)
        setAttendanceStatusError(null)
      } catch (error) {
        if (!options?.quiet) {
          setAttendanceStatusError(getErrorMessage(error))
        }
      } finally {
        setAttendanceStatusLoading(false)
        setAttendanceStatusRefreshing(false)
      }
    },
    [],
  )

  const closeConfirmDialog = (result: boolean) => {
    const resolve = confirmResolveRef.current
    confirmResolveRef.current = null
    setConfirmDialog(null)
    if (resolve) {
      resolve(result)
    }
  }

  const requestConfirm = (options: ConfirmDialogOptions): Promise<boolean> =>
    new Promise((resolve) => {
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false)
      }
      confirmResolveRef.current = resolve
      setConfirmDialog({
        title: options.title ?? 'Konfirmasi',
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Ya, Lanjutkan',
        cancelLabel: options.cancelLabel ?? 'Batal',
        tone: options.tone ?? 'default',
      })
    })

  useEffect(() => {
    appDataRef.current = appData
  }, [appData])

  useEffect(() => {
    void refreshAttendanceStatus()
  }, [refreshAttendanceStatus])

  useEffect(() => {
    if (staffAttendanceStatus?.hasCheckedIn) {
      return undefined
    }

    const pollerId = window.setInterval(() => {
      void refreshAttendanceStatus({ quiet: true })
    }, 15000)

    return () => {
      window.clearInterval(pollerId)
    }
  }, [refreshAttendanceStatus, staffAttendanceStatus?.hasCheckedIn])

  useEffect(() => {
    const clockId = window.setInterval(() => {
      setAttendanceClockLabel(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
    }, 1000)

    return () => {
      window.clearInterval(clockId)
    }
  }, [])

  useEffect(() => {
    const restoredState = readNavigationState(isPetugasNavigationState)

    if (restoredState) {
      if (restoredState.menu !== initialMenuRef.current) {
        isApplyingNavigationHistoryRef.current = true
        setActiveMenu(restoredState.menu)
      }
    } else {
      replaceNavigationState(buildPetugasNavigationState(initialMenuRef.current))
    }

    hasInitializedNavigationHistoryRef.current = true

    const handlePopState = (event: PopStateEvent) => {
      const nextState = parseNavigationState(event.state, isPetugasNavigationState)
      if (!nextState) {
        return
      }

      isApplyingNavigationHistoryRef.current = true
      setActiveMenu(nextState.menu)
      setSidebarOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (!hasInitializedNavigationHistoryRef.current) {
      return
    }

    if (isApplyingNavigationHistoryRef.current) {
      isApplyingNavigationHistoryRef.current = false
      return
    }

    const currentState = readNavigationState(isPetugasNavigationState)
    if (currentState?.menu === activeMenu) {
      return
    }

    pushNavigationState(buildPetugasNavigationState(activeMenu))
  }, [activeMenu])

  const loadMenuData = useCallback(
    async (
      menu: PetugasMenuKey,
      options?: { manualReload?: boolean; quiet?: boolean },
    ): Promise<void> => {
      const requestId = ++loadRequestIdRef.current
      const requiredSegments = menuDataSegments[menu]
      const segmentsToFetch = options?.manualReload
        ? requiredSegments
        : requiredSegments.filter((segment) => !loadedSegmentsRef.current.has(segment))

      if (segmentsToFetch.length === 0) {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false)
          setStatusMessage(null)
        }
        return
      }

      setLoading(true)

      try {
        const segments = new Set(segmentsToFetch)
        const [children, attendanceRecords, incidentReports, observationRecords, supplyInventory] =
          await Promise.all([
            segments.has('children') ? childApi.getChildren() : Promise.resolve<ChildProfile[] | null>(null),
            segments.has('attendanceRecords')
              ? attendanceApi.getAttendanceRecords()
              : Promise.resolve<AttendanceRecord[] | null>(null),
            segments.has('incidentReports')
              ? incidentApi.getIncidentReports()
              : Promise.resolve<IncidentReport[] | null>(null),
            segments.has('observationRecords')
              ? observationApi.getObservationRecords()
              : Promise.resolve<ObservationRecord[] | null>(null),
            segments.has('supplyInventory')
              ? supplyInventoryApi.getSupplyInventory()
              : Promise.resolve<SupplyInventoryItem[] | null>(null),
          ])

        if (requestId !== loadRequestIdRef.current) {
          return
        }

        segmentsToFetch.forEach((segment) => {
          loadedSegmentsRef.current.add(segment)
        })

        setAppData((previous) => {
          const nextState: AppData = {
            ...previous,
            ...(children ? { children } : {}),
            ...(attendanceRecords
              ? { attendanceRecords: attendanceRecords.map(normalizeAttendanceRecord) }
              : {}),
            ...(incidentReports
              ? { incidentReports: incidentReports.map(normalizeIncidentReport) }
              : {}),
            ...(observationRecords
              ? { observationRecords: observationRecords.map(normalizeObservationRecord) }
              : {}),
            ...(supplyInventory ? { supplyInventory } : {}),
          }
          appDataRef.current = nextState
          return nextState
        })

        if (options?.manualReload && !options.quiet) {
          setStatusMessage(`Data "${menuTitles[menu].title}" berhasil dimuat ulang.`)
        } else {
          setStatusMessage(null)
        }
      } catch (error) {
        if (requestId !== loadRequestIdRef.current) {
          return
        }

        if (!options?.quiet) {
          const menuLabel = menuTitles[menu].title.toLowerCase()
          setStatusMessage(`Gagal memuat data ${menuLabel}: ${getErrorMessage(error)} `)
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (!staffAttendanceStatus?.hasCheckedIn) {
      return
    }

    void loadMenuData(activeMenu)
  }, [activeMenu, loadMenuData, staffAttendanceStatus?.hasCheckedIn])

  useEffect(() => {
    if (!staffAttendanceStatus?.hasCheckedIn) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      if (isSyncing) {
        return
      }

      void loadMenuData(activeMenu, {
        manualReload: true,
        quiet: true,
      })
    }, PETUGAS_BACKGROUND_SYNC_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeMenu, isSyncing, loadMenuData, staffAttendanceStatus?.hasCheckedIn])

  useEffect(() => {
    if (!toastMessage) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setToastMessage(null)
    }, 3000)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [toastMessage])

  useEffect(() => {
    if (!staffAttendanceStatus?.hasCheckedIn || staffAttendanceStatus.hasCheckedOut) {
      setCheckInPopupVisible(false)
      setCheckInPopupCloseCountdown(0)
      setCheckInPopupStorageKey(null)
      return
    }

    const attendanceDate = staffAttendanceStatus.attendanceDate || new Date().toISOString().slice(0, 10)
    const storageKey = buildPetugasPopupStorageKey(user.id, attendanceDate, 'checkin')
    const hasShownPopup = window.localStorage.getItem(storageKey) === '1'
    if (hasShownPopup) {
      return
    }

    setCheckInPopupStorageKey(storageKey)
    setCheckInPopupVisible(true)
    setCheckInPopupCloseCountdown(5)
  }, [
    staffAttendanceStatus?.attendanceDate,
    staffAttendanceStatus?.hasCheckedIn,
    staffAttendanceStatus?.hasCheckedOut,
    user.id,
  ])

  useEffect(() => {
    if (!staffAttendanceStatus?.hasCheckedOut) {
      setCheckOutPopupVisible(false)
      setCheckOutPopupStorageKey(null)
      return
    }

    const attendanceDate = staffAttendanceStatus.attendanceDate || new Date().toISOString().slice(0, 10)
    const storageKey = buildPetugasPopupStorageKey(user.id, attendanceDate, 'checkout')
    const hasShownPopup = window.localStorage.getItem(storageKey) === '1'
    if (hasShownPopup) {
      return
    }

    setCheckOutPopupStorageKey(storageKey)
    setCheckOutPopupVisible(true)
  }, [
    staffAttendanceStatus?.attendanceDate,
    staffAttendanceStatus?.hasCheckedOut,
    user.id,
  ])

  useEffect(() => {
    if (!isCheckInPopupVisible || checkInPopupCloseCountdown <= 0) {
      return undefined
    }

    const countdownId = window.setTimeout(() => {
      setCheckInPopupCloseCountdown((previous) => Math.max(previous - 1, 0))
    }, 1000)

    return () => {
      window.clearTimeout(countdownId)
    }
  }, [checkInPopupCloseCountdown, isCheckInPopupVisible])

  useEffect(() => {
    if (!confirmDialog) {
      return undefined
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeConfirmDialog(false)
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [confirmDialog])

  useEffect(
    () => () => {
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false)
        confirmResolveRef.current = null
      }
    },
    [],
  )
  const upsertIncidentReport = async (
    input: IncidentReportInput,
    editingId?: string,
  ): Promise<boolean> => {
    setSyncing(true)
    try {
      let saved: IncidentReport
      if (editingId) {
        saved = await incidentApi.updateIncidentReport(editingId, input)
      } else {
        saved = await incidentApi.createIncidentReport(input)
      }

      setAppData((previous) => {
        const nextState = {
          ...previous,
          incidentReports: editingId
            ? previous.incidentReports.map((record) =>
              record.id === editingId ? saved : record,
            )
            : [saved, ...previous.incidentReports],
        }
        appDataRef.current = nextState
        return nextState
      })
      setStatusMessage(null)
      setToastMessage('Data berita acara berhasil disimpan.')
      return true
    } catch (error) {
      const message = getErrorMessage(error)
      setStatusMessage(`Gagal menyimpan berita acara: ${message} `)
      return false
    } finally {
      setSyncing(false)
    }
  }

  const upsertAttendanceRecord = async (
    input: AttendanceRecordInput,
    editingId?: string,
  ): Promise<boolean> => {
    setSyncing(true)
    try {
      let saved: AttendanceRecord
      if (editingId) {
        saved = await attendanceApi.updateAttendanceRecord(editingId, input)
      } else {
        saved = await attendanceApi.createAttendanceRecord(input)
      }

      setAppData((previous) => {
        const nextState = {
          ...previous,
          attendanceRecords: editingId
            ? previous.attendanceRecords.map((record) =>
              record.id === editingId ? saved : record,
            )
            : [saved, ...previous.attendanceRecords],
        }
        appDataRef.current = nextState
        return nextState
      })
      setStatusMessage(null)
      setToastMessage('Data kehadiran berhasil disimpan.')
      return true
    } catch (error) {
      const message = getErrorMessage(error)
      setStatusMessage(`Gagal menyimpan data absensi: ${message} `)
      return false
    } finally {
      setSyncing(false)
    }
  }

  const upsertSupplyInventoryItem = async (
    input: SupplyInventoryItemInput,
    editingId?: string,
  ): Promise<boolean> => {
    setSyncing(true)
    try {
      let saved: SupplyInventoryItem
      if (editingId) {
        saved = await supplyInventoryApi.updateSupplyItem(editingId, input)
      } else {
        saved = await supplyInventoryApi.createSupplyItem(input)
      }

      setAppData((previous) => {
        const nextState = {
          ...previous,
          supplyInventory: editingId
            ? previous.supplyInventory.map((record) =>
              record.id === editingId ? saved : record,
            )
            : [saved, ...previous.supplyInventory],
        }
        appDataRef.current = nextState
        return nextState
      })
      setStatusMessage(null)
      setToastMessage('Data inventori berhasil disimpan.')
      return true
    } catch (error) {
      const message = getErrorMessage(error)
      setStatusMessage(`Gagal menyimpan data inventori: ${message} `)
      return false
    } finally {
      setSyncing(false)
    }
  }

  const removeSupplyInventoryItem = async (id: string): Promise<boolean> => {
    setSyncing(true)
    try {
      await supplyInventoryApi.deleteSupplyItem(id)

      setAppData((previous) => {
        const nextState = {
          ...previous,
          supplyInventory: previous.supplyInventory.filter((record) => record.id !== id),
        }
        appDataRef.current = nextState
        return nextState
      })
      setStatusMessage(null)
      setToastMessage('Data inventori berhasil dihapus.')
      return true
    } catch (error) {
      const message = getErrorMessage(error)
      setStatusMessage(`Gagal menghapus data inventori: ${message} `)
      return false
    } finally {
      setSyncing(false)
    }
  }

  const upsertObservationRecord = async (
    input: ObservationRecordInput,
    editingId?: string,
  ): Promise<boolean> => {
    setSyncing(true)
    try {
      let saved: ObservationRecord
      if (editingId) {
        saved = await observationApi.updateObservationRecord(editingId, input)
      } else {
        saved = await observationApi.createObservationRecord(input)
      }

      setAppData((previous) => {
        const nextState = {
          ...previous,
          observationRecords: editingId
            ? previous.observationRecords.map((record) =>
              record.id === editingId ? saved : record,
            )
            : [saved, ...previous.observationRecords],
        }
        appDataRef.current = nextState
        return nextState
      })
      setStatusMessage(null)
      setToastMessage('Data observasi berhasil disimpan.')
      return true
    } catch (error) {
      const message = getErrorMessage(error)
      setStatusMessage(`Gagal menyimpan data observasi: ${message} `)
      return false
    } finally {
      setSyncing(false)
    }
  }

  const selectMenu = (menu: string) => {
    setActiveMenu(menu as PetugasMenuKey)
    setSidebarOpen(false)
  }

  const viewDataAnak = () => {
    setActiveMenu('data-anak')
    setSidebarOpen(false)
  }

  const activeHeader = useMemo(() => menuTitles[activeMenu], [activeMenu])
  const showLoadingOverlay = isSyncing
  const closeCheckInPopup = () => {
    if (checkInPopupStorageKey) {
      window.localStorage.setItem(checkInPopupStorageKey, '1')
    }
    setCheckInPopupVisible(false)
    setCheckInPopupCloseCountdown(0)
    setCheckInPopupStorageKey(null)
  }
  const closeCheckOutPopup = () => {
    if (checkOutPopupStorageKey) {
      window.localStorage.setItem(checkOutPopupStorageKey, '1')
    }
    setCheckOutPopupVisible(false)
    setCheckOutPopupStorageKey(null)
  }
  const attendanceDateLabel = useMemo(() => {
    const dateKey = staffAttendanceStatus?.attendanceDate ?? new Date().toISOString().slice(0, 10)
    const parsed = new Date(`${dateKey}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      return dateKey
    }
    return parsed.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [staffAttendanceStatus?.attendanceDate])

  const checkInTimeLabel = useMemo(() => {
    const raw = staffAttendanceStatus?.checkInAt ?? ''
    if (!raw) {
      return 'Belum tercatat'
    }
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) {
      return 'Sudah tercatat'
    }
    return `Sudah tercatat (${parsed.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })})`
  }, [staffAttendanceStatus?.checkInAt])

  const checkOutTimeLabel = useMemo(() => {
    const raw = staffAttendanceStatus?.checkOutAt ?? ''
    if (!raw) {
      return 'Belum tercatat'
    }
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) {
      return 'Sudah tercatat'
    }
    return `Sudah tercatat (${parsed.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })})`
  }, [staffAttendanceStatus?.checkOutAt])

  const hasCheckedOutToday = Boolean(staffAttendanceStatus?.hasCheckedOut)

  if (isAttendanceStatusLoading && !staffAttendanceStatus) {
    return (
      <div className="app-shell app-shell--petugas app-shell--attendance-gate">
        <div className="app-main">
          <main className="app-content app-content--attendance-gate">
            <section className="page page--attendance-gate">
              <article className="card staff-attendance-gate">
                <div className="staff-attendance-gate__header">
                  <h3>Memeriksa status absensi petugas...</h3>
                  <span className="staff-attendance-clock">
                    <Clock3 size={14} />
                    {attendanceClockLabel}
                  </span>
                </div>
              </article>
            </section>
          </main>
        </div>
      </div>
    )
  }

  if (!staffAttendanceStatus?.hasCheckedIn || hasCheckedOutToday) {
    const isLockedAfterCheckout = hasCheckedOutToday

    return (
      <div className="app-shell app-shell--petugas app-shell--attendance-gate">
        <div className="app-main">
          <main className="app-content app-content--attendance-gate">
            <section className="page page--attendance-gate">
              <article className="card staff-attendance-hero">
                <div className="staff-attendance-hero__badge-block">
                  <div className="staff-attendance-hero__badge">
                    <img
                      src="/logo_TPA.jpg"
                      alt="Logo TPA Rumah Ceria"
                      className="staff-attendance-hero__logo"
                    />
                  </div>
                  <p>DASHBOARD OPERASIONAL</p>
                </div>
                <div className="staff-attendance-hero__content">
                  <h2>{isLockedAfterCheckout ? 'Akses petugas telah terkunci' : 'Akses petugas masih terkunci'}</h2>
                  {isLockedAfterCheckout ? (
                    <p>
                      Anda sudah tercatat absensi pulang. Silahkan tunggu esok hari untuk dapat masuk Dashboard Operasional.
                    </p>
                  ) : (
                    <p>
                      Anda belum tercatat absen masuk hari ini. Silakan datang langsung ke admin untuk verifikasi kehadiran.
                    </p>
                  )}
                </div>
              </article>

              <article className="card staff-attendance-gate">
                <div className="staff-attendance-gate__header">
                  <h3>Status Absensi Hari Ini</h3>
                  <span className="staff-attendance-clock">
                    <Clock3 size={14} />
                    {attendanceClockLabel}
                  </span>
                </div>

                <div className="staff-attendance-meta">
                  <div className="staff-attendance-module staff-attendance-module--date">
                    <span className="staff-attendance-module__label">
                      <Clock3 size={14} />
                      Tanggal Kerja
                    </span>
                    <strong>{attendanceDateLabel}</strong>
                  </div>
                  <div className="staff-attendance-module">
                    <span className="staff-attendance-module__label">
                      <UserCheck size={14} />
                      Absen Masuk
                    </span>
                    <strong>{checkInTimeLabel}</strong>
                  </div>
                  <div className="staff-attendance-module">
                    <span className="staff-attendance-module__label">
                      <LogOut size={14} />
                      Absen Pulang
                    </span>
                    <strong>{checkOutTimeLabel}</strong>
                    <span className="staff-attendance-module__security">
                      <ShieldAlert size={13} />
                    </span>
                  </div>
                </div>

                {attendanceStatusError ? (
                  <p className="field-hint" style={{ marginTop: '0.9rem' }}>
                    {attendanceStatusError}
                  </p>
                ) : null}

                <div className="form-actions staff-attendance-gate__actions">
                  <button
                    type="button"
                    className="button button--success"
                    onClick={() => void refreshAttendanceStatus({ manual: true })}
                    disabled={isAttendanceStatusRefreshing}
                  >
                    <RefreshCw
                      size={14}
                      className={isAttendanceStatusRefreshing ? 'staff-attendance-action__icon is-spinning' : ''}
                    />
                    {isAttendanceStatusRefreshing ? 'Memeriksa...' : 'Refresh'}
                  </button>
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => void onLogout()}
                  >
                    Logout
                  </button>
                </div>
              </article>
            </section>
          </main>
        </div>

        {isLockedAfterCheckout && isCheckOutPopupVisible ? (
          <div
            className="app-confirm-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeCheckOutPopup()
              }
            }}
          >
            <div className="app-greeting-dialog" role="dialog" aria-modal="true" aria-label="Ucapan setelah absen pulang">
              <button
                type="button"
                className="app-greeting-dialog__close"
                onClick={closeCheckOutPopup}
                aria-label="Tutup ucapan"
              >
                x
              </button>
              <div className="app-greeting-dialog__badge">
                <img src="/logo_TPA.jpg" alt="Logo TPA Rumah Ceria" />
                <span>Selesai Bertugas</span>
              </div>
              <h3>Sampai jumpa kak {user.displayName}🙏🏻</h3>
              <p>
                Terima kasih atas semua kesabaran dan kasih sayang yang Kakak berikan hari ini dan menjadi bagian dari tumbuh kembang mereka, anak-anak pulang dengan aman dan bahagia berkat Kakak. hati-hati dijalan👋🏻
              </p>
              <div className="app-greeting-dialog__footer">
                <button
                  type="button"
                  className="button"
                  onClick={closeCheckOutPopup}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const renderPage = () => {
    switch (activeMenu) {
      case 'berita-acara':
        return (
          <BeritaAcaraPage
            childrenData={appData.children}
            reports={appData.incidentReports}
            attendanceRecords={appData.attendanceRecords}
            staffDisplayName={user.displayName}
            isTableLoading={isLoading}
            onSave={upsertIncidentReport}
            onNavigateToDataAnak={viewDataAnak}
          />
        )
      case 'kehadiran':
        return (
          <KehadiranPage
            childrenData={appData.children}
            records={appData.attendanceRecords}
            supplyItems={appData.supplyInventory}
            isTableLoading={isLoading}
            onSave={upsertAttendanceRecord}
            onNavigateToDataAnak={viewDataAnak}
          />
        )
      case 'observasi':
        return (
          <ObservasiPage
            childrenData={appData.children}
            records={appData.observationRecords}
            attendanceRecords={appData.attendanceRecords}
            observerDisplayName={user.displayName}
            showRecapSection={false}
            isTableLoading={isLoading}
            onSave={upsertObservationRecord}
            onNavigateToDataAnak={viewDataAnak}
          />
        )
      case 'inventori':
        return (
          <InventoriPage
            childrenData={appData.children}
            supplyItems={appData.supplyInventory}
            onSaveSupplyItem={upsertSupplyInventoryItem}
            onDeleteSupplyItem={removeSupplyInventoryItem}
            onRequestConfirm={requestConfirm}
          />
        )
      case 'data-anak':
      default:
        return (
          <DataAnakPage
            childrenData={appData.children}
            viewerRole="PETUGAS"
            canManageData={false}
            onRequestConfirm={requestConfirm}
          />
        )
    }
  }

  return (
    <div className="app-shell app-shell--petugas">
      <Sidebar
        activeMenu={activeMenu}
        menus={petugasMenus}
        isOpen={isSidebarOpen}
        onMenuSelect={selectMenu}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
        userLabel={user.displayName}
        accountLabel="Akun Pendamping"
        panelTitle="Panel Petugas"
        menuLabel="Menu Petugas"
        chipLabel=""
      />

      <div className="app-main">
        <header className={`topbar ${isTopbarHidden ? 'is-hidden' : ''}`}>
          <button
            type="button"
            className="topbar__menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu"
          >
            <Menu size={18} />
          </button>
          <div id="tour-topbar-title" className="topbar__title-wrap">
            <h1>{activeHeader.title}</h1>
            <p>{activeHeader.subtitle}</p>
          </div>

          <div className="topbar__actions" />
        </header>

        <main id="tour-main-content" className="app-content">
          {statusMessage ? (
            <section className="page">
              <div className="card">
                <p>{statusMessage}</p>
                {isSyncing ? <p className="field-hint">Sinkronisasi database...</p> : null}
              </div>
            </section>
          ) : null}
          {renderPage()}
        </main>
      </div>

      {toastMessage ? (
        <div className="app-toast app-toast--success" role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      ) : null}

      {isCheckInPopupVisible ? (
        <div
          className="app-confirm-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget && checkInPopupCloseCountdown <= 0) {
              closeCheckInPopup()
            }
          }}
        >
          <div className="app-greeting-dialog" role="dialog" aria-modal="true" aria-label="Ucapan awal masuk petugas">
            {checkInPopupCloseCountdown <= 0 ? (
              <button
                type="button"
                className="app-greeting-dialog__close"
                onClick={closeCheckInPopup}
                aria-label="Tutup ucapan"
              >
                x
              </button>
            ) : null}
            <div className="app-greeting-dialog__badge">
              <img src="/logo_TPA.jpg" alt="Logo TPA Rumah Ceria" />
              <span>Dashboard Operasional</span>
            </div>
            <h3>Selamat datang kak {user.displayName}✨</h3>
            <p>
              Setiap sentuhan dan kesabaran kak {user.displayName} memberikan rasa aman dan nyaman pada anak anak dalam lingkungan TPA, semangat dan Selamat Bertugas kak {user.displayName}.
            </p>
            <div className="app-greeting-dialog__footer">
              <span className="app-greeting-dialog__countdown">
                {checkInPopupCloseCountdown > 0
                  ? `Tombol silang muncul dalam ${checkInPopupCloseCountdown} detik.`
                  : 'Anda bisa mulai bertugas sekarang.'}
              </span>
              {checkInPopupCloseCountdown <= 0 ? (
                <button
                  type="button"
                  className="button"
                  onClick={closeCheckInPopup}
                >
                  Mulai Bertugas
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <div
          className="app-confirm-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmDialog(false)
            }
          }}
        >
          <div className="app-confirm-dialog" role="alertdialog" aria-modal="true">
            <h3>{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            <div className="app-confirm-actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => closeConfirmDialog(false)}
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                type="button"
                className={`button ${confirmDialog.tone === 'danger' ? 'button--danger' : ''}`}
                onClick={() => closeConfirmDialog(true)}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLoadingOverlay ? (
        <div className="app-loading-overlay" role="status" aria-live="polite">
          <div className="app-loading-dialog">
            <div className="app-loading-spinner" aria-hidden="true" />
            <p>Menyimpan perubahan...</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PetugasSection
