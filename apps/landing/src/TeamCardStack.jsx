import { useEffect, useRef, useState } from 'react'
import './team-card-stack.css'

const SPRING_STIFFNESS = 300
const SPRING_DAMPING = 40
const EVENT_OFFSET_PER_CARD = 35
const TEAM_MOBILE_OFFSET_PER_CARD = 20
const TEAM_MOBILE_STACK_SHIFT = -12
const DRAG_DENOMINATOR = 300
const THROW_THRESHOLD = 200
const MOBILE_BREAKPOINT = 760
const TEAM_VISIBLE_STACK_DEPTH = 5
const TEAM_MOBILE_RENDER_RADIUS = 3
const TEAM_DESKTOP_RENDER_RADIUS = 5
const TEAM_PRELOAD_RADIUS = 3
const TEAM_PRELOAD_RADIUS_MOBILE = 2
const EVENT_PRELOAD_RADIUS = 2
const EDGE_DRAG_RESISTANCE = 0.24
const EDGE_DRAG_MAX_OVERSHOOT = 0.55
const TEAM_MOBILE_SCALE_STEP = 0.062
const TEAM_MOBILE_MIN_SCALE = 0.78
const TEAM_MOBILE_ROTATION_FACTOR = 0.7
const TEAM_MOBILE_OPACITY_STEP = 0.08
const TEAM_MOBILE_MIN_OPACITY = 0.66
const TEAM_DESKTOP_OFFSET_PER_CARD = 22
const TEAM_DESKTOP_STACK_SHIFT = -18
const TEAM_DESKTOP_SWING_MULTIPLIER = 15
const TEAM_DESKTOP_SCALE_STEP = 0.036
const TEAM_DESKTOP_MIN_SCALE = 0.84
const TEAM_DESKTOP_ROTATION_FACTOR = 0.52
const TEAM_DESKTOP_Y_STEP = 1.8
const TEAM_DESKTOP_MAX_Y = 12
const TEAM_DESKTOP_OPACITY_STEP = 0.09
const TEAM_DESKTOP_MIN_OPACITY = 0.42

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getTeamRoleLabel = (item, fallbackTitle) => {
  const candidates = [
    item?.role,
    item?.position,
    item?.jabatan,
    item?.subtitle,
    item?.subTitle,
    item?.excerpt,
  ]

  const rawRole = candidates.find((value) => typeof value === 'string' && value.trim().length > 0) || ''
  const normalizedRole = rawRole.split(/\r?\n/)[0].replace(/\s+/g, ' ').trim()
  if (!normalizedRole) {
    return 'Petugas TPA'
  }

  if (normalizedRole.toLowerCase() === String(fallbackTitle || '').trim().toLowerCase()) {
    return 'Petugas TPA'
  }

  return normalizedRole.length > 56
    ? `${normalizedRole.slice(0, 53).trimEnd()}...`
    : normalizedRole
}

const clampWithResistance = (value, min, max) => {
  if (value < min) {
    return min - Math.min((min - value) * EDGE_DRAG_RESISTANCE, EDGE_DRAG_MAX_OVERSHOOT)
  }

  if (value > max) {
    return max + Math.min((value - max) * EDGE_DRAG_RESISTANCE, EDGE_DRAG_MAX_OVERSHOOT)
  }

  return value
}

export default function TeamCardStack({ items, mode = 'team' }) {
  const isEventMode = mode === 'event'
  const maxIndex = Math.max(items.length - 1, 0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragCardIndex, setDragCardIndex] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [flippedIndex, setFlippedIndex] = useState(null)
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
  })

  const currentIndexRef = useRef(0)
  const settledIndexRef = useRef(0)
  const dragStateRef = useRef(null)
  const springVelocityRef = useRef(0)
  const animationFrameRef = useRef(null)
  const dragFrameRef = useRef(null)
  const pendingIndexRef = useRef(null)
  const suppressClickUntilRef = useRef(0)
  const preloadedImagesRef = useRef(new Set())
  const roundedCurrentIndex = clamp(Math.round(currentIndex), 0, maxIndex)
  const isMobileTeamMode = isCompactViewport && !isEventMode
  const isDesktopTeamMode = !isCompactViewport && !isEventMode
  const preloadRadius = isEventMode
    ? EVENT_PRELOAD_RADIUS
    : (isCompactViewport ? TEAM_PRELOAD_RADIUS_MOBILE : TEAM_PRELOAD_RADIUS)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const onViewportChange = (event) => {
      setIsCompactViewport(event.matches)
    }

    setIsCompactViewport(mediaQuery.matches)
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onViewportChange)
      return () => mediaQuery.removeEventListener('change', onViewportChange)
    }

    mediaQuery.addListener(onViewportChange)
    return () => mediaQuery.removeListener(onViewportChange)
  }, [])

  useEffect(() => {
    const nextIndex = clamp(currentIndexRef.current, 0, maxIndex)
    if (nextIndex !== currentIndexRef.current) {
      currentIndexRef.current = nextIndex
      settledIndexRef.current = nextIndex
      setCurrentIndex(nextIndex)
    }
    if (maxIndex === 0 && items.length <= 1) {
      setFlippedIndex((previous) => (previous === 0 ? previous : null))
    }
  }, [items.length, maxIndex])

  useEffect(() => {
    preloadedImagesRef.current = new Set()
  }, [items])

  useEffect(() => {
    if (items.length === 0 || typeof window === 'undefined') {
      return
    }

    const preloadStart = Math.max(roundedCurrentIndex - preloadRadius, 0)
    const preloadEnd = Math.min(roundedCurrentIndex + preloadRadius, maxIndex)

    for (let index = preloadStart; index <= preloadEnd; index += 1) {
      const imageSrc = items[index]?.image
      if (!imageSrc || preloadedImagesRef.current.has(imageSrc)) {
        continue
      }

      preloadedImagesRef.current.add(imageSrc)
      const image = new window.Image()
      image.decoding = 'async'
      image.src = imageSrc
    }
  }, [items, maxIndex, preloadRadius, roundedCurrentIndex])

  useEffect(() => {
    const roundedIndex = clamp(Math.round(currentIndex), 0, maxIndex)
    if (flippedIndex !== null && flippedIndex !== roundedIndex) {
      setFlippedIndex(null)
    }
  }, [currentIndex, flippedIndex, maxIndex])

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current)
      }
    },
    [],
  )

  const stopAnimation = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    springVelocityRef.current = 0
  }

  const updateCurrentIndex = (nextIndex) => {
    currentIndexRef.current = nextIndex
    setCurrentIndex(nextIndex)
  }

  const queueCurrentIndex = (nextIndex) => {
    currentIndexRef.current = nextIndex
    pendingIndexRef.current = nextIndex

    if (dragFrameRef.current !== null) {
      return
    }

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null
      if (pendingIndexRef.current === null) {
        return
      }

      setCurrentIndex(pendingIndexRef.current)
      pendingIndexRef.current = null
    })
  }

  const flushQueuedCurrentIndex = () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = null
    }

    if (pendingIndexRef.current !== null) {
      setCurrentIndex(pendingIndexRef.current)
      pendingIndexRef.current = null
    }
  }

  const animateTo = (targetIndex) => {
    const safeTargetIndex = clamp(targetIndex, 0, maxIndex)
    stopAnimation()
    flushQueuedCurrentIndex()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settledIndexRef.current = safeTargetIndex
      updateCurrentIndex(safeTargetIndex)
      return
    }

    let previousTimestamp = null

    const tick = (timestamp) => {
      if (previousTimestamp === null) {
        previousTimestamp = timestamp
        animationFrameRef.current = window.requestAnimationFrame(tick)
        return
      }

      const deltaTime = Math.min((timestamp - previousTimestamp) / 1000, 1 / 20)
      previousTimestamp = timestamp

      const displacement = safeTargetIndex - currentIndexRef.current
      const acceleration =
        (SPRING_STIFFNESS * displacement) - (SPRING_DAMPING * springVelocityRef.current)

      springVelocityRef.current += acceleration * deltaTime
      const nextIndex = currentIndexRef.current + (springVelocityRef.current * deltaTime)

      if (
        Math.abs(safeTargetIndex - nextIndex) < 0.001 &&
        Math.abs(springVelocityRef.current) < 0.001
      ) {
        settledIndexRef.current = safeTargetIndex
        updateCurrentIndex(safeTargetIndex)
        stopAnimation()
        return
      }

      updateCurrentIndex(nextIndex)
      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)
  }

  const finishDrag = (event, cancelled = false) => {
    flushQueuedCurrentIndex()
    const dragState = dragStateRef.current
    dragStateRef.current = null
    setDragCardIndex(null)
    setIsDragging(false)

    if (
      event &&
      typeof event.currentTarget?.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!dragState) {
      return
    }

    if (dragState.moved) {
      suppressClickUntilRef.current = performance.now() + 120
    }

    if (cancelled) {
      animateTo(Math.round(settledIndexRef.current))
      return
    }

    const predictedEndTranslation = dragState.translationX + (dragState.velocityX * 240)
    const snappedBaseIndex = Math.round(settledIndexRef.current)

    if (Math.abs(predictedEndTranslation) > THROW_THRESHOLD) {
      const nextIndex = predictedEndTranslation > 0
        ? snappedBaseIndex - 1
        : snappedBaseIndex + 1
      if (nextIndex !== snappedBaseIndex) {
        setFlippedIndex(null)
      }
      animateTo(nextIndex)
      return
    }

    animateTo(Math.round(currentIndexRef.current))
  }

  const handlePointerDown = (event) => {
    if (!event.isPrimary || dragStateRef.current) {
      return
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    if (items.length <= 1) {
      return
    }

    stopAnimation()
    settledIndexRef.current = currentIndexRef.current
    setDragCardIndex(clamp(Math.round(currentIndexRef.current), 0, maxIndex))
    setIsDragging(true)
    dragStateRef.current = {
      axis: null,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTimestamp: event.timeStamp,
      moved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      translationX: 0,
      velocityX: 0,
    }

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const handlePointerMove = (event) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const totalDeltaX = event.clientX - dragState.startClientX
    const totalDeltaY = event.clientY - dragState.startClientY
    if (dragState.axis === null) {
      if (Math.abs(totalDeltaX) < 3 && Math.abs(totalDeltaY) < 3) {
        return
      }

      dragState.axis = Math.abs(totalDeltaX) >= Math.abs(totalDeltaY) ? 'x' : 'y'
    }

    if (dragState.axis === 'y') {
      finishDrag(event, true)
      return
    }

    const translationX = event.clientX - dragState.startClientX
    const deltaX = event.clientX - dragState.lastClientX
    const deltaTime = Math.max(event.timeStamp - dragState.lastTimestamp, 1)

    dragState.translationX = translationX
    dragState.velocityX = deltaX / deltaTime
    dragState.lastClientX = event.clientX
    dragState.lastClientY = event.clientY
    dragState.lastTimestamp = event.timeStamp
    dragState.moved = dragState.moved || Math.abs(translationX) > 4

    const rawDragIndex = settledIndexRef.current - (translationX / DRAG_DENOMINATOR)
    const nextDragIndex = isMobileTeamMode
      ? clamp(rawDragIndex, 0, maxIndex)
      : clampWithResistance(rawDragIndex, 0, maxIndex)
    queueCurrentIndex(nextDragIndex)
  }

  const handlePointerUp = (event) => {
    finishDrag(event)
  }

  const handlePointerCancel = (event) => {
    finishDrag(event, true)
  }

  const handleClickCapture = (event) => {
    if (performance.now() <= suppressClickUntilRef.current) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const handleCardClick = () => {
    if (performance.now() <= suppressClickUntilRef.current) {
      return
    }

    const roundedIndex = clamp(Math.round(currentIndexRef.current), 0, maxIndex)
    setFlippedIndex((previous) => (previous === roundedIndex ? null : roundedIndex))
  }

  const handleCardKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    handleCardClick()
  }

  const interactiveIndex = dragCardIndex ?? roundedCurrentIndex
  const teamRenderRadius = isEventMode
    ? Number.POSITIVE_INFINITY
    : (isMobileTeamMode ? TEAM_MOBILE_RENDER_RADIUS : TEAM_DESKTOP_RENDER_RADIUS)
  const shouldUse2DTransform = isMobileTeamMode
  const mobileStackAnchorIndex = isMobileTeamMode && !isEventMode && isDragging
    ? clamp(Math.round(settledIndexRef.current), 0, maxIndex)
    : roundedCurrentIndex
  const focusIndexForRender = isEventMode
    ? currentIndex
    : (
      isDragging
        ? (isMobileTeamMode ? mobileStackAnchorIndex : currentIndex)
        : roundedCurrentIndex
    )
  const renderBuffer = isDragging && !isEventMode ? (isMobileTeamMode ? 2 : 1) : 0

  return (
    <div
      className={`team-card-stack ${isEventMode ? 'team-card-stack--event' : 'team-card-stack--team'} ${isMobileTeamMode ? 'team-card-stack--mobile-team' : ''} ${isDesktopTeamMode ? 'team-card-stack--desktop-team' : ''} ${isDragging ? 'is-dragging' : ''}`}
      role="region"
      aria-label={isEventMode ? 'Daftar event kegiatan' : 'Daftar profil tim pengasuh'}
      onClickCapture={handleClickCapture}
    >
      <div className={`team-card-stack__stage ${isEventMode ? 'team-card-stack__stage--event' : ''}`}>
        {items.map((item, index) => {
          const distanceFromFocus = Math.abs(index - focusIndexForRender)
          if (distanceFromFocus > (teamRenderRadius + renderBuffer) && interactiveIndex !== index) {
            return null
          }

          const isTopCard = interactiveIndex === index
          const motionIndex = isMobileTeamMode && !isEventMode && !isTopCard
            ? mobileStackAnchorIndex
            : currentIndex
          const currentPosition = motionIndex - index
          const clampedPosition = isEventMode
            ? currentPosition
            : clamp(currentPosition, -TEAM_VISIBLE_STACK_DEPTH, TEAM_VISIBLE_STACK_DEPTH)
          const teamPosition = isEventMode
            ? currentPosition
            : (isMobileTeamMode ? currentPosition : clampedPosition)
          const stackShiftX = isEventMode
            ? 0
            : (isMobileTeamMode ? TEAM_MOBILE_STACK_SHIFT : TEAM_DESKTOP_STACK_SHIFT)
          const baseOffset = isEventMode
            ? ((index - currentIndex) * EVENT_OFFSET_PER_CARD)
            : (
              isMobileTeamMode
                ? ((-teamPosition) * TEAM_MOBILE_OFFSET_PER_CARD)
                : ((-teamPosition) * TEAM_DESKTOP_OFFSET_PER_CARD)
            )
          const hasSwingOut =
            currentPosition > 0 &&
            currentPosition < 0.99 &&
            index < items.length - 1
          const shouldApplySwingOut = hasSwingOut && (isEventMode || !isMobileTeamMode)
          const swingOutMultiplier = hasSwingOut
            ? Math.sin(Math.PI * currentPosition) * (
              isEventMode
                ? 15
                : TEAM_DESKTOP_SWING_MULTIPLIER
            )
            : 1
          const translateX = (shouldApplySwingOut ? baseOffset * swingOutMultiplier : baseOffset) + stackShiftX
          const scale = isEventMode
            ? Math.max(0.72, 1 - (0.1 * Math.abs(currentPosition)))
            : (
              isMobileTeamMode
                ? Math.max(TEAM_MOBILE_MIN_SCALE, 1 - (TEAM_MOBILE_SCALE_STEP * Math.abs(teamPosition)))
                : Math.max(TEAM_DESKTOP_MIN_SCALE, 1 - (TEAM_DESKTOP_SCALE_STEP * Math.abs(teamPosition)))
            )
          const rotation = isEventMode
            ? (-currentPosition * 2)
            : (
              isMobileTeamMode
                ? (-teamPosition * TEAM_MOBILE_ROTATION_FACTOR)
                : (-teamPosition * TEAM_DESKTOP_ROTATION_FACTOR)
            )
          const translateY = isEventMode
            ? 0
            : (
              isMobileTeamMode
                ? 0
                : Math.min(Math.abs(teamPosition) * TEAM_DESKTOP_Y_STEP, TEAM_DESKTOP_MAX_Y)
            )
          const stackOpacity = isEventMode
            ? 1
            : (
              isMobileTeamMode
                ? 1
                : clamp(
                  1 - (Math.abs(teamPosition) * TEAM_DESKTOP_OPACITY_STEP),
                  TEAM_DESKTOP_MIN_OPACITY,
                  1,
                )
            )
          const isBackCard = !isTopCard
          const sideClass = isEventMode
            ? ''
            : (isMobileTeamMode ? '' : (teamPosition > 0 ? 'is-left' : (teamPosition < 0 ? 'is-right' : '')))
          const teamStackDepth = isEventMode
            ? 1
            : Math.max(1, Math.ceil(Math.abs(teamPosition)))
          const zIndexBase = items.length * 2
          let zIndex
          if (isEventMode) {
            zIndex = index + 0.5 < currentIndex
              ? zIndexBase - (items.length + index)
              : zIndexBase + (items.length - index)
          } else {
            const depthFromTop = Math.abs(teamPosition)
            zIndex = zIndexBase + (TEAM_VISIBLE_STACK_DEPTH - depthFromTop)
            if (teamPosition > 0) {
              zIndex -= 0.01
            }
          }
          if (isTopCard) {
            zIndex = zIndexBase + items.length + TEAM_VISIBLE_STACK_DEPTH + 6
          }

          const isFlipped = flippedIndex === index
          const fallbackTeamScore = (8 + ((((item.title || '').length + index) % 10) / 10)).toFixed(1)
          const badgeLabel = isEventMode
            ? (item.period || 'Event')
            : String(item.rating || item.score || item.badge || fallbackTeamScore)
          const backPeriodLabel = isEventMode ? (item.period || 'Event') : 'Tim Kami'
          const backDescription = isEventMode
            ? (item.excerpt || item.content || 'Keterangan event belum tersedia.')
            : (item.content || item.excerpt || 'Profil tim belum ditambahkan.')
          const teamRoleLabel = isEventMode ? '' : getTeamRoleLabel(item, item.title)
          const cardAriaLabel = isTopCard
            ? (
              isEventMode
                ? `Kartu event ${item.title}. Geser ke kiri atau kanan untuk pindah kartu. Klik untuk ${isFlipped ? 'kembali ke sisi depan' : 'membuka detail event'}.`
                : `Kartu tim ${item.title}. Geser ke kiri atau kanan untuk pindah kartu. Klik untuk ${isFlipped ? 'kembali ke sisi depan' : 'membuka profil lengkap'}.`
            )
            : undefined
          const tapHint = isEventMode
            ? 'Geser kiri atau kanan. Klik untuk lihat detail.'
            : 'Geser kiri atau kanan. Klik untuk lihat profil.'
          const flipHint = isEventMode
            ? 'Klik untuk kembali. Geser untuk pindah ke event lain.'
            : 'Klik untuk kembali. Geser untuk pindah ke kartu lain.'
          const imageDistance = Math.abs(index - roundedCurrentIndex)
          const eagerDistance = isCompactViewport ? 0 : 2
          const cardKey = item.id || item.deckKey || `${mode}-${index}-${item.title || 'item'}`
          const transformValue = shouldUse2DTransform
            ? `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`
            : `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale}) rotate(${rotation}deg)`

          return (
            <div
              key={cardKey}
              className={`team-card-stack__item ${isTopCard ? 'is-top' : ''} ${isBackCard && !isEventMode ? `is-back ${sideClass}` : ''}`}
              style={{
                '--team-stack-depth': teamStackDepth,
                transform: transformValue,
                opacity: stackOpacity,
                zIndex,
              }}
            >
              <article
                className={`team-card-stack__card ${isEventMode ? 'team-card-stack__card--event' : 'team-card-stack__card--team'} ${isTopCard ? 'is-top' : ''} ${isDragging && isTopCard ? 'is-dragging' : ''} ${isFlipped ? 'is-flipped' : ''}`}
                onClick={isTopCard ? handleCardClick : undefined}
                onKeyDown={isTopCard ? handleCardKeyDown : undefined}
                onPointerCancel={isTopCard ? handlePointerCancel : undefined}
                onPointerDown={isTopCard ? handlePointerDown : undefined}
                onPointerMove={isTopCard ? handlePointerMove : undefined}
                onPointerUp={isTopCard ? handlePointerUp : undefined}
                role={isTopCard ? 'button' : undefined}
                tabIndex={isTopCard ? 0 : -1}
                aria-pressed={isTopCard ? isFlipped : undefined}
                aria-label={cardAriaLabel}
              >
                <div className="kegiatan-deck-card__flip-inner">
                  <div className="kegiatan-deck-card__face kegiatan-deck-card__face--front">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="kegiatan-deck-card__image"
                      draggable={false}
                      loading={imageDistance <= eagerDistance ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={imageDistance === 0 ? 'high' : 'auto'}
                    />
                    {isEventMode ? (
                      <p className="kegiatan-deck-card__index">
                        {index + 1} / {items.length}
                      </p>
                    ) : null}
                    <p className="kegiatan-deck-card__badge">{badgeLabel}</p>
                    <h4 className={`kegiatan-deck-card__title ${isEventMode ? '' : 'kegiatan-deck-card__title--team'}`}>
                      <span className={isEventMode ? '' : 'kegiatan-deck-card__team-name'}>{item.title}</span>
                      {!isEventMode ? (
                        <span className="kegiatan-deck-card__team-role">{teamRoleLabel}</span>
                      ) : null}
                    </h4>
                    {isEventMode ? (
                      <p className="kegiatan-deck-card__tap-hint">{tapHint}</p>
                    ) : null}
                  </div>

                  <div className={`kegiatan-deck-card__face kegiatan-deck-card__face--back team-card-stack__face--back ${isEventMode ? 'team-card-stack__face--back--event' : ''}`}>
                    <p className="kegiatan-deck-card__back-period">{backPeriodLabel}</p>
                    <h4 className="kegiatan-deck-card__back-title">{item.title}</h4>
                    <p className={`kegiatan-deck-card__back-description team-card-stack__back-description ${isEventMode ? 'team-card-stack__back-description--event' : ''}`}>
                      {backDescription}
                    </p>
                    {isEventMode && item.ctaLabel && item.ctaUrl ? (
                      <a
                        href={item.ctaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="button button--ghost kegiatan-event__cta team-card-stack__cta"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        {item.ctaLabel}
                      </a>
                    ) : null}
                    <p className="kegiatan-deck-card__flip-hint">{flipHint}</p>
                  </div>
                </div>
              </article>
            </div>
          )
        })}
      </div>

      <div className={`kegiatan-deck__meta kegiatan-deck__meta--hint tim-deck__meta ${isEventMode ? 'tim-deck__meta--event' : ''}`}>
        <p>
          {isEventMode
            ? 'Saat mencapai kartu terakhir, geser ke kanan akan menurunkan kartu itu ke belakang kanan dan menampilkan event sebelumnya di depan.'
            : 'Saat mencapai kartu terakhir, geser ke kanan akan menurunkan kartu itu ke belakang kanan dan menampilkan kartu sebelumnya di depan.'}
        </p>
      </div>
    </div>
  )
}
