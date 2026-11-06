// Copiado de polarsource/polar (Apache-2.0), clients/packages/orbit/src/lib/utils.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { twMerge, type ClassNameValue } from 'tailwind-merge'

// Utility for merging Tailwind CSS class names
export function cn(...inputs: ClassNameValue[]) {
  return twMerge(inputs)
}
