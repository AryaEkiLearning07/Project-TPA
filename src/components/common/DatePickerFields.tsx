import { useEffect, useRef } from 'react'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs, { type Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

const parseIsoDate = (value?: string): Dayjs | null => {
  if (!value) {
    return null
  }
  const parsed = dayjs(value, 'YYYY-MM-DD', true)
  return parsed.isValid() ? parsed : null
}

const parseIsoMonth = (value?: string): Dayjs | null => {
  if (!value) {
    return null
  }
  const parsed = dayjs(`${value}-01`, 'YYYY-MM-DD', true)
  return parsed.isValid() ? parsed : null
}

const parseIsoMonthOrDate = (value?: string): Dayjs | null => {
  if (!value) {
    return null
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseIsoDate(value)
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return parseIsoMonth(value)
  }
  return null
}

const getMonthMaxDate = (value?: string): Dayjs | undefined => {
  const parsed = parseIsoMonth(value)
  return parsed ? parsed.endOf('month') : undefined
}

const resolveMonthBoundary = (value?: string): string | undefined => {
  if (!value) {
    return undefined
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return value
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 7)
  }
  return undefined
}

const clampIsoDate = (value: string, min?: string, max?: string): string => {
  if (min && value < min) {
    return min
  }
  if (max && value > max) {
    return max
  }
  return value
}

const clampIsoMonth = (value: string, min?: string, max?: string): string => {
  if (min && value < min) {
    return min
  }
  if (max && value > max) {
    return max
  }
  return value
}

const clampMonthWithDateBounds = (value: string, min?: string, max?: string): string => {
  const minMonth = resolveMonthBoundary(min)
  const maxMonth = resolveMonthBoundary(max)
  return clampIsoMonth(value, minMonth, maxMonth)
}

interface AppDatePickerFieldProps {
  id?: string
  value: string
  min?: string
  max?: string
  disabled?: boolean
  onChange: (nextValue: string) => void
  allowEmpty?: boolean
}

interface AppMonthPickerFieldProps {
  id?: string
  value: string
  min?: string
  max?: string
  disabled?: boolean
  onChange: (nextValue: string) => void
  allowEmpty?: boolean
}

interface AppMonthOrDatePickerFieldProps {
  id?: string
  value: string
  min?: string
  max?: string
  disabled?: boolean
  onChange: (nextValue: string) => void
  allowEmpty?: boolean
}

export const AppDatePickerField = ({
  id,
  value,
  min,
  max,
  disabled = false,
  onChange,
  allowEmpty = true,
}: AppDatePickerFieldProps) => (
  <DatePicker
    value={parseIsoDate(value)}
    minDate={parseIsoDate(min) ?? undefined}
    maxDate={parseIsoDate(max) ?? undefined}
    format="DD/MM/YYYY"
    views={['year', 'month', 'day']}
    openTo="day"
    disabled={disabled}
    closeOnSelect={false}
    onChange={(nextValue, context) => {
      if (context.validationError) {
        return
      }
      if (!nextValue) {
        if (allowEmpty && value) {
          onChange('')
        }
        return
      }
      if (!nextValue.isValid()) {
        return
      }
      const nextIsoDate = clampIsoDate(nextValue.format('YYYY-MM-DD'), min, max)
      if (nextIsoDate !== value) {
        onChange(nextIsoDate)
      }
    }}
    slotProps={{
      textField: {
        id,
        fullWidth: true,
        className: 'app-date-input',
        size: 'small',
        inputProps: {
          placeholder: 'DD/MM/YYYY',
          inputMode: 'numeric',
        },
      },
      actionBar: {
        actions: ['cancel', 'accept'],
      },
      field: {
        clearable: allowEmpty,
        onClear: () => onChange(''),
      },
      dialog: {
        className: 'app-date-dialog',
      },
    }}
  />
)

export const AppMonthOrDatePickerField = ({
  id,
  value,
  min,
  max,
  disabled = false,
  onChange,
  allowEmpty = true,
}: AppMonthOrDatePickerFieldProps) => {
  const activeViewRef = useRef<'year' | 'month' | 'day'>('month')
  const pendingMonthRef = useRef<string>('')
  const pendingDateRef = useRef<string | null>(null)

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      pendingMonthRef.current = value.slice(0, 7)
      pendingDateRef.current = value
      return
    }
    if (/^\d{4}-\d{2}$/.test(value)) {
      pendingMonthRef.current = value
      pendingDateRef.current = null
      return
    }
    pendingMonthRef.current = ''
    pendingDateRef.current = null
  }, [value])

  return (
    <DatePicker
      value={parseIsoMonthOrDate(value)}
      minDate={parseIsoDate(min) ?? parseIsoMonth(min) ?? undefined}
      maxDate={parseIsoDate(max) ?? getMonthMaxDate(max)}
      format={/^\d{4}-\d{2}$/.test(value) ? 'MM/YYYY' : 'DD/MM/YYYY'}
      views={['year', 'month', 'day']}
      openTo="month"
      disabled={disabled}
      closeOnSelect={false}
      onViewChange={(nextView) => {
        activeViewRef.current = nextView
      }}
      onMonthChange={(nextValue) => {
        if (!nextValue || !nextValue.isValid()) {
          return
        }
        const nextMonth = clampMonthWithDateBounds(
          nextValue.format('YYYY-MM'),
          min,
          max,
        )
        pendingMonthRef.current = nextMonth
        pendingDateRef.current = null
      }}
      onChange={(nextValue, context) => {
        if (context.validationError) {
          return
        }
        if (!nextValue) {
          if (allowEmpty && value) {
            onChange('')
          }
          return
        }
        if (!nextValue.isValid()) {
          return
        }
        if (activeViewRef.current !== 'day') {
          return
        }

        const nextIsoDate = clampIsoDate(nextValue.format('YYYY-MM-DD'), min, max)
        pendingMonthRef.current = nextIsoDate.slice(0, 7)
        pendingDateRef.current = nextIsoDate
      }}
      onAccept={(acceptedValue) => {
        if (!acceptedValue || !acceptedValue.isValid()) {
          return
        }

        const fallbackMonth = clampMonthWithDateBounds(
          acceptedValue.format('YYYY-MM'),
          min,
          max,
        )
        const resolvedMonth = pendingMonthRef.current || fallbackMonth
        const resolvedDate = pendingDateRef.current
          ? clampIsoDate(pendingDateRef.current, min, max)
          : ''
        const nextValue = resolvedDate || resolvedMonth

        if (nextValue && nextValue !== value) {
          onChange(nextValue)
        }
      }}
      slotProps={{
        textField: {
          id,
          fullWidth: true,
          className: 'app-date-input',
          size: 'small',
          inputProps: {
            placeholder: 'MM/YYYY atau DD/MM/YYYY',
            inputMode: 'numeric',
          },
        },
        actionBar: {
          actions: ['cancel', 'accept'],
        },
        field: {
          clearable: allowEmpty,
          onClear: () => onChange(''),
        },
        dialog: {
          className: 'app-date-dialog',
        },
      }}
    />
  )
}

export const AppMonthPickerField = ({
  id,
  value,
  min,
  max,
  disabled = false,
  onChange,
  allowEmpty = true,
}: AppMonthPickerFieldProps) => (
  <DatePicker
    value={parseIsoMonth(value)}
    minDate={parseIsoMonth(min) ?? undefined}
    maxDate={getMonthMaxDate(max)}
    format="MM/YYYY"
    views={['year', 'month']}
    openTo="month"
    disabled={disabled}
    closeOnSelect={false}
    onChange={(nextValue, context) => {
      if (context.validationError) {
        return
      }
      if (!nextValue) {
        if (allowEmpty && value) {
          onChange('')
        }
        return
      }
      if (!nextValue.isValid()) {
        return
      }
      const nextIsoMonth = clampIsoMonth(nextValue.format('YYYY-MM'), min, max)
      if (nextIsoMonth !== value) {
        onChange(nextIsoMonth)
      }
    }}
    slotProps={{
      textField: {
        id,
        fullWidth: true,
        className: 'app-date-input',
        size: 'small',
        inputProps: {
          placeholder: 'MM/YYYY',
          inputMode: 'numeric',
        },
      },
      actionBar: {
        actions: ['cancel', 'accept'],
      },
      field: {
        clearable: allowEmpty,
        onClear: () => onChange(''),
      },
      dialog: {
        className: 'app-date-dialog',
      },
    }}
  />
)
