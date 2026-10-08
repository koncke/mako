// =============================================================================
// /api-mako — lo que la pantalla necesita, armado en el SERVER
// =============================================================================
// El registro (lib/api-mako/registro.ts) no lleva `server-only` pero NO es apto para
// el navegador: ~500 descripciones al bundle de cada cliente (AGENTS.md, «Una
// capacidad nueva de MaKo se DECLARA en el registro»). Así que la pantalla nunca lo
// importa: recibe acá un ÍNDICE liviano por props, y el detalle de una operación lo
// pide cuando la abre (actions.ts → `detalleDe`).
//
// Qué operaciones ve el workspace: las que su gating deja pasar (capa, rol admin,
// workspace principal) por CUALQUIER canal, marcando cuáles salen por HTTP. La tab
// es la de la API, pero también es el mapa de qué sabe hacer MaKo: Martín la pidió
// para «configurar acciones en el chatbot y en otros lugares», y para eso hay que ver
// también las que hoy sólo corren por WhatsApp o en la app.
// =============================================================================

import 'server-only';
import { REGISTRO, gatingOk, porId, type Vista } from '@/lib/api-mako/registro';
import { vistaDe } from '@/lib/api-mako/ejecutar';
import { canalKeyDe } from '@/lib/api-mako/canal';
import { ejemploCurl } from '@/lib/api-mako/docs';
import {
  AREAS, AREA_INFO, alcanceMinimo, esAccion, esLectura,
  type Alcance, type Area, type Canal, type Costo, type OperacionDef, type Parametro,
} from '@/lib/api-mako/tipos';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';

export type TipoOp = 'lectura' | 'accion' | 'control';

/** Una fila del catálogo de la pantalla. Lo justo para listar, filtrar y buscar. */
export type OpIndice = {
  id: string;
  area: Area;
  tipo: TipoOp;
  titulo: string;
  /** la primera oración de la descripción, para la lista y el buscador */
  resumen: string;
  metodo: 'GET' | 'POST';
  canales: Canal[];
  confirmacion?: 'chat' | 'pantalla';
  costo: Costo;
};

export type AreaIndice = { area: Area; titulo: string; tab: string };

export type FilaParametro = {
  nombre: string;
  tipo: string;
  obligatorio: boolean;
  descripcion: string;
  enum?: string[];
  ejemplo?: string;
};

export type DetalleOp = OpIndice & {
  descripcion: string;
  ruta: string;
  alcance: Alcance;
  parametros: FilaParametro[];
  /** las condiciones del gating, ya dichas (se muestran tal cual) */
  requisitos: string[];
  alias: string[];
  escribe?: string;
  reversible?: boolean;
  pantalla?: string;
  salida?: string;
  formatos?: string[];
  lenta: boolean;
  /** el curl por HTTP, o null si la operación no sale por HTTP */
  curl: string | null;
  /** se puede probar desde la pantalla (ver `sePuedeProbar`) */
  probable: boolean;
};

/** Con qué mira el catálogo la pantalla: el workspace como admin y por HTTP con el
 *  alcance máximo. El canal y el alcance NO filtran el índice (ver arriba): sólo la
 *  capa, el rol y el workspace principal, que es lo que `gatingOk` mira. */
export async function vistaDeLaTab(ws: number): Promise<Vista> {
  return vistaDe({ ws, canal: 'http', canalKey: canalKeyDe('http', ws), alcance: 'ejecutar', rol: 'admin' });
}

const primeraOracion = (s: string): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  const m = /^(.{20,}?[.!?])(\s|$)/.exec(t);
  const o = m ? m[1] : t;
  return o.length > 160 ? `${o.slice(0, 157).trimEnd()}…` : o;
};

const fila = (d: OperacionDef): OpIndice => ({
  id: d.id,
  area: d.area,
  tipo: d.tipo,
  titulo: d.titulo,
  resumen: primeraOracion(d.descripcion),
  metodo: esLectura(d) ? 'GET' : 'POST',
  canales: [...d.canales],
  ...(esAccion(d) ? { confirmacion: d.confirmacion } : {}),
  costo: d.costo,
});

/** El índice que ve este workspace, y las áreas que tienen algo. */
export function indiceDe(vista: Vista): { areas: AreaIndice[]; operaciones: OpIndice[] } {
  const operaciones = REGISTRO.filter((d) => gatingOk(d, vista)).map(fila);
  const conAlgo = new Set(operaciones.map((o) => o.area));
  const areas = AREAS.filter((a) => conAlgo.has(a)).map((a) => ({ area: a, titulo: AREA_INFO[a].titulo, tab: AREA_INFO[a].tab }));
  return { areas, operaciones };
}

/**
 * ¿Se puede correr desde la pantalla? Sólo LECTURAS que salen por HTTP y que no
 * gastan: `gratis` (nuestra base) o `externo` (leen a Meta, Chatwoot…). Las de `ia`
 * cuestan cuota o plata, y una acción no se «prueba»: deja una pendiente de verdad.
 * `datosDeGoogle` no sale por HTTP (la agenda no pasa por ningún modelo ni tercero).
 */
export function sePuedeProbar(d: OperacionDef): boolean {
  return esLectura(d) && d.canales.includes('http') && (d.costo === 'gratis' || d.costo === 'externo') && !d.datosDeGoogle;
}

function filasDe(ps: readonly Parametro[], prefijo = ''): FilaParametro[] {
  const out: FilaParametro[] = [];
  for (const p of ps) {
    out.push({
      nombre: `${prefijo}${p.nombre}`,
      tipo: p.tipo,
      obligatorio: !!p.obligatorio,
      descripcion: p.descripcion,
      ...(p.enum?.length ? { enum: [...p.enum] } : {}),
      ...(p.ejemplo !== undefined ? { ejemplo: typeof p.ejemplo === 'string' ? p.ejemplo : JSON.stringify(p.ejemplo) } : {}),
    });
    if (p.campos?.length) out.push(...filasDe(p.campos, `${prefijo}${p.nombre}.`));
  }
  return out;
}

function requisitosDe(d: OperacionDef): string[] {
  const g = d.gating;
  const r: string[] = [];
  if (g?.soloWs1) r.push('Solo el workspace principal');
  if (g?.rolMinimo) r.push('Solo el administrador');
  if (g?.integracion) r.push(`Requiere conectada: ${g.integracion}`);
  if (g?.tab) r.push(`Requiere la tab: ${g.tab}`);
  return r;
}

/** El detalle de una operación para esta vista, o null si no existe o no le toca. */
export function detalleDe(id: string, vista: Vista, base: string): DetalleOp | null {
  const d = porId(id);
  if (!d || d.id !== id || !gatingOk(d, vista)) return null;
  return {
    ...fila(d),
    descripcion: d.descripcion,
    ruta: `/api/v1/${d.area}/${d.id}`,
    alcance: alcanceMinimo(d),
    parametros: filasDe(d.parametros),
    requisitos: requisitosDe(d),
    alias: [...(d.alias ?? [])],
    ...(esAccion(d) ? { escribe: d.escribe, reversible: d.reversible, ...(d.pantalla ? { pantalla: d.pantalla } : {}) } : {}),
    ...(esLectura(d) ? { salida: d.salida, ...(d.formatos?.length ? { formatos: [...d.formatos] } : {}) } : {}),
    lenta: !!d.lenta,
    curl: d.canales.includes('http') ? ejemploCurl(d, base) : null,
    probable: sePuedeProbar(d),
  };
}

/** Lo que vuelve de «Probar»: el texto tal cual sale por HTTP, recortado. */
export type Prueba = { ok: true; formato: string; texto: string; ms: number; recortado: boolean } | { ok: false; error: string; faltan?: string[] };

// ── El uso: lo que pidieron los tokens por /api/v1 ───────────────────────────

export type LlamadaApi = { cuando: string; operacion: string; status: number; ms: number; ip: string };

export type UsoApi = {
  dias: number;
  /** los conteos exactos del período */
  total: number;
  errores: number;
  /** por hora (UTC) desde `desdeMs`: la pantalla los agrupa en días con SU zona */
  desdeMs: number;
  porHora: { total: number[]; errores: number[] };
  porOperacion: { operacion: string; total: number; errores: number }[];
  porIp: { ip: string; total: number; ultima: string }[];
  ultimas: LlamadaApi[];
  /** true si el desglose se armó sobre una muestra (las más recientes) */
  muestra: boolean;
};

const DIAS_USO = 30;
const TOPE_FILAS = 5000;

/** El uso de los últimos 30 días. Nunca tira: sin datos, todo en cero. */
export async function usoDe(ws: number): Promise<UsoApi | { error: string }> {
  const hora = 3_600_000;
  const ahora = Date.now();
  const desdeMs = Math.floor((ahora - DIAS_USO * 86_400_000) / hora) * hora;
  const desde = new Date(desdeMs).toISOString();
  try {
    return await runWithWorkspace(ws, async () => {
      const sb = getSupabaseServer();
      const [tot, err, filas] = await Promise.all([
        sb.from('api_llamadas').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).gte('created_at', desde),
        sb.from('api_llamadas').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).gte('created_at', desde).eq('ok', false),
        sb.from('api_llamadas').select('created_at, operacion, ok, status, ms, ip').eq('workspace_id', ws).gte('created_at', desde)
          .order('created_at', { ascending: false }).limit(TOPE_FILAS),
      ]);
      const fallo = tot.error ?? err.error ?? filas.error;
      if (fallo) throw new Error(fallo.message);
      const rows = (filas.data ?? []) as { created_at: string; operacion: string; ok: boolean; status: number; ms: number; ip: string | null }[];

      const horas = Math.ceil((ahora - desdeMs) / hora) + 1;
      const total = new Array<number>(horas).fill(0);
      const errores = new Array<number>(horas).fill(0);
      const ops = new Map<string, { total: number; errores: number }>();
      const ips = new Map<string, { total: number; ultima: string }>();
      for (const r of rows) {
        const i = Math.floor((Date.parse(r.created_at) - desdeMs) / hora);
        if (i >= 0 && i < horas) { total[i]++; if (!r.ok) errores[i]++; }
        const o = ops.get(r.operacion) ?? { total: 0, errores: 0 };
        o.total++; if (!r.ok) o.errores++;
        ops.set(r.operacion, o);
        const ip = r.ip ?? 'desconocida';
        const p = ips.get(ip) ?? { total: 0, ultima: r.created_at };
        p.total++;
        if (r.created_at > p.ultima) p.ultima = r.created_at;
        ips.set(ip, p);
      }
      return {
        dias: DIAS_USO,
        total: tot.count ?? rows.length,
        errores: err.count ?? rows.filter((r) => !r.ok).length,
        desdeMs,
        porHora: { total, errores },
        porOperacion: [...ops].map(([operacion, v]) => ({ operacion, ...v })).sort((a, b) => b.total - a.total).slice(0, 15),
        porIp: [...ips].map(([ip, v]) => ({ ip, ...v })).sort((a, b) => b.total - a.total).slice(0, 10),
        ultimas: rows.slice(0, 50).map((r) => ({ cuando: r.created_at, operacion: r.operacion, status: r.status, ms: r.ms, ip: r.ip ?? 'desconocida' })),
        muestra: (tot.count ?? 0) > rows.length,
      };
    });
  } catch (e) {
    console.error(`[api-mako] no pude leer el uso del ws ${ws}: ${e instanceof Error ? e.message : String(e)}`);
    return { error: 'No se pudo leer el uso.' };
  }
}
