'use client';

// =============================================================================
// ficha/pagos/datos — lo que los bloques de Pagos leen por su cuenta (los cobros, cómo cobrar, la moneda)
// =============================================================================
// El contrato (../tipos.ts, punto 3): lo que no viene en `LeadFullData` lo pide cada bloque con SU action, al
// montarse. Cuatro bloques de Pagos necesitan los MISMOS cobros del lead (estado de cuenta, links, movimientos y
// suscripción), y cada uno pidiéndolos eran cuatro lecturas iguales por ficha abierta. Acá se piden UNA vez por
// lead, mientras haya un bloque montado que los use, y se releen todos juntos cuando algo cambia
// (`refrescarCobros`): un link nuevo, una devolución o una cuota que se pagó.
//
// Sin store global de la app: una FOTO inmutable por lead (cada cambio arma una nueva, así `useSyncExternalStore`
// sabe que cambió) y quién la escucha. Se olvida cuando el último bloque que la usa se desmonta.
// =============================================================================

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { CobroVisible } from '@/lib/cobros-tipos';
import { cobrosDelLeadAction, opcionesCobroAction, type OpcionesCobro } from '@/app/crm/[id]/cobros-actions';
import { monedaDelNegocioAction } from '@/app/crm/[id]/pagos-campo-actions';

/** `cobros` null = todavía se está leyendo; `error` = no se pudo leer (no es «no hay»). */
export type FotoCobros = { cobros: CobroVisible[] | null; error: boolean; opciones: OpcionesCobro | null };

const VACIA: FotoCobros = { cobros: null, error: false, opciones: null };
const FOTOS = new Map<number, FotoCobros>();
const OYENTES = new Map<number, Set<() => void>>();
const VUELTA = new Map<number, number>();

function poner(leadId: number, cambio: Partial<FotoCobros>) {
  if (!OYENTES.has(leadId)) return; // ya nadie la mira
  FOTOS.set(leadId, { ...(FOTOS.get(leadId) ?? VACIA), ...cambio });
  for (const o of OYENTES.get(leadId) ?? []) o();
}

function leerCobros(leadId: number) {
  const vuelta = (VUELTA.get(leadId) ?? 0) + 1;
  VUELTA.set(leadId, vuelta);
  cobrosDelLeadAction(leadId)
    .then((c) => { if (VUELTA.get(leadId) === vuelta) poner(leadId, { cobros: c, error: false }); })
    .catch(() => { if (VUELTA.get(leadId) === vuelta) poner(leadId, { error: true }); });
}

function leerOpciones(leadId: number) {
  opcionesCobroAction(leadId)
    .then((o) => poner(leadId, { opciones: o }))
    .catch(() => poner(leadId, { opciones: { ok: false, error: 'No pude leer cómo cobrar.' } }));
}

function suscribir(leadId: number, oyente: () => void): () => void {
  let set = OYENTES.get(leadId);
  if (!set) {
    set = new Set();
    OYENTES.set(leadId, set);
  }
  const primero = set.size === 0;
  set.add(oyente);
  if (primero) { leerCobros(leadId); leerOpciones(leadId); }
  return () => {
    set.delete(oyente);
    if (set.size === 0) { OYENTES.delete(leadId); FOTOS.delete(leadId); VUELTA.delete(leadId); }
  };
}

/** Relee los cobros del lead en TODOS los bloques que los muestran (y lo que dice cómo cobrar). */
export function refrescarCobros(leadId: number) {
  if (OYENTES.has(leadId)) { leerCobros(leadId); leerOpciones(leadId); }
}

/** Los cobros de la pasarela del lead y con qué se le puede cobrar (pasarelas, productos y si quien mira administra). */
export function useCobrosDelLead(leadId: number): FotoCobros {
  // ⚠️ La suscripción va memorizada por lead: una función nueva en cada render hace que React se desuscriba y se
  // vuelva a suscribir, y con el último oyente afuera la foto se tira y se vuelve a pedir (una lectura por render).
  const sub = useCallback((o: () => void) => suscribir(leadId, o), [leadId]);
  const foto = useCallback(() => FOTOS.get(leadId) ?? VACIA, [leadId]);
  return useSyncExternalStore(sub, foto, () => VACIA);
}

/** La moneda en que el negocio carga lo que cobra a mano (decisión 7): el valor inicial de los montos a mano. */
export function useMonedaDelNegocio(): string {
  const [moneda, setMoneda] = useState('USD');
  useEffect(() => {
    let vivo = true;
    monedaDelNegocioAction().then((r) => { if (vivo) setMoneda(r.moneda || 'USD'); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return moneda;
}
