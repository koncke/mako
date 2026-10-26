// =============================================================================
// editor-landing/motion — el bloque «Motion graphic» de la landing (el nodo `motion`)
// =============================================================================
// El motor es lib/motion (plantillas, escena, árbol HTML y la hoja de @keyframes): ESTE módulo es sólo el pegamento
// con la landing, y es PURO (sin DOM, sin React, sin server-only): lo importan doc.ts (el texto del bloque),
// especificacion.ts (la forma HTML), validar.ts (el saneo), el NodeView del editor, la IA y la API.
//
// Los atributos del nodo son `{ plantilla, valores, formato }`: `plantilla` y `valores` son el `MotionSpec` del motor
// tal cual (lo mismo que guarda el Video Editor en un clip), `formato` es la proporción de la caja en la sección.
//
// Dos saneos, a propósito, y una sola función (`normalizarAttrsMotion`):
//   · lo que escribió una PERSONA (el panel del editor, lo guardado) pasa NO estricto: nunca se corta ni se rechaza un
//     texto por largo (Martín: «nunca cortar un texto por caracteres»); el motor achica la letra para que entre;
//   · lo que escribe la IA o llega por la API pasa ESTRICTO (el tope de cada campo, el que pensó el diseño): un texto
//     largo se RECHAZA con su motivo, nunca se recorta.
//
// La forma HTML es la del motor (`arbolDeEscena`): la MISMA en el NodeView y en la página publicada. En una miniatura
// o una exportación (PNG, PDF) el bloque sale QUIETO en su estado final (`gm-mo-espera`): una foto a mitad de una
// animación saldría con los textos a medio entrar.
// =============================================================================

import { armarEscena } from '../motion/escena';
import { arbolDeEscena, type NodoHtml } from '../motion/html';
import { familiasDe } from '../motion/fuentes';
import { FUENTES_MOTION, PLANTILLAS, camposDe, esPlantilla, normalizarMotion } from '../motion/plantillas';
import { PLANTILLAS_MOTION, type IdPlantilla, type ValorCampo, type ValoresMotion } from '../motion/tipos';

/** El nombre del nodo (doc.ts lo toma de acá: este módulo no importa doc.ts, que importa éste). */
export const NODO_MOTION = 'motion' as const;

/** La proporción de la caja (ancho:alto). La de un video, la de un post y la de una historia. */
export const FORMATOS_MOTION = ['16:9', '1:1', '9:16'] as const;
export type FormatoMotion = (typeof FORMATOS_MOTION)[number];
export const FORMATO_MOTION_DEFECTO: FormatoMotion = '16:9';

/** Ancho / alto de cada formato (lo que pide `armarEscena`). */
export const ASPECTO_MOTION: Readonly<Record<FormatoMotion, number>> = { '16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16 };

export const ROTULO_FORMATO: Readonly<Record<FormatoMotion, string>> = { '16:9': 'Horizontal', '1:1': 'Cuadrado', '9:16': 'Vertical' };

export type AttrsMotion = { plantilla: IdPlantilla; valores: ValoresMotion; formato: FormatoMotion };

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const esFormatoMotion = (v: unknown): v is FormatoMotion => typeof v === 'string' && (FORMATOS_MOTION as readonly string[]).includes(v);

/**
 * Lo que llegue → atributos válidos y COMPLETOS (todos los campos de la plantilla, en su orden), con lo que se descartó
 * y por qué. `estricto` (la IA, la API): el tope de cada texto se respeta; sin él (la persona), pasa hasta el tope duro
 * del motor. Idempotente: normalizar lo normalizado no cambia nada.
 */
export function normalizarAttrsMotion(raw: unknown, op: { estricto?: boolean } = {}): { attrs: AttrsMotion; descartes: string[] } {
  const o = esObj(raw) ? raw : {};
  const r = normalizarMotion({ plantilla: o.plantilla, valores: o.valores }, { estricto: op.estricto === true });
  const descartes = [...r.descartes];
  let formato = FORMATO_MOTION_DEFECTO;
  if (esFormatoMotion(o.formato)) formato = o.formato;
  else if (o.formato !== undefined && o.formato !== null) descartes.push(`formato «${String(o.formato).slice(0, 20)}»: no es ${FORMATOS_MOTION.join(', ')}`);
  return { attrs: { plantilla: r.spec.plantilla, valores: r.spec.valores, formato }, descartes };
}

/** El normalizador del nodo (NORMALIZAR_NODOS): el de la persona, no estricto. */
export function attrsMotion(raw: unknown): AttrsMotion {
  return normalizarAttrsMotion(raw).attrs;
}

/** La escena del motor para estos atributos (sin `video`: en la landing el bloque queda quieto en su estado final). */
const escenaDe = (a: AttrsMotion) => armarEscena({ plantilla: a.plantilla, valores: a.valores }, { aspecto: ASPECTO_MOTION[a.formato] });

/**
 * El árbol del bloque: `div.gm-motion[role=img][aria-label][data-plantilla][data-formato]` con las capas del motor.
 * `quieto`: con `gm-mo-espera` (sin animación = el estado final): la miniatura, la exportación, el panel abierto.
 */
export function arbolMotion(raw: unknown, op: { quieto?: boolean } = {}): NodoHtml {
  const a = attrsMotion(raw);
  return arbolDeEscena(escenaDe(a), {
    'data-plantilla': a.plantilla,
    'data-formato': a.formato,
    ...(op.quieto ? { class: 'gm-mo-espera' } : {}),
  });
}

/** El texto que se LEE del bloque (el `aria-label`): para la tira, el SEO, el diagnóstico y la IA. */
export function textoDeMotion(raw: unknown): string {
  return escenaDe(attrsMotion(raw)).texto;
}

/** Las familias de Google Fonts que dibuja el bloque (la de la plantilla y, en un testimonio, la de las comillas). */
export function familiasDeMotion(raw: unknown): string[] {
  return familiasDe(escenaDe(attrsMotion(raw)));
}

/** Las claves de los campos COMUNES (tono, colores, fondo, fuente): las que valen en cualquier plantilla. */
export function camposComunes(id: IdPlantilla): Set<string> {
  const propias = new Set(PLANTILLAS[id].campos.map((c) => c.clave));
  return new Set(camposDe(id).map((c) => c.clave).filter((k) => !propias.has(k)));
}

/**
 * Cambiar de plantilla en el panel: los comunes (el estilo) se quedan; lo propio de la otra plantilla no calza y entra
 * el ejemplo de la nueva. Así no queda ningún campo ajeno que el saneo anotaría como descarte en cada guardado.
 */
export function cambiarPlantilla(actual: AttrsMotion, nueva: IdPlantilla): AttrsMotion {
  if (nueva === actual.plantilla) return actual;
  const comunes = camposComunes(nueva);
  const valores: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(actual.valores)) if (comunes.has(k)) valores[k] = v;
  return normalizarAttrsMotion({ plantilla: nueva, valores, formato: actual.formato }).attrs;
}

/**
 * Lo que pide la IA o la API para un motion graphic, ESTRICTO, sobre el que ya había (`base`, o null si es nuevo):
 *   · cada campo que llega pasa SOLO por `normalizarMotion` estricto: un texto más largo que su tope o un número fuera
 *     de rango es un `motivo` (el pedido no se aplica: nunca se recorta, y no queda el ejemplo de la plantilla en su
 *     lugar); un color, un tono, una fuente o un formato inválidos son un `aviso` (queda el anterior);
 *   · lo que no cambió respecto de `base` no se vuelve a validar (un texto largo que la persona escribió en el panel,
 *     sin tope, no hace fallar el pedido por pasar por acá);
 *   · lo que NADIE dio no sale del ejemplo de la plantilla (las skills: «nunca inventes un nombre, una cifra o una
 *     calificación»): un texto queda vacío; uno obligatorio o el número de «cifra» son un `motivo`; las estrellas, 0.
 *   · con otra plantilla, de `base` sólo quedan los comunes (el estilo).
 * `attrs` es null si hay algún motivo.
 */
export function pedidoMotion(
  pedido: { plantilla?: unknown; valores?: unknown; formato?: unknown },
  base: AttrsMotion | null,
): { attrs: AttrsMotion | null; motivos: string[]; avisos: string[] } {
  const motivos: string[] = [];
  const avisos: string[] = [];
  const pedida = typeof pedido.plantilla === 'string' ? pedido.plantilla.trim() : '';
  const plantilla: IdPlantilla | null = esPlantilla(pedida) ? pedida : !pedida && base ? base.plantilla : null;
  if (!plantilla) {
    motivos.push(`la plantilla «${pedida.slice(0, 30) || '(sin plantilla)'}» no existe (${PLANTILLAS_MOTION.join(', ')})`);
    return { attrs: null, motivos, avisos };
  }
  const campos = camposDe(plantilla);
  const comunes = camposComunes(plantilla);
  const previos: Record<string, ValorCampo> = {};
  if (base) for (const c of campos) if (c.clave in base.valores && (base.plantilla === plantilla || comunes.has(c.clave))) previos[c.clave] = base.valores[c.clave];
  const crudos = esObj(pedido.valores) ? pedido.valores : {};
  const aceptados: Record<string, ValorCampo> = {};
  for (const [k, v] of Object.entries(crudos)) {
    const c = campos.find((x) => x.clave === k);
    if (!c) { avisos.push(`«${k.slice(0, 30)}» no es un campo de «${PLANTILLAS[plantilla].nombre}» (${campos.map((x) => x.clave).join(', ')})`); continue; }
    if (k in previos && previos[k] === v) continue;
    const uno = normalizarMotion({ plantilla, valores: { [k]: v } }, { estricto: true });
    if (!uno.descartes.length) { aceptados[k] = uno.spec.valores[k]; continue; }
    (c.tipo === 'texto' || c.tipo === 'numero' ? motivos : avisos).push(...uno.descartes);
  }
  const defecto = normalizarMotion({ plantilla }).spec.valores;
  const valores: Record<string, ValorCampo> = {};
  for (const c of campos) {
    if (c.clave in aceptados) valores[c.clave] = aceptados[c.clave];
    else if (c.clave in previos) valores[c.clave] = previos[c.clave];
    else if (c.tipo === 'texto') {
      if (c.obligatorio && !motivos.some((m) => m.startsWith(c.rotulo + ':'))) motivos.push(`falta «${c.rotulo}» (${c.clave}), y no se inventa`);
      valores[c.clave] = '';
    } else if (plantilla === 'cifra' && c.clave === 'numero') {
      if (!motivos.some((m) => m.startsWith(c.rotulo + ':'))) motivos.push('falta el número (numero), y no se inventa');
    } else if (c.clave === 'estrellas') valores[c.clave] = 0;
    else valores[c.clave] = defecto[c.clave];
  }
  let formato: FormatoMotion = base?.formato ?? FORMATO_MOTION_DEFECTO;
  if (pedido.formato !== undefined && pedido.formato !== null && pedido.formato !== '') {
    if (esFormatoMotion(pedido.formato)) formato = pedido.formato;
    else avisos.push(`el formato «${String(pedido.formato).slice(0, 20)}» no existe (${FORMATOS_MOTION.join(', ')})`);
  }
  return { attrs: motivos.length ? null : { plantilla, valores, formato }, motivos, avisos };
}

/** El catálogo CORTO para el prompt de la IA: una línea por plantilla con sus campos y topes (* = obligatorio). */
export function catalogoMotionCorto(): string {
  return (Object.keys(PLANTILLAS) as IdPlantilla[]).map((id) => {
    const campos = PLANTILLAS[id].campos.map((c) => {
      if (c.tipo === 'texto') return `${c.clave}${c.obligatorio ? '*' : ''}≤${c.max}`;
      if (c.tipo === 'numero') return `${c.clave}(número${Math.abs(c.max) < 1e6 ? ` ${c.min} a ${c.max}` : ''})`;
      return `${c.clave}(${c.tipo})`;
    }).join(', ');
    return `${id}: ${campos}`;
  }).join(' · ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Las fuentes de los bloques en la página publicada (un link de Google Fonts)
// ─────────────────────────────────────────────────────────────────────────────

type NodoJson = { type?: unknown; attrs?: unknown; content?: unknown };

/** Las familias que usan los motion graphics de estos nodos (y sus hijos). */
export function familiasMotionDe(nodos: readonly unknown[]): string[] {
  const out = new Set<string>();
  const visitar = (n: unknown) => {
    if (!esObj(n)) return;
    const x = n as NodoJson;
    if (x.type === NODO_MOTION) for (const f of familiasDeMotion(x.attrs)) out.add(f);
    if (Array.isArray(x.content)) x.content.forEach(visitar);
  };
  nodos.forEach(visitar);
  return [...out].sort();
}

/**
 * El link de Google Fonts del tema con las familias de los motion graphics SUMADAS (un solo link: la página
 * publicada acepta hasta cuatro y el tema ya usa uno). Una familia que ya trae el tema suma los pesos que le faltan.
 * Sin familias, el link del tema tal cual.
 */
export function urlFuentesConMotion(urlTema: string, familias: readonly string[]): string {
  const pesos = new Map<string, Set<number>>();
  const PREFIJO = 'https://fonts.googleapis.com/css2?';
  if (urlTema.startsWith(PREFIJO)) {
    for (const parte of urlTema.slice(PREFIJO.length).split('&')) {
      if (!parte.startsWith('family=')) continue;
      const [fam, w] = parte.slice('family='.length).split(':wght@');
      const nombre = decodeURIComponent(fam.replace(/\+/g, ' '));
      pesos.set(nombre, new Set((w ?? '').split(';').map(Number).filter((n) => Number.isFinite(n) && n > 0)));
    }
  }
  const antes = pesos.size;
  let suma = false;
  for (const f of familias) {
    const disponibles = FUENTES_MOTION[f];
    if (!disponibles) continue;
    const s = pesos.get(f) ?? new Set<number>();
    for (const w of disponibles) if (!s.has(w)) { s.add(w); suma = true; }
    pesos.set(f, s);
  }
  if (!suma && pesos.size === antes) return urlTema;
  const familiasUrl = [...pesos.keys()].sort().map((f) => {
    const ws = [...(pesos.get(f) ?? [])].sort((a, b) => a - b);
    return 'family=' + f.replace(/ /g, '+') + (ws.length ? ':wght@' + ws.join(';') : '');
  });
  return PREFIJO + familiasUrl.join('&') + '&display=swap';
}

export { esPlantilla };
