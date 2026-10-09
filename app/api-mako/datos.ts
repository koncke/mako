// =============================================================================
// /api-mako — lo que la pantalla necesita, armado en el SERVER
// =============================================================================
// El registro (lib/api-mako/registro.ts) no lleva `server-only` pero NO es apto para el
// navegador: ~500 descripciones al bundle de cada cliente (AGENTS.md, «Una capacidad nueva
// de MaKo se DECLARA en el registro»). Así que la pantalla nunca lo importa: recibe acá un
// ÍNDICE liviano (área → recurso → endpoint) y la página de documentación que está abierta,
// ya armada.
//
// Lo que se documenta es lo que sale por HTTP y le toca a ESTE workspace (capa, workspace
// principal): la documentación de GitHub es la de lo que se puede pedir, y acá lo que se
// puede pedir depende del negocio. Se agrupa como docs.github.com: categoría (el ÁREA) →
// subcategoría (el RECURSO de la ruta REST, lib/api-mako/recursos.ts) → endpoints.
// =============================================================================

import 'server-only';
import { REGISTRO, gatingOk, porId, type Vista } from '@/lib/api-mako/registro';
import { vistaDe } from '@/lib/api-mako/ejecutar';
import { canalKeyDe } from '@/lib/api-mako/canal';
import { ejemplosDe, tipoJson, type Ejemplos } from '@/lib/api-mako/ejemplos';
import { paramsDeRuta, rutaRestDe, type MetodoRest } from '@/lib/api-mako/rest';
import { recursoDe, tituloRecurso } from '@/lib/api-mako/recursos';
import { nivelRequerido, permisoAceptado } from '@/lib/api-mako/permisos';
import { TEXTO_ALCANCE } from '@/lib/api-mako/alcance';
import {
  AREAS, AREA_INFO, alcanceMinimo, esAccion, esLectura,
  type Area, type OperacionDef, type Parametro,
} from '@/lib/api-mako/tipos';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';

// ── El índice (barra lateral, permisos, formulario de tokens) ───────────────

export type EndpointIndice = {
  id: string;
  titulo: string;
  metodo: MetodoRest;
  ruta: string;
  /** el permiso que pide a un token detallado en su área */
  nivel: 'lectura' | 'escritura';
};
export type RecursoIndice = { slug: string; titulo: string; endpoints: EndpointIndice[] };
export type AreaDocs = { area: Area; titulo: string; tab: string; recursos: RecursoIndice[] };

/** Con qué mira el catálogo la pantalla: el workspace como admin y por HTTP con el alcance
 *  máximo. Filtra la capa, el rol y el workspace principal (lo que mira `gatingOk`). */
export async function vistaDeLaTab(ws: number): Promise<Vista> {
  return vistaDe({ ws, canal: 'http', canalKey: canalKeyDe('http', ws), alcance: 'ejecutar', rol: 'admin' });
}

const documentables = (vista: Vista): OperacionDef[] =>
  REGISTRO.filter((d) => d.canales.includes('http') && !!rutaRestDe(d.id) && gatingOk(d, vista));

/** Área → recurso → endpoint, en el orden de AREAS y con los recursos por título. */
export function indiceDocs(vista: Vista): AreaDocs[] {
  const porArea = new Map<Area, Map<string, EndpointIndice[]>>();
  for (const d of documentables(vista)) {
    const r = rutaRestDe(d.id)!;
    const recurso = recursoDe(d.id)!;
    const recursos = porArea.get(d.area) ?? new Map<string, EndpointIndice[]>();
    const lista = recursos.get(recurso) ?? [];
    lista.push({ id: d.id, titulo: d.titulo, metodo: r.metodo, ruta: r.ruta, nivel: nivelRequerido(d) });
    recursos.set(recurso, lista);
    porArea.set(d.area, recursos);
  }
  const ORDEN: Record<MetodoRest, number> = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };
  return AREAS.filter((a) => porArea.has(a)).map((area) => ({
    area,
    titulo: AREA_INFO[area].titulo,
    tab: AREA_INFO[area].tab,
    recursos: [...porArea.get(area)!].map(([slug, endpoints]) => ({
      slug,
      titulo: tituloRecurso(slug),
      // Como GitHub: primero las rutas más cortas (la colección antes que el ítem), y en la
      // misma ruta, leer antes que escribir.
      endpoints: endpoints.sort((a, b) => a.ruta.split('/').length - b.ruta.split('/').length || a.ruta.localeCompare(b.ruta) || ORDEN[a.metodo] - ORDEN[b.metodo]),
    })).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')),
  }));
}

// ── Una página de la documentación: todos los endpoints de un recurso ──────

export type ParamDoc = {
  nombre: string;
  tipo: string;
  obligatorio: boolean;
  descripcion: string;
  /** «Puede ser uno de:» */
  enum?: string[];
  /** el rango, el tope, el ejemplo: lo que GitHub pone abajo de la descripción */
  extra?: string;
  hijos?: ParamDoc[];
};

export type EndpointDoc = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: 'lectura' | 'accion' | 'control';
  metodo: MetodoRest;
  ruta: string;
  /** la ruta por operación de siempre, que sigue andando */
  rutaOperacion: string;
  areaTitulo: string;
  nivel: 'lectura' | 'escritura';
  /** `crm=read`: lo que devuelve X-Accepted-MaKo-Permissions */
  permiso: string;
  /** qué pasa con el token clásico (el de la skill) */
  clasico: string;
  /** con un token detallado, ¿escribe en el acto? (las acciones que no gastan plata) */
  directo: boolean;
  costo: string;
  lenta: boolean;
  requisitos: string[];
  formatos: string[];
  params: { ruta: ParamDoc[]; consulta: ParamDoc[]; cuerpo: ParamDoc[] };
  estados: { codigo: number; descripcion: string }[];
  ejemplos: Ejemplos;
  /** se puede probar desde la pantalla (`sePuedeProbar`) */
  probable: boolean;
};

export type PaginaDocs = { area: Area; areaTitulo: string; recurso: string; titulo: string; endpoints: EndpointDoc[] };

function paramDoc(p: Parametro): ParamDoc {
  const extra: string[] = [];
  if (p.minimo != null && p.maximo != null) extra.push(`Entre ${p.minimo} y ${p.maximo}.`);
  else if (p.minimo != null) extra.push(`Mínimo: ${p.minimo}.`);
  else if (p.maximo != null) extra.push(`Máximo: ${p.maximo}.`);
  if (p.max != null) extra.push(p.tipo === 'string' ? `Hasta ${p.max} caracteres.` : `Hasta ${p.max} elementos.`);
  if (p.ejemplo !== undefined) extra.push(`Ejemplo: ${typeof p.ejemplo === 'string' ? p.ejemplo : JSON.stringify(p.ejemplo)}`);
  return {
    nombre: p.nombre,
    tipo: tipoJson(p),
    obligatorio: !!p.obligatorio,
    descripcion: p.descripcion,
    ...(p.enum?.length ? { enum: [...p.enum] } : {}),
    ...(extra.length ? { extra: extra.join(' ') } : {}),
    ...(p.campos?.length ? { hijos: p.campos.map(paramDoc) } : {}),
  };
}

function requisitosDe(d: OperacionDef): string[] {
  const g = d.gating;
  const r: string[] = [];
  if (g?.soloWs1) r.push('Solo el workspace principal.');
  if (g?.rolMinimo) r.push('Solo el administrador del workspace.');
  if (g?.integracion) r.push(`Requiere conectada: ${g.integracion}.`);
  if (g?.tab) r.push(`Requiere la tab ${g.tab}.`);
  if (d.lenta) r.push('Puede tardar hasta un minuto.');
  if (d.costo === 'ia') r.push('Usa IA: consume la cuota del workspace.');
  if (d.costo === 'dinero') r.push('Gasta dinero: queda como propuesta y una persona la confirma en una pantalla.');
  return r;
}

function clasicoDe(d: OperacionDef): string {
  const a = alcanceMinimo(d);
  const nombre = TEXTO_ALCANCE[a].titulo;
  if (esLectura(d)) return `Con el token clásico (el de la skill de Claude), cualquier alcance: «${nombre}» alcanza.`;
  if (esAccion(d)) {
    return d.confirmacion === 'chat'
      ? `Con el token clásico, alcance «${nombre}» o más: no escribe, deja una acción pendiente que confirma una persona.`
      : `Con el token clásico, alcance «${nombre}» o más: no escribe, deja una propuesta con un link a la pantalla donde se confirma.`;
  }
  return `Con el token clásico, alcance «${nombre}».`;
}

function estadosDe(d: OperacionDef, directo: boolean): { codigo: number; descripcion: string }[] {
  const comunes = [
    { codigo: 400, descripcion: 'Falta un parámetro o tiene mal la forma (`faltan` dice cuáles)' },
    { codigo: 401, descripcion: 'Requiere autenticación: el token falta, no existe o venció' },
    { codigo: 403, descripcion: 'Prohibido: al token le falta el permiso del área' },
    { codigo: 404, descripcion: 'Recurso no encontrado' },
    { codigo: 429, descripcion: 'Demasiados pedidos: se superó el límite por minuto' },
  ];
  if (esLectura(d)) return [{ codigo: 200, descripcion: 'OK' }, { codigo: 304, descripcion: 'No modificado' }, ...comunes];
  if (esAccion(d)) {
    return [
      ...(directo ? [{ codigo: 200, descripcion: 'Hecho (token detallado con «Lectura y escritura»)' }] : []),
      { codigo: 202, descripcion: directo ? 'Aceptado: con el token clásico queda pendiente o como propuesta' : 'Aceptado: queda como propuesta para confirmar en una pantalla' },
      ...comunes.slice(0, 4),
      { codigo: 422, descripcion: 'No se pudo hacer: el motivo viene en `message`' },
      comunes[4],
    ];
  }
  return [{ codigo: 200, descripcion: 'OK' }, ...comunes];
}

/** ¿Se puede correr desde la pantalla? Sólo LECTURAS que no gastan: `gratis` (nuestra base) o
 *  `externo` (leen a Meta, Calendly…). Las de `ia` cuestan cuota, y una acción no se
 *  «prueba». `datosDeGoogle` no sale por HTTP. */
export function sePuedeProbar(d: OperacionDef): boolean {
  return esLectura(d) && d.canales.includes('http') && (d.costo === 'gratis' || d.costo === 'externo') && !d.datosDeGoogle;
}

function endpointDoc(d: OperacionDef, base: string, areaTitulo: string): EndpointDoc | null {
  const ejemplos = ejemplosDe(d, base);
  if (!ejemplos) return null;
  const enRuta = new Set(paramsDeRuta(d.id));
  const resto = d.parametros.filter((p) => !enRuta.has(p.nombre));
  const directo = esAccion(d) && d.costo !== 'dinero';
  return {
    id: d.id,
    titulo: d.titulo,
    descripcion: d.descripcion,
    tipo: d.tipo,
    metodo: ejemplos.metodo,
    ruta: ejemplos.ruta,
    rutaOperacion: `${esLectura(d) ? 'GET' : 'POST'} /api/v1/${d.area}/${d.id}`,
    areaTitulo,
    nivel: nivelRequerido(d),
    permiso: permisoAceptado(d),
    clasico: clasicoDe(d),
    directo,
    costo: d.costo,
    lenta: !!d.lenta,
    requisitos: requisitosDe(d),
    formatos: esLectura(d) ? [...(d.formatos ?? [])] : [],
    params: {
      ruta: d.parametros.filter((p) => enRuta.has(p.nombre)).map(paramDoc),
      consulta: ejemplos.metodo === 'GET' ? resto.map(paramDoc) : [],
      cuerpo: ejemplos.metodo !== 'GET' ? resto.map(paramDoc) : [],
    },
    estados: estadosDe(d, directo),
    ejemplos,
    probable: sePuedeProbar(d),
  };
}

/** La página de un recurso (todos sus endpoints, en el orden del índice), o null. */
export function paginaDocs(indice: AreaDocs[], area: string, recurso: string, base: string): PaginaDocs | null {
  const a = indice.find((x) => x.area === area);
  const r = a?.recursos.find((x) => x.slug === recurso);
  if (!a || !r) return null;
  const endpoints = r.endpoints.map((e) => porId(e.id)).filter((d): d is OperacionDef => !!d).map((d) => endpointDoc(d, base, a.titulo)).filter((e): e is EndpointDoc => !!e);
  return { area: a.area, areaTitulo: a.titulo, recurso: r.slug, titulo: r.titulo, endpoints };
}

/** Lo que vuelve de «Probar»: el texto tal cual sale por HTTP, recortado. */
export type Prueba = { ok: true; formato: string; texto: string; ms: number; recortado: boolean } | { ok: false; error: string; faltan?: string[] };

// ── El registro: lo que pidieron los tokens por /api/v1 ─────────────────────

export type LlamadaApi = { cuando: string; operacion: string; status: number; ms: number; ip: string; token: string | null };

export type UsoApi = {
  dias: number;
  /** el token por el que se filtró, o null (todos) */
  token: string | null;
  total: number;
  errores: number;
  /** por hora (UTC) desde `desdeMs`: la pantalla los agrupa en días con SU zona */
  desdeMs: number;
  porHora: { total: number[]; errores: number[] };
  porOperacion: { operacion: string; total: number; errores: number }[];
  porIp: { ip: string; total: number; ultima: string }[];
  porToken: { token: string; total: number; errores: number; ultima: string }[];
  ultimas: LlamadaApi[];
  /** true si el desglose se armó sobre una muestra (las más recientes) */
  muestra: boolean;
  /** false si la base todavía no tiene la columna `token_id` (migración 0222 sin aplicar) */
  conToken: boolean;
};

const DIAS_USO = 30;
const TOPE_FILAS = 5000;

type FilaLlamada = { created_at: string; operacion: string; ok: boolean; status: number; ms: number; ip: string | null; token_id?: string | null };

/** El uso de los últimos 30 días, de todos los tokens o de uno. Nunca tira. */
export async function usoDe(ws: number, token: string | null = null): Promise<UsoApi | { error: string }> {
  const hora = 3_600_000;
  const ahora = Date.now();
  const desdeMs = Math.floor((ahora - DIAS_USO * 86_400_000) / hora) * hora;
  const desde = new Date(desdeMs).toISOString();
  try {
    return await runWithWorkspace(ws, async () => {
      const sb = getSupabaseServer();
      const consultar = async (conToken: boolean) => {
        const deUno = conToken && token;
        let tot = sb.from('api_llamadas').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).gte('created_at', desde);
        let err = sb.from('api_llamadas').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).gte('created_at', desde).eq('ok', false);
        let filas = sb.from('api_llamadas').select(conToken ? 'created_at, operacion, ok, status, ms, ip, token_id' : 'created_at, operacion, ok, status, ms, ip')
          .eq('workspace_id', ws).gte('created_at', desde);
        if (deUno) { tot = tot.eq('token_id', token); err = err.eq('token_id', token); filas = filas.eq('token_id', token); }
        return Promise.all([tot, err, filas.order('created_at', { ascending: false }).limit(TOPE_FILAS)]);
      };
      let conToken = true;
      let [tot, err, filas] = await consultar(true);
      // Sin la migración 0222, la columna no existe: se lee sin ella (y sin filtro por token).
      if (filas.error && /token_id/.test(filas.error.message)) {
        conToken = false;
        [tot, err, filas] = await consultar(false);
      }
      const fallo = tot.error ?? err.error ?? filas.error;
      if (fallo) throw new Error(fallo.message);
      const rows = (filas.data ?? []) as unknown as FilaLlamada[];

      const horas = Math.ceil((ahora - desdeMs) / hora) + 1;
      const total = new Array<number>(horas).fill(0);
      const errores = new Array<number>(horas).fill(0);
      const ops = new Map<string, { total: number; errores: number }>();
      const ips = new Map<string, { total: number; ultima: string }>();
      const toks = new Map<string, { total: number; errores: number; ultima: string }>();
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
        if (conToken) {
          const k = r.token_id ?? 'sin dato';
          const t = toks.get(k) ?? { total: 0, errores: 0, ultima: r.created_at };
          t.total++; if (!r.ok) t.errores++;
          if (r.created_at > t.ultima) t.ultima = r.created_at;
          toks.set(k, t);
        }
      }
      return {
        dias: DIAS_USO,
        token: conToken ? token : null,
        total: tot.count ?? rows.length,
        errores: err.count ?? rows.filter((r) => !r.ok).length,
        desdeMs,
        porHora: { total, errores },
        porOperacion: [...ops].map(([operacion, v]) => ({ operacion, ...v })).sort((a, b) => b.total - a.total).slice(0, 15),
        porIp: [...ips].map(([ip, v]) => ({ ip, ...v })).sort((a, b) => b.total - a.total).slice(0, 10),
        porToken: [...toks].map(([t, v]) => ({ token: t, ...v })).sort((a, b) => b.total - a.total),
        ultimas: rows.slice(0, 50).map((r) => ({ cuando: r.created_at, operacion: r.operacion, status: r.status, ms: r.ms, ip: r.ip ?? 'desconocida', token: r.token_id ?? null })),
        muestra: (tot.count ?? 0) > rows.length,
        conToken,
      };
    });
  } catch (e) {
    console.error(`[api-mako] no pude leer el uso del ws ${ws}: ${e instanceof Error ? e.message : String(e)}`);
    return { error: 'No se pudo leer el registro.' };
  }
}
