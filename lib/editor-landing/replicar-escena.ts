// =============================================================================
// editor-landing/replicar-escena — los varios mouse armando la réplica, atados a lo que de verdad pasa (9/11/2026)
// =============================================================================
// Martín: «PARA WEB REPLICATE, COPIAR ESTO: [el reel] … Sobre todo la animación de los multiples mouse actuando». En el
// reel (docs/relevo/web-replicate-nube.md, cuadro por cuadro) doce cursores con nombre arman una página: arrancan en un
// anillo («BOOTING AGENTS 12/12»), salen disparados, trazan cajas azules con su etiqueta («QA · 400 × 16»), escriben los
// textos letra por letra («Copy · typing»), la página baja siguiendo lo que se arma, y al final se juntan abajo, al lado del
// botón. Acá eso se DERIVA de los eventos reales de la réplica (replicar-progreso.ts), con las reglas de «se ve
// construyéndose» (app/_ui/armado-en-vivo.ts):
//   · una caja aparece cuando llegó el esquema (sus títulos reales), nunca antes;
//   · una caja se escribe sólo si su sección ya se armó Y ya se reveló (`visibles`, la cadencia de useRevelado), con su
//     título de verdad;
//   · el diseño se pinta cuando llegó el evento del diseño y ya se vio escribir todo; la reunión del final, con el `fin` ok;
//   · lo que hacen los cursores sin tarea (los tirones de un lado a otro) no cuenta nada: es cómo se ve que MaKo trabaja,
//     como un giro. El progreso (cuántas cajas escritas, la fase) sale sólo de los eventos.
// Puro y sin `server-only`: lo usa EscenarioReplica.tsx y lo prueba tests/web-replicate-agentes.test.ts, que lo EJECUTA.
// =============================================================================

import { AGENTES, dentro, duracionTecleo, letrasVisibles, puntoOcioso, type Punto, type Rect } from '@/app/_ui/enjambre';
import type { EventoReplica } from './replicar-progreso';
import type { MoldeSeccion } from './replicar-estructura';

/** Lo que se dibuja adentro de una caja: la forma de su sección (de la lectura) o una neutra. */
export type Esqueleto = { tarjetas: number; lineas: number; vinetas: number; botones: number };
const NEUTRO: Esqueleto = { tarjetas: 0, lineas: 2, vinetas: 0, botones: 0 };

export type CajaEscena = {
  indice: number;
  titulo: string;
  /** Quedó con el texto del esquema (no la escribió la IA): la etiqueta lo dice. */
  respaldo: boolean;
  /** Su sección se armó y ya se reveló. */
  escrita: boolean;
  /** En qué turno se reveló (0, 1, 2…), o null. */
  orden: number | null;
  /** El ayudante que la traza y la escribe (índice de AGENTES). */
  dueno: number;
  esqueleto: Esqueleto;
  rect: Rect;
};

export type EtapaEscena = 'arranque' | 'secciones' | 'diseno' | 'lista' | 'fallo';
export type Escena = { etapa: EtapaEscena; cajas: CajaEscena[]; alto: number; escritas: number; total: number };

/** La página del escenario: los márgenes, el aire entre cajas y lo que queda abajo para la barra. */
export const PAGINA = { lado: 18, arriba: 22, entre: 24, abajo: 78 } as const;

/** El dueño de la caja `i`: de a cinco, así dos vecinas nunca son del mismo y con doce cajas trabajan los doce. */
export const duenoDeCaja = (i: number): number => (i * 5 + 1) % AGENTES.length;

/** Los que pintan el diseño (Colores, Imágenes y Fuentes), en ese orden. */
export const PINTORES: readonly number[] = ['colores', 'imagenes', 'fuentes'].map((id) => AGENTES.findIndex((a) => a.id === id));

/** La forma de una sección, recortada a lo que entra en una caja chica. */
export function esqueletoDe(m: MoldeSeccion | undefined): Esqueleto {
  if (!m) return NEUTRO;
  return {
    tarjetas: Math.min(m.subtitulos, 4),
    lineas: Math.min(m.parrafos, 3) || (m.subtitulos || m.vinetas ? 0 : 1),
    vinetas: Math.min(m.vinetas, 3),
    botones: Math.min(m.botones, 2),
  };
}

/** El alto de una caja según lo que lleva adentro. */
export function altoDeCaja(e: Esqueleto): number {
  const h = 20 + 22
    + (e.tarjetas ? 10 + 56 : 0)
    + (e.lineas ? 8 + e.lineas * 12 : 0)
    + (e.vinetas ? 6 + e.vinetas * 11 : 0)
    + (e.botones ? 12 + 24 : 0)
    + 18;
  return Math.max(96, h);
}

/** Las cajas una debajo de la otra, a todo el ancho del escenario. Devuelve los rects y el alto de la página. */
export function maquetar(esqueletos: readonly Esqueleto[], ancho: number): { rects: Rect[]; alto: number } {
  const w = Math.max(120, ancho - PAGINA.lado * 2);
  let y = PAGINA.arriba;
  const rects = esqueletos.map((e) => {
    const r = { x: PAGINA.lado, y, w, h: altoDeCaja(e) };
    y += r.h + PAGINA.entre;
    return r;
  });
  return { rects, alto: y - PAGINA.entre + PAGINA.abajo };
}

/**
 * La escena de una réplica a partir de los eventos que llegaron. `visibles`: cuántas secciones armadas ya se revelaron
 * (useRevelado, en el orden en que llegaron). `moldes`: la forma de cada sección según la lectura; se usa sólo si son las
 * mismas secciones (la misma cantidad), si no la caja va neutra (no se le inventan botones).
 */
export function escenaDeReplica(eventos: readonly EventoReplica[], op: { visibles: number; ancho: number; moldes?: readonly MoldeSeccion[] }): Escena {
  let titulos: string[] | null = null;
  let diseno = false;
  let fin: boolean | null = null;
  const llegadas: { indice: number; titulo: string; respaldo: boolean }[] = [];
  const vistos = new Set<number>();
  for (const e of eventos) {
    if (e.fase === 'esquema') titulos = e.secciones.map((t) => String(t ?? ''));
    else if (e.fase === 'seccion') {
      if (!Number.isInteger(e.indice) || e.indice < 0 || vistos.has(e.indice)) continue;
      vistos.add(e.indice);
      llegadas.push({ indice: e.indice, titulo: e.titulo, respaldo: e.respaldo === true });
    } else if (e.fase === 'diseno') diseno = true;
    else if (e.fase === 'fin') fin = e.respuesta.ok;
  }
  const reveladas = llegadas.slice(0, Math.max(0, Math.min(Math.floor(op.visibles), llegadas.length)));
  const todas = reveladas.length >= llegadas.length;
  const etapa: EtapaEscena = fin === false ? 'fallo'
    : !titulos ? 'arranque'
    : !todas ? 'secciones'
    : fin === true ? 'lista'
    : diseno ? 'diseno'
    : 'secciones';
  if (!titulos) return { etapa, cajas: [], alto: 0, escritas: 0, total: 0 };
  const n = Math.max(titulos.length, ...llegadas.map((l) => l.indice + 1));
  const usarMoldes = !!op.moldes && op.moldes.length === n;
  const esqueletos = Array.from({ length: n }, (_, i) => (usarMoldes ? esqueletoDe(op.moldes![i]) : NEUTRO));
  const { rects, alto } = maquetar(esqueletos, op.ancho);
  const orden = new Map(reveladas.map((r, k) => [r.indice, k]));
  const porIndice = new Map(llegadas.map((l) => [l.indice, l]));
  const cajas = rects.map((rect, i): CajaEscena => {
    const l = porIndice.get(i);
    const k = orden.get(i);
    return {
      indice: i,
      titulo: (l?.titulo || titulos![i] || `Sección ${i + 1}`).replace(/\s+/g, ' ').trim(),
      respaldo: !!l?.respaldo,
      escrita: k !== undefined,
      orden: k ?? null,
      dueno: duenoDeCaja(i),
      esqueleto: esqueletos[i],
      rect,
    };
  });
  return { etapa, cajas, alto, escritas: reveladas.length, total: n };
}

// ─────────────────────────────────────────────────────────────────────────────
// El tiempo: cuándo se traza, se escribe y se pinta cada caja (lo arman los eventos; esto sólo los reparte)
// ─────────────────────────────────────────────────────────────────────────────

/** Cuándo pasó cada cosa (ms del reloj de la pantalla). Lo anota el escenario al ver cambiar la escena. */
export type Tiempos = { esquema: number | null; escritas: ReadonlyMap<number, number>; diseno: number | null; lista: number | null };

export const TRAZO_MS = 520;
export const TRAZO_PASO_MS = 120;
/** Lo más que tarda en arrancar el trazo de la última caja: segundos, nunca minutos. */
export const TOPE_TRAZOS_MS = 1_800;
export const PINTA_MS = 600;
export const PINTA_PASO_MS = 150;
export const TOPE_PINTURA_MS = 1_600;
/** Lo que espera la pantalla, con todo a la vista, antes de abrir el editor: lo que tardan en juntarse. */
export const ESPERA_FINAL_MS = 2_400;

const paso = (n: number, base: number, tope: number) => (n <= 1 ? 0 : Math.min(base, Math.floor(tope / (n - 1))));
export const inicioDeTrazo = (i: number, n: number): number => i * paso(n, TRAZO_PASO_MS, TOPE_TRAZOS_MS);
export const inicioDePintura = (i: number, n: number): number => i * paso(n, PINTA_PASO_MS, TOPE_PINTURA_MS);

/** Cuándo empieza a escribirse una caja: cuando se reveló, pero nunca antes de terminar de trazarla. */
export function inicioDeTecleo(c: CajaEscena, n: number, t: Tiempos): number | null {
  const revelada = t.escritas.get(c.indice);
  if (!c.escrita || revelada === undefined || t.esquema === null) return null;
  return Math.max(revelada, t.esquema + inicioDeTrazo(c.indice, n) + TRAZO_MS);
}

export type EstadoCaja = 'oculta' | 'trazando' | 'trazada' | 'escribiendo' | 'escrita' | 'pintando' | 'pintada';

/** En qué está una caja en el momento `ahora` (con `ahora = Infinity`, lo final: la vista sin movimiento). */
export function estadoDeCaja(c: CajaEscena, escena: Escena, t: Tiempos, ahora: number): EstadoCaja {
  const n = escena.cajas.length;
  if (t.esquema === null) return 'oculta';
  const traza = t.esquema + inicioDeTrazo(c.indice, n);
  if (ahora < traza) return 'oculta';
  if (ahora < traza + TRAZO_MS) return 'trazando';
  const tecleo = inicioDeTecleo(c, n, t);
  if (tecleo === null || ahora < tecleo) return 'trazada';
  if (ahora < tecleo + duracionTecleo(c.titulo)) return 'escribiendo';
  const pintaDesde = escena.etapa === 'diseno' || escena.etapa === 'lista' ? t.diseno ?? t.lista : null;
  if (pintaDesde === null || pintaDesde === undefined) return 'escrita';
  const pinta = pintaDesde + inicioDePintura(c.indice, n);
  if (ahora < pinta) return 'escrita';
  if (ahora < pinta + PINTA_MS) return 'pintando';
  return 'pintada';
}

/** Cuánto del marco de la caja está trazado (0 a 1, con el frenado del reel). */
export function avanceDeTrazo(c: CajaEscena, escena: Escena, t: Tiempos, ahora: number): number {
  if (t.esquema === null) return 0;
  return eo((ahora - (t.esquema + inicioDeTrazo(c.indice, escena.cajas.length))) / TRAZO_MS);
}

/**
 * Los tiempos de una escena ya terminada de mostrar (sin movimiento: «reducir movimiento» del sistema). Con `FINAL` como
 * `ahora`, cada caja queda en su estado final y cada ayudante en su lugar, sin animar nada.
 */
export const FINAL = 1e15;
export function tiemposFinales(escena: Escena): Tiempos {
  const pinta = escena.etapa === 'diseno' || escena.etapa === 'lista';
  return {
    esquema: escena.etapa === 'arranque' ? null : 0,
    escritas: new Map(escena.cajas.filter((c) => c.escrita).map((c) => [c.indice, 0])),
    diseno: pinta ? 0 : null,
    lista: escena.etapa === 'lista' ? 0 : null,
  };
}

/** Las letras del título que se ven (0 hasta que empieza a escribirse). */
export function letrasDeCaja(c: CajaEscena, escena: Escena, t: Tiempos, ahora: number): number {
  const tecleo = inicioDeTecleo(c, escena.cajas.length, t);
  return tecleo === null ? 0 : letrasVisibles(c.titulo, ahora - tecleo);
}

/** La etiqueta azul de la caja (la del reel: «QA · 400 × 16», «Copy · typing»), o null si no lleva. */
export function etiquetaDeCaja(c: CajaEscena, escena: Escena, t: Tiempos, ahora: number): string | null {
  const e = estadoDeCaja(c, escena, t, ahora);
  const dueno = AGENTES[c.dueno].nombre;
  if (e === 'trazando' || e === 'trazada') return `${dueno} · ${Math.round(c.rect.w)} × ${Math.round(c.rect.h)}`;
  if (e === 'escribiendo') return `${dueno} · ${c.respaldo ? 'del esquema' : 'escribiendo'}`;
  if (e === 'pintando') return `${AGENTES[PINTORES[c.indice % PINTORES.length]].nombre} · aplicando`;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Los cursores y la cámara
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que se ve del escenario: desde dónde (`y`, en la página) y cuánto alto. */
export type Vista = { y: number; alto: number };
/** Lo que ocupa la pastilla a la derecha de la flecha (para que no se salga del escenario). */
export const ANCHO_PASTILLA = 108;

export type AccionAgente = 'oculto' | 'trazar' | 'escribir' | 'pintar' | 'reunirse' | 'ocio' | 'quieto';
export type Destino = { p: Punto; visible: boolean; accion: AccionAgente };

const eo = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** Lo que ve el escenario donde se mueven los que no tienen tarea (sin la barra de abajo). */
export function zonaDe(vista: Vista, ancho: number): Rect {
  return { x: 10, y: vista.y + 12, w: Math.max(40, ancho - 20 - ANCHO_PASTILLA), h: Math.max(40, vista.alto - 24 - 58) };
}

/** Adónde va el ayudante `i` en el momento `ahora`. */
export function destinoDeAgente(i: number, escena: Escena, t: Tiempos, ahora: number, vista: Vista, ancho: number): Destino {
  const zona = zonaDe(vista, ancho);
  const borde = (p: Punto): Punto => dentro(p, { x: 6, y: 0, w: ancho - 6, h: Math.max(escena.alto, vista.y + vista.alto) }, ANCHO_PASTILLA);
  if (escena.etapa === 'arranque') return { p: { x: ancho / 2, y: vista.y + vista.alto / 2 }, visible: false, accion: 'oculto' };
  if (escena.etapa === 'fallo') return { p: borde(puntoOcioso(i, 0, zona)), visible: true, accion: 'quieto' };
  // Primero lo que el ayudante tiene entre manos (trazar, escribir, pintar): eso se termina aunque la réplica ya esté lista.
  const n = escena.cajas.length;
  if (t.esquema !== null) {
    for (const c of escena.cajas) {
      if (c.dueno !== i) continue;
      const e = estadoDeCaja(c, escena, t, ahora);
      if (e === 'trazando') {
        const a = eo((ahora - (t.esquema + inicioDeTrazo(c.indice, n))) / TRAZO_MS);
        return { p: borde({ x: c.rect.x + c.rect.w * a, y: c.rect.y + c.rect.h * a }), visible: true, accion: 'trazar' };
      }
      if (e === 'escribiendo') {
        const letras = letrasDeCaja(c, escena, t, ahora);
        return { p: borde({ x: c.rect.x + 18 + Math.min(letras * 9, c.rect.w - 60), y: c.rect.y + 44 }), visible: true, accion: 'escribir' };
      }
    }
  }
  const j = PINTORES.indexOf(i);
  const pintaDesde = t.diseno;
  if ((escena.etapa === 'diseno' || escena.etapa === 'lista') && j >= 0 && pintaDesde !== null) {
    for (const c of escena.cajas) {
      if (c.indice % PINTORES.length !== j) continue;
      const desde = pintaDesde + inicioDePintura(c.indice, n);
      if (ahora >= desde && ahora < desde + PINTA_MS) {
        const a = eo((ahora - desde) / PINTA_MS);
        return { p: borde({ x: c.rect.x + 20 + (c.rect.w - 120) * a, y: c.rect.y + c.rect.h * 0.55 }), visible: true, accion: 'pintar' };
      }
    }
  }
  // Lista: se juntan abajo, al lado del botón de la barra (el final del reel).
  if (escena.etapa === 'lista') {
    // Sin pisarse (una pastilla mide ~90 px): de a cuatro por fila, o menos si el escenario es angosto (un teléfono).
    const columnas = Math.max(2, Math.min(4, Math.floor((ancho - 40) / 100)));
    const filas = Math.ceil(AGENTES.length / columnas);
    const entre = Math.min(100, (ancho - 40 - ANCHO_PASTILLA) / Math.max(1, columnas - 1));
    const col = i % columnas;
    const fila = Math.floor(i / columnas);
    const x0 = (ancho - (entre * (columnas - 1) + ANCHO_PASTILLA)) / 2;
    const y0 = vista.y + vista.alto - 72 - filas * 26;
    return { p: borde({ x: x0 + col * entre + (fila % 2) * (entre / 4), y: y0 + fila * 26 }), visible: true, accion: 'reunirse' };
  }
  return { p: borde(puntoOcioso(i, ahora, zona)), visible: true, accion: 'ocio' };
}

/**
 * Adónde mira la cámara, un poco por debajo del borde de arriba, como en el reel (la página baja siguiendo lo que se
 * arma). Lo que se ESCRIBE manda: la caja que se está escribiendo; si no, la que se está pintando; si no, la última que se
 * escribió; si todavía no se escribió nada, arriba. Los trazos NO mueven la cámara: se trazan todas las cajas juntas (el
 * esquema llega entero), y siguiéndolos la cámara bajaba hasta el final y volvía a subir a escribir, con los títulos fuera
 * de cuadro mientras tanto (medido en el navegador, 9/11/2026).
 */
export function camaraDe(escena: Escena, t: Tiempos, ahora: number, altoVista: number): number {
  if (t.esquema === null || !escena.cajas.length) return 0;
  const n = escena.cajas.length;
  const pinta = (escena.etapa === 'diseno' || escena.etapa === 'lista') && t.diseno !== null;
  // [prioridad, inicio]: la de menor prioridad gana; a igual prioridad, la que empezó más tarde.
  let frente: CajaEscena | null = null;
  let mejor: [number, number] = [Infinity, -Infinity];
  const mirar = (c: CajaEscena, prioridad: number, inicio: number | null) => {
    if (inicio === null || inicio > ahora) return;
    if (prioridad < mejor[0] || (prioridad === mejor[0] && inicio >= mejor[1])) { mejor = [prioridad, inicio]; frente = c; }
  };
  for (const c of escena.cajas) {
    const estado = estadoDeCaja(c, escena, t, ahora);
    const tecleo = inicioDeTecleo(c, n, t);
    if (estado === 'escribiendo') mirar(c, 0, tecleo);
    else if (estado === 'pintando' && pinta) mirar(c, 1, t.diseno! + inicioDePintura(c.indice, n));
    if (tecleo !== null) mirar(c, 2, tecleo);
  }
  const f = frente as CajaEscena | null;
  if (!f) return 0;
  return Math.min(Math.max(0, f.rect.y - altoVista * 0.28), Math.max(0, escena.alto - altoVista));
}

/** El color de acento de la original para pintar el diseño: el más vivo de sus colores, o el naranja del reel. */
export const ACENTO_REEL = '#F2552C';
export function acentoDe(colores: readonly string[] | null | undefined): string {
  let mejor: { c: string; s: number } | null = null;
  for (const c of colores ?? []) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(c.trim());
    if (!m) continue;
    const hex = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    if (s < 0.3 || l < 0.2 || l > 0.82) continue;
    if (!mejor || s > mejor.s) mejor = { c: `#${hex.toUpperCase()}`, s };
  }
  return mejor?.c ?? ACENTO_REEL;
}
