// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Disputes/DisputeStatusSelect.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import {
  DisputeStatusDisplayTitle,
  type DisputeStatusFilter,
} from '@/app/admin/_polar/web/utils/dispute'
import { schemas } from '@/app/admin/_polar/datos/polar-tipos'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/app/admin/_polar/orbit'
import React from 'react'

const STATUSES: schemas['DisputeStatus'][] = [
  'needs_response',
  'under_review',
  'won',
  'lost',
  'prevented',
  'early_warning',
]

interface Props {
  value: DisputeStatusFilter
  onChange: (value: DisputeStatusFilter) => void
}

export const DisputeStatusSelect: React.FC<Props> = ({ value, onChange }) => (
  <Select
    value={value}
    onValueChange={(value) => onChange(value as DisputeStatusFilter)}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select a status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="any">
        <span className="whitespace-nowrap">Any status</span>
      </SelectItem>
      <SelectSeparator />
      {STATUSES.map((status) => (
        <SelectItem key={status} value={status}>
          {DisputeStatusDisplayTitle[status]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)
