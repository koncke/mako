// =============================================================================
// tokens-del-flujo — ¿cada dato de cada tarjeta se puede resolver? (puro, para Publicar)
// =============================================================================
// Undécima tanda (11/10/2026). Martín, punto 4: «En el mensaje dice "{{Mensaje de MaKo}}", ese dato NO existe...
// No es trackeable, no tiene sentido eso». Y la regla de la casa: lo que un campo ofrece sale de la MISMA
// función con la que el motor resuelve y Publicar valida (`datosOfrecidos(contexto)`, lib/variables-aviso.ts).
//
// Hasta acá Publicar validaba los tokens SÓLO en el recordatorio (`problemaDelTexto`, lib/recordatorio-lead.ts):
// un `{{link_crm}}` en un WhatsApp al lead, un `{{lead_escribio}}` fuera de la charla o un `{{inventado}}`
// salían CRUDOS al teléfono del lead, porque el motor deja crudo lo que no conoce (a propósito: crudo se nota).
// Esto es la pregunta, para TODA tarjeta:
//   · `contextoDeTarjeta(paso, fila)`: con qué contexto se resuelve ESA tarjeta (a quién le llega y qué trae);
//   · `problemasDeTokens(pasos, triggerTipo, subtipoEvento)`: por tarjeta, los tokens que no se pueden resolver,
//     con un motivo corto («No existe: {{x}}»).
//
// NO está enchufado: lo enchufan `setSecuenciaPasos` y `frenoDelFlujo` (paquete w3-motor-integracion). Hasta
// ahí, nadie lo llama.
//
// ⚠️ PURO, SIN `server-only`: lo leen el lienzo, el server y los tests.

import { claseDe, idDe, type PasoGrafo } from './flujo-grafo';
import { OP_AVISAR } from './flujo-legado';
import { proveedorDelPaso } from './nutricion-canal';
import { esVariableConocida } from './template-vars';
import { tokensDe, tokensFueraDe, CLAVE_MENSAJE_MAKO, type ContextoDatos } from './variables-aviso';
import { datosDelEvento } from './aviso-evento';
import { TRIGGER_AVISO_MAKO, TRIGGER_SOLO_GRUPO } from './disparadores';
import { TRIGGER_RECORDATORIO } from './recordatorio-automatizacion';

/**
 * Los tokens que NO se aceptan aunque el contexto los ofrezca: `{{mensaje_mako}}` es el aviso entero que armaba
 * el código, pegado en un token (punto 4). El motor lo sigue RESOLVIENDO para las filas vivas que lo tienen hasta
 * la limpieza (docs/diseno-undecima-tanda.md §8.7), pero nada nuevo lo puede publicar.
 */
export const RETIRADOS: ReadonlySet<string> = new Set([CLAVE_MENSAJE_MAKO]);

/** De qué fila es la tarjeta: su CRON (y, en un evento de MaKo, cuál). */
export type FilaTokens = { trigger_tipo: string; subtipo?: unknown };

/**
 * Con qué se resuelve una tarjeta:
 *   · `catalogo`: el árbol del «{ }» con este contexto (`tokensFueraDe`);
 *   · `oficial`: una plantilla de Meta, que sólo lleva los datos que el motor registra como parámetros
 *     (`valoresVariablesLead`, lib/template-vars.ts: nombre, nombre completo, apellido, empresa y `negocio`).
 */
export type ContextoTarjeta =
  | { tipo: 'catalogo'; datos: ContextoDatos }
  | { tipo: 'oficial' };

const esObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** ¿Es la tarjeta «MaKo en WhatsApp»? (la ⚡ Acción `avisar_al_equipo`). */
function esTarjetaMako(p: PasoGrafo): boolean {
  return claseDe(p) === 'accion' && esObj(p.accion) && p.accion.operacion === OP_AVISAR;
}

/**
 * EL CONTEXTO DE UNA TARJETA, o null si la tarjeta no manda texto (DELAY, CONDITION, AI Step, otra ⚡ Acción…):
 *   · mensaje al lead no oficial, email, Instagram o Messenger → `{ destino: 'lead', conLead: true }`;
 *   · WhatsApp oficial (`proveedorDelPaso`, lib/nutricion-canal.ts) → `oficial`;
 *   · «MaKo en WhatsApp» en una fila de EVENTO de MaKo → lo que trae ese evento (`datosDelEvento`);
 *   · «MaKo en WhatsApp» en un flujo de lead → `{ destino: 'equipo', conLead: true }`; en un Recurrente que es
 *     SÓLO el grupo (`TRIGGER_SOLO_GRUPO`, no hay lead) → `{ destino: 'equipo', conLead: false }`.
 */
export function contextoDeTarjeta(p: PasoGrafo, fila: FilaTokens): ContextoTarjeta | null {
  const conLead = fila.trigger_tipo !== TRIGGER_SOLO_GRUPO;
  if (esTarjetaMako(p)) {
    if (fila.trigger_tipo === TRIGGER_AVISO_MAKO) return { tipo: 'catalogo', datos: datosDelEvento(fila.subtipo) };
    return { tipo: 'catalogo', datos: { destino: 'equipo', conLead } };
  }
  if (claseDe(p) !== 'mensaje') return null;
  const canal = p.canal ?? 'whatsapp';
  if (canal === 'whatsapp' && proveedorDelPaso(p) === 'oficial') return { tipo: 'oficial' };
  return { tipo: 'catalogo', datos: { destino: 'lead', conLead } };
}

// Con UNA llave basta: lo retirado se busca también como `{mensaje_mako}` (el motor lo resuelve igual).
const textoDe = (x: unknown): string | null => (typeof x === 'string' && x.includes('{') ? x : null);

/** Los textos de una lista de partes (`ParteMensaje[]`: el `cuerpo` de las de texto y el pie de las de archivo). */
function textosDePartes(partes: unknown): string[] {
  if (!Array.isArray(partes)) return [];
  return partes.map((x) => (esObj(x) ? textoDe(x.cuerpo) : null)).filter((t): t is string => t != null);
}

/**
 * TODO lo que una tarjeta puede mandar, de TODOS sus lugares: el cuerpo, las variantes (sólo si se sortean: un
 * audio o un archivo no las manda, `textoDelPaso`), las partes, el asunto, el preheader y el HTML del email, y en
 * «MaKo en WhatsApp» el título, el mensaje y las partes de `accion.params`. Sólo los que tienen un token.
 */
export function textosDeTarjeta(p: PasoGrafo): string[] {
  const out: string[] = [];
  const poner = (x: unknown) => { const t = textoDe(x); if (t != null) out.push(t); };
  if (esTarjetaMako(p)) {
    const params = esObj(p.accion) && esObj(p.accion.params) ? p.accion.params : {};
    poner(params.titulo);
    poner(params.mensaje);
    out.push(...textosDePartes(params.partes));
    return out;
  }
  const m = p as PasoGrafo & { variantes?: unknown; preheader?: unknown; cuerpo_html?: unknown };
  poner(m.cuerpo);
  const audio = m.tipo === 'audio' && Number(m.audio_id) > 0;
  if (!audio && m.tipo !== 'media' && Array.isArray(m.variantes)) for (const v of m.variantes) poner(v);
  out.push(...textosDePartes(m.partes));
  poner(m.asunto);
  poner(m.preheader);
  poner(m.cuerpo_html);
  return out;
}

/** Los tokens de un texto que ESTA tarjeta no puede mandar (`{{clave}}`, sin repetir). */
function fueraDe(textos: readonly string[], ctx: ContextoTarjeta): string[] {
  const malos: string[] = [];
  const poner = (t: string) => { if (!malos.includes(t)) malos.push(t); };
  for (const texto of textos) {
    if (ctx.tipo === 'oficial') {
      for (const t of tokensDe(texto)) if (!esVariableConocida(t.key)) poner(`{{${t.key}}}`);
    } else {
      for (const t of tokensFueraDe(texto, ctx.datos)) poner(t);
    }
    // Lo RETIRADO se busca con el regex del MOTOR (`aplicarVariables`, lib/template-vars.ts), no con `tokensDe`: el
    // motor también resuelve `{{ mensaje_mako }}` con espacios y con una llave sola, y `tokensDe` (estricto) no los ve.
    for (const m of texto.matchAll(RX_COMO_EL_MOTOR)) {
      const k = (m[1] ?? m[2] ?? '').toLowerCase();
      if (RETIRADOS.has(k)) poner(`{{${k}}}`);
    }
  }
  return malos;
}

/** El regex de `aplicarVariables` (lib/template-vars.ts): `{{ x }}` con espacios, y `{x}` / `{{x}` sin dígitos. */
const RX_COMO_EL_MOTOR = /\{\{\s*([a-z0-9_]+)\s*\}\}|\{\{?\s*([a-z_]+)\s*\}?\}/gi;

/** Un problema de datos: qué tarjeta abrir y por qué, corto. */
export type ProblemaDeTokens = { tarjeta: string; motivo: string };

/**
 * LOS DATOS QUE NO SE PUEDEN RESOLVER, tarjeta por tarjeta («No existe: {{a}}, {{b}}»). Vacío = todo se resuelve.
 *
 *   · Las filas del CRON del recordatorio (`TRIGGER_RECORDATORIO`) se saltean: su emisor tiene su propio catálogo
 *     (`VARIABLES`, lib/recordatorio-lead.ts) y su propio freno (`problemaDelTexto`) hasta la limpieza.
 *   · `{{mensaje_mako}}` se rechaza SIEMPRE (`RETIRADOS`), aunque el evento lo traiga.
 *
 * `subtipoEvento`: en una fila de evento de MaKo, cuál (`eventoDeFila`, lib/aviso-evento.ts). En las demás, nada.
 */
export function problemasDeTokens(pasos: readonly PasoGrafo[], triggerTipo: string, subtipoEvento?: unknown): ProblemaDeTokens[] {
  if (triggerTipo === TRIGGER_RECORDATORIO) return [];
  const fila: FilaTokens = { trigger_tipo: triggerTipo, subtipo: subtipoEvento };
  const out: ProblemaDeTokens[] = [];
  pasos.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const ctx = contextoDeTarjeta(p, fila);
    if (!ctx) return;
    const malos = fueraDe(textosDeTarjeta(p), ctx);
    if (malos.length) out.push({ tarjeta: idDe(p, i), motivo: `No existe: ${malos.join(', ')}` });
  });
  return out;
}
