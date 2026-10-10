'use client';

// =============================================================================
// useBorradorSecuencia — lo que el lienzo de /chatbot tiene SIN PUBLICAR, guardado solo
// =============================================================================
// Sexta tanda, punto 7 (Martín, 09/10/2026): «Que se elimine una flecha no significa que se elimine la
// tarjeta posterior, sino que queda "flotando". Lo que no se puede es publicar o probar una
// automatización incompleta». Una automatización a medio armar —con una tarjeta suelta, una condición
// sin completar— no se puede publicar, y hasta la segunda pasada tampoco se podía GUARDAR: el lienzo
// editaba en memoria y lo único que escribía los pasos era Publicar. Al recargar o al cambiar de
// automatización se perdía.
//
// Esto lo guarda en su propia columna (`nutricion_secuencias.pasos_borrador`, mig 0240) por SU acción
// (POST /api/chat-agent/secuencias, `action: 'borrador'` → `guardarBorradorSecuencia`,
// lib/secuencia-borrador.ts), que valida sólo lo que rompe el DATO (`validarParaGuardar`). EL MOTOR
// NO LO LEE NUNCA. Mismo molde que app/chatbot/usePosicionesLienzo.ts:
//   · CON UN RESPIRO: tipear una frase es UN guardado, con el flujo final.
//   · AL IRSE (otra automatización, cerrar la pestaña) lo que esperaba su respiro se manda igual.
//   · SI NO SE LEYÓ (`puedeGuardar` false: el GET no trajo el borrador porque falta la columna o la
//     lectura falló) NO se guarda: guardarlo pisaría un borrador que la pantalla no vio. Y si el server
//     contesta `sinColumna`, se deja de intentar sin cartel (no es nada que la persona pueda arreglar).
//   · `guardado(json)` avisa con el flujo que quedó guardado: desde ahí, salir no pierde nada.

import { useEffect, useRef } from 'react';
import type { PasoSecuenciaDto } from './ChatAgentApp';

/** El respiro entre el último cambio y el guardado. Más largo que el de las posiciones: acá se tipea. */
export const RESPIRO_BORRADOR_MS = 1200;

export function useBorradorSecuencia(
  secuenciaId: number,
  opts: {
    /** El borrador se leyó (hay o no hay) y quien mira puede editar. */
    puedeGuardar: boolean;
    /** El flujo con el que se abrió (lo publicado o el borrador): ése no se vuelve a mandar. */
    inicial: PasoSecuenciaDto[];
    /** Quedó guardado ESTE flujo (su JSON). */
    onGuardado?: (json: string) => void;
    onError?: (m: string) => void;
  },
): {
  /** El flujo de ahora: se guarda después del respiro, si cambió desde lo último guardado. */
  cambio: (pasos: PasoSecuenciaDto[]) => void;
  /** Esto ya está guardado por otro camino (se publicó, lo creó la IA): no se manda. */
  yaGuardado: (pasos: PasoSecuenciaDto[]) => void;
  /** Se publicó: el borrador se borra en el server (sin él tampoco se abriría: cambió la base). */
  descartar: () => void;
} {
  const guardable = useRef(opts.puedeGuardar);
  const ultimo = useRef(JSON.stringify(opts.inicial));
  const pendiente = useRef<{ t: ReturnType<typeof setTimeout>; pasos: PasoSecuenciaDto[] } | null>(null);
  const avisos = useRef({ onGuardado: opts.onGuardado, onError: opts.onError });
  useEffect(() => { avisos.current = { onGuardado: opts.onGuardado, onError: opts.onError }; });

  const post = (body: Record<string, unknown>) => fetch('/api/chat-agent/secuencias', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ secuenciaId, ...body }),
  });

  const mandar = useRef(async (pasos: PasoSecuenciaDto[]) => {
    const json = JSON.stringify(pasos);
    try {
      const r = await post({ action: 'borrador', pasos });
      const j = await r.json().catch(() => null) as { ok?: boolean; sinColumna?: boolean } | null;
      if (j?.sinColumna) { guardable.current = false; return; }
      if (!j?.ok) { avisos.current.onError?.('No se guardó el borrador'); return; }
      avisos.current.onGuardado?.(json);
    } catch {
      avisos.current.onError?.('No se guardó el borrador');
    }
  }).current;

  const despachar = () => {
    const p = pendiente.current;
    if (!p) return;
    clearTimeout(p.t);
    pendiente.current = null;
    ultimo.current = JSON.stringify(p.pasos);
    void mandar(p.pasos);
  };

  const cambio = (pasos: PasoSecuenciaDto[]) => {
    if (!guardable.current) return;
    const json = JSON.stringify(pasos);
    if (json === ultimo.current) {
      if (pendiente.current) { clearTimeout(pendiente.current.t); pendiente.current = null; }
      return;
    }
    if (pendiente.current) clearTimeout(pendiente.current.t);
    const t = setTimeout(() => { pendiente.current = null; ultimo.current = json; void mandar(pasos); }, RESPIRO_BORRADOR_MS);
    pendiente.current = { t, pasos };
  };

  const yaGuardado = (pasos: PasoSecuenciaDto[]) => {
    if (pendiente.current) { clearTimeout(pendiente.current.t); pendiente.current = null; }
    ultimo.current = JSON.stringify(pasos);
  };

  const descartar = () => {
    if (pendiente.current) { clearTimeout(pendiente.current.t); pendiente.current = null; }
    if (!guardable.current) return;
    void post({ action: 'descartar-borrador' }).catch(() => { /* sin red: no se abriría igual (cambió la base) */ });
  };

  // Al irse, y al esconder la pestaña (el desmonte no corre al cerrarla): lo que esperaba su respiro
  // sale ya, con `keepalive` para que sobreviva al cierre.
  useEffect(() => {
    const alEsconder = () => { if (document.visibilityState === 'hidden') despachar(); };
    document.addEventListener('visibilitychange', alEsconder);
    return () => { document.removeEventListener('visibilitychange', alEsconder); despachar(); };
    // `despachar` lee refs: no cambia nada entre renders que importe acá.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { cambio, yaGuardado, descartar };
}
