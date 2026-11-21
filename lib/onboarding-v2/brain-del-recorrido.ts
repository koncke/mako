// =============================================================================
// EL SECOND BRAIN DEL RECORRIDO: lo puro (21/11/2026, la animación de la maqueta en la app)
// =============================================================================
// La maqueta aprobada (C:/dev/artefactos-onboarding/cuerpo.html → `brainHtml`): el Second Brain de la portada, entero
// (app/vsl/_sitio/cerebro-ejemplo.json), que se APAGA DE A POCO de los nodos de afuera hacia adentro (16/11, 4.ª vuelta, Martín: «no
// que se haga chiquito el Second Brain y que de pronto aparezca otro»). Quedan la raíz y uno de las áreas por cada cosa que MaKo sabe
// de la persona; se acomodan en un círculo parejo alrededor de su negocio y pasan a decirla. La cámara se acerca.
// Lo dibuja app/second-brain/BrainDelRecorrido.tsx; lo prueba tests/brain-del-recorrido.test.ts.
// =============================================================================

/** [id, área, etiqueta, x, y, radio, destacado (0|1), es un área (0|1)]: lo que la animación necesita de cada nodo. */
export type NodoCorto = [string, string, string, number, number, number, 0 | 1, 0 | 1];
export type CerebroCorto = { nodos: NodoCorto[]; aristas: [string, string][]; encuadre: { x: number; y: number; lado: number } };

/** Lo que MaKo sabe de la persona al terminar el onboarding (`onboarding.arranque`). Lo que no dijo, vacío: no se pone. */
export type LoQueSabe = { nombre: string; negocio: string; whatsapp: boolean; origen: string; intereses: string[] };
export type Hecho = { k: string; v: string; area: string };

/** A los 1,2 s de abrirse empieza a apagarse (la maqueta, `programarBrain`). */
// 21/11/2026, Martín en producción: «primero aparece un Second Brain chiquito (el original) y recién al segundo arranca la animación»:
// arranca DIRECTO. Lo justo para que el navegador pinte el cuadro de partida y la transición corra (sin eso, salta al final).
export const DEMORA_FASE_MS = 60;

/** Hasta 3 cosas para resolver primero, como el onboarding. */
const MAX_INTERESES = 3;

/**
 * El cerebro de la portada, en corto (lo mismo que hace la maqueta al armarse, C:/dev/artefactos-onboarding/armar.mjs): sólo los nodos
 * con posición, con el radio de la app (lib/cerebro-modelo.ts → `radioNodo`, por el grado). El JSON entero pesa 107 KB; éste, lo justo.
 */
export function compactarCerebro(j: {
  nodos: { id: string; area: string; etiqueta: string; destacado?: boolean; tipo?: string }[];
  aristas: { de: string; a: string }[];
  posiciones: Record<string, { x: number; y: number }>;
  encuadre: { x: number; y: number; lado: number };
}): CerebroCorto {
  const grado: Record<string, number> = {};
  for (const a of j.aristas) { grado[a.de] = (grado[a.de] || 0) + 1; grado[a.a] = (grado[a.a] || 0) + 1; }
  const radio = (g: number) => Math.max(8, Math.min(3 * Math.sqrt(g + 1), 30));
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const nodos: NodoCorto[] = j.nodos.filter((n) => j.posiciones[n.id]).map((n) => [
    n.id, n.area, n.etiqueta, r1(j.posiciones[n.id].x), r1(j.posiciones[n.id].y), r1(radio(grado[n.id] || 0)), n.destacado ? 1 : 0, n.tipo === 'Área' ? 1 : 0,
  ]);
  const ids = new Set(nodos.map((n) => n[0]));
  return { nodos, aristas: j.aristas.filter((a) => ids.has(a.de) && ids.has(a.a)).map((a) => [a.de, a.a]), encuadre: j.encuadre };
}

/** Lo que MaKo sabe, en el orden de la maqueta; lo que falta no va (ni con «…»). */
export function hechosDe(s: LoQueSabe): Hecho[] {
  const h: Hecho[] = [];
  if (s.nombre) h.push({ k: 'Tú', v: s.nombre, area: 'panorama' });
  if (s.whatsapp) h.push({ k: 'Tu WhatsApp', v: 'Confirmado', area: 'documentos' });
  if (s.origen) h.push({ k: 'Llegaste por', v: s.origen, area: 'razones' });
  for (const q of s.intereses.slice(0, MAX_INTERESES)) if (q) h.push({ k: 'Quieres', v: q, area: 'funnel' });
  return h;
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** `onboarding.arranque` guardado (en crudo) → lo que MaKo sabe. `nombre`: el de la página (lib/reto/nombre.ts), si el onboarding no trae. */
export function loQueSabeDelArranque(crudo: string | null | undefined, nombre: string): LoQueSabe {
  let a: Record<string, unknown> = {};
  try { const j = JSON.parse(crudo ?? 'null'); if (j && typeof j === 'object') a = j as Record<string, unknown>; } catch { /* roto: lo de la página */ }
  const delOnboarding = texto(a.nombre).split(/\s+/)[0] ?? '';
  return {
    nombre: delOnboarding || nombre,
    negocio: texto(a.negocio),
    whatsapp: a.telefono === 'verificado',
    origen: texto(a.origen),
    intereses: Array.isArray(a.intereses) ? a.intereses.map(texto).filter(Boolean).slice(0, MAX_INTERESES) : [],
  };
}

/** Un texto en renglones de hasta `n` letras (3 como mucho), como la maqueta. */
export function partirEnRenglones(t: string, n: number): string[] {
  const out: string[] = [];
  let l = '';
  for (const w of String(t).split(' ')) {
    if ((l + ' ' + w).trim().length > n && l) { out.push(l); l = w; } else l = (l + ' ' + w).trim();
  }
  if (l) out.push(l);
  return out.slice(0, 3);
}

export type NodoDelBrain = {
  id: string; x: number; y: number; r: number; color: string;
  /** La etiqueta de la portada (sólo las áreas y la raíz). */
  etiqueta: string | null;
  queda: boolean; esRaiz: boolean;
  /** Los que se apagan: cuánto esperan (s). El de más afuera, 0; el de más adentro, 1,6. */
  demora: number | null;
  /** Los que quedan: a dónde van, y lo que dicen. */
  tx?: number; ty?: number; area?: string; k?: string; v?: string[];
};
export type Brain = {
  cx: number; cy: number; RT: number; negocio: string;
  encuadre: CerebroCorto['encuadre'];
  /** Cuánto se mueve la cámara para centrar el negocio. */
  dx: number; dy: number;
  aristas: { x1: number; y1: number; x2: number; y2: number; demora: number }[];
  lineas: { x2: number; y2: number }[];
  nodos: NodoDelBrain[];
};

/** La geometría de la animación (la maqueta, `brainHtml`). `angosta`: en el teléfono los renglones son más cortos. */
export function armarBrain(C: CerebroCorto, s: LoQueSabe, o: { angosta: boolean }): Brain {
  const e = C.encuadre;
  const pos = new Map(C.nodos.map((x) => [x[0], x]));
  const raiz = pos.get('raiz') ?? C.nodos[0];
  const cx = raiz[3], cy = raiz[4];
  const hechos = hechosDe(s);
  // Los que quedan: de las áreas (la primera vuelta alrededor de la raíz), repartidos; al final, en un círculo parejo.
  const areas = C.nodos.filter((x) => x[7] && x[0] !== raiz[0]).sort((a, b) => Math.atan2(a[4] - cy, a[3] - cx) - Math.atan2(b[4] - cy, b[3] - cx));
  const RT = Math.round(e.lado * 0.2);
  const quedan = new Map(hechos.map((h, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / hechos.length;
    return [areas[Math.floor((i * areas.length) / hechos.length)][0], { h, tx: cx + RT * Math.cos(ang), ty: cy + RT * Math.sin(ang) }] as const;
  }));
  const dist = (x: NodoCorto) => Math.hypot(x[3] - cx, x[4] - cy);
  const resto = C.nodos.filter((x) => x[0] !== raiz[0] && !quedan.has(x[0]));
  const dMax = Math.max(...resto.map(dist)), dMin = Math.min(...resto.map(dist));
  const demora = new Map(resto.map((x) => [x[0], +((1 - (dist(x) - dMin) / (dMax - dMin || 1)) * 1.6).toFixed(2)]));
  const aristas = C.aristas.flatMap(([de, a]) => {
    const p = pos.get(de), q = pos.get(a);
    if (!p || !q) return [];
    const vs = [demora.get(de), demora.get(a)].filter((v): v is number => v != null);
    // Las de la raíz a los que quedan se apagan antes de que se acomoden.
    return [{ x1: p[3], y1: p[4], x2: q[3], y2: q[4], demora: vs.length ? Math.min(...vs) : 1.3 }];
  });
  const ancho = o.angosta ? 15 : 20;
  const nodos: NodoDelBrain[] = C.nodos.map((x) => {
    const esRaiz = x[0] === raiz[0], q = quedan.get(x[0]);
    const color = esRaiz ? 'var(--ink)' : x[6] ? 'var(--mako)' : `var(--grafo-${x[1]})`;
    const base: NodoDelBrain = { id: x[0], x: x[3], y: x[4], r: x[5], color, etiqueta: x[7] || esRaiz ? x[2] : null, queda: esRaiz || !!q, esRaiz, demora: demora.get(x[0]) ?? null };
    if (!q) return base;
    return { ...base, tx: +q.tx.toFixed(1), ty: +q.ty.toFixed(1), area: q.h.area, k: q.h.k, v: partirEnRenglones(q.h.v, ancho) };
  });
  return {
    cx, cy, RT, negocio: s.negocio || 'Tu negocio', encuadre: e,
    dx: Math.round(e.x + e.lado / 2 - cx), dy: Math.round(e.y + e.lado / 2 - cy),
    aristas, lineas: [...quedan.values()].map((q) => ({ x2: +q.tx.toFixed(1), y2: +q.ty.toFixed(1) })), nodos,
  };
}

/**
 * La cámara (la maqueta, `medirBrain`): los nombres se leen igual en la computadora y en el teléfono (`k`, la escala del lienzo), y se
 * acerca hasta que lo que quedó llene el lienzo (`s`, de 1 a 3). En el teléfono la tarjeta del recorrido va abajo: lo que quedó sube.
 */
export function camaraDe(ancho: number, alto: number, b: Pick<Brain, 'RT' | 'encuadre' | 'dy'>, angosta: boolean): { k: number; s: number; dy: number } {
  const m = Math.min(ancho, alto);
  const k = m / b.encuadre.lado || 1;
  const s = Math.max(1, Math.min(3, (m / 2 - (angosta ? 70 : 110)) / (b.RT * k)));
  return { k, s, dy: angosta ? b.dy - 118 / k : b.dy };
}
