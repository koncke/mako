// =============================================================================
// secciones — cómo se reparte docs/offer-marco.md entre las tabs de Offer Playbook
// =============================================================================
// Módulo PURO (sin fs, sin server-only) para que lo pruebe un test: la pantalla
// lee el documento y se lo pasa; acá sólo se corta.
//
// ⚠️ EL DOCUMENTO ES LA FUENTE. Esta tab lo RENDERIZA (como /admin/docs), no lo
// copia: una segunda copia del marco se queda vieja en cuanto alguien edite la
// primera, y el marco va a cambiar —Martín lo abre justamente para revisarlo—.
//
// ⚠️ Y UNA SECCIÓN NUEVA NO PUEDE DESAPARECER EN SILENCIO. Si el documento suma un
// «## 11.» que nadie mapeó, va a Criterio, al desplegable de «Las piezas en detalle»
// (no se pierde), y el test tests/offer-playbook.test.ts falla hasta que alguien
// decida dónde va.
//
// Desde el 11/10/2026 (tarde) el reparto es: Criterio lleva §1-§7 en desplegables
// (los indicadores, las piezas y la rúbrica salen del CÓDIGO, lib/offer-marco.ts),
// Errores comunes §8, Discrepancias §9 y Autores §10 (las fuentes, al final). «A
// definir» no sale del documento: sale de pendientes.ts.
// =============================================================================

import { ancla } from '@/app/_components/MarkdownDoc';

import { TAB_INICIAL, type TabPlaybook } from './tabs';

export { TABS_PLAYBOOK, TAB_INICIAL, esTabPlaybook, tabDeParam, hrefDeTab, type TabPlaybook } from './tabs';

/** Las tabs que dibujan algo del documento. */
export type TabDelMarco = Exclude<TabPlaybook, 'definir'>;

/** Qué secciones `## N.` del documento van en cada tab. */
export const SECCIONES_DE_TAB: Readonly<Record<TabDelMarco, readonly number[]>> = {
  criterio: [1, 2, 3, 4, 5, 6, 7],
  errores: [8],
  discrepancias: [9],
  autores: [10],
};

/** Los desplegables de Criterio, en el orden del documento. */
export type BloqueCriterio = 'piezas' | 'preguntas' | 'rubrica' | 'plantilla' | 'precio';

/**
 * Qué secciones lleva cada desplegable de Criterio. La introducción del documento
 * (lo que está antes del «## 1.») va al principio de «piezas». Cada sección de
 * `SECCIONES_DE_TAB.criterio` está en UNO (lo fija el test).
 */
export const BLOQUES_CRITERIO: ReadonlyArray<{ id: BloqueCriterio; titulo: string; secciones: readonly number[] }> = [
  { id: 'piezas', titulo: 'Las piezas en detalle', secciones: [1, 2] },
  { id: 'preguntas', titulo: 'Qué le pregunta MaKo', secciones: [3] },
  { id: 'rubrica', titulo: 'La rúbrica en detalle', secciones: [4] },
  { id: 'plantilla', titulo: 'Qué entrega: la plantilla', secciones: [5] },
  { id: 'precio', titulo: 'Precio, garantía, bonos y urgencia', secciones: [6, 7] },
];

/** El desplegable de Autores donde va el §10. */
export const BLOQUE_FUENTES = 'fuentes';

/** El id de un desplegable (`bloque-precio`). El ancla de cada sección va adentro. */
export const idBloque = (b: string): string => `bloque-${b}`;

/**
 * Una sección del documento. `texto` la trae entera (con su «## N.»); `cuerpo`,
 * sin esa primera línea, porque en la tab el título ya lo dice el desplegable o la
 * pestaña. `id` es el ancla que le pondría MarkdownDoc al título: la pantalla se la
 * pone al contenedor, así los links «§N» siguen llegando.
 */
export type Seccion = { numero: number; titulo: string; texto: string; cuerpo: string; id: string };

const RE_SECCION = /^##\s+(\d+)\.\s+(.*)$/;

/**
 * Corta el documento por sus «## N.». Saltea los bloques de código: un «## »
 * adentro de un ``` no es un título (la misma trampa que `sumario` en MarkdownDoc).
 */
export function cortarSecciones(doc: string): { intro: string; secciones: Seccion[] } {
  const lineas = doc.replace(/\r\n/g, '\n').split('\n');
  const intro: string[] = [];
  const secciones: Seccion[] = [];
  let actual: { numero: number; titulo: string; lineas: string[] } | null = null;
  const cerrar = () => {
    if (!actual) return;
    const [cabeza, ...resto] = actual.lineas;
    secciones.push({
      numero: actual.numero,
      titulo: actual.titulo,
      texto: actual.lineas.join('\n').trim(),
      cuerpo: resto.join('\n').trim().replace(/\n-{3,}$/, '').trim(),
      id: ancla(cabeza.replace(/^##\s+/, '').trim()),
    });
  };
  let enCodigo = false;
  for (const l of lineas) {
    if (l.trim().startsWith('```')) enCodigo = !enCodigo;
    const m = enCodigo ? null : l.match(RE_SECCION);
    if (m) {
      cerrar();
      actual = { numero: Number(m[1]), titulo: m[2].trim(), lineas: [l] };
      continue;
    }
    if (actual) actual.lineas.push(l);
    else intro.push(l);
  }
  cerrar();
  // La intro termina en el «---» que la separa del §1: se va, es un separador.
  return { intro: intro.join('\n').trim().replace(/\n-{3,}$/, '').trim(), secciones };
}

/** La tab de una sección. Lo que nadie mapeó va a Criterio (no se pierde). */
export function tabDeSeccion(numero: number): TabDelMarco {
  for (const [tab, nums] of Object.entries(SECCIONES_DE_TAB)) {
    if (nums.includes(numero)) return tab as TabDelMarco;
  }
  return 'criterio';
}

/** El desplegable de Criterio de una sección. Lo que nadie ubicó va al primero. */
export function bloqueDeSeccion(numero: number): BloqueCriterio {
  return BLOQUES_CRITERIO.find((b) => b.secciones.includes(numero))?.id ?? BLOQUES_CRITERIO[0].id;
}

/** Las secciones de una tab, en el orden del documento. */
export function seccionesDeTab(doc: string, tab: TabDelMarco): Seccion[] {
  return cortarSecciones(doc).secciones.filter((s) => tabDeSeccion(s.numero) === tab);
}

/** Las secciones de un desplegable de Criterio (y la intro, si es el primero). */
export function seccionesDeBloque(doc: string, bloque: BloqueCriterio): { intro: string | null; secciones: Seccion[] } {
  const { intro, secciones } = cortarSecciones(doc);
  return {
    intro: bloque === BLOQUES_CRITERIO[0].id && intro ? intro : null,
    secciones: secciones.filter((s) => tabDeSeccion(s.numero) === 'criterio' && bloqueDeSeccion(s.numero) === bloque),
  };
}

// ── El «Cómo se lee» del §4: el recuadro de cómo sale la nota ────────────────

/**
 * Parte el cuerpo del §4 en el «Cómo se lee» (sus viñetas, sin el rótulo) y el
 * resto. El recuadro de Criterio dibuja lo primero tal cual lo dice el documento;
 * el desplegable «La rúbrica en detalle», lo segundo. Si el documento deja de
 * tener ese rótulo, `comoSeLee` sale vacío y el resto trae todo (el test lo caza).
 */
export function partirRubrica(cuerpo: string): { comoSeLee: string; resto: string } {
  const lineas = cuerpo.replace(/\r\n/g, '\n').split('\n');
  const i = lineas.findIndex((l) => /^\*\*Cómo se lee\*\*\s*$/.test(l.trim()));
  if (i < 0) return { comoSeLee: '', resto: cuerpo };
  let fin = i + 1;
  while (fin < lineas.length && (lineas[fin].trim().startsWith('- ') || (fin > i + 1 && /^\s{2,}\S/.test(lineas[fin])))) fin++;
  return {
    comoSeLee: lineas.slice(i + 1, fin).join('\n').trim(),
    resto: [...lineas.slice(0, i), ...lineas.slice(fin)].join('\n').trim(),
  };
}

// ── §9: una tarjeta por discrepancia ─────────────────────────────────────────

/** Un tramo de una discrepancia: una viñeta con su rótulo («MaKo»), o markdown suelto. */
export type Tramo = { etiqueta: string | null; texto: string };

export type Discrepancia = { clave: string; titulo: string; id: string; tramos: Tramo[] };

const RE_SUB = /^###\s+(\d+\.\d+)\s+(.*)$/;
const RE_VINETA = /^-\s+\*\*(.+?)\.?\*\*\s*(.*)$/;

/**
 * Corta el cuerpo del §9 en sus «### 9.x». Cada una se parte en tramos: las
 * viñetas «- **Rótulo.** texto» (con sus renglones de continuación) y lo que no
 * tenga esa forma, como markdown suelto. Nada se descarta: lo que no se entiende
 * se dibuja tal cual.
 */
export function partirDiscrepancias(cuerpo: string): { preambulo: string; items: Discrepancia[] } {
  const lineas = cuerpo.replace(/\r\n/g, '\n').split('\n');
  const pre: string[] = [];
  const items: Array<{ clave: string; titulo: string; cabeza: string; lineas: string[] }> = [];
  for (const l of lineas) {
    const m = l.trim().match(RE_SUB);
    if (m) { items.push({ clave: m[1], titulo: m[2].trim(), cabeza: l.trim().replace(/^###\s+/, ''), lineas: [] }); continue; }
    if (items.length) items[items.length - 1].lineas.push(l);
    else pre.push(l);
  }
  return {
    preambulo: pre.join('\n').trim(),
    items: items.map((it) => ({ clave: it.clave, titulo: it.titulo, id: ancla(it.cabeza), tramos: tramosDe(it.lineas) })),
  };
}

function tramosDe(lineas: string[]): Tramo[] {
  const out: Tramo[] = [];
  let suelto: string[] = [];
  const soltar = () => {
    const t = suelto.join('\n').trim();
    if (t) out.push({ etiqueta: null, texto: t });
    suelto = [];
  };
  for (const l of lineas) {
    const m = l.trim().match(RE_VINETA);
    if (m && !/^\s/.test(l)) { soltar(); out.push({ etiqueta: m[1].trim(), texto: m[2].trim() }); continue; }
    const ultimo = out[out.length - 1];
    if (ultimo?.etiqueta && !suelto.length && /^\s{2,}\S/.test(l)) { ultimo.texto += ' ' + l.trim(); continue; }
    suelto.push(l);
  }
  soltar();
  return out;
}

/** ¿Este tramo es el criterio que adopta MaKo? Lo dice el rótulo del documento. */
export const esCriterioDeMako = (t: Tramo): boolean => !!t.etiqueta && /^mako$/i.test(t.etiqueta.trim());

// ── §8: los errores comunes, de la tabla del documento ───────────────────────

export type ErrorComun = { n: string; error: string; comoSeVe: string; senalan: string[] };

/**
 * Lee la tabla del §8 (# · Error · Cómo se ve · Lo señalan). Devuelve lo que hay
 * antes y después de la tabla, para dibujarlo como texto. Si la tabla no está o
 * cambió de forma, `filas` es null y la pantalla dibuja el cuerpo entero con
 * MarkdownDoc: un cambio del documento no puede hacer desaparecer la sección.
 */
export function partirErrores(cuerpo: string): { antes: string; filas: ErrorComun[] | null; despues: string } {
  const lineas = cuerpo.replace(/\r\n/g, '\n').split('\n');
  const ini = lineas.findIndex((l, i) => l.trim().startsWith('|') && /^\|[\s:|-]+\|$/.test((lineas[i + 1] ?? '').trim()));
  if (ini < 0) return { antes: cuerpo, filas: null, despues: '' };
  const celdas = (fila: string) => fila.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  if (celdas(lineas[ini]).length !== 4) return { antes: cuerpo, filas: null, despues: '' };
  let fin = ini + 2;
  const filas: ErrorComun[] = [];
  while (fin < lineas.length && lineas[fin].trim().startsWith('|')) {
    const c = celdas(lineas[fin]);
    if (c.length !== 4) return { antes: cuerpo, filas: null, despues: '' };
    filas.push({ n: c[0], error: c[1], comoSeVe: c[2], senalan: partirPorComas(c[3]) });
    fin++;
  }
  return { antes: lineas.slice(0, ini).join('\n').trim(), filas, despues: lineas.slice(fin).join('\n').trim() };
}

/** «Molina («a, b»), Razzetti» → ['Molina («a, b»)', 'Razzetti']: no corta adentro de () ni «». */
export function partirPorComas(s: string): string[] {
  const out: string[] = [];
  let hondo = 0;
  let actual = '';
  for (const ch of s) {
    if (ch === '(' || ch === '«') hondo++;
    if (ch === ')' || ch === '»') hondo = Math.max(0, hondo - 1);
    if (ch === ',' && hondo === 0) { if (actual.trim()) out.push(actual.trim()); actual = ''; continue; }
    actual += ch;
  }
  if (actual.trim()) out.push(actual.trim());
  return out;
}

// ── Los links «§N.N» de cada autor ───────────────────────────────────────────

export type Destino = {
  tab: TabDelMarco;
  /** El ancla del título (la misma que pone MarkdownDoc, o la del contenedor). */
  id: string;
  titulo: string;
  /** El desplegable que hay que abrir para que el ancla se vea (`?ver=`). */
  abre: string | null;
};

/**
 * Dónde vive cada «§N» o «§N.N» del documento: en qué tab, con qué ancla y qué
 * desplegable abre. Lo usan los «lo tomó MaKo» de cada autor para linkear a la
 * regla. El ancla es la misma que le pone MarkdownDoc al título (`ancla(texto del
 * título)`), así que no puede divergir.
 */
export function indiceDeSecciones(doc: string): Map<string, Destino> {
  const out = new Map<string, Destino>();
  let enCodigo = false;
  for (const l of doc.replace(/\r\n/g, '\n').split('\n')) {
    const t = l.trim();
    if (t.startsWith('```')) { enCodigo = !enCodigo; continue; }
    if (enCodigo) continue;
    const m = t.match(/^(#{2,4})\s+((\d+)(?:\.(\d+))?\.?\s+.*)$/);
    if (!m) continue;
    const clave = m[4] ? `${m[3]}.${m[4]}` : m[3];
    const n = Number(m[3]);
    const tab = tabDeSeccion(n);
    const abre = tab === 'criterio' ? bloqueDeSeccion(n)
      : tab === 'autores' ? BLOQUE_FUENTES
        : tab === 'discrepancias' && m[4] ? clave
          : null;
    if (!out.has(clave)) out.set(clave, { tab, id: ancla(m[2]), titulo: m[2], abre });
  }
  return out;
}

/** La URL de un destino: la tab, el desplegable que hay que abrir y el ancla. */
export function hrefDeDestino(d: Destino): string {
  const qs = new URLSearchParams();
  if (d.tab !== TAB_INICIAL) qs.set('tab', d.tab);
  if (d.abre) qs.set('ver', d.abre);
  const q = qs.toString();
  return `/admin/offer-playbook${q ? `?${q}` : ''}#${d.id}`;
}

// ── Lo que se le pasa a MarkdownDoc ──────────────────────────────────────────

const RE_CURSIVA = /(?<![*\w])\*(?![\s*])([^*\n]+?)(?<!\s)\*(?![*\w])/g;

/**
 * Saca las marcas de cursiva (`*Nicho Dorado*` → `Nicho Dorado`). MarkdownDoc sólo
 * entiende negrita, código y links —su comentario lo dice: «cursiva y tachado no
 * aparecen en estos documentos»—, y el marco trae 99 cursivas (nombres de recursos
 * de los cursos) que se dibujaban con los asteriscos a la vista. La negrita y lo que
 * va entre backticks no se tocan. Es presentación: el documento no cambia.
 */
export function sinCursivas(md: string): string {
  return md.split(/(`[^`\n]*`)/).map((p, i) => (i % 2 ? p : p.replace(RE_CURSIVA, '$1'))).join('');
}

/** «§2.10», «2.10», «§ 9» → «2.10» / «9». Null si no es una referencia. */
export function claveDeReferencia(ref: string): string | null {
  const m = ref.match(/§?\s*(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}
