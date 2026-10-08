// =============================================================================
// bloqueo-editor — el selector del CANDADO en el editor del curso (puro)
// =============================================================================
// Pedido de Martín (07/10/2026, item 8): «implementes la funcionalidad de Skool de poder "bloquear"
// algunas clases, y que se vayan desbloqueando con ciertos requerimientos». Lo que se puede guardar y
// cómo se evalúa vive en lib/curso-bloqueo.ts (D2, el contrato de 8 tipos). Acá está lo que el EDITOR
// necesita para ofrecerlo: qué opciones tiene cada cosa, qué datos pide cada una, y cómo se arma el
// candado que se manda (`guardarBloqueoAction`). Puro y sin React, para que tenga test
// (tests/curso-editor.test.ts).
//
// ⚠️ «LO DE SIEMPRE» ES `null` Y NO UN TIPO: el default de un módulo vinculado es esperar a su etapa,
// el de un suelto y el de una clase es estar abierto (la clase, con su módulo). Guardarlo como
// `{ tipo: 'etapa' }` o `{ tipo: 'abierto' }` sería decir lo mismo con dos valores, y el día que
// cambie un default, los que lo eligieron «explícito» se quedarían con el viejo sin haberlo decidido.
//
// ⚠️ EL SERVER VUELVE A VALIDAR TODO (lib/curso-modulos-datos.ts, `guardarBloqueo`): esto sólo evita
// mandar lo que se sabe que va a rebotar y dice POR QUÉ en la pantalla, corto.

import {
  MAX_DIAS_BLOQUEO, bloqueoPermitido, rotuloDeBloqueo, saneaBloqueo,
  type Bloqueo, type ObjetoBloqueo, type TipoBloqueo,
} from '@/lib/curso-bloqueo';
import { NIVEL_MAX } from '@/lib/comunidad-niveles';
import type { ChipDato } from '@/app/_cursos/tipos';

/** Una opción del selector. `default` = `null`: lo de siempre de ese objeto. */
export type OpcionBloqueo = 'default' | Exclude<TipoBloqueo, 'etapa'>;

/** Lo que dice cada opción: corto (es texto de pantalla). */
const TEXTO: Record<Exclude<OpcionBloqueo, 'default'>, string> = {
  abierto: 'Abierto',
  anterior: 'Al terminar el anterior',
  dias: 'Días después de entrar',
  fecha: 'En una fecha',
  tarea: 'Al terminar otra clase',
  nivel: 'Al llegar a un nivel',
  manual: 'Lo abre el equipo',
};

/** Lo de siempre, dicho para cada objeto. */
const TEXTO_DEFAULT: Record<ObjetoBloqueo, string> = {
  vinculado: 'Al llegar a su etapa',
  suelto: 'Abierto',
  clase: 'Como su módulo',
};

/**
 * Las opciones de cada cosa, en orden. Un SUELTO y una CLASE no ofrecen «Abierto» aparte: es su
 * default. Ninguno ofrece «etapa» como tipo: para un vinculado es el default, y para un suelto o una
 * clase no se puede guardar (`bloqueoPermitido`).
 */
export function opcionesDeBloqueo(objeto: ObjetoBloqueo): Array<{ valor: OpcionBloqueo; texto: string }> {
  const tipos: Array<Exclude<OpcionBloqueo, 'default'>> = objeto === 'vinculado'
    ? ['abierto', 'anterior', 'dias', 'fecha', 'tarea', 'nivel', 'manual']
    : ['anterior', 'dias', 'fecha', 'tarea', 'nivel', 'manual'];
  return [
    { valor: 'default', texto: TEXTO_DEFAULT[objeto] },
    ...tipos.map((t) => ({ valor: t, texto: t === 'anterior' && objeto === 'clase' ? 'Al terminar la anterior' : TEXTO[t] })),
  ];
}

/** La opción que corresponde a un candado guardado. Lo que es el default de ese objeto se ve como el default. */
export function opcionDe(objeto: ObjetoBloqueo, b: Bloqueo | null): OpcionBloqueo {
  if (!b) return 'default';
  if (b.tipo === 'etapa') return 'default';
  if (b.tipo === 'abierto' && objeto !== 'vinculado') return 'default';
  return b.tipo;
}

/** Los datos que piden las opciones, con lo que ya tenía el candado (o lo de arranque). */
export type DatosBloqueo = { dias: number; fecha: string; claseId: number | null; aprobada: boolean; nivel: number };

/** Lo de arranque: una semana, ninguna fecha ni clase (hay que elegirlas), el nivel 2 (el 1 es el de todos). */
export function datosDe(b: Bloqueo | null): DatosBloqueo {
  return {
    dias: b?.tipo === 'dias' ? b.dias : 7,
    fecha: b?.tipo === 'fecha' ? b.fecha : '',
    claseId: b?.tipo === 'tarea' ? b.claseId : null,
    aprobada: b?.tipo === 'tarea' ? !!b.aprobada : false,
    nivel: b?.tipo === 'nivel' ? b.nivel : 2,
  };
}

/** ¿Esta opción necesita un dato que todavía no hay? Entonces se espera a que lo elijan. */
export function faltaDato(opcion: OpcionBloqueo, d: DatosBloqueo): boolean {
  return (opcion === 'fecha' && !d.fecha) || (opcion === 'tarea' && d.claseId == null);
}

/**
 * El candado que se guarda para una opción con sus datos (`null` = el default), o por qué no se puede.
 * `propia`: la clase a la que se le pone (una clase no puede esperarse a sí misma).
 */
export function bloqueoDeOpcion(
  objeto: ObjetoBloqueo,
  opcion: OpcionBloqueo,
  d: DatosBloqueo,
  propia?: { claseId?: number },
): { ok: true; bloqueo: Bloqueo | null } | { ok: false; error: string } {
  if (opcion === 'default') return { ok: true, bloqueo: null };
  let crudo: unknown;
  switch (opcion) {
    case 'abierto': case 'anterior': case 'manual':
      crudo = { tipo: opcion };
      break;
    case 'dias':
      crudo = { tipo: 'dias', dias: d.dias };
      break;
    case 'fecha':
      if (!d.fecha) return { ok: false, error: 'Elige la fecha.' };
      crudo = { tipo: 'fecha', fecha: d.fecha };
      break;
    case 'tarea':
      if (d.claseId == null) return { ok: false, error: 'Elige la clase.' };
      crudo = d.aprobada ? { tipo: 'tarea', claseId: d.claseId, aprobada: true } : { tipo: 'tarea', claseId: d.claseId };
      break;
    case 'nivel':
      crudo = { tipo: 'nivel', nivel: d.nivel };
      break;
  }
  // El MISMO saneo del server: un decimal, un texto o un número fuera de rango no se redondean, se dicen.
  const b = saneaBloqueo(crudo);
  if (!b) {
    if (opcion === 'dias') return { ok: false, error: `De 0 a ${MAX_DIAS_BLOQUEO} días.` };
    if (opcion === 'nivel') return { ok: false, error: `Del nivel 1 al ${NIVEL_MAX}.` };
    if (opcion === 'fecha') return { ok: false, error: 'Esa fecha no existe.' };
    return { ok: false, error: 'Ese candado no se entiende.' };
  }
  const no = bloqueoPermitido(objeto, b, propia);
  return no ? { ok: false, error: no } : { ok: true, bloqueo: b };
}

/**
 * Las clases que puede esperar un candado `tarea`: las del producto menos la misma clase, y para un
 * MÓDULO, menos las suyas (cerrado, no deja completarlas: esperaría para siempre; el server también lo
 * rechaza, `guardarBloqueo`).
 */
export function clasesParaTarea<T extends { id: number; etapa: string }>(clases: readonly T[], objetivo: { modulo: string } | { clase: number }): T[] {
  return clases.filter((c) => ('modulo' in objetivo ? c.etapa !== objetivo.modulo : c.id !== objetivo.clase));
}

/**
 * El aviso del candado sobre la tarjeta de un módulo, para quien arma el curso. Nada para lo de
 * siempre: un módulo que espera a su etapa no tiene nada que avisar.
 */
export function avisoDeBloqueo(objeto: ObjetoBloqueo, b: Bloqueo | null, titulo: (claseId: number) => string | null): string | undefined {
  if (opcionDe(objeto, b) === 'default' || !b) return undefined;
  return rotuloDeBloqueo(b, titulo);
}

/** El chip del candado de una clase en el editor. `null` = sin candado propio (va con su módulo). */
export function chipDeBloqueo(b: Bloqueo | null | undefined, titulo: (claseId: number) => string | null): ChipDato | null {
  const a = avisoDeBloqueo('clase', b ?? null, titulo);
  return a ? { tono: 'aviso', texto: a } : null;
}
