import {
  CheckCircle2,
  Menu,
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

function PetugasSection({ user, onLogout }: PetugasSectionProps) {
  const [appData, setAppData] = useState<AppData>(() => createEmptyAppData())
  const appDataRef = useRef<AppData>(createEmptyAppData())
  const [activeMenu, setActiveMenu] = useState<PetugasMenuKey>('kehadiran')
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [isSyncing, setSyncing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(
    null,
  )
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const confirmResolveRef = useRef<((result: boolean) => void) | null>(null)
  const initialMenuRef = useRef<PetugasMenuKey>(activeMenu)
  const isApplyingNavigationHistoryRef = useRef(false)
  const hasInitializedNavigationHistoryRef = useRef(false)
  const isTopbarHidden = useHideOnScroll()
  const loadRequestIdRef = useRef(0)
  const loadedSegmentsRef = useRef<Set<PetugasDataSegment>>(new Set())

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
      options?: { manualReload?: boolean },
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

        if (options?.manualReload) {
          setStatusMessage(`Data "${menuTitles[menu].title}" berhasil dimuat ulang.`)
        } else {
          setStatusMessage(null)
        }
      } catch (error) {
        if (requestId !== loadRequestIdRef.current) {
          return
        }

        const menuLabel = menuTitles[menu].title.toLowerCase()
        setStatusMessage(`Gagal memuat data ${menuLabel}: ${getErrorMessage(error)} `)
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    void loadMenuData(activeMenu)
  }, [activeMenu, loadMenuData])

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


  // Disabled: Attendance feature for petugas role

  return (
    <div className="app-shell">
      <Sidebar
        activeMenu={activeMenu}
        menus={petugasMenus}
        isOpen={isSidebarOpen}
        onMenuSelect={selectMenu}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
        userLabel={user.displayName}
        accountLabel="Pendamping Hari Ini"
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
