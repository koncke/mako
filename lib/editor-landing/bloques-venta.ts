// =============================================================================
// editor-landing/bloques-venta — la cuenta regresiva, la prueba social y la barra de escasez (puro)
// =============================================================================
// Black November de Leila (5/11/2026): su landing de la campaña necesita una fecha de cierre, a quién ya compró y cuántos
// lugares quedan. Tres bloques nuevos, con UNA regla que no se negocia: SÓLO CON DATOS REALES QUE PONE EL NEGOCIO.
//   · la cuenta regresiva cuenta hasta una FECHA guardada (no «24 h desde que entraste»): es la misma para todo el que la mira,
//     y al vencer NO se reinicia (se oculta o dice que terminó, lo que el negocio eligió);
//   · la prueba social muestra lo que el negocio escribió (nombre, qué hizo, de dónde, cuándo): nada se genera, no hay «hace
//     5 minutos» inventado (el «hace N días» sale de la fecha que puso) y sin ninguna, no hay pop;
//   · la escasez dice «Quedan N de M» con los dos números que puso el negocio: no baja sola ni se estima.
// Sin el dato, el bloque NO SE MUESTRA en la página (render.ts lo saltea con `bloqueVentaListo`); en el editor se ve con lo
// que falta, para completarlo.
//
// Lo usan: especificacion.ts (la forma HTML, que comparten el editor y la página publicada), render.ts (saltear lo que no
// está listo), pagina-publica.ts (`SCRIPT_VENTA`: el reloj y el pop, con el hash del script en la CSP), la vista del editor
// (app/web-generator/editor/nodos/BloqueVentaVista.tsx) y la API de MaKo (`configurar_bloque_venta_landing`).
// ⚠️ PURO: sin DOM, sin React, sin server-only.
// =============================================================================

import { NODO, enLista } from './doc';
import { instanteDe } from '../cron-aviso';
import { cortarSinPartir } from '../unicode-seguro';
import { ZONA_POR_DEFECTO } from '../zona-negocio-reglas';
import type { AttrsArbol, HijoArbol, NodoArbol } from './grafico-svg';

export const NODOS_VENTA = [NODO.cuentaRegresiva, NODO.pruebaSocial, NODO.escasez] as const;
export type NodoVenta = (typeof NODOS_VENTA)[number];
export const esNodoVenta = (tipo: string): tipo is NodoVenta => (NODOS_VENTA as readonly string[]).includes(tipo);

/** Los topes de lo que escribe el negocio. */
export const TOPES_VENTA = { titulo: 120, mensaje: 160, nombre: 60, detalle: 120, lugar: 60, items: 20, unidad: 40, total: 100_000 } as const;

// Cortado sin partir un emoji (`cortarSinPartir`): medio emoji en el JSON hace que la base rechace la landing entera.
const texto = (v: unknown, tope: number): string => (typeof v === 'string' ? cortarSinPartir(v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(), tope).trim() : '');
const entero = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const o = (raw: unknown): Record<string, unknown> => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {});

/** ¿Es una zona que el navegador y el server entienden? */
export function zonaValida(z: unknown): string | null {
  if (typeof z !== 'string' || !z || z.length > 64) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return z; } catch { return null; }
}

/** Un instante ISO (lo guarda como `…Z`), entre 2020 y 2100. null = no hay fecha. */
export function instanteValido(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 40) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms) || ms < Date.UTC(2020, 0, 1) || ms > Date.UTC(2100, 0, 1)) return null;
  return new Date(ms).toISOString();
}

/** Una fecha «AAAA-MM-DD» real (no 2026-02-31). */
export function fechaValida(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

// ── La cuenta regresiva ──────────────────────────────────────────────────────────────────────

export const AL_VENCER = ['mensaje', 'ocultar'] as const;
export type AlVencer = (typeof AL_VENCER)[number];
export type AttrsCuentaRegresiva = { hasta: string | null; zona: string; titulo: string; alVencer: AlVencer; mensaje: string };

export const TITULO_CUENTA = 'La oferta termina en';
export const MENSAJE_VENCIDA = 'La oferta terminó.';

export function attrsCuentaRegresiva(raw: unknown): AttrsCuentaRegresiva {
  const a = o(raw);
  return {
    hasta: instanteValido(a.hasta),
    // La del negocio la pone quien elige la fecha (el editor y la API); sin ella, el default UNO de la casa.
    zona: zonaValida(a.zona) ?? ZONA_POR_DEFECTO,
    titulo: texto(a.titulo, TOPES_VENTA.titulo),
    alVencer: enLista(AL_VENCER, a.alVencer, 'mensaje'),
    mensaje: texto(a.mensaje, TOPES_VENTA.mensaje),
  };
}

/** «2026-11-30T23:59» (lo que da un input datetime-local) en la zona → el instante ISO. El día del cambio de horario también (`instanteDe`). */
export function instanteDeHoraLocal(local: string, zona: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m || !zonaValida(zona)) return null;
  return instanteValido(instanteDe(zona, Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])).toISOString());
}

/** El instante, en la zona, como lo pide un input datetime-local («2026-11-30T23:59»). */
export function horaLocalDe(iso: string, zona: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
}

/** «29 de noviembre a las 23:59 (hora estándar central)»: lo que dice la página aunque no corra el reloj. */
export function fechaDeCierre(hastaIso: string, zona: string): string {
  const d = new Date(hastaIso);
  const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: zona, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  let nombre = '';
  try { nombre = new Intl.DateTimeFormat('es-MX', { timeZone: zona, timeZoneName: 'longGeneric' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? ''; } catch { nombre = ''; }
  return nombre ? `${fecha} (${nombre})` : fecha;
}

/** Cuánto falta, en días, horas, minutos y segundos (para el editor y el test: la página lo calcula en el navegador). */
export function faltaPara(hastaIso: string, ahoraMs: number): { vencida: boolean; dias: number; horas: number; minutos: number; segundos: number } {
  const r = Math.max(0, Math.floor((Date.parse(hastaIso) - ahoraMs) / 1000));
  return { vencida: r <= 0, dias: Math.floor(r / 86400), horas: Math.floor((r % 86400) / 3600), minutos: Math.floor((r % 3600) / 60), segundos: r % 60 };
}

const UNIDADES_RELOJ = [['d', 'días'], ['h', 'horas'], ['m', 'min'], ['s', 'seg']] as const;

export function specCuentaRegresiva(raw: unknown): NodoArbol {
  const a = attrsCuentaRegresiva(raw);
  const reloj: NodoArbol = ['div', { class: 'gm-cuenta-reloj', 'aria-hidden': 'true' },
    ...UNIDADES_RELOJ.map(([k, nombre]): NodoArbol => ['span', { class: 'gm-cuenta-unidad' },
      ['span', { class: 'gm-cuenta-num', 'data-u': k }, '--'], ['span', { class: 'gm-cuenta-nombre' }, nombre]])];
  const attrs: AttrsArbol = {
    class: 'gm-cuenta', 'data-hasta': a.hasta ?? undefined, 'data-al-vencer': a.alVencer,
    role: 'timer', 'aria-label': a.hasta ? `${a.titulo || TITULO_CUENTA}: hasta el ${fechaDeCierre(a.hasta, a.zona)}` : undefined,
  };
  const hijos: HijoArbol[] = [['p', { class: 'gm-cuenta-titulo' }, a.titulo || TITULO_CUENTA], reloj];
  hijos.push(['p', { class: 'gm-cuenta-fecha' }, a.hasta ? `Hasta el ${fechaDeCierre(a.hasta, a.zona)}` : 'Elige hasta cuándo termina']);
  hijos.push(['p', { class: 'gm-cuenta-msg', hidden: '' }, a.mensaje || MENSAJE_VENCIDA]);
  return ['div', attrs, ...hijos];
}

// ── La prueba social ─────────────────────────────────────────────────────────────────────────

export type ItemPrueba = { nombre: string; detalle: string; lugar: string; fecha: string | null };
export type AttrsPruebaSocial = { items: ItemPrueba[] };

export function attrsPruebaSocial(raw: unknown): AttrsPruebaSocial {
  const a = o(raw);
  const items = (Array.isArray(a.items) ? a.items : []).map((x): ItemPrueba => {
    const i = o(x);
    return { nombre: texto(i.nombre, TOPES_VENTA.nombre), detalle: texto(i.detalle, TOPES_VENTA.detalle), lugar: texto(i.lugar, TOPES_VENTA.lugar), fecha: fechaValida(i.fecha) };
  });
  return { items: items.slice(0, TOPES_VENTA.items) };
}

/** Los que se pueden mostrar: con nombre y con lo que hizo. Uno a medio escribir en el editor no sale. */
export const itemsCompletos = (a: AttrsPruebaSocial): ItemPrueba[] => a.items.filter((i) => i.nombre && i.detalle);

/** «el 3 de noviembre» (lo que se ve sin el script; con él, «hace 2 días»). */
export const fechaCorta = (f: string): string => new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(`${f}T12:00:00Z`));

export function specPruebaSocial(raw: unknown, ctx?: { modo?: string }): NodoArbol {
  const a = attrsPruebaSocial(raw);
  const items = itemsCompletos(a);
  const publico = ctx?.modo === 'publico';
  const lista: NodoArbol = ['ul', { class: 'gm-prueba-lista' }, ...items.map((i): NodoArbol => ['li', { class: 'gm-prueba-item' },
    ['strong', { class: 'gm-prueba-nombre' }, i.nombre],
    ...(i.lugar ? [['span', { class: 'gm-prueba-lugar' }, ` de ${i.lugar}`] as NodoArbol] : []),
    ['span', { class: 'gm-prueba-detalle' }, ` ${i.detalle}`],
    // `span[data-fecha]` y no `<time>`: la forma HTML de la casa sólo emite etiquetas de su lista (grafico-svg.ts).
    ...(i.fecha ? [['span', { class: 'gm-prueba-fecha', 'data-fecha': i.fecha }, fechaCorta(i.fecha)] as NodoArbol] : []),
  ])];
  // En la página, el pop: escondido hasta que el script lo muestra (sin script no hay pop, y no queda una lista suelta).
  if (publico) return ['div', { class: 'gm-prueba', 'data-pop': 'si', hidden: '' }, lista, ['button', { type: 'button', class: 'gm-prueba-cerrar', 'aria-label': 'Cerrar' }, '×']];
  return ['div', { class: 'gm-prueba' },
    ['p', { class: 'gm-prueba-titulo' }, items.length ? `Aparece abajo a la izquierda, de a uno (${items.length})` : 'Pon quién compró o se inscribió'],
    lista];
}

// ── La barra de escasez ──────────────────────────────────────────────────────────────────────

export type AttrsEscasez = { total: number | null; quedan: number | null; unidad: string; titulo: string };
export const UNIDAD_ESCASEZ = 'lugares';

export function attrsEscasez(raw: unknown): AttrsEscasez {
  const a = o(raw);
  const total = entero(a.total, 1, TOPES_VENTA.total);
  const quedan = entero(a.quedan, 0, TOPES_VENTA.total);
  return { total, quedan: quedan != null && total != null && quedan > total ? null : quedan, unidad: texto(a.unidad, TOPES_VENTA.unidad), titulo: texto(a.titulo, TOPES_VENTA.titulo) };
}

/** «Quedan 12 de 50 lugares» / «Agotado: no quedan lugares», o null sin los dos números. */
export function textoEscasez(a: AttrsEscasez): string | null {
  if (a.total == null || a.quedan == null) return null;
  const unidad = a.unidad || UNIDAD_ESCASEZ;
  return a.quedan === 0 ? `Agotado: no quedan ${unidad}` : `Quedan ${a.quedan} de ${a.total} ${unidad}`;
}

export function specEscasez(raw: unknown): NodoArbol {
  const a = attrsEscasez(raw);
  const dice = textoEscasez(a);
  const vendidos = a.total != null && a.quedan != null ? a.total - a.quedan : 0;
  const pct = a.total ? Math.round((vendidos / a.total) * 100) : 0;
  return ['div', { class: 'gm-escasez', 'data-agotado': a.quedan === 0 ? 'si' : undefined },
    ...(a.titulo ? [['p', { class: 'gm-escasez-titulo' }, a.titulo] as NodoArbol] : []),
    ['p', { class: 'gm-escasez-texto' }, dice ?? 'Pon cuántos quedan y de cuántos'],
    ['div', {
      class: 'gm-escasez-barra', role: dice ? 'progressbar' : undefined, 'aria-valuemin': dice ? '0' : undefined,
      'aria-valuemax': dice ? String(a.total) : undefined, 'aria-valuenow': dice ? String(vendidos) : undefined, 'aria-label': dice ?? undefined,
    }, ['span', { class: 'gm-escasez-lleno', style: `width:${pct}%` }]]];
}

// ── Lo común ─────────────────────────────────────────────────────────────────────────────────

/** ¿Tiene el dato real para salir en la página? (render.ts saltea el que no: «si no hay dato, el bloque no se muestra»). */
export function bloqueVentaListo(tipo: string, raw: unknown): boolean {
  if (tipo === NODO.cuentaRegresiva) return attrsCuentaRegresiva(raw).hasta != null;
  if (tipo === NODO.pruebaSocial) return itemsCompletos(attrsPruebaSocial(raw)).length > 0;
  if (tipo === NODO.escasez) return textoEscasez(attrsEscasez(raw)) != null;
  return true;
}

/** Cómo se dice el bloque en una línea (la API, ver_secciones_landing). */
export function resumenBloqueVenta(tipo: string, raw: unknown): string {
  if (tipo === NODO.cuentaRegresiva) {
    const a = attrsCuentaRegresiva(raw);
    return a.hasta ? `cuenta regresiva hasta el ${fechaDeCierre(a.hasta, a.zona)}; al vencer, ${a.alVencer === 'ocultar' ? 'se oculta' : `dice «${a.mensaje || MENSAJE_VENCIDA}»`}` : 'cuenta regresiva sin fecha (no se muestra)';
  }
  if (tipo === NODO.pruebaSocial) {
    const n = itemsCompletos(attrsPruebaSocial(raw)).length;
    return n ? `prueba social con ${n === 1 ? '1 compra' : `${n} compras`} escritas por el negocio` : 'prueba social vacía (no se muestra)';
  }
  if (tipo === NODO.escasez) return textoEscasez(attrsEscasez(raw)) ?? 'barra de escasez sin números (no se muestra)';
  return '';
}

/**
 * EL SCRIPT DE LA PÁGINA PUBLICADA para estos bloques (se suma a `SCRIPT_PAGINA`, con su hash en la CSP):
 *   · el reloj de cada cuenta regresiva, cada segundo, hasta su fecha; al llegar, se oculta o muestra su mensaje, y no vuelve;
 *   · el pop de la prueba social: el primero de la página se muda al final de `.gm-doc` (una sección animada tiene `transform` y
 *     un `position: fixed` adentro quedaría encerrado; fuera de `.gm-doc` perdería los colores del tema), muestra un ítem a la vez cada 8 s, empieza a los 4 s, y la «×» lo cierra
 *     por el resto de la visita. La fecha que puso el negocio se dice «hoy», «ayer» o «hace N días» (hasta 30).
 * Sin expresiones regulares: va adentro de un texto y los escapes se pierden.
 */
export const SCRIPT_VENTA: readonly string[] = [
  '  function bloquesDeVenta() {',
  "    var cs = d.querySelectorAll('.gm-cuenta[data-hasta]');",
  '    function dos(n) { return n < 10 ? "0" + n : String(n); }',
  '    function tic() {',
  '      for (var i = 0; i < cs.length; i++) {',
  "        var c = cs[i], t = Date.parse(c.getAttribute('data-hasta'));",
  '        if (!isFinite(t)) continue;',
  '        var r = Math.floor((t - Date.now()) / 1000);',
  '        if (r <= 0) {',
  "          if (c.getAttribute('data-al-vencer') === 'ocultar') c.hidden = true;",
  "          else { c.setAttribute('data-vencida', 'si'); var msg = c.querySelector('.gm-cuenta-msg'); if (msg) msg.hidden = false; }",
  '          continue;',
  '        }',
  "        var v = { d: Math.floor(r / 86400), h: Math.floor((r % 86400) / 3600), m: Math.floor((r % 3600) / 60), s: r % 60 };",
  "        var ns = c.querySelectorAll('.gm-cuenta-num');",
  "        for (var k = 0; k < ns.length; k++) { var u = ns[k].getAttribute('data-u'); if (u && v[u] != null) ns[k].textContent = u === 'd' ? String(v[u]) : dos(v[u]); }",
  "        c.setAttribute('data-vivo', 'si');",
  '      }',
  '    }',
  '    if (cs.length) { tic(); w.setInterval(tic, 1000); }',
  "    var p = d.querySelector('.gm-prueba[data-pop]');",
  '    if (!p || !d.body) return;',
  "    var items = p.querySelectorAll('.gm-prueba-item');",
  '    if (!items.length) return;',
  "    var raiz = p.closest ? p.closest('.gm-doc') : null;",
  '    (raiz || d.body).appendChild(p);',
  "    var hoy = new Date(Date.now()); hoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());",
  "    var fs = p.querySelectorAll('[data-fecha]');",
  '    for (var f = 0; f < fs.length; f++) {',
  "      var dt = Date.parse(fs[f].getAttribute('data-fecha') + 'T00:00:00Z');",
  '      if (!isFinite(dt)) continue;',
  '      var dias = Math.round((hoy - dt) / 86400000);',
  "      if (dias === 0) fs[f].textContent = 'hoy'; else if (dias === 1) fs[f].textContent = 'ayer'; else if (dias > 1 && dias <= 30) fs[f].textContent = 'hace ' + dias + ' días';",
  '    }',
  '    var actual = -1, cerrado = false;',
  '    function mostrar() {',
  '      if (cerrado) return;',
  "      if (actual >= 0) items[actual].removeAttribute('data-visible');",
  '      actual = (actual + 1) % items.length;',
  "      items[actual].setAttribute('data-visible', 'si');",
  '      p.hidden = false;',
  '    }',
  "    var x = p.querySelector('.gm-prueba-cerrar');",
  "    if (x) x.addEventListener('click', function () { cerrado = true; p.hidden = true; });",
  '    w.setTimeout(function () { mostrar(); if (items.length > 1) w.setInterval(mostrar, 8000); }, 4000);',
  '  }',
  '  try { bloquesDeVenta(); } catch (e) {}',
];
