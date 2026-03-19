import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import type {
  ChildProfile,
  ConfirmDialogOptions,
  SupplyInventoryItem,
  SupplyInventoryItemInput,
} from '../../../types'
import {
  inventoryCategoryOptions,
  inventoryCategoryLabelMap,
} from '../../../constants/inventory'
import SearchableSelect from '../../../components/common/SearchableSelect'
import { compressImageToDataUrl } from '../../../utils/image'

interface InventoriPageProps {
  childrenData: ChildProfile[]
  supplyItems: SupplyInventoryItem[]
  onSaveSupplyItem: (
    input: SupplyInventoryItemInput,
    editingId?: string,
  ) => Promise<boolean>
  onDeleteSupplyItem: (id: string) => Promise<boolean>
  onRequestConfirm: (options: ConfirmDialogOptions) => Promise<boolean>
}

const MOBILE_MAX_ITEMS_PER_PAGE = 6

const getCategoryLabel = (value: string): string => {
  const selectedLabel = inventoryCategoryLabelMap.get(value)
  if (selectedLabel) {
    return selectedLabel
  }

  return value.trim() || 'Tanpa kategori'
}

const createEmptySupplyForm = (
  defaults?: Partial<Pick<SupplyInventoryItemInput, 'childId' | 'category'>>,
): SupplyInventoryItemInput => ({
  childId: defaults?.childId ?? '',
  productName: '',
  category: defaults?.category ?? '',
  quantity: 0,
  description: '',
  imageDataUrl: '',
  imageName: '',
})

const InventoriPage = ({
  childrenData,
  supplyItems,
  onSaveSupplyItem,
  onDeleteSupplyItem,
  onRequestConfirm,
}: InventoriPageProps) => {
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isFormModalOpen, setFormModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeSupplyId, setActiveSupplyId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplyInventoryItemInput>(() => createEmptySupplyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isUploading, setUploading] = useState(false)
  const [isAdjustingStock, setAdjustingStock] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [mobilePage, setMobilePage] = useState(1)

  const childNameMap = useMemo(
    () =>
      new Map(
        childrenData.map((child) => [child.id, child.fullName] as const),
      ),
    [childrenData],
  )

  const childFilterOptions = useMemo(
    () => [
      { value: '', label: 'Semua anak' },
      ...childrenData.map((child) => ({
        value: child.id,
        label: child.fullName,
      })),
    ],
    [childrenData],
  )

  const categoryFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Semua kategori' },
      ...inventoryCategoryOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    ],
    [],
  )

  const childFormOptions = useMemo(() => {
    const options = childrenData.map((child) => ({
      value: child.id,
      label: child.fullName,
    }))

    if (form.childId && !childrenData.some((child) => child.id === form.childId)) {
      options.push({
        value: form.childId,
        label: 'Data anak dihapus',
      })
    }

    return options
  }, [childrenData, form.childId])

  const categoryFormOptions = useMemo(
    () => [
      { value: '', label: 'Pilih kategori' },
      ...inventoryCategoryOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    ],
    [],
  )

  const filteredSupplies = useMemo(() => {
    const byChild = selectedChildId
      ? supplyItems.filter((item) => item.childId === selectedChildId)
      : supplyItems

    const byCategory =
      selectedCategory !== 'all'
        ? byChild.filter((item) => item.category === selectedCategory)
        : byChild

    return [...byCategory].sort((left, right) => {
      const rightTime = new Date(right.updatedAt).getTime()
      const leftTime = new Date(left.updatedAt).getTime()

      if (rightTime !== leftTime) {
        return rightTime - leftTime
      }

      return left.productName.localeCompare(right.productName, 'id')
    })
  }, [selectedCategory, selectedChildId, supplyItems])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches)
    }

    syncViewport()

    mediaQuery.addEventListener('change', syncViewport)
    return () => {
      mediaQuery.removeEventListener('change', syncViewport)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    if (!isFormModalOpen && !activeSupplyId) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    const previousTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.touchAction = previousTouchAction
    }
  }, [activeSupplyId, isFormModalOpen])

  useEffect(() => {
    setMobilePage(1)
  }, [selectedCategory, selectedChildId])

  const mobileTotalPages = useMemo(() => {
    if (!isMobileViewport) {
      return 1
    }

    return Math.max(1, Math.ceil(filteredSupplies.length / MOBILE_MAX_ITEMS_PER_PAGE))
  }, [filteredSupplies.length, isMobileViewport])

  useEffect(() => {
    if (!isMobileViewport) {
      setMobilePage(1)
      return
    }

    setMobilePage((previous) => Math.min(previous, mobileTotalPages))
  }, [isMobileViewport, mobileTotalPages])

  const visibleSupplies = useMemo(() => {
    if (!isMobileViewport) {
      return filteredSupplies
    }

    const startIndex = (mobilePage - 1) * MOBILE_MAX_ITEMS_PER_PAGE
    return filteredSupplies.slice(startIndex, startIndex + MOBILE_MAX_ITEMS_PER_PAGE)
  }, [filteredSupplies, isMobileViewport, mobilePage])

  const activeSupply = useMemo(
    () =>
      supplyItems.find((item) => item.id === activeSupplyId) ?? null,
    [activeSupplyId, supplyItems],
  )

  const openAddModal = () => {
    setDetailError(null)
    setEditingId(null)
    setForm(
      createEmptySupplyForm({
        childId: selectedChildId,
        category: selectedCategory !== 'all' ? selectedCategory : '',
      }),
    )
    setFormError(null)
    setFormModalOpen(true)
  }

  const openEditModal = (item: SupplyInventoryItem) => {
    setDetailError(null)
    setEditingId(item.id)
    setForm({
      childId: item.childId,
      productName: item.productName,
      category: item.category,
      quantity: item.quantity,
      description: item.description,
      imageDataUrl: item.imageDataUrl,
      imageName: item.imageName,
    })
    setFormError(null)
    setActiveSupplyId(null)
    setFormModalOpen(true)
  }

  const closeFormModal = () => {
    setFormModalOpen(false)
    setFormError(null)
  }

  const handleSupplyImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploading(true)
    setFormError(null)

    try {
      const compressed = await compressImageToDataUrl(file, {
        maxDimension: 1024,
        quality: 0.75,
        aspectRatio: 1,
      })
      setForm((previous) => ({
        ...previous,
        imageDataUrl: compressed.dataUrl,
        imageName: compressed.name,
      }))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Gagal mengunggah foto barang.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleSaveSupply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalized: SupplyInventoryItemInput = {
      ...form,
      childId: form.childId.trim(),
      productName: form.productName.trim(),
      category: form.category.trim(),
      quantity: Number.isFinite(form.quantity) ? Math.max(0, Math.floor(form.quantity)) : 0,
      description: form.description.trim(),
      imageDataUrl: form.imageDataUrl,
      imageName: form.imageName.trim(),
    }

    if (!normalized.childId) {
      setFormError('Nama anak wajib dipilih.')
      return
    }

    if (!normalized.productName) {
      setFormError('Nama barang wajib diisi.')
      return
    }

    if (!normalized.category) {
      setFormError('Kategori barang wajib dipilih.')
      return
    }

    if (!normalized.imageDataUrl) {
      setFormError('Foto barang wajib diunggah.')
      return
    }

    if (!normalized.description) {
      setFormError('Deskripsi singkat wajib diisi.')
      return
    }

    const success = await onSaveSupplyItem(normalized, editingId ?? undefined)
    if (!success) {
      setFormError('Gagal menyimpan data barang.')
      return
    }

    setSelectedChildId(normalized.childId)
    setFormModalOpen(false)
    setEditingId(null)
    setFormError(null)
  }

  const handleDeleteSupply = async (item: SupplyInventoryItem) => {
    const confirmed = await onRequestConfirm({
      title: 'Hapus Barang Persediaan',
      message: `Hapus barang "${item.productName}" dari inventori?`,
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      tone: 'danger',
    })

    if (!confirmed) {
      return
    }

    const success = await onDeleteSupplyItem(item.id)
    if (!success) {
      setDetailError('Gagal menghapus barang.')
      return
    }

    if (activeSupplyId === item.id) {
      setActiveSupplyId(null)
    }
  }

  const handleAdjustStock = async (delta: number) => {
    if (!activeSupply) {
      return
    }

    if (!activeSupply.childId || !activeSupply.category) {
      setDetailError('Lengkapi nama anak dan kategori lewat tombol Edit Barang terlebih dahulu.')
      return
    }

    const nextQuantity = Math.max(0, activeSupply.quantity + delta)
    if (nextQuantity === activeSupply.quantity) {
      return
    }

    setAdjustingStock(true)
    setDetailError(null)

    const success = await onSaveSupplyItem(
      {
        childId: activeSupply.childId,
        productName: activeSupply.productName,
        category: activeSupply.category,
        quantity: nextQuantity,
        description: activeSupply.description,
        imageDataUrl: activeSupply.imageDataUrl,
        imageName: activeSupply.imageName,
      },
      activeSupply.id,
    )

    if (!success) {
      setDetailError('Gagal memperbarui stok barang.')
    }

    setAdjustingStock(false)
  }

  return (
    <section className="page page--inventori">
      <div className="card">
        <h2>Persediaan Pokok</h2>

        <div id="tour-inventori-toolbar" className="inventory-toolbar">
          <div className="field-group field-group--small">
            <label className="label">
              Anak
            </label>
            <SearchableSelect
              value={selectedChildId}
              onChange={(value) => setSelectedChildId(value)}
              options={childFilterOptions}
              placeholder="Semua anak"
              emptyMessage="Belum ada data anak"
              usePortal
            />
          </div>

          <div className="field-group field-group--small">
            <label className="label">
              Kategori
            </label>
            <SearchableSelect
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              options={categoryFilterOptions}
              placeholder="Pilih kategori"
              searchable={false}
              clearable={false}
              usePortal
            />
          </div>

          <div className="inventory-toolbar__actions">
            <button type="button" className="button" onClick={openAddModal}>
              Tambah Barang
            </button>
          </div>
        </div>

        {filteredSupplies.length === 0 ? (
          <div className="empty-state inventory-empty-state">
            <p>
              Belum ada persediaan {selectedCategory !== 'all' ? getCategoryLabel(selectedCategory) : 'semua kategori'} untuk {selectedChildId ? (childNameMap.get(selectedChildId) ?? 'anak ini') : 'semua anak'}.
            </p>
          </div>
        ) : (
          <div id="tour-inventori-grid" className="inventory-shop-grid">
            {visibleSupplies.map((item) => (
              <button
                key={item.id}
                type="button"
                className="inventory-shop-card"
                onClick={() => {
                  setDetailError(null)
                  setActiveSupplyId(item.id)
                }}
              >
                <div className="inventory-shop-card__image-wrap">
                  {item.imageDataUrl ? (
                    <img src={item.imageDataUrl} alt={item.productName} />
                  ) : (
                    <span>Tanpa foto</span>
                  )}
                </div>

                <div className="inventory-shop-card__meta">
                  <strong>{item.productName}</strong>
                  <span className="inventory-shop-card__owner">
                    Pemilik: {childNameMap.get(item.childId) ?? 'Data anak dihapus'}
                  </span>
                  <span>Kategori: {getCategoryLabel(item.category)}</span>
                  <span>Jumlah: {item.quantity}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {isMobileViewport && filteredSupplies.length > MOBILE_MAX_ITEMS_PER_PAGE ? (
          <div className="inventory-pagination">
            <button
              type="button"
              className="button button--ghost button--tiny"
              onClick={() => setMobilePage((previous) => Math.max(1, previous - 1))}
              disabled={mobilePage <= 1}
            >
              Previous
            </button>
            <span className="inventory-pagination__indicator">
              {mobilePage} / {mobileTotalPages}
            </span>
            <button
              type="button"
              className="button button--tiny"
              onClick={() =>
                setMobilePage((previous) => Math.min(mobileTotalPages, previous + 1))
              }
              disabled={mobilePage >= mobileTotalPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {isFormModalOpen ? (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeFormModal()
            }
          }}
        >
          <div className="modal-content modal-content--large inventory-modal inventory-modal--form">
            <div className="modal-header">
              <h2>{editingId ? 'Edit Barang Persediaan' : 'Tambah Barang Persediaan'}</h2>
              <button type="button" className="modal-close" onClick={closeFormModal}>
                X
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSaveSupply} className="inventory-item-form">
                <div className="inventory-photo-picker">
                  <label className="label" htmlFor="supplyImage">
                    Foto Barang
                  </label>
                  <label
                    className="inventory-supply-preview inventory-supply-preview--picker"
                    htmlFor="supplyImage"
                  >
                    {form.imageDataUrl ? (
                      <img src={form.imageDataUrl} alt={form.productName || 'Preview barang'} />
                    ) : (
                      <span>Klik untuk pilih foto</span>
                    )}
                  </label>
                  <input
                    id="supplyImage"
                    className="inventory-supply-input-hidden"
                    type="file"
                    accept="image/*"
                    onChange={handleSupplyImageUpload}
                  />
                  <small className="field-hint">Klik frame foto untuk memilih atau mengganti foto.</small>
                </div>

                <div className="form-grid form-grid--3">
                  <div className="field-group">
                    <label className="label">
                      Nama Anak
                    </label>
                    <SearchableSelect
                      value={form.childId}
                      onChange={(value) =>
                        setForm((previous) => ({
                          ...previous,
                          childId: value,
                        }))
                      }
                      options={childFormOptions}
                      placeholder="Pilih anak"
                      emptyMessage="Belum ada data anak"
                      clearable={false}
                      usePortal
                      portalZIndex={1400}
                    />
                  </div>

                  <div className="field-group">
                    <label className="label">
                      Kategori Barang
                    </label>
                    <SearchableSelect
                      value={form.category}
                      onChange={(value) =>
                        setForm((previous) => ({
                          ...previous,
                          category: value,
                        }))
                      }
                      options={categoryFormOptions}
                      placeholder="Pilih kategori"
                      searchable={false}
                      clearable={false}
                      usePortal
                      portalZIndex={1400}
                    />
                  </div>

                  <div className="field-group field-group--small">
                    <label className="label" htmlFor="supplyQuantity">
                      Jumlah Stok
                    </label>
                    <input
                      id="supplyQuantity"
                      className="input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={Number.isFinite(form.quantity) ? form.quantity : 0}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, '')
                        setForm((previous) => ({
                          ...previous,
                          quantity: digits ? Number(digits) : 0,
                        }))
                      }}
                    />
                  </div>

                  <div className="field-group">
                    <label className="label" htmlFor="supplyProductName">
                      Nama Barang
                    </label>
                    <input
                      id="supplyProductName"
                      className="input"
                      value={form.productName}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          productName: event.target.value,
                        }))
                      }
                      placeholder="Contoh: Susu Formula A"
                    />
                  </div>

                  <div className="field-group">
                    <label className="label" htmlFor="supplyDescription">
                      Deskripsi Singkat
                    </label>
                    <textarea
                      id="supplyDescription"
                      className="input"
                      rows={2}
                      value={form.description}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Contoh: Dipakai setelah mandi sore."
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="button" disabled={isUploading}>
                    {editingId ? 'Simpan Perubahan' : 'Simpan Barang'}
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={closeFormModal}
                  >
                    Batal
                  </button>
                  {isUploading ? <span className="field-hint">Mengunggah gambar...</span> : null}
                </div>

                {formError ? <p className="field-error">{formError}</p> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {activeSupply ? (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setActiveSupplyId(null)
            }
          }}
        >
          <div className="modal-content modal-content--large inventory-modal inventory-modal--detail">
            <div className="modal-header">
              <h2>Detail Barang Persediaan</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setActiveSupplyId(null)}
              >
                X
              </button>
            </div>

            <div className="modal-body">
              <div className="inventory-detail">
                <div className="inventory-detail__image">
                  {activeSupply.imageDataUrl ? (
                    <img src={activeSupply.imageDataUrl} alt={activeSupply.productName} />
                  ) : (
                    <span>Tanpa foto</span>
                  )}
                </div>

                <div className="inventory-detail__meta">
                  <h3>{activeSupply.productName}</h3>
                  <p>
                    <strong>Pemilik:</strong>{' '}
                    {childNameMap.get(activeSupply.childId) ?? 'Data anak dihapus'}
                  </p>
                  <p>
                    <strong>Kategori:</strong> {getCategoryLabel(activeSupply.category)}
                  </p>
                  <p>
                    <strong>Deskripsi:</strong> {activeSupply.description || '-'}
                  </p>

                  <div className="inventory-stock-stepper">
                    <span className="label">Jumlah Stok</span>
                    <div className="inventory-stock-stepper__controls">
                      <button
                        type="button"
                        className="button button--ghost button--tiny"
                        onClick={() => void handleAdjustStock(-1)}
                        disabled={isAdjustingStock || activeSupply.quantity <= 0}
                      >
                        -
                      </button>
                      <strong>{activeSupply.quantity}</strong>
                      <button
                        type="button"
                        className="button button--tiny"
                        onClick={() => void handleAdjustStock(1)}
                        disabled={isAdjustingStock}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => openEditModal(activeSupply)}
                    >
                      Edit Barang
                    </button>
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => void handleDeleteSupply(activeSupply)}
                    >
                      Hapus Barang
                    </button>
                  </div>

                  {detailError ? <p className="field-error">{detailError}</p> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default InventoriPage
