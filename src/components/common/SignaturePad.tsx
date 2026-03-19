import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react'

interface SignaturePadProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  onDisabledInteract?: () => void
}

const CANVAS_HEIGHT = 180

const SignaturePad = ({
  label,
  value,
  onChange,
  error,
  disabled = false,
  onDisabledInteract,
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)

  const paintBackground = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      context.fillStyle = disabled ? '#f2f2f2' : '#ffffff'
      context.fillRect(0, 0, width, height)
      context.strokeStyle = '#e4e0d7'
      context.strokeRect(0.5, 0.5, width - 1, height - 1)
    },
    [disabled],
  )

  const renderValue = useCallback(
    (signature: string) => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const ratio = window.devicePixelRatio || 1
      const cssWidth = canvas.clientWidth || 560
      const cssHeight = CANVAS_HEIGHT

      canvas.width = Math.floor(cssWidth * ratio)
      canvas.height = Math.floor(cssHeight * ratio)

      const context = canvas.getContext('2d')
      if (!context) {
        return
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.strokeStyle = '#292929'
      context.lineWidth = 2

      paintBackground(context, cssWidth, cssHeight)

      if (!signature) {
        return
      }

      const image = new Image()
      image.onload = () => {
        context.drawImage(image, 0, 0, cssWidth, cssHeight)
      }
      image.src = signature
    },
    [paintBackground],
  )

  useEffect(() => {
    renderValue(value)
  }, [renderValue, value])

  useEffect(() => {
    const handleResize = () => renderValue(value)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [renderValue, value])

  const getPointerPosition = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (disabled) {
      onDisabledInteract?.()
      return
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }

    const pointer = getPointerPosition(event)
    context.beginPath()
    context.moveTo(pointer.x, pointer.y)
    isDrawingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!isDrawingRef.current || disabled) {
      return
    }

    const context = canvasRef.current?.getContext('2d')
    if (!context) {
      return
    }

    const pointer = getPointerPosition(event)
    context.lineTo(pointer.x, pointer.y)
    context.stroke()
  }

  const stopDrawing = (): void => {
    if (!isDrawingRef.current) {
      return
    }

    isDrawingRef.current = false
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    onChange(canvas.toDataURL('image/png'))
  }

  const clearSignature = (): void => {
    renderValue('')
    onChange('')
  }

  return (
    <div className="field-group">
      <label className="label">{label}</label>
      <canvas
        ref={canvasRef}
        className={`signature-canvas ${disabled ? 'is-disabled' : ''}`}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      <div className="signature-actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={clearSignature}
          disabled={disabled}
        >
          Bersihkan
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  )
}

export default SignaturePad
