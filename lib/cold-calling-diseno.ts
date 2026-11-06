// =============================================================================
// cold-calling-diseno — lo que dibuja cada tarjeta de la hoja «Cold Calling» con su DISEÑO PROPIO (la copia de Corvane)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con Maco».
// La copia y sus capturas: docs/diseno/mockups-dashboard/cold-calling-corvane/. La hoja la dibuja app/dashboard/disenos/HojaColdCalling.tsx
// con lo que arma `vistaColdCalling`, y la miniatura de «Nueva hoja» pasa por la MISMA función con datos de ejemplo
// (lib/cold-calling-diseno-muestra.ts). Sin `server-only` y sin la base: se prueba (tests/dashboard-diseno-cold-calling.test.ts).
//
// De dónde sale cada número (las piezas de la plantilla `cold-calling`, todas del conjunto `llamadas_grabadas`: lo que se grabó con el
// botón «Grabar llamada»):
//   · «Captured today» → «Llamadas»: el número con su cambio contra el período anterior (`llamadas`), el gráfico día por día (`dias`).
//   · «Needs you» → «Lo que sigue»: las llamadas sin marcar, las que no contestaron, las que agendaron y a las que no les interesa, cada una
//     con su número de «Cómo terminan» (`terminan`). Sólo lo que tiene algo.
//   · Los cuatro números: contestan (`contacto`), agendaron (`agendaron`), agendan de los que contestan (con las líneas de `dias`) y los
//     minutos grabados (la suma de `leads`). «No contestaron» no es un número suelto: «Sin marcar» no puede contar ahí.
//   · «Live payments» → «A quién llamaste» (`leads`): cada lead con sus llamadas, cómo terminó y sus minutos.
//   · «Top merchants» → «Quién llamó» (`quien`), por llamadas o por agendadas.
//   · «Merchant money» → «Cómo terminan» (`terminan`): las llamadas repartidas por cómo terminaron, y las que faltan marcar.
//
// ⚠️ Lo que Corvane tiene y MaKo no mide no está: el reloj, el ticker en vivo (el botón «Pause»: aquí nada llega solo) y las tarjetas de
//    pago. Un número que no llegó es null, nunca 0, y «Sin marcar» nunca cuenta como «No contestó» (lo dice la fuente).
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { ROTULO_RESULTADO, SIN_MARCAR } from './grabar-llamada-reglas';
import { iniciales } from './hooks-diseno';
import { pasoDe, rotuloDia, type PasoTiempo } from './marketing-diseno';

export type { DatosPieza };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const antes = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.anterior?.[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const SIN = '(sin dato)';
const filasDe = (r: Resultado | null) => (r ? r.filas.filter((f) => f.clave !== SIN && f.clave !== '') : []);

/** «72%» (redondo) o «6.4%» debajo de 10. */
export const pct = (v: number) => (Math.abs(v) < 10 && Math.round(v) !== v ? `${(Math.round(v * 10) / 10).toFixed(1)}%` : `${Math.round(v)}%`);

// ── «Captured today» → llamadas ─────────────────────────────────────────────────────────────────────────────────────────
export type CambioCold = { texto: string; sube: boolean; tono: 'bueno' | 'malo' | 'neutro' };
/** Cuánto cambió contra el período anterior, en %: «12%» con su flecha. Sin el anterior (o con cero antes) no hay cambio. */
export function cambioDe(v: number | null, a: number | null): CambioCold | null {
  if (v == null || a == null || a <= 0) return null;
  const d = ((v - a) / a) * 100;
  if (Math.abs(d) < 0.05) return { texto: '0%', sube: true, tono: 'neutro' };
  return { texto: pct(Math.abs(d)), sube: d > 0, tono: d > 0 ? 'bueno' : 'malo' };
}
export type DiaCold = { clave: string; rotulo: string; llamadas: number; contestaron: number; agendaron: number };
export function diasDe(r: Resultado | null): { filas: DiaCold[]; paso: PasoTiempo } | null {
  if (!r) return null;
  const crudas = r.filas.filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f.clave)).sort((a, b) => a.clave.localeCompare(b.clave));
  const paso = pasoDe(crudas.map((f) => f.clave));
  return {
    paso,
    filas: crudas.map((f) => ({ clave: f.clave, rotulo: rotuloDia(f.clave, paso), llamadas: enFila(r, f, 'llamadas') ?? 0, contestaron: enFila(r, f, 'contestaron') ?? 0, agendaron: enFila(r, f, 'agendaron') ?? 0 })),
  };
}
/** El acumulado (el selector «Acumulado» del gráfico): cada día suma los de antes. */
export function acumuladoCold(filas: DiaCold[]): DiaCold[] {
  let l = 0, c = 0, a = 0;
  return filas.map((f) => { l += f.llamadas; c += f.contestaron; a += f.agendaron; return { ...f, llamadas: l, contestaron: c, agendaron: a }; });
}

// ── «Merchant money» → cómo terminan ─────────────────────────────────────────────────────────────────────────────────────
export type ResultadoCold = { clave: string; nombre: string; valor: number; color: string };
/** Los colores de la barra de Corvane (acento, azul, verde, gris) más su rojo: lo que agendó en verde, lo que no le interesa en rojo. */
export const COLOR_RESULTADO: Readonly<Record<string, string>> = {
  [ROTULO_RESULTADO.agendo]: 'var(--good)', [ROTULO_RESULTADO.hablo]: 'var(--accent)', [ROTULO_RESULTADO.no_interesa]: 'var(--bad)',
  [ROTULO_RESULTADO.no_contesto]: 'var(--info)', [SIN_MARCAR]: 'var(--faint)',
};
/** Las llamadas por cómo terminaron, en el orden de la fuente (de lo mejor a lo que falta marcar); las que tienen cero no se dibujan. */
export function terminanDe(r: Resultado | null): { filas: ResultadoCold[]; total: number; sinMarcar: number } | null {
  if (!r) return null;
  const todas = filasDe(r).map((f) => ({ clave: f.clave, nombre: f.etiqueta || f.clave, valor: enFila(r, f, 'llamadas') ?? 0, color: COLOR_RESULTADO[f.clave] ?? 'var(--faint)' }));
  const suma = todas.reduce((a, x) => a + x.valor, 0);
  return { filas: todas.filter((x) => x.valor > 0), total: total(r, 'llamadas') ?? suma, sinMarcar: todas.find((x) => x.clave === SIN_MARCAR)?.valor ?? 0 };
}

// ── «Needs you» → lo que sigue ──────────────────────────────────────────────────────────────────────────────────────────
export type PendienteCold = { clave: string; tono: 'warn' | 'bad' | 'info'; icono: 'marcar' | 'telefono' | 'cal' | 'no'; titulo: string; texto: string };
const plural = (n: number, una: string, varias: string) => `${Math.round(n).toLocaleString('en-US')} ${n === 1 ? una : varias}`;
/** Lo que pide algo después de llamar, sacado de «Cómo terminan»: sólo los resultados que tienen alguna llamada, en este orden. */
export function pendientesDe(t: ReturnType<typeof terminanDe>): PendienteCold[] {
  if (!t) return [];
  const n = (k: string) => t.filas.find((f) => f.clave === k)?.valor ?? 0;
  const out: PendienteCold[] = [];
  if (n(SIN_MARCAR)) out.push({ clave: SIN_MARCAR, tono: 'warn', icono: 'marcar', titulo: `${plural(n(SIN_MARCAR), 'llamada', 'llamadas')} sin marcar`, texto: 'Marca cómo terminaron: hasta entonces cuentan en «Sin marcar»' });
  if (n(ROTULO_RESULTADO.no_contesto)) out.push({ clave: ROTULO_RESULTADO.no_contesto, tono: 'bad', icono: 'telefono', titulo: `${plural(n(ROTULO_RESULTADO.no_contesto), 'no contestó', 'no contestaron')}`, texto: 'Puedes volver a llamarlos desde su ficha' });
  if (n(ROTULO_RESULTADO.agendo)) out.push({ clave: ROTULO_RESULTADO.agendo, tono: 'info', icono: 'cal', titulo: `${plural(n(ROTULO_RESULTADO.agendo), 'agendó', 'agendaron')} una reunión`, texto: 'Terminaron la llamada con una reunión agendada' });
  if (n(ROTULO_RESULTADO.no_interesa)) out.push({ clave: ROTULO_RESULTADO.no_interesa, tono: 'bad', icono: 'no', titulo: `A ${n(ROTULO_RESULTADO.no_interesa).toLocaleString('en-US')} no ${n(ROTULO_RESULTADO.no_interesa) === 1 ? 'le' : 'les'} interesa`, texto: 'Lo marcaste al cortar la llamada' });
  return out;
}

// ── los cuatro números ──────────────────────────────────────────────────────────────────────────────────────────────────
export type NumeroCold = { id: 'contestan' | 'agendaron' | 'agendan' | 'minutos'; tono: 'sage' | 'sand' | 'clay' | 'mist'; nombre: string; texto: string | null; sub: string | null; linea: number[] | null };
/** «Agendan, de los que contestan» se calcula con 5 que contestaron o más (el mismo mínimo que `tasa_agenda` de la fuente). */
export const MINIMO_AGENDAN = 5;
export function numerosDe(p: { contacto: Resultado | null; agendaron: Resultado | null; dias: DiaCold[] | null; leads: Resultado | null; llamadas: number | null; contestaron: number | null }): NumeroCold[] {
  const tasa = total(p.contacto, 'tasa_contacto'), ag = total(p.agendaron, 'agendaron'), min = total(p.leads, 'minutos');
  const agendan = ag != null && p.contestaron != null && p.contestaron >= MINIMO_AGENDAN ? Math.min(100, (ag / p.contestaron) * 100) : null;
  // Una línea necesita dos días con dato y alguno con algo; si no, no se dibuja (una línea plana de ceros se lee como un dato).
  const linea = (vs: Array<number | null>) => { const ok = vs.filter((x): x is number => x != null); return ok.length >= 2 && ok.some((x) => x > 0) ? ok : null; };
  const d = p.dias ?? [];
  return [
    { id: 'contestan', tono: 'sage', nombre: 'Contestan', texto: tasa == null ? null : pct(tasa), sub: 'De tus llamadas', linea: linea(d.map((x) => (x.llamadas ? (x.contestaron / x.llamadas) * 100 : null))) },
    { id: 'agendaron', tono: 'sand', nombre: 'Agendaron', texto: ag == null ? null : Math.round(ag).toLocaleString('en-US'), sub: 'Reuniones agendadas', linea: linea(d.map((x) => x.agendaron)) },
    {
      id: 'agendan', tono: 'clay', nombre: 'Agendan', texto: agendan == null ? null : pct(agendan),
      sub: agendan == null && p.contestaron != null ? `Con ${MINIMO_AGENDAN} que contesten se calcula` : 'De los que contestan',
      linea: linea(d.map((x) => (x.contestaron ? (x.agendaron / x.contestaron) * 100 : null))),
    },
    // Los minutos no tienen día: van sin línea, con el promedio por llamada.
    { id: 'minutos', tono: 'mist', nombre: 'Minutos grabados', texto: min == null ? null : Math.round(min).toLocaleString('en-US'), sub: min != null && p.llamadas ? `${(min / p.llamadas).toFixed(1)} min por llamada` : null, linea: null },
  ];
}

// ── «Live payments» → a quién llamaste ──────────────────────────────────────────────────────────────────────────────────
/** Cuántos dibuja (Corvane tiene siete). */
export const LLAMADOS = 7;
export type LlamadoCold = { clave: string; nombre: string; iniciales: string; llamadas: number; minutos: number | null; resultado: string | null };
export function llamadosDe(r: Resultado | null): { filas: LlamadoCold[]; total: number } | null {
  if (!r) return null;
  const todas = filasDe(r).map((f) => {
    const resultado = f.extra?.resultado && f.extra.resultado !== SIN ? f.extra.resultado : null;
    const nombre = f.etiqueta || f.clave;
    return { clave: f.clave, nombre, iniciales: iniciales(nombre), llamadas: enFila(r, f, 'llamadas') ?? 0, minutos: enFila(r, f, 'minutos'), resultado };
  }).filter((x) => x.llamadas > 0);
  return { filas: todas.slice(0, LLAMADOS), total: todas.length + r.fuera };
}

// ── «Top merchants» → quién llamó ───────────────────────────────────────────────────────────────────────────────────────
export const QUIEN = 6;
export type QuienCold = { clave: string; nombre: string; valor: number; ancho: number };
/** Quién llamó, del que más al que menos en la métrica elegida (llamadas o agendadas), con su barra relativa al primero. */
export function quienDe(r: Resultado | null, metrica: 'llamadas' | 'agendaron'): QuienCold[] | null {
  if (!r) return null;
  const todas = filasDe(r).map((f) => ({ clave: f.clave, nombre: f.etiqueta || f.clave, valor: enFila(r, f, metrica) ?? 0, llamadas: enFila(r, f, 'llamadas') ?? 0 }))
    .filter((x) => x.llamadas > 0)
    .sort((a, b) => b.valor - a.valor || b.llamadas - a.llamadas).slice(0, QUIEN);
  const max = Math.max(0, ...todas.map((x) => x.valor));
  return todas.map(({ llamadas: _l, ...x }) => ({ ...x, ancho: max > 0 ? x.valor / max : 0 }));
}

// ── la hoja entera ──────────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaCold = {
  llamadas: number | null;
  cambio: CambioCold | null;
  contestaron: number | null;
  agendaron: number | null;
  dias: ReturnType<typeof diasDe>;
  terminan: ReturnType<typeof terminanDe>;
  pendientes: PendienteCold[];
  numeros: NumeroCold[];
  llamados: ReturnType<typeof llamadosDe>;
  /** El crudo de «Quién llamó», para que el selector elija la métrica sin volver a leer. */
  quien: Resultado | null;
  cargando: boolean;
  /** Si en el período no se grabó ninguna llamada: la hoja lo dice y ofrece grabar la primera. */
  vacia: boolean;
};
export function vistaColdCalling(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>): VistaCold {
  const p = hoja.diseno?.piezas ?? {};
  const r = (k: string) => res(datos, p[k]);
  const rl = r('llamadas'), rd = r('dias');
  const llamadas = total(rl, 'llamadas') ?? total(rd, 'llamadas');
  const contestaron = total(rd, 'contestaron'), agendaron = total(r('agendaron'), 'agendaron') ?? total(rd, 'agendaron');
  const dias = diasDe(rd);
  const terminan = terminanDe(r('terminan'));
  return {
    llamadas, cambio: cambioDe(llamadas, antes(rl, 'llamadas')), contestaron, agendaron, dias, terminan,
    pendientes: pendientesDe(terminan),
    numeros: numerosDe({ contacto: r('contacto'), agendaron: r('agendaron'), dias: dias?.filas ?? null, leads: r('leads'), llamadas, contestaron }),
    llamados: llamadosDe(r('leads')),
    quien: r('quien'),
    cargando: Object.values(p).some((id) => datos[id]?.cargando),
    vacia: llamadas === 0,
  };
}
