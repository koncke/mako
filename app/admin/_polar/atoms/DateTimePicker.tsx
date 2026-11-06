// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/ui/src/components/atoms/DateTimePicker.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { Button } from '@/app/admin/_polar/orbit/components/ui/button'
import { Calendar } from '@/app/admin/_polar/ui/calendar'
import { FormControl } from '@/app/admin/_polar/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/admin/_polar/ui/popover'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays } from '@/app/admin/_polar/orbit/icons'
import { useCallback, useMemo } from 'react'
import { Matcher } from 'react-day-picker'
import { twMerge } from 'tailwind-merge'

interface DatePickerProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  disabled?: Matcher | Matcher[]
}

const DatePicker: React.FC<DatePickerProps> = (props) => {
  const { value, onChange: _onChange, disabled } = props
  const internalValue = useMemo(
    () => (value ? new Date(value as string) : undefined),
    [value],
  )

  const onChange = useCallback(
    (date: Date | undefined) => {
      const value = date ? date.toISOString() : ''
      _onChange(value)
    },
    [_onChange],
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FormControl className="flex">
          <Button
            variant={'outline'}
            className={twMerge(
              'dark:bg-polar-800 h-10 w-full justify-start rounded-xl bg-white text-left',
              !value && 'text-muted-foreground',
            )}
          >
            {internalValue ? (
              format(internalValue, 'PPP', { locale: es })
            ) : (
              <span>Elige una fecha</span>
            )}
            <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={internalValue}
          onSelect={onChange}
          disabled={disabled}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export default DatePicker
