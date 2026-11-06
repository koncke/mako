// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Disputes/DisputeStatusSelect.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: en qué quedó un contracargo, como lo escribió lib/cobros-reglas.ts (`textoContracargo`): abierta, la plata se descontó o
// volvió, ganada, perdida, cerrada, o en revisión (Mercado Pago). Los de Polar (needs response, under review…) no se pueden saber
// en MaKo: no guarda la disputa, sólo el texto de su última fase.

import { ESTADOS_DISPUTA, ROTULO_ESTADO_DISPUTA, esEstadoDisputa, type EstadoDisputa } from '@/app/admin/_polar/datos/ventas'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/app/admin/_polar/orbit'

export const DisputeStatusSelect = ({ value, onChange }: { value: EstadoDisputa | null; onChange: (value: EstadoDisputa | null) => void }) => (
  <Select value={value ?? 'any'} onValueChange={(v) => onChange(esEstadoDisputa(v) ? v : null)}>
    <SelectTrigger>
      <SelectValue placeholder="Elige un estado" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="any">Cualquier estado</SelectItem>
      <SelectSeparator />
      {ESTADOS_DISPUTA.map((s) => (
        <SelectItem key={s} value={s}>
          {ROTULO_ESTADO_DISPUTA[s].titulo}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)
