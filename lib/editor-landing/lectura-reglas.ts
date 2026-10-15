// =============================================================================
// editor-landing/lectura-reglas — lo PURO de una página leída en el navegador (tanda 6)
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto
// de esa página". Soluciona eso...». El contrato está en lectura-tipos.ts; acá, lo que el server hace
// con él y se puede probar sin red:
//   · `sanearLectura`: lo que manda el navegador, con topes y sin lo que no es texto (llega de la
//     página de un TERCERO: nunca se confía en su forma);
//   · `lineasProbadas`: lo que el lector probó, dicho para el análisis («Botón «Agenda» → calendly…»,
//     «Calendario: no cargó»);
//   · `motivoDeError` / `fallaEnNavegador`: la respuesta que la pantalla entiende cuando el server no
//     pudo leer la página y en el navegador de la persona sí se lee — en vez del callejón «No pude
//     leer el texto de esa página», que era todo lo que se contestaba.
// Sin server-only: lo importan las rutas, el server y los tests.
// =============================================================================

import { bloqueaLaLectura } from '../landing-extraer';
import {
  MOTIVOS_EN_NAVEGADOR,
  type FallaEnNavegador, type InteraccionLectura, type Lectura, type MotivoEnNavegador, type SeLeeEnNavegador,
} from './lectura-tipos';

/**
 * Los topes de una lectura. `texto` es el de lo que entra a un esquema (`MAX_TEXTO_ENTRADA`,
 * ia-reglas.ts: no se importa para no arrastrar ese módulo a quien sólo quiere esto).
 */
export const TOPES_LECTURA = {
  texto: 60_000,
  interacciones: 80,
  tipo: 30,
  textoInteraccion: 300,
  destino: 500,
} as const;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const linea = (v: unknown, max: number): string =>
  (typeof v === 'string' ? v.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Un destino que se puede mostrar: sin esquemas que ejecutan (javascript:, data:, vbscript:). */
function destinoSeguro(v: unknown): string {
  const d = linea(v, TOPES_LECTURA.destino);
  return /^\s*(?:javascript|data|vbscript):/i.test(d) ? '' : d;
}

/**
 * Lo que mandó el navegador como `Lectura`, o null si no es una (sin `fuente: 'navegador'`, o sin
 * texto ni nada probado). El texto conserva sus renglones (son el orden de lectura) y pierde los
 * caracteres de control; cada interacción, sus saltos de línea.
 */
export function sanearLectura(raw: unknown): Lectura | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.fuente !== 'navegador') return null;
  const texto = typeof r.texto === 'string'
    ? r.texto.replace(/\r\n?/g, '\n').replace(CONTROL, '').replace(/[ \t ]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, TOPES_LECTURA.texto)
    : '';
  const interacciones: InteraccionLectura[] = [];
  for (const x of Array.isArray(r.interacciones) ? r.interacciones : []) {
    if (interacciones.length >= TOPES_LECTURA.interacciones) break;
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const tipo = linea(o.tipo, TOPES_LECTURA.tipo).toLowerCase();
    const t = linea(o.texto, TOPES_LECTURA.textoInteraccion);
    const destino = destinoSeguro(o.destino);
    if (!tipo || (!t && !destino)) continue;
    interacciones.push({ tipo, texto: t, ...(destino ? { destino } : {}) });
  }
  if (!texto && !interacciones.length) return null;
  return { texto, interacciones, fuente: 'navegador' };
}

/** Una interacción probada, dicha para el análisis (los tipos los documenta `InteraccionLectura`). */
export function lineaDeInteraccion(i: InteraccionLectura): string {
  const rotulo = i.texto ? `«${i.texto}»` : '(sin texto)';
  const a = i.destino ? ` → ${i.destino}` : '';
  if (/bot[oó]n|cta|enlace|link/.test(i.tipo)) return `Botón ${rotulo}${a || ' → (sin destino)'}`;
  if (/calend|agenda/.test(i.tipo)) return `Calendario: ${i.texto || '(sin dato)'}${a}`;
  if (/desplegable|acorde|pregunta|faq/.test(i.tipo)) return `Desplegable abierto: ${rotulo}`;
  if (/form/.test(i.tipo)) return `Formulario: ${rotulo}${a}`;
  if (/video/.test(i.tipo)) return `Video: ${i.texto || '(sin dato)'}${a}`;
  return `${i.tipo}: ${i.texto}${a}`;
}

/** Lo que el lector probó, una línea por cosa y sin repetidas (un botón que aparece tres veces es uno). */
export function lineasProbadas(l: Pick<Lectura, 'interacciones'>): string[] {
  return [...new Set(l.interacciones.map(lineaDeInteraccion))];
}

/**
 * La línea del `meta` del análisis cuando la página la leyó el navegador (la escribimos nosotros, no la
 * página: va fuera del bloque no confiable). Lo probado va abajo, delimitado.
 */
export const LINEA_LEIDA_EN_NAVEGADOR =
  'Leída en un navegador: MaKo abrió la página como un visitante, abrió los desplegables, anotó a dónde lleva cada botón sin seguirlo y miró si el calendario carga, sin reservar. Lo que probó va abajo y es un hecho medido: un botón sin destino o un calendario que no cargó es un hallazgo.';

// ─────────────────────────────────────────────────────────────────────────────
// La respuesta «léela en tu navegador»
// ─────────────────────────────────────────────────────────────────────────────

export const motivoValido = (v: unknown): v is MotivoEnNavegador => (MOTIVOS_EN_NAVEGADOR as readonly unknown[]).includes(v);

/** El texto de la falla, para la persona (la pantalla dibuja su propio aviso con `motivo`). */
export function mensajeEnNavegador(motivo: MotivoEnNavegador): string {
  return motivo === 'bloquea-lectura'
    ? 'Esta página no deja que MaKo la lea sola. Léela desde tu navegador o pega su texto.'
    : 'Esta página se arma en el navegador. Léela desde tu navegador o pega su texto.';
}

export const seLeeEnNavegador = (motivo: MotivoEnNavegador): SeLeeEnNavegador => ({ pegable: true, enNavegador: true, motivo });

/** La falla entera: `{ ok: false, error, pegable: true, enNavegador: true, motivo }`. */
export function fallaEnNavegador(motivo: MotivoEnNavegador, error = mensajeEnNavegador(motivo)): FallaEnNavegador {
  return { ok: false, error, ...seLeeEnNavegador(motivo) };
}

/**
 * ¿Un error de bajar la página se resuelve leyéndola en el navegador? Sólo cuando la página contestó
 * pero NO A NOSOTROS (401/403/406/429, `bloqueaLaLectura`). Un 404, un DNS que no resuelve o una red
 * interna no se arreglan en ningún navegador: siguen siendo su error.
 */
export function motivoDeError(e: unknown): MotivoEnNavegador | null {
  return bloqueaLaLectura(e) ? 'bloquea-lectura' : null;
}

/** ¿Lo que se bajó no trae texto? (el HTML de una app que se arma con JavaScript). */
export function motivoDePagina(p: { bloqueada: boolean; texto: string }): MotivoEnNavegador | null {
  return p.bloqueada || !p.texto.trim() ? 'se-arma-en-navegador' : null;
}
