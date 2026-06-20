'use server';

// =============================================================================
// Server actions de Vista General — objetivo global editable (Fase 14)
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { setSetting } from '@/lib/settings';
import { TAG } from '@/lib/cache';

const PERMITIDAS = new Set(['objetivo_cierres', 'objetivo_cash_usd', 'objetivo_desde']);

/** Guarda uno de los valores del objetivo y revalida Vista General. */
export async function setObjetivoAction(key: string, value: string): Promise<void> {
  if (!PERMITIDAS.has(key)) throw new Error(`Setting no permitida: ${key}`);
  await setSetting(key, value.trim());
  try { updateTag(TAG.settings); } catch { /* la caché vence por TTL */ }
  revalidatePath('/general');
}
