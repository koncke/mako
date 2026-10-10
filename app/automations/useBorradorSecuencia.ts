'use client';

// =============================================================================
// useBorradorSecuencia — lo que el lienzo de /automations tiene SIN PUBLICAR, guardado solo
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
// NO LO LEE NUNCA. Mismo molde que app/automations/usePosicionesLienzo.ts:
//   · CON UN RESPIRO: tipear una frase es UN guardado, con el flujo final.
//   · AL IRSE (otra automatización, cerrar la pestaña) lo que esperaba su respiro se manda igual.
//   · SI NO SE LEYÓ (`puedeGuardar` false: el GET no trajo el borrador porque falta la columna o la
//     lectura falló) NO se guarda: guardarlo pisaría un borrador que la pantalla no vio. Y si el server
//     contesta `sinColumna`, se deja de intentar sin cartel (no es nada que la persona pueda arreglar).
//   · `guardado(json)` avisa con el flujo que quedó guardado: desde ahí, salir no pierde nada.
//
// La lógica vive en `crearBorrador`, sin React, para que un test la EJECUTE con relojes falsos
// (tests/chatbot-v6b-flujo.test.ts); el hook sólo la monta una vez y le engancha la salida.

import { useEffect, useRef } from 'react';
import type { PasoSecuenciaDto } from './ChatAgentApp';

/** El respiro entre el último cambio y el guardado. Más largo que el de las posiciones: acá se tipea. */
export const RESPIRO_BORRADOR_MS = 1200;

/** El cartel cuando el server no lo guardó (corto: es un error de pantalla). */
export const ERROR_BORRADOR = 'No se guardó el borrador';

export type MotorBorrador = {
  /** El flujo de ahora: se guarda después del respiro, si cambió desde lo último guardado. */
  cambio: (pasos: PasoSecuenciaDto[]) => void;
  /** Esto ya está guardado por otro camino (se publicó, lo creó la IA): no se manda. */
  yaGuardado: (pasos: PasoSecuenciaDto[]) => void;
  /** Se publicó: el borrador se borra en el server (sin él tampoco se abriría: cambió la base). */
  descartar: () => void;
  /** Lo que esperaba su respiro sale YA (al irse de la vista). */
  despachar: () => void;
};

/**
 * EL GUARDADO DEL BORRADOR, sin React. `post` manda el cuerpo a la ruta (el hook le pone el
 * `secuenciaId` y `keepalive`); `avisos()` se lee en cada respuesta, así un aviso nuevo del
 * componente llega aunque el motor se haya creado en el primer render.
 */
export function crearBorrador(dep: {
  post: (body: Record<string, unknown>) => Promise<{ json: () => Promise<unknown> }>;
  /** El flujo con el que se abrió (lo publicado o el borrador): ése no se vuelve a mandar. */
  inicial: PasoSecuenciaDto[];
  /** El borrador se leyó (hay o no hay) y quien mira puede editar. */
  puedeGuardar: boolean;
  avisos: () => { onGuardado?: (json: string) => void; onError?: (m: string) => void };
  respiroMs?: number;
}): MotorBorrador {
  const respiro = dep.respiroMs ?? RESPIRO_BORRADOR_MS;
  let guardable = dep.puedeGuardar;
  let ultimo = JSON.stringify(dep.inicial);
  let pendiente: { t: ReturnType<typeof setTimeout>; pasos: PasoSecuenciaDto[] } | null = null;

  const mandar = async (pasos: PasoSecuenciaDto[]) => {
    const json = JSON.stringify(pasos);
    try {
      const r = await dep.post({ action: 'borrador', pasos });
      const j = await r.json().catch(() => null) as { ok?: boolean; sinColumna?: boolean } | null;
      if (j?.sinColumna) { guardable = false; return; }
      if (!j?.ok) { dep.avisos().onError?.(ERROR_BORRADOR); return; }
      dep.avisos().onGuardado?.(json);
    } catch {
      dep.avisos().onError?.(ERROR_BORRADOR);
    }
  };

  const soltar = () => { if (pendiente) { clearTimeout(pendiente.t); pendiente = null; } };

  return {
    cambio(pasos) {
      if (!guardable) return;
      const json = JSON.stringify(pasos);
      // Volvió a lo último guardado (deshacer hasta ahí): lo que esperaba ya no hace falta.
      if (json === ultimo) { soltar(); return; }
      soltar();
      const t = setTimeout(() => { pendiente = null; ultimo = json; void mandar(pasos); }, respiro);
      pendiente = { t, pasos };
    },
    yaGuardado(pasos) {
      soltar();
      ultimo = JSON.stringify(pasos);
    },
    descartar() {
      soltar();
      if (!guardable) return;
      void dep.post({ action: 'descartar-borrador' }).catch(() => { /* sin red: no se abriría igual (cambió la base) */ });
    },
    despachar() {
      const p = pendiente;
      if (!p) return;
      soltar();
      ultimo = JSON.stringify(p.pasos);
      void mandar(p.pasos);
    },
  };
}

export function useBorradorSecuencia(
  secuenciaId: number,
  opts: {
    puedeGuardar: boolean;
    inicial: PasoSecuenciaDto[];
    onGuardado?: (json: string) => void;
    onError?: (m: string) => void;
  },
): Omit<MotorBorrador, 'despachar'> {
  const avisos = useRef({ onGuardado: opts.onGuardado, onError: opts.onError });
  useEffect(() => { avisos.current = { onGuardado: opts.onGuardado, onError: opts.onError }; });
  // UNA vez por montaje: SecuenciaPerfil se monta con `key={sel.id}`, así que otra automatización es
  // otro motor (y el desmonte de la anterior ya despachó lo suyo).
  const motor = useRef<MotorBorrador | null>(null);
  if (!motor.current) {
    motor.current = crearBorrador({
      post: (body) => fetch('/api/chat-agent/secuencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ secuenciaId, ...body }),
      }),
      inicial: opts.inicial, puedeGuardar: opts.puedeGuardar, avisos: () => avisos.current,
    });
  }
  const m = motor.current;

  // Al irse, y al esconder la pestaña (el desmonte no corre al cerrarla): lo que esperaba su respiro
  // sale ya, con `keepalive` para que sobreviva al cierre.
  useEffect(() => {
    const alEsconder = () => { if (document.visibilityState === 'hidden') m.despachar(); };
    document.addEventListener('visibilitychange', alEsconder);
    return () => { document.removeEventListener('visibilitychange', alEsconder); m.despachar(); };
  }, [m]);

  return { cambio: m.cambio, yaGuardado: m.yaGuardado, descartar: m.descartar };
}
