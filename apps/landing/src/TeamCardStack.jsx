import { useEffect, useRef, useState } from 'react'
import './team-card-stack.css'

const SPRING_STIFFNESS = 280
const SPRING_DAMPING = 32
const OFFSET_PER_CARD = 35
const DRAG_DENOMINATOR = 300
const THROW_THRESHOLD = 200

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export default function TeamCardStack({ items, mode = 'team' }) {
  const isEventMode = mode === 'event'
  const maxIndex = Math.max(items.length - 1, 0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragCardIndex, setDragCardIndex] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [flippedIndex, setFlippedIndex] = useState(null)

  const currentIndexRef = useRef(0)
  const settledIndexRef = useRef(0)
  const dragStateRef = useRef(null)
  const springVelocityRef = useRef(0)
  const animationFrameRef = useRef(null)
  const dragFrameRef = useRef(null)
  const pendingIndexRef = useRef(null)
  const suppressClickUntilRef = useRef(0)

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
      lastClientX: event.clientX,
      lastTimestamp: event.timeStamp,
      moved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
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

    const translationX = event.clientX - dragState.startClientX
    const deltaX = event.clientX - dragState.lastClientX
    const deltaTime = Math.max(event.timeStamp - dragState.lastTimestamp, 1)

    dragState.translationX = translationX
    dragState.velocityX = deltaX / deltaTime
    dragState.lastClientX = event.clientX
    dragState.lastTimestamp = event.timeStamp
    dragState.moved = dragState.moved || Math.abs(translationX) > 4

    queueCurrentIndex(settledIndexRef.current - (translationX / DRAG_DENOMINATOR))
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

  const roundedCurrentIndex = clamp(Math.round(currentIndex), 0, maxIndex)
  const interactiveIndex = dragCardIndex ?? roundedCurrentIndex

  return (
    <div
      className={`team-card-stack ${isEventMode ? 'team-card-stack--event' : 'team-card-stack--team'}`}
      role="region"
      aria-label={isEventMode ? 'Daftar event kegiatan' : 'Daftar profil tim pengasuh'}
      onClickCapture={handleClickCapture}
    >
      <div className={`team-card-stack__stage ${isEventMode ? 'team-card-stack__stage--event' : ''}`}>
        {items.map((item, index) => {
          const currentPosition = currentIndex - index
          const baseOffset = (index - currentIndex) * OFFSET_PER_CARD
          const hasSwingOut =
            currentPosition > 0 && currentPosition < 0.99 && index < items.length - 1
          const swingOutMultiplier = hasSwingOut
            ? Math.sin(Math.PI * currentPosition) * 15
            : 1
          const translateX = hasSwingOut ? baseOffset * swingOutMultiplier : baseOffset
          const scale = Math.max(0.72, 1 - (0.1 * Math.abs(currentPosition)))
          const rotation = -currentPosition * 2
          const zIndex =
            index + 0.5 < currentIndex ? -(items.length - index) : items.length - index

          const isTopCard = interactiveIndex === index
          const isFlipped = flippedIndex === index
          const badgeLabel = isEventMode ? (item.period || 'Event') : 'Profil Tim'
          const backPeriodLabel = isEventMode ? (item.period || 'Event') : 'Tim Kami'
          const backDescription = isEventMode
            ? (item.excerpt || item.content || 'Keterangan event belum tersedia.')
            : (item.content || item.excerpt || 'Profil tim belum ditambahkan.')
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
          const cardKey = item.id || item.deckKey || `${mode}-${index}-${item.title || 'item'}`

          return (
            <div
              key={cardKey}
              className={`team-card-stack__item ${isTopCard ? 'is-top' : ''}`}
              style={{
                transform: `translate3d(${translateX}px, 0, 0) scale(${scale}) rotate(${rotation}deg)`,
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
                    />
                    <p className="kegiatan-deck-card__index">
                      {index + 1} / {items.length}
                    </p>
                    <p className="kegiatan-deck-card__badge">{badgeLabel}</p>
                    <h4 className="kegiatan-deck-card__title">{item.title}</h4>
                    <p className="kegiatan-deck-card__tap-hint">{tapHint}</p>
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
