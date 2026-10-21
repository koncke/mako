'use server';

// =============================================================================
// Confirmar o descartar una propuesta de acción GENÉRICA (/mako/revisar/<id>)
// =============================================================================
// La pantalla es editable a propósito: la persona corrige el dato antes de
// confirmarlo. Lo que vuelve editado pasa por `validarInput` con los MISMOS
// `parametros` de la operación (solo las claves declaradas, con su tipo y sus
// topes), y recién después por `aplicarPropuestaGenerica`, que vuelve a
// preparar contra la base y reclama la propuesta antes de ejecutar: dos clicks
// crean UNA sola cosa.
// =============================================================================

import { revalidatePath } from 'next/cache';
import { aplicarPropuestaGenerica, descartarPropuestaGenerica } from '@/lib/api-mako/acciones';
import { porId } from '@/lib/api-mako/registro';
import { validarInput } from '@/lib/api-mako/validar';
import { esAccion } from '@/lib/api-mako/tipos';
import { getPropuesta } from '@/lib/propuestas';
import { bloqueDeResultado, type Abrir, type Bloque } from '@/lib/chat-bloques';
import { abrirDeResultado } from '@/lib/mako-turno-app-reglas';
import { enSegundoPlano } from '@/lib/chat-trabajos';
import { sesionDeClave } from '@/lib/chat-hilo-origen';
import { ctxDeBandeja } from '../../ctx-bandeja';

/** `bloques` y `abrir`: lo que dibuja el resultado y su «Abrir en <tab>» (lib/chat-bloques.ts), para el chat que
 *  confirma ADENTRO (1.10). La pantalla de revisión no los usa. */
export type ResultadoRevision = { ok: true; resumen: string; bloques?: Bloque[]; abrir?: Abrir; enCurso?: true } | { ok: false; error: string };

/** Tope del cuerpo editado, el mismo criterio que http.ts: un JSON de megas no
 *  es una corrección, es un error. */
const MAX_CHARS_PAYLOAD = 256 * 1024;

const idValido = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id);

export async function confirmarAccionAction(id: string, payloadEditado: Record<string, unknown>): Promise<ResultadoRevision> {
  if (!idValido(id)) return { ok: false, error: 'Falta el id de la propuesta.' };
  if (!payloadEditado || typeof payloadEditado !== 'object' || Array.isArray(payloadEditado)) return { ok: false, error: 'El formulario llegó vacío.' };
  let largo = 0;
  try { largo = JSON.stringify(payloadEditado).length; } catch { return { ok: false, error: 'El formulario tiene un valor que no se puede enviar.' }; }
  if (largo > MAX_CHARS_PAYLOAD) return { ok: false, error: 'El formulario es demasiado grande para enviarlo.' };

  const c = await ctxDeBandeja();
  if ('error' in c) return { ok: false, error: c.error };

  // La operación se lee de la PROPUESTA guardada, no del formulario: el cliente
  // no elige qué se ejecuta, solo con qué datos.
  const prop = await getPropuesta(id);
  if (!prop || prop.tipo !== 'accion') return { ok: false, error: 'Esa propuesta no existe en este workspace.' };
  if (prop.estado !== 'pendiente') return { ok: false, error: `Esta propuesta ya está ${prop.estado}.` };
  const def = porId(String(prop.datos.operacion ?? ''));
  if (!def || !esAccion(def)) return { ok: false, error: 'La operación de esta propuesta ya no existe en MaKo.' };

  const v = validarInput(def.parametros, payloadEditado, 'json');
  if ('error' in v) return { ok: false, error: v.error };

  // ⚠️ `aplicarPropuestaGenerica` MEZCLA lo editado sobre el payload guardado
  // (`{ ...base, ...editado }`), y `validarInput` omite lo vacío. Mandar solo
  // `v.input` haría que un campo que la persona VACIÓ vuelva con el valor viejo, en
  // silencio. Cada parámetro declarado viaja: con su valor, o `null` si quedó vacío
  // (el segundo `validarInput` de adentro lo vuelve a omitir).
  const editado: Record<string, unknown> = Object.fromEntries(
    def.parametros.map((p) => [p.nombre, p.nombre in v.input ? v.input[p.nombre] : null]),
  );

  // Un trabajo LARGO que nació en un chat de la app (1.11): sigue por detrás, y su avance y su resultado quedan en ESE
  // chat (lib/chat-trabajos.ts). La respuesta vuelve enseguida. Si no se puede anotar, corre como siempre.
  const sesion = def.lenta ? sesionDeClave(prop.datos.canalKey) : null;
  if (sesion != null) {
    const trabajo = await enSegundoPlano(c.ctx.ws, sesion, def.titulo,
      () => aplicarPropuestaGenerica(id, editado, c.ctx, { sinAnotar: true }), (x) => abrirDeResultado(def.id, x.datos));
    if (trabajo) { revalidatePath('/mako/revisar'); return { ok: true, resumen: `En curso: ${def.titulo}`, bloques: [trabajo], enCurso: true }; }
  }
  const r = await aplicarPropuestaGenerica(id, editado, c.ctx);
  revalidatePath('/mako/revisar');
  if (!r.ok) return { ok: false, error: r.resumen };
  const bloque = bloqueDeResultado(r.datos);
  const abrir = bloque ? null : abrirDeResultado(def.id, r.datos);
  return { ok: true, resumen: r.resumen, ...(bloque ? { bloques: [bloque] } : {}), ...(abrir ? { abrir } : {}) };
}

export async function descartarAccionAction(id: string): Promise<ResultadoRevision> {
  if (!idValido(id)) return { ok: false, error: 'Falta el id de la propuesta.' };
  const c = await ctxDeBandeja();
  if ('error' in c) return { ok: false, error: c.error };
  // `descartarPropuesta` no mira el tipo: sin esto, esta action descartaría una
  // propuesta de LEAD cuyo id alguien pegó en /mako/revisar/<id>.
  const prop = await getPropuesta(id);
  if (!prop || prop.tipo !== 'accion') return { ok: false, error: 'Esa propuesta no existe en este workspace.' };
  if (prop.estado !== 'pendiente') return { ok: false, error: `Esta propuesta ya está ${prop.estado}.` };
  try {
    await descartarPropuestaGenerica(id, c.ctx);
  } catch (err) {
    return { ok: false, error: `No se pudo descartar (${err instanceof Error ? err.message : 'error'}).` };
  }
  revalidatePath('/mako/revisar');
  return { ok: true, resumen: 'Propuesta descartada. No se ejecutó nada.' };
}
