// =============================================================================
// Media Buyer — los agentes PROPIOS: una regla escrita en palabras, que MaKo mira cada día (PURO: lo prueban los tests)
// =============================================================================
// Los «Custom Agents» de AdAmigo (adamigo-2/-3: «Pause any campaign whose ROAS drops below 1.5x...», cada día a las 8:00).
// El negocio escribe la regla como la diría («pausa todo conjunto que pase de US$ 15 por lead en 3 días»), elige cada
// cuánto, y en la corrida diaria la IA DEL NEGOCIO la mira contra los números de su cuenta y deja acciones.
//
// ⚠️ SIEMPRE PROPONE: lo de un agente propio va con la táctica `manual`, que el piloto automático no lanza nunca
//    (corrida.ts → `automaticas`). Una regla mal entendida por la IA queda en «Hoy» esperando a una persona, y al lanzar
//    pasa por los mismos topes de siempre (lib/media-buyer/topes.ts).
// ⚠️ LA IA NO INVENTA ENTIDADES: sólo se aceptan ids que están en la cuenta y con su nivel; un cambio de presupuesto sólo
//    sobre lo que tiene presupuesto propio, y nunca más de ±50% en un paso. Lo demás se descarta en silencio.
// Se guardan en `media-buyer.agentes` (app_settings), hasta 10 por negocio.
// =============================================================================

import type { NodoMB, SenalMB } from './motor';
import type { KpiMediaBuyer, Propuesta, TipoDecision } from './tipos';

export type AgentePropio = { id: string; nombre: string; regla: string; cada: 'dia' | 'semana'; estado: 'activo' | 'pausado'; creado: string };
export const CLAVE_AGENTES = 'media-buyer.agentes';
export const MAX_AGENTES = 10;
export const FEATURE_AGENTES = 'media-buyer-agentes';

const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Lo guardado, saneado (una fila rota se descarta, el resto sigue). */
export function leerAgentes(crudo: string | null | undefined): AgentePropio[] {
  let j: unknown;
  try { j = crudo ? JSON.parse(crudo) : []; } catch { return []; }
  if (!Array.isArray(j)) return [];
  return j.map((x) => validarAgente(x)).filter((v): v is { ok: true; valor: AgentePropio } => v.ok).map((v) => v.valor).slice(0, MAX_AGENTES);
}

export function validarAgente(x: unknown): { ok: true; valor: AgentePropio } | { ok: false; error: string } {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const nombre = limpio(o.nombre, 60);
  const regla = limpio(o.regla, 600);
  if (nombre.length < 2) return { ok: false, error: 'Ponle un nombre al agente.' };
  if (regla.length < 10) return { ok: false, error: 'Escribe la regla: qué tiene que mirar y qué hacer.' };
  const id = typeof o.id === 'string' && /^[a-z0-9-]{4,40}$/.test(o.id) ? o.id : null;
  if (!id) return { ok: false, error: 'Falta el id del agente.' };
  return {
    ok: true,
    valor: {
      id, nombre, regla,
      cada: o.cada === 'semana' ? 'semana' : 'dia',
      estado: o.estado === 'pausado' ? 'pausado' : 'activo',
      creado: typeof o.creado === 'string' && !Number.isNaN(Date.parse(o.creado)) ? o.creado : new Date(0).toISOString(),
    },
  };
}

/** ¿Le toca mirar hoy? Los semanales, los lunes. `hoy` es AAAA-MM-DD. */
export function tocaHoy(a: Pick<AgentePropio, 'estado' | 'cada'>, hoy: string): boolean {
  if (a.estado !== 'activo') return false;
  return a.cada === 'dia' || new Date(`${hoy}T12:00:00Z`).getUTCDay() === 1;
}

const RES: Record<KpiMediaBuyer, string> = { lead: 'leads', agenda: 'agendas', venta: 'ventas' };

/** La cuenta en renglones cortos para la IA: cada entidad prendida o con gasto, con sus números de 7 días. */
/**
 * `fmt` escribe la unidad del gasto (dólares si la cuenta convierte); `fmtCuenta` y `aUnidad`, el presupuesto en la moneda de
 * la cuenta y su equivalente: antes los dos iban con «$» y la IA comparaba MX$1,000 de presupuesto con US$385 de gasto
 * (revisión de tren-l, falla 5).
 */
export function resumenParaAgente(arbol: readonly NodoMB[], larga: readonly SenalMB[], kpi: KpiMediaBuyer, fmt: (u: number) => string,
  fmtCuenta: (m: number) => string = fmt, aUnidad: (m: number) => number = (m) => m): string {
  const porAd = new Map(larga.map((s) => [s.adId, s] as const));
  const suma = (ids: string[]) => ids.reduce((acc, id) => {
    const s = porAd.get(id);
    if (!s) return acc;
    acc.gasto += s.gasto;
    acc.res += kpi === 'venta' ? s.cierres : kpi === 'agenda' ? s.agendasCrm : s.leadsCrm;
    return acc;
  }, { gasto: 0, res: 0 });
  const hijos = (id: string): string[] => arbol.filter((n) => n.parentId === id).flatMap((n) => (n.nivel === 'ad' ? [n.id] : hijos(n.id)));
  const lineas: string[] = [];
  for (const n of arbol) {
    if (n.configurado === 'DELETED') continue;
    const ads = n.nivel === 'ad' ? [n.id] : hijos(n.id);
    const { gasto, res } = suma(ads);
    if (n.configurado !== 'ACTIVE' && gasto <= 0) continue;
    const costo = res > 0 ? fmt(gasto / res) : '—';
    lineas.push(`${n.nivel} ${n.id} «${n.nombre}» · ${n.configurado === 'ACTIVE' ? 'prendido' : 'pausado'}${n.presupuestoDia != null ? ` · presupuesto ${fmtCuenta(n.presupuestoDia)}/día (≈ ${fmt(aUnidad(n.presupuestoDia))})` : ''} · 7 días: gasto ${fmt(gasto)}, ${res} ${RES[kpi]}, costo ${costo}`);
    if (lineas.length >= 80) break;
  }
  return lineas.join('\n');
}

export function promptAgente(a: Pick<AgentePropio, 'nombre' | 'regla'>, resumen: string, kpi: KpiMediaBuyer, objetivo: string | null): { system: string; user: string } {
  return {
    system: [
      'Eres el media buyer de un negocio. El dueño escribió una regla para su cuenta de Meta y tú la aplicas a los números de hoy.',
      'Devuelve SÓLO JSON: {"acciones":[{"tipo":"pausar"|"activar"|"subir_presupuesto"|"bajar_presupuesto","nivel":"campaign"|"adset"|"ad","entidadId":"…","presupuesto":número o null,"porque":"una oración"}]}.',
      'Usa SÓLO los ids que aparecen en la lista. Si la regla no aplica a nada hoy, devuelve {"acciones":[]}. Un presupuesto sólo para lo que tiene presupuesto diario, nunca más de 50% de cambio, y en la moneda de la cuenta (la primera cifra del presupuesto); para compararlo con el gasto usa la cifra con ≈.',
      'El porqué, en español neutro con tú, sin voseo, con el número que lo dispara.',
    ].join('\n'),
    user: `La regla («${a.nombre}»): ${a.regla}\nEl resultado que busca: ${RES[kpi]}${objetivo ? `, objetivo ${objetivo} por resultado` : ''}.\n\nLa cuenta hoy:\n${resumen || '(sin nada prendido ni con gasto)'}`,
  };
}

const TIPOS: TipoDecision[] = ['pausar', 'activar', 'subir_presupuesto', 'bajar_presupuesto'];

/** Lo que contestó la IA, como propuestas que el Media Buyer sabe lanzar y deshacer. Lo que no cierra, se descarta. */
export function propuestasDeAgente(crudo: string, a: Pick<AgentePropio, 'id' | 'nombre' | 'regla'>, arbol: readonly NodoMB[], hoy: string): Propuesta[] {
  let j: unknown;
  try { j = JSON.parse(crudo.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { return []; }
  const acciones = (j && typeof j === 'object' && Array.isArray((j as { acciones?: unknown }).acciones)) ? (j as { acciones: unknown[] }).acciones : [];
  const porId = new Map(arbol.map((n) => [n.id, n] as const));
  const campanaDe = (n: NodoMB): NodoMB | null => { let x: NodoMB | undefined = n; while (x && x.nivel !== 'campaign') x = x.parentId ? porId.get(x.parentId) : undefined; return x ?? null; };
  const out: Propuesta[] = [];
  const vistas = new Set<string>();
  for (const x of acciones.slice(0, 10)) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const tipo = TIPOS.find((t) => t === o.tipo);
    const id = typeof o.entidadId === 'string' ? o.entidadId : typeof o.entidadId === 'number' ? String(o.entidadId) : '';
    const n = porId.get(id);
    if (!tipo || !n || n.configurado === 'DELETED' || o.nivel !== n.nivel || vistas.has(n.id)) continue;
    const porque = limpio(o.porque, 200) || `Lo pide tu regla «${a.nombre}».`;
    let antes: Propuesta['antes'];
    let despues: Propuesta['despues'];
    if (tipo === 'pausar' || tipo === 'activar') {
      const quiere = tipo === 'pausar' ? 'PAUSED' : 'ACTIVE';
      if (n.configurado === quiere) continue;
      antes = { estado: n.configurado === 'ACTIVE' ? 'ACTIVE' : 'PAUSED' };
      despues = { estado: quiere };
    } else {
      const p = typeof o.presupuesto === 'number' && Number.isFinite(o.presupuesto) ? o.presupuesto : NaN;
      if (n.presupuestoDia == null || !(p > 0)) continue;
      const tope = tipo === 'subir_presupuesto' ? n.presupuestoDia * 1.5 : n.presupuestoDia * 0.5;
      const monto = Math.round((tipo === 'subir_presupuesto' ? Math.min(p, tope) : Math.max(p, tope)) * 100) / 100;
      if (tipo === 'subir_presupuesto' ? monto <= n.presupuestoDia : monto >= n.presupuestoDia) continue;
      antes = { presupuesto: n.presupuestoDia };
      despues = { presupuesto: monto };
    }
    vistas.add(n.id);
    const camp = n.nivel === 'campaign' ? null : campanaDe(n);
    const verbo = { pausar: 'Pausar', activar: 'Prender', subir_presupuesto: 'Subir el presupuesto de', bajar_presupuesto: 'Bajar el presupuesto de' }[tipo as 'pausar'];
    out.push({
      clave: `propia:${a.id}:${n.nivel}:${n.id}:${hoy}`.slice(0, 200),
      tipo, tactica: 'manual', nivel: n.nivel, entidadId: n.id, entidadNombre: n.nombre, campanaNombre: camp?.nombre ?? null,
      titulo: `${a.nombre}: ${verbo} «${n.nombre}»`.slice(0, 200),
      titular: porque.replace(/\.$/, ''),
      porque: [`Tu regla: «${a.regla}».`, porque],
      numeros: [], antes, despues,
    });
  }
  return out;
}

/** ¿Esta acción la dejó un agente propio? Y cuál. */
export const agenteDeClave = (clave: string): string | null => (clave.startsWith('propia:') ? clave.split(':')[1] ?? null : null);
