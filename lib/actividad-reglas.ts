// =============================================================================
// actividad-reglas — Admin › Activity: qué pantallas abre la gente, qué usa y qué no, y quién dejó de venir (5/11/2026)
// =============================================================================
// Martín: «qué acciones hacen los usuarios dentro de MaKo, cuándo es que se conectan, qué no están utilizando, qué se están
// utilizando». Copiado de PostHog (sus docs en GitHub, MIT fuera de `ee/`; docs/investigacion-admin.md, «Activity y Usage»):
//   · los activos del día, la semana y el mes (DAU, WAU, MAU);
//   · el ciclo de vida por semana: arriba los nuevos, los que siguen y los que volvieron; abajo, los que dejaron de entrar;
//   · el uso por tab y por negocio (las «usage metrics» de PostHog: una columna por función, en 30 días), y las tabs sin uso;
//   · quién dejó de venir: la lista de la banda de abajo, con su última vez.
// Sin `server-only`: lo ejecutan los tests. El lector, en lib/actividad.ts; los que escriben, en lib/actividad-registro.ts
// (mig 0398).
//
// ⚠️ «NUEVO» ES POR EL ALTA DE LA PERSONA, NO POR SU PRIMER DÍA MEDIDO (lo mismo que PostHog con el `created_at` de la persona).
//    Con el primer día medido, la semana en que arranca la medición mostraría a todos como nuevos.
// =============================================================================

import { ARRIBA, TODOS_LOS_ITEMS, type NavItem } from '@/app/_components/nav';
import { esRutaMovil, rutaEscritorio } from './movil-rutas';

const DIA_MS = 86_400_000;

/** Las tabs que se miden: las de la barra (de los negocios y del super admin), sin repetir la key. */
function tabsDeLaBarra(): NavItem[] {
  const vistas = new Set<string>();
  const out: NavItem[] = [];
  for (const it of [...ARRIBA, ...TODOS_LOS_ITEMS]) {
    if (!it.key || vistas.has(it.key) || typeof it.match !== 'function') continue;
    vistas.add(it.key);
    out.push(it);
  }
  return out;
}

/** La key de la tab de una ruta (`/crm/12/resumen` → `crm`), o 'otra'. Una ruta del teléfono (/m/…) cuenta como su tab. */
export function tabDeRuta(ruta: string): string {
  let p = String(ruta ?? '').split(/[?#]/)[0] || '/';
  if (!p.startsWith('/')) return 'otra';
  if (esRutaMovil(p)) p = rutaEscritorio(p).split(/[?#]/)[0] || p;
  for (const it of tabsDeLaBarra()) {
    try { if (it.match(p)) return it.key; } catch { /* una regla de match rota no tumba la medición */ }
  }
  return 'otra';
}

/** El nombre de una tab, como en la barra. */
export function nombreDeTab(key: string): string {
  return tabsDeLaBarra().find((t) => t.key === key)?.label ?? (key === 'otra' ? 'Otras pantallas' : key);
}

/**
 * Las tabs que ve un negocio (no las del super admin): con éstas se arma «sin uso». Juntas por su NOMBRE: dos keys pueden
 * dibujarse igual («Ops Center» es `mako` y `second-brain`), y la persona lee una sola tab.
 */
export function tabsDeNegocios(): Array<{ key: string; label: string; keys: string[] }> {
  const porNombre = new Map<string, { key: string; label: string; keys: string[] }>();
  for (const t of tabsDeLaBarra()) {
    if (t.adminOnly) continue;
    const prev = porNombre.get(t.label);
    if (prev) prev.keys.push(t.key);
    else porNombre.set(t.label, { key: t.key, label: t.label, keys: [t.key] });
  }
  return [...porNombre.values()];
}

// ── La retención (el cron app/api/cron/actividad-purga) ────────────────────────────────────────────────────────────
// El uso por día se guarda 400 días: alcanza para comparar con el mismo mes del año anterior. Lo que hizo MaKo, 90: es
// un registro para mirar «qué hace», no un historial. Lo que pasa de ahí se borra cada noche.
export const RETENCION_USO_DIAS = 400;
export const RETENCION_ACCIONES_DIAS = 90;

/** El primer día que se CONSERVA (lo anterior se borra), en el día de la plataforma. */
export const corteDeRetencion = (hoy: string, dias: number): string =>
  new Date(Date.parse(`${hoy}T00:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);

// ── El lote que manda el navegador ─────────────────────────────────────────────────────────────────────────────────

export const TOPE_ENTRADAS_LOTE = 30;
export const TOPE_POR_ENTRADA = 500;

export type EntradaLote = { tab: string; pantallas: number; acciones: number };

/**
 * Lo que manda el navegador ({ entradas: [{ ruta, pantallas, acciones }] }), saneado: cada ruta a su tab (nunca se guarda la
 * URL, que puede traer ids), los números enteros y con tope, lo que no suma nada fuera, y juntos los de la misma tab.
 */
export function sanearLote(x: unknown): EntradaLote[] {
  const entradas = x && typeof x === 'object' && Array.isArray((x as { entradas?: unknown }).entradas) ? (x as { entradas: unknown[] }).entradas : [];
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(TOPE_POR_ENTRADA, Math.max(0, Math.floor(v))) : 0);
  const porTab = new Map<string, EntradaLote>();
  for (const e of entradas.slice(0, TOPE_ENTRADAS_LOTE)) {
    if (!e || typeof e !== 'object') continue;
    const r = e as { ruta?: unknown; pantallas?: unknown; acciones?: unknown };
    if (typeof r.ruta !== 'string' || r.ruta.length > 500) continue;
    const pantallas = n(r.pantallas);
    const acciones = n(r.acciones);
    if (!pantallas && !acciones) continue;
    const tab = tabDeRuta(r.ruta);
    const prev = porTab.get(tab) ?? { tab, pantallas: 0, acciones: 0 };
    prev.pantallas = Math.min(TOPE_POR_ENTRADA, prev.pantallas + pantallas);
    prev.acciones = Math.min(TOPE_POR_ENTRADA, prev.acciones + acciones);
    porTab.set(tab, prev);
  }
  return [...porTab.values()];
}

// ── Lo que se cuenta ───────────────────────────────────────────────────────────────────────────────────────────────

/** Una fila de `actividad_uso`. */
export type FilaUso = { dia: string; usuario: number; ws: number | null; tab: string; pantallas: number; acciones: number };
/** Lo que hace falta de una persona. */
export type Persona = { id: number; nombre: string; email: string; ws: number | null; negocio: string | null; creado: string; ultimoLogin: string | null; rol: string; estado: string };

const masDias = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * DIA_MS).toISOString().slice(0, 10);

/** Cuántas personas distintas usaron la app hoy, en 7 y en 30 días (DAU, WAU, MAU). */
export function activos(filas: readonly FilaUso[], hoy: string): { hoy: number; semana: number; mes: number } {
  const d7 = masDias(hoy, -6);
  const d30 = masDias(hoy, -29);
  const a = new Set<number>(), b = new Set<number>(), c = new Set<number>();
  for (const f of filas) {
    if (f.dia > hoy) continue;
    if (f.dia === hoy) a.add(f.usuario);
    if (f.dia >= d7) b.add(f.usuario);
    if (f.dia >= d30) c.add(f.usuario);
  }
  return { hoy: a.size, semana: b.size, mes: c.size };
}

/** El lunes de la semana de `iso`. */
export const lunesDe = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return masDias(iso, -((d.getUTCDay() + 6) % 7));
};

export type SemanaCiclo = { semana: string; nuevos: number; siguen: number; volvieron: number; dejaron: number; enCurso: boolean };

/**
 * El ciclo de vida de PostHog, por semana (lunes a domingo), las últimas `n`:
 *   · nuevos: activos esa semana y dados de alta esa semana;
 *   · siguen: activos esa semana y la anterior;
 *   · volvieron: activos esa semana, no la anterior, y dados de alta antes;
 *   · dejaron: activos la semana anterior y no ésta (va en negativo en el gráfico).
 */
export function cicloDeVida(filas: readonly FilaUso[], personas: readonly Persona[], hoy: string, n = 8): SemanaCiclo[] {
  const alta = new Map(personas.map((p) => [p.id, lunesDe(String(p.creado).slice(0, 10))]));
  const porSemana = new Map<string, Set<number>>();
  for (const f of filas) {
    if (f.dia > hoy || (f.pantallas <= 0 && f.acciones <= 0)) continue;
    const s = lunesDe(f.dia);
    const set = porSemana.get(s) ?? new Set<number>();
    set.add(f.usuario);
    porSemana.set(s, set);
  }
  const esta = lunesDe(hoy);
  const out: SemanaCiclo[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = masDias(esta, -7 * i);
    const ant = porSemana.get(masDias(s, -7)) ?? new Set<number>();
    const act = porSemana.get(s) ?? new Set<number>();
    let nuevos = 0, siguen = 0, volvieron = 0, dejaron = 0;
    for (const u of act) {
      if (alta.get(u) === s) nuevos += 1;
      else if (ant.has(u)) siguen += 1;
      else volvieron += 1;
    }
    for (const u of ant) if (!act.has(u)) dejaron += 1;
    out.push({ semana: s, nuevos, siguen, volvieron, dejaron, enCurso: s === esta });
  }
  return out;
}

export type UsoTab = { tab: string; nombre: string; personas: number; negocios: number; pantallas: number; acciones: number };

/** Lo que se usó de cada tab en los últimos `dias` (personas, negocios, pantallas, acciones), lo más usado primero. */
export function usoPorTab(filas: readonly FilaUso[], hoy: string, dias = 30): UsoTab[] {
  const desde = masDias(hoy, -(dias - 1));
  const m = new Map<string, { personas: Set<number>; negocios: Set<number>; pantallas: number; acciones: number }>();
  for (const f of filas) {
    if (f.dia < desde || f.dia > hoy) continue;
    const t = m.get(f.tab) ?? { personas: new Set<number>(), negocios: new Set<number>(), pantallas: 0, acciones: 0 };
    t.personas.add(f.usuario);
    if (f.ws != null) t.negocios.add(f.ws);
    t.pantallas += f.pantallas;
    t.acciones += f.acciones;
    m.set(f.tab, t);
  }
  return [...m.entries()]
    .map(([tab, t]) => ({ tab, nombre: nombreDeTab(tab), personas: t.personas.size, negocios: t.negocios.size, pantallas: t.pantallas, acciones: t.acciones }))
    .sort((a, b) => b.personas - a.personas || b.pantallas - a.pantallas || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Las tabs de los negocios que NADIE abrió en esos días (lo que «no están utilizando»). */
export function tabsSinUso(uso: readonly UsoTab[]): Array<{ key: string; label: string }> {
  const usadas = new Set(uso.filter((u) => u.pantallas > 0 || u.acciones > 0).map((u) => u.tab));
  return tabsDeNegocios().filter((t) => !t.keys.some((k) => usadas.has(k))).map(({ key, label }) => ({ key, label }));
}

export type UsoNegocio = { ws: number; personas7: number; personas30: number; pantallas30: number; acciones30: number; tabs: string[] };

/** Cada negocio: cuánta gente suya entró en 7 y 30 días, cuánto usó, y sus tres tabs más usadas. */
export function usoPorNegocio(filas: readonly FilaUso[], hoy: string): UsoNegocio[] {
  const d7 = masDias(hoy, -6);
  const d30 = masDias(hoy, -29);
  const m = new Map<number, { p7: Set<number>; p30: Set<number>; pantallas: number; acciones: number; tabs: Map<string, number> }>();
  for (const f of filas) {
    if (f.ws == null || f.dia < d30 || f.dia > hoy) continue;
    const t = m.get(f.ws) ?? { p7: new Set<number>(), p30: new Set<number>(), pantallas: 0, acciones: 0, tabs: new Map<string, number>() };
    t.p30.add(f.usuario);
    if (f.dia >= d7) t.p7.add(f.usuario);
    t.pantallas += f.pantallas;
    t.acciones += f.acciones;
    if (f.tab !== 'otra') t.tabs.set(f.tab, (t.tabs.get(f.tab) ?? 0) + f.pantallas + f.acciones);
    m.set(f.ws, t);
  }
  return [...m.entries()].map(([ws, t]) => ({
    ws, personas7: t.p7.size, personas30: t.p30.size, pantallas30: t.pantallas, acciones30: t.acciones,
    tabs: [...t.tabs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
  })).sort((a, b) => b.pantallas30 + b.acciones30 - (a.pantallas30 + a.acciones30));
}

export const DIAS_DEJO_DE_ENTRAR = 14;
export const DIAS_DEJO_DE_ENTRAR_HASTA = 120;

/**
 * Quién dejó de venir: personas de un negocio (no el super admin), sin suspender, que entraron alguna vez y no entran hace
 * entre `DIAS_DEJO_DE_ENTRAR` y `DIAS_DEJO_DE_ENTRAR_HASTA` días. Sale de `usuarios.ultimo_login` (lib/ultimo-uso.ts), que
 * tiene la historia entera: no depende de la medición nueva. La más reciente primero (la que todavía se puede recuperar).
 */
export function dejaronDeEntrar(personas: readonly Persona[], ahoraMs: number): Array<Persona & { dias: number }> {
  const out: Array<Persona & { dias: number }> = [];
  for (const p of personas) {
    if (p.rol === 'admin' || p.estado === 'suspendido' || !p.ultimoLogin) continue;
    const t = Date.parse(p.ultimoLogin);
    if (!Number.isFinite(t)) continue;
    const dias = Math.floor((ahoraMs - t) / DIA_MS);
    if (dias >= DIAS_DEJO_DE_ENTRAR && dias <= DIAS_DEJO_DE_ENTRAR_HASTA) out.push({ ...p, dias });
  }
  return out.sort((a, b) => a.dias - b.dias || a.email.localeCompare(b.email));
}

// ── Lo que dice la pantalla ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Cuántos días mira el uso por tab: 30, o los que lleva la medición si arrancó hace menos. «Nadie la abrió en 30 días»
 * sobre una medición de 3 días sería falso: la pantalla dice «en N días».
 */
export function ventanaDeUso(desde: string | null, hoy: string, max = 30): number {
  if (!desde || desde > hoy) return 0;
  const dias = Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS) + 1;
  return Math.max(1, Math.min(max, dias));
}

/** «3 nov» para el lunes de una semana. */
export function semanaTxt(lunes: string): string {
  const d = new Date(`${lunes}T00:00:00Z`);
  return `${d.getUTCDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getUTCMonth()]}`;
}

/** Por dónde llegó lo que hizo MaKo. */
export const canalTxt = (c: string): string => ({ app: 'En la app', whatsapp: 'Por WhatsApp', http: 'Por la API' }[c] ?? c);
