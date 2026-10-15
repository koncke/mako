// =============================================================================
// skool-evento — qué dice un aviso de Skool que llega por Zapier, sin tocar la base
// =============================================================================
// Skool no tiene un webhook propio documentado. Lo oficial son los triggers de su app de Zapier
// —«Answered Membership Questions» (alguien pidió entrar y contestó las preguntas de ingreso) y
// «New Paid Member» (alguien pagó y entró)—, y el paso que los manda a MaKo es «Webhooks by
// Zapier → POST» a /api/webhooks/skool con el header `X-MaKo-Clave`.
//
// ⚠️ LA FORMA DEL CUERPO LA DECIDE EL ZAP, NO SKOOL. Si en el paso de Zapier el campo «Data»
// queda vacío, Zapier manda los campos crudos del trigger (no medidos: su nombre exacto depende de
// la app de Skool en Zapier); si la persona los mapea, manda los que eligió. Por eso este lector es
// TOLERANTE y busca por el SIGNIFICADO de la clave, no por un nombre fijo:
//   · email: `email`, `Email`, `member_email`… (cualquier clave que diga «email»);
//   · nombre: `name`/`full_name`/`nombre`, o `first_name` + `last_name` (o `nombre` + `apellido`);
//   · teléfono: `phone`, `telefono`, `whatsapp`, `celular`;
//   · respuestas: pares `question_N`/`answer_N` (o `pregunta_N`/`respuesta_N`), una lista
//     `answers`/`respuestas` de `{ question, answer }`, o cualquier clave que diga «answer» o
//     «respuesta». Lo demás (ids, fechas, links) NO se toma como respuesta: llenaría la ficha de
//     ruido.
//   · evento: `evento`/`event`/`tipo`, opcional. «pago»/«paid» → entró pagando; si no, una solicitud.
//
// SIN `server-only`: lo prueban los tests (tests/skool-evento.test.ts).

import { respuestasDelOptin, type RespuestaOptin } from './optin-respuestas';
import { emailValido } from './hotmart-evento';

export type TipoSkool = 'solicitud' | 'pago';

export type EventoSkool = {
  tipo: TipoSkool;
  contacto: { nombre: string | null; email: string | null; telefono: string | null };
  /** Las respuestas a las preguntas de ingreso, saneadas por la misma regla que el opt-in. */
  respuestas: RespuestaOptin[];
  comunidad: string | null;
};

export type Ignorado = { ignorado: string };

const txt = (v: unknown, tope = 500): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, tope) : null;
};

/** La clave sin mayúsculas, acentos ni separadores: «First Name» → «firstname». */
const llave = (k: string) => k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** «what_is_your_business» → «What is your business»; un guion del texto de la pregunta se queda. */
function rotulo(k: string): string {
  const t = k.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : k;
}

/**
 * El primer valor de texto cuya clave cumple Y que pasa `valida`. Sin `valida`, una clave como
 * `email_verified: true` taparía al `email` de verdad que viene después.
 */
function primero(o: Record<string, unknown>, cumple: (l: string) => boolean, valida: (t: string) => boolean = () => true): string | null {
  for (const [k, v] of Object.entries(o)) {
    if (!cumple(llave(k))) continue;
    const t = txt(v, 200);
    if (t && valida(t)) return t;
  }
  return null;
}

const ES_EMAIL = (l: string) => l === 'email' || l.endsWith('email') || l.startsWith('email');
const ES_TELEFONO = (l: string) => /^(phone|phonenumber|telefono|tel|whatsapp|celular|movil|mobile)$/.test(l) || l.endsWith('phone');
// «nombre» NO va acá: con «apellido» al lado es el nombre de pila, y se junta abajo (ES_PRIMER).
const ES_NOMBRE = (l: string) => /^(name|fullname|nombrecompleto|membername)$/.test(l);
const ES_PRIMER = (l: string) => /^(firstname|nombre|primernombre)$/.test(l);
const ES_APELLIDO = (l: string) => /^(lastname|apellido|apellidos|surname)$/.test(l);
const ES_EVENTO = (l: string) => /^(evento|event|tipo|type|trigger)$/.test(l);
const ES_COMUNIDAD = (l: string) => /^(group|groupname|community|communityname|comunidad)$/.test(l);

/** Las respuestas, como un objeto pregunta → respuesta (después lo sanea `respuestasDelOptin`). */
function respuestasDe(o: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const poner = (p: string | null, r: string | null) => { if (p && r && !(p in out)) out[p] = r; };

  // 1. Una lista de pares o de textos.
  for (const [k, v] of Object.entries(o)) {
    const l = llave(k);
    if ((l === 'answers' || l === 'respuestas' || l === 'membershipanswers') && Array.isArray(v)) {
      v.forEach((x, i) => {
        if (x && typeof x === 'object') {
          const par = x as Record<string, unknown>;
          poner(txt(par.question ?? par.pregunta, 200) ?? `Pregunta ${i + 1}`, txt(par.answer ?? par.respuesta));
        } else poner(`Pregunta ${i + 1}`, txt(x));
      });
    }
  }
  // 2. Pares numerados: question_1 / answer_1, pregunta_1 / respuesta_1, q1 / a1.
  const numero = (l: string, prefijos: string[]) => {
    for (const p of prefijos) { const m = new RegExp(`^${p}(\\d{1,2})$`).exec(l); if (m) return m[1]; }
    return null;
  };
  const preguntas = new Map<string, string>();
  const respuestas = new Map<string, string>();
  for (const [k, v] of Object.entries(o)) {
    const l = llave(k);
    const nq = numero(l, ['question', 'pregunta', 'q']);
    const na = numero(l, ['answer', 'respuesta', 'a']);
    const t = txt(v);
    if (nq && t) preguntas.set(nq, t);
    else if (na && t) respuestas.set(na, t);
  }
  for (const [n, r] of [...respuestas.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    poner(preguntas.get(n) ?? `Pregunta ${n}`, r);
  }
  // 3. Cualquier otra clave que diga «answer» o «respuesta» (una pregunta mapeada con su texto).
  for (const [k, v] of Object.entries(o)) {
    const l = llave(k);
    if (numero(l, ['answer', 'respuesta', 'a']) || l === 'answers' || l === 'respuestas') continue;
    if (/answer|respuesta/.test(l)) poner(rotulo(k), txt(v));
  }
  return out;
}

/**
 * Lee el cuerpo (ya parseado: JSON, o un formulario convertido a objeto). Devuelve el evento, o
 * `{ ignorado }` si no hay a quién sumar: sin email ni teléfono, el CRM no tiene cómo reconocer a
 * la persona la próxima vez (es la misma regla del importador: «sin-contacto»).
 */
export function leerEventoSkool(cuerpo: unknown): EventoSkool | Ignorado {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return { ignorado: 'el cuerpo no es un objeto' };
  // Zapier a veces anida lo del trigger en `data`: se aplana un nivel (lo de arriba gana).
  const raiz = cuerpo as Record<string, unknown>;
  const anidado = raiz.data && typeof raiz.data === 'object' && !Array.isArray(raiz.data) ? (raiz.data as Record<string, unknown>) : {};
  const o: Record<string, unknown> = { ...anidado, ...raiz };

  const email = emailValido(primero(o, ES_EMAIL, (t) => emailValido(t) != null));
  const telefono = primero(o, ES_TELEFONO, (t) => t.replace(/\D/g, '').length >= 6);
  if (!email && !telefono) return { ignorado: 'sin email ni teléfono: no hay cómo reconocer a la persona' };

  const completo = primero(o, ES_NOMBRE);
  const partes = [primero(o, ES_PRIMER), primero(o, ES_APELLIDO)].filter(Boolean).join(' ').trim();
  const nombre = completo ?? (partes || (email ? email.split('@')[0] : null));

  const evento = (primero(o, ES_EVENTO) ?? '').toLowerCase();
  const tipo: TipoSkool = /pag|paid|pay/.test(evento) ? 'pago' : 'solicitud';

  return {
    tipo,
    contacto: { nombre, email, telefono },
    respuestas: respuestasDelOptin(respuestasDe(o)),
    comunidad: primero(o, ES_COMUNIDAD),
  };
}

/** La línea del historial. Es también la llave de que no se repita (ver lib/fuentes-leads.ts). */
export function lineaDelHistorialSkool(e: EventoSkool): string {
  const donde = e.comunidad ? `tu comunidad de Skool «${e.comunidad}»` : 'tu comunidad de Skool';
  return e.tipo === 'pago' ? `Entró pagando a ${donde}` : `Pidió entrar a ${donde}`;
}

/** Las respuestas en una línea, para el historial de un lead que ya existía. */
export function respuestasEnUnaLinea(rs: RespuestaOptin[]): string | null {
  if (!rs.length) return null;
  return `Respuestas de Skool: ${rs.map((r) => `${r.pregunta}: ${r.respuesta}`).join(' · ')}`.slice(0, 1500);
}
