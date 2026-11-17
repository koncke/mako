// =============================================================================
// leads-exportar-respuestas — «Respuestas del formulario» en el export de leads: UNA COLUMNA POR PREGUNTA (ticket 106)
// =============================================================================
// Codigo Inmobiliario (ws 13), 17/11/2026: «cuando quiero descargar del CRM los leads, no me descarga las respuestas del
// formulario». Medido en producción ese día (sólo lectura): el ws 13 tiene 111 leads, 60 con respuestas guardadas, y el
// export no sacaba NINGUNA. El grupo «Respuestas del formulario» leía seis columnas fijas de `leads` (`respuesta_objetivo`…),
// que sólo llena el webhook de Calendly del ws 1 con su formulario de entonces: en el ws 13 están en NULL en los 111.
// Sus respuestas viven en `lead_respuestas` (las que deja Cal.com al agendar), y las de un formulario de Meta en
// `leads.meta_field_data`. El tilde salía marcado, el archivo traía seis columnas vacías y ningún error.
//
// Ahora el export lleva LO MISMO QUE LA FICHA, de los tres lugares donde vive lo que contestó un lead:
//   · la agenda: las columnas de Calendly con su rótulo curado (`PREGUNTAS_CALENDLY`) y, si no tiene ninguna, el último set
//     de cada reunión de `lead_respuestas`; las de la R2 con «R2 · » adelante. Es la regla del resumen
//     (`respuestasDelResumen`, lib/lead-respuestas.ts), para que el archivo no diga otra cosa que la pantalla;
//   · el formulario de Meta (`respuestasPropias`: sin el nombre, el email ni el teléfono, que ya tienen su columna);
//   · el formulario de la landing (`leads.optin_respuestas`).
// Y una columna por pregunta, con la pregunta de rótulo, en el orden en que aparecen: cada negocio tiene SU formulario, así
// que las columnas salen de los datos y no de una lista.
//
// `lead_formularios` (mig 0415, un renglón por envío) NO se lee: medido el mismo día, la tabla no existe en producción. Lo
// que guarda también queda en `optin_respuestas`, que sí se lee.
//
// Puro y sin `server-only`, para que tenga test (tests/crm-exportar-respuestas.test.ts).
// =============================================================================

import { PREGUNTAS_CALENDLY, respuestasDelResumen, type RespuestaFormulario } from '@/lib/lead-respuestas';
import { respuestasPropias, type MetaFieldData } from '@/lib/meta-leads-campos';
import { respuestasGuardadas } from '@/lib/optin-respuestas';
import type { RespuestaQA } from '@/lib/leads';

/** Lo que hay que traer de `leads` para armar las respuestas de cada lead. */
export const COLS_RESPUESTAS: string[] = [...PREGUNTAS_CALENDLY.map((p) => p.campo), 'meta_field_data', 'optin_respuestas'];

export type AgendaDelLead = { R1: RespuestaQA[]; R2: RespuestaQA[] };

const esQA = (x: unknown): x is RespuestaQA =>
  !!x && typeof x === 'object' && typeof (x as RespuestaQA).q === 'string' && typeof (x as RespuestaQA).a === 'string';

/**
 * Las filas de `lead_respuestas` (DE LA MÁS NUEVA A LA MÁS VIEJA) → el último set de cada reunión, por lead. Es lo que hace
 * `getLeadRespuestas` (lib/leads.ts) para una ficha, de una vez para todo el negocio.
 */
export function agendaPorLead(filas: ReadonlyArray<{ lead_id: unknown; reunion: unknown; respuestas: unknown }>): Map<number, AgendaDelLead> {
  const out = new Map<number, AgendaDelLead>();
  for (const f of filas) {
    const id = Number(f.lead_id);
    const reunion = f.reunion === 'R1' ? 'R1' : f.reunion === 'R2' ? 'R2' : null;
    if (!Number.isFinite(id) || !reunion || !Array.isArray(f.respuestas)) continue;
    const de = out.get(id) ?? { R1: [], R2: [] };
    if (!de[reunion].length) de[reunion] = f.respuestas.filter(esQA);
    out.set(id, de);
  }
  return out;
}

/** Cuándo dos preguntas son la misma columna: sin importar espacios de más ni mayúsculas. */
const claveDe = (pregunta: string): string => pregunta.replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');

/** Lo que contestó un lead, de los tres lugares, sin la misma pregunta dos veces (gana la primera). */
export function respuestasDeFila(fila: Record<string, unknown>, agenda: AgendaDelLead | null): RespuestaFormulario[] {
  const legado = PREGUNTAS_CALENDLY
    .map(({ campo, pregunta }) => ({ pregunta, respuesta: String(fila[campo] ?? '').trim() }))
    .filter((r) => r.respuesta.length > 0);
  const todas = [
    ...respuestasDelResumen(legado, agenda),
    ...respuestasPropias(fila.meta_field_data as MetaFieldData | null | undefined),
    ...respuestasGuardadas(fila.optin_respuestas),
  ];
  const vistas = new Set<string>();
  const out: RespuestaFormulario[] = [];
  for (const r of todas) {
    const pregunta = r.pregunta.replace(/\s+/g, ' ').trim();
    const respuesta = r.respuesta.trim();
    const k = claveDe(pregunta);
    if (!pregunta || !respuesta || vistas.has(k)) continue;
    vistas.add(k);
    out.push({ pregunta, respuesta });
  }
  return out;
}

/**
 * Las columnas de las respuestas (una por pregunta, en el orden en que aparecen por primera vez en el archivo) y el valor de
 * cada una en cada lead. Las claves son DERIVADAS (`#resp:N`, ver `esColumnaDerivada`): nunca van al select.
 */
export function columnasDeRespuestas(porLead: ReadonlyArray<ReadonlyArray<RespuestaFormulario>>): {
  columnas: Array<[clave: string, rotulo: string]>;
  valores: Array<Record<string, string>>;
} {
  const indice = new Map<string, string>();
  const columnas: Array<[string, string]> = [];
  const valores = porLead.map((rs) => {
    const v: Record<string, string> = {};
    for (const r of rs) {
      const k = claveDe(r.pregunta);
      let clave = indice.get(k);
      if (!clave) {
        clave = `#resp:${columnas.length}`;
        indice.set(k, clave);
        columnas.push([clave, r.pregunta]);
      }
      v[clave] = r.respuesta;
    }
    return v;
  });
  return { columnas, valores };
}
