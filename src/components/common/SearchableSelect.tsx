import { Check, ChevronDown, Search, X } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../App.css'

interface Option {
  value: string
  label: string
  badge?: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  maxHeight?: string
  searchable?: boolean
  clearable?: boolean
  usePortal?: boolean
  portalZIndex?: number
}

const parseLengthToPx = (value: string): number | null => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null

  if (normalized.endsWith('px')) {
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (normalized.endsWith('rem')) {
    const parsed = Number.parseFloat(normalized)
    if (!Number.isFinite(parsed)) return null
    const rootFontSize = Number.parseFloat(
      window.getComputedStyle(document.documentElement).fontSize,
    )
    return parsed * (Number.isFinite(rootFontSize) ? rootFontSize : 16)
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Pilih opsi...',
  emptyMessage = 'Tidak ada data',
  disabled = false,
  className = '',
  maxHeight = '14rem',
  searchable = true,
  clearable = true,
  usePortal = false,
  portalZIndex = 500,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null)
  const [portalListMaxHeight, setPortalListMaxHeight] = useState<string>(maxHeight)

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  )

  const filteredOptions = useMemo(() => {
    if (!searchable) return options
    if (!searchQuery.trim()) return options
    const query = searchQuery.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(query))
  }, [options, searchQuery, searchable])

  const closeDropdown = () => {
    setIsOpen(false)
    setSearchQuery('')
    setPortalStyle(null)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedInsideContainer = containerRef.current?.contains(target) ?? false
      const clickedInsideDropdown = dropdownRef.current?.contains(target) ?? false

      if (
        !clickedInsideContainer &&
        !clickedInsideDropdown
      ) {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, searchable])

  useEffect(() => {
    if (!usePortal || !isOpen || disabled) {
      return
    }

    const updatePortalLayout = () => {
      if (!triggerRef.current) return

      const rect = triggerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const sidePadding = 8
      const verticalGap = 4
      const searchBoxHeight = searchable ? 54 : 0
      const dropdownPadding = 14
      const minDropdownHeight = 168

      const spaceBelow = viewportHeight - rect.bottom - sidePadding
      const spaceAbove = rect.top - sidePadding
      const shouldOpenUp = spaceBelow < minDropdownHeight && spaceAbove > spaceBelow
      const availableHeight = Math.max(
        minDropdownHeight,
        (shouldOpenUp ? spaceAbove : spaceBelow) - verticalGap,
      )

      const preferredListHeight = parseLengthToPx(maxHeight) ?? 224
      const availableListHeight = Math.max(
        96,
        availableHeight - searchBoxHeight - dropdownPadding,
      )
      const listHeight = Math.min(preferredListHeight, availableListHeight)

      const safeWidth = Math.min(rect.width, viewportWidth - sidePadding * 2)
      const safeLeft = Math.min(
        Math.max(rect.left, sidePadding),
        viewportWidth - safeWidth - sidePadding,
      )

      const nextStyle: React.CSSProperties = {
        position: 'fixed',
        left: safeLeft,
        width: safeWidth,
        zIndex: portalZIndex,
      }

      if (shouldOpenUp) {
        nextStyle.top = rect.top - verticalGap
        nextStyle.transform = 'translateY(-100%)'
      } else {
        nextStyle.top = rect.bottom + verticalGap
      }

      setPortalStyle(nextStyle)
      setPortalListMaxHeight(`${Math.floor(listHeight)}px`)
    }

    updatePortalLayout()
    window.addEventListener('resize', updatePortalLayout)
    window.addEventListener('scroll', updatePortalLayout, true)

    return () => {
      window.removeEventListener('resize', updatePortalLayout)
      window.removeEventListener('scroll', updatePortalLayout, true)
    }
  }, [disabled, isOpen, maxHeight, portalZIndex, searchable, usePortal])

  const handleSelect = (selectedValue: string) => {
    if (disabled) return
    onChange(selectedValue)
    closeDropdown()
  }

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!disabled) {
      onChange('')
    }
  }

  const toggleOpen = () => {
    if (disabled) return
    if (isOpen) {
      closeDropdown()
      return
    }
    setPortalStyle(null)
    setIsOpen(true)
  }

  const listMaxHeight = usePortal ? portalListMaxHeight : maxHeight

  const dropdownNode =
    isOpen && !disabled ? (
      <div
        ref={dropdownRef}
        className={`searchable-select__dropdown ${usePortal ? 'searchable-select__dropdown--portal' : ''}`}
        style={usePortal ? (portalStyle ?? undefined) : undefined}
      >
        {searchable ? (
          <div className="searchable-select__search">
            <Search size={16} className="searchable-select__search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="searchable-select__search-input"
              placeholder="Cari..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}

        <div className="searchable-select__list" style={{ maxHeight: listMaxHeight }}>
          {filteredOptions.length === 0 ? (
            <div className="searchable-select__empty">
              {searchable && searchQuery ? 'Tidak ditemukan' : emptyMessage}
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                className={`searchable-select__option ${opt.value === value ? 'is-selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                <span className="searchable-select__option-label">{opt.label}</span>
                <span className="searchable-select__option-end">
                  {opt.badge ? (
                    <span className="searchable-select__badge">{opt.badge}</span>
                  ) : null}
                  {opt.value === value ? (
                    <span className="searchable-select__check">
                      <Check size={14} />
                    </span>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    ) : null

  return (
    <div
      ref={containerRef}
      className={`searchable-select ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
    >
      <div ref={triggerRef} className="searchable-select__trigger" onClick={toggleOpen}>
        <div className="searchable-select__value">
          {selectedOption ? (
            <span className="searchable-select__value-row">
              <span className="searchable-select__label">{selectedOption.label}</span>
              {selectedOption.badge ? (
                <span className="searchable-select__badge">{selectedOption.badge}</span>
              ) : null}
            </span>
          ) : (
            <span className="searchable-select__placeholder">{placeholder}</span>
          )}
        </div>

        <div className="searchable-select__actions">
          {selectedOption && clearable && !disabled ? (
            <button
              type="button"
              className="searchable-select__clear"
              onClick={handleClear}
              title="Hapus pilihan"
            >
              <X size={16} />
            </button>
          ) : null}
          <ChevronDown
            size={18}
            className={`searchable-select__arrow ${isOpen ? 'is-active' : ''}`}
          />
        </div>
      </div>

      {usePortal
        ? (typeof document !== 'undefined' && portalStyle && dropdownNode
            ? createPortal(dropdownNode, document.body)
            : null)
        : dropdownNode}
    </div>
  )
}

export default SearchableSelect
