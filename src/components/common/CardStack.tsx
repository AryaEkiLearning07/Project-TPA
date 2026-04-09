import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import './CardStack.css'

type CardStackItem = {
  id: string | number
}

type CardStackRenderMeta = {
  currentIndex: number
  currentPosition: number
  index: number
  isTopCard: boolean
}

type CardStackProps<T extends CardStackItem> = {
  className?: string
  dragDenominator?: number
  height?: CSSProperties['height']
  initialIndex?: number
  items: readonly T[]
  offsetPerCard?: number
  onIndexChange?: (index: number) => void
  renderCard: (item: T, meta: CardStackRenderMeta) => ReactNode
  throwThreshold?: number
  width?: CSSProperties['width']
}

type DragState = {
  lastClientX: number
  lastTimestamp: number
  moved: boolean
  pointerId: number
  startClientX: number
  translationX: number
  velocityX: number
}

const SPRING_STIFFNESS = 300
const SPRING_DAMPING = 40

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const toDimension = (value: CSSProperties['width'] | CSSProperties['height'] | undefined) => {
  if (typeof value === 'number') {
    return `${value}px`
  }

  return value
}

function CardStack<T extends CardStackItem>({
  className,
  dragDenominator = 300,
  height = 400,
  initialIndex = 0,
  items,
  offsetPerCard = 35,
  onIndexChange,
  renderCard,
  throwThreshold = 200,
  width = 'min(100%, 420px)',
}: CardStackProps<T>) {
  const maxIndex = Math.max(items.length - 1, 0)
  const startingIndex = clamp(initialIndex, 0, maxIndex)

  const [currentIndex, setCurrentIndex] = useState(startingIndex)
  const [isDragging, setIsDragging] = useState(false)

  const currentIndexRef = useRef(startingIndex)
  const dragStateRef = useRef<DragState | null>(null)
  const onIndexChangeRef = useRef(onIndexChange)
  const rafRef = useRef<number | null>(null)
  const settledIndexRef = useRef(startingIndex)
  const springVelocityRef = useRef(0)
  const suppressClickUntilRef = useRef(0)

  useEffect(() => {
    onIndexChangeRef.current = onIndexChange
  }, [onIndexChange])

  useEffect(() => {
    const nextIndex = clamp(currentIndexRef.current, 0, maxIndex)
    if (nextIndex !== currentIndexRef.current) {
      currentIndexRef.current = nextIndex
      settledIndexRef.current = nextIndex
      setCurrentIndex(nextIndex)
      onIndexChangeRef.current?.(nextIndex)
    }
  }, [maxIndex])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const updateCurrentIndex = (nextIndex: number) => {
    currentIndexRef.current = nextIndex
    setCurrentIndex(nextIndex)
  }

  const stopAnimation = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    springVelocityRef.current = 0
  }

  const animateTo = (targetIndex: number) => {
    const safeTargetIndex = clamp(targetIndex, 0, maxIndex)
    stopAnimation()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settledIndexRef.current = safeTargetIndex
      updateCurrentIndex(safeTargetIndex)
      onIndexChangeRef.current?.(safeTargetIndex)
      return
    }

    let previousTimestamp: number | null = null

    const tick = (timestamp: number) => {
      if (previousTimestamp === null) {
        previousTimestamp = timestamp
        rafRef.current = window.requestAnimationFrame(tick)
        return
      }

      const deltaTime = Math.min((timestamp - previousTimestamp) / 1000, 1 / 20)
      previousTimestamp = timestamp

      const displacement = safeTargetIndex - currentIndexRef.current
      const acceleration =
        SPRING_STIFFNESS * displacement - SPRING_DAMPING * springVelocityRef.current

      springVelocityRef.current += acceleration * deltaTime
      const nextIndex = currentIndexRef.current + springVelocityRef.current * deltaTime

      if (
        Math.abs(safeTargetIndex - nextIndex) < 0.001 &&
        Math.abs(springVelocityRef.current) < 0.001
      ) {
        settledIndexRef.current = safeTargetIndex
        updateCurrentIndex(safeTargetIndex)
        onIndexChangeRef.current?.(safeTargetIndex)
        stopAnimation()
        return
      }

      updateCurrentIndex(nextIndex)
      rafRef.current = window.requestAnimationFrame(tick)
    }

    rafRef.current = window.requestAnimationFrame(tick)
  }

  const finishDrag = (pointerTarget: Element | null, pointerId: number, cancelled = false) => {
    const dragState = dragStateRef.current
    dragStateRef.current = null
    setIsDragging(false)

    if (
      pointerTarget instanceof HTMLElement &&
      pointerTarget.hasPointerCapture(pointerId)
    ) {
      pointerTarget.releasePointerCapture(pointerId)
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

    const predictedEndTranslation = dragState.translationX + dragState.velocityX * 240
    const snappedBaseIndex = Math.round(settledIndexRef.current)

    if (Math.abs(predictedEndTranslation) > throwThreshold) {
      animateTo(predictedEndTranslation > 0 ? snappedBaseIndex - 1 : snappedBaseIndex + 1)
      return
    }

    animateTo(Math.round(currentIndexRef.current))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (items.length <= 1) {
      return
    }

    stopAnimation()
    settledIndexRef.current = currentIndexRef.current
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
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
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

    updateCurrentIndex(settledIndexRef.current - translationX / dragDenominator)
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    finishDrag(event.currentTarget, event.pointerId)
  }

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    finishDrag(event.currentTarget, event.pointerId, true)
  }

  const handleClickCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (performance.now() <= suppressClickUntilRef.current) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const stackStyle = {
    '--card-stack-height': toDimension(height),
    '--card-stack-width': toDimension(width),
  } as CSSProperties

  const rootClassName = ['card-stack', isDragging ? 'is-dragging' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClassName}
      onClickCapture={handleClickCapture}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={stackStyle}
    >
      {items.map((item, index) => {
        const currentPosition = currentIndex - index
        const baseOffset = (index - currentIndex) * offsetPerCard
        const swingOutMultiplier =
          currentPosition > 0 && currentPosition < 0.99 && index < items.length - 1
            ? Math.sin(Math.PI * currentPosition) * 15
            : 1
        const xOffset =
          currentPosition > 0 && currentPosition < 0.99 && index < items.length - 1
            ? baseOffset * swingOutMultiplier
            : baseOffset
        const scale = 1 - 0.1 * Math.abs(currentPosition)
        const rotation = -currentPosition * 2
        const zIndex =
          index + 0.5 < currentIndex ? -(items.length - index) : items.length - index

        return (
          <div
            className="card-stack__item"
            key={item.id}
            style={{
              transform: `translate3d(${xOffset}px, 0, 0) scale(${scale}) rotate(${rotation}deg)`,
              zIndex,
            }}
          >
            <div className="card-stack__card">
              {renderCard(item, {
                currentIndex,
                currentPosition,
                index,
                isTopCard: Math.round(currentIndex) === index,
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CardStack
export type { CardStackItem, CardStackProps, CardStackRenderMeta }
