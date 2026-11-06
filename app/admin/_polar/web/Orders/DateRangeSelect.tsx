'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Metrics/DateRangePicker.tsx (`dateRangeIntervals`,
// el selector de intervalos de su FilterPopover). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los intervalos de Polar, en días del negocio (`rangoDe`, app/admin/_polar/datos/ventas.ts). Sin el calendario para elegir
// un rango a mano: lo de Polar que no se usó en Sales (lo anota el informe).

import { INTERVALOS, ROTULO_INTERVALO, esIntervalo, type Intervalo } from '@/app/admin/_polar/datos/ventas'
import { CalendarMonthOutlined } from '@/app/admin/_polar/orbit/icons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/admin/_polar/orbit'

export const DateRangeSelect = ({ value, onChange }: { value: Intervalo; onChange: (v: Intervalo) => void }) => (
  <Select value={value} onValueChange={(v) => onChange(esIntervalo(v) ? v : 'allTime')}>
    <SelectTrigger className="w-full sm:w-52">
      <span className="flex items-center gap-2">
        <CalendarMonthOutlined fontSize="inherit" />
        <SelectValue />
      </span>
    </SelectTrigger>
    <SelectContent>
      {INTERVALOS.map((i) => (
        <SelectItem key={i} value={i}>
          {ROTULO_INTERVALO[i]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)
