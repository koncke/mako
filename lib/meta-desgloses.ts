// =============================================================================
// meta-desgloses — los desgloses de TODA la cuenta de Meta para un período, en vivo
// =============================================================================
// Lo leen dos: /api/account-insights (el resumen de cuenta del Ads Manager) y la audiencia del
// Dashboard (lib/graficos-audiencia.ts). Vivía adentro del GET de la ruta; se sacó acá el
// 11/10/2026 para que el Dashboard no tuviera una segunda copia del pedido a Meta.
//
// Esto es SÓLO la lectura: credenciales, paginado y caché. Cómo se lee una fila de Meta (los
// números, la agenda, las etiquetas) es puro, tiene test y vive en lib/graficos-audiencia.ts.
//
// Lo que no se ve en la firma:
//   · UNA lectura por desglose. Región, plataforma y edad-y-género son tres universos: juntas, un
//     gráfico por región sumaría también las filas de edad y de plataforma.
//   · El workspace va EXPLÍCITO y las credenciales se leen ESTRICTAS (`credWsEstricta`). `credWs`
//     sin workspace cae al ws1 —un cliente— y con la base caída contesta null, que acá se leería
//     como «no conectó Meta» y le diría a alguien que conecte lo que ya conectó.
//   · El fallo de Meta viene ADENTRO del cuerpo (AGENTS.md: `res.ok` no es «salió bien»), y el
//     código 190 es el token vencido o revocado: eso se arregla reconectando, y se distingue.
//   · Caché en la memoria de la instancia por (workspace, cuenta, desde, hasta, desglose), cinco
//     minutos. Medido el 11/10/2026 contra la cuenta del ws1: 0,6 a 1,3 s por desglose, y
//     /api/graficos corta a los 60 s. Se guarda la PROMESA, así dos tarjetas que piden lo mismo a
//     la vez hacen un solo pedido. Un fallo no se guarda.

import 'server-only';
import { credWsEstricta } from './credenciales';
import { getWorkspaceActual } from './workspace';

const GRAPH = 'https://graph.facebook.com';

/** Los desgloses que se le piden a Meta. Cada uno es una lectura, y un universo aparte. */
export type Desglose = 'region' | 'publisher_platform' | 'age,gender';

/** Una fila tal cual la manda Meta: los números vienen como texto. */
export type FilaInsights = Record<string, unknown>;

/**
 * Por qué no se pudo leer. `sin_workspace`: quien mira no está en ningún negocio (un admin sin
 * entrar a un cliente). `sin_conexion`: el negocio no tiene token o cuenta de anuncios.
 * `token_vencido`: Meta contestó 190. `meta`: cualquier otro error de Meta o del servidor.
 */
export type MotivoFalloMeta = 'sin_workspace' | 'sin_conexion' | 'token_vencido' | 'meta';
export class FalloMeta extends Error {
  readonly motivo: MotivoFalloMeta;
  readonly codigo: number | null;
  constructor(message: string, motivo: MotivoFalloMeta, codigo: number | null = null) {
    super(message);
    this.name = 'FalloMeta';
    this.motivo = motivo;
    this.codigo = codigo;
  }
}

// `inline_link_clicks` son los clics al ENLACE: los mismos que guarda la pauta diaria
// (`link_clicks`), para que el CTR de la audiencia y el de los anuncios se lean igual.
const CAMPOS = 'impressions,reach,spend,actions,inline_link_clicks';
const TOPE_PAGINAS = 50;
const ESPERA_MS = 25_000;
const MEMO_MS = 5 * 60_000;
const TOPE_MEMO = 200;
const memo = new Map<string, { vence: number; filas: Promise<FilaInsights[]> }>();

type Conexion = { ws: number; ver: string; token: string; cuenta: string };

async function conexion(): Promise<Conexion> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new FalloMeta('Sin workspace', 'sin_workspace');
  const [token, cuenta] = await Promise.all([
    credWsEstricta('META_ACCESS_TOKEN', ws),
    credWsEstricta('META_AD_ACCOUNT_ID', ws), // ya incluye el `act_`
  ]);
  if (!token || !cuenta) throw new FalloMeta('Meta no está conectada en este negocio', 'sin_conexion');
  const ver = process.env.META_API_VERSION;
  // Una falta del SERVIDOR, no del negocio: no se le pide que conecte nada.
  if (!ver) throw new FalloMeta('Falta META_API_VERSION en el servidor', 'meta');
  return { ws, ver, token, cuenta };
}

async function pedir(c: Conexion, p: { desde: string; hasta: string; breakdown: Desglose }): Promise<FilaInsights[]> {
  const u = new URL(`${GRAPH}/${c.ver}/${c.cuenta}/insights`);
  u.searchParams.set('fields', CAMPOS);
  u.searchParams.set('action_breakdowns', 'action_type');
  u.searchParams.set('breakdowns', p.breakdown);
  u.searchParams.set('time_range', JSON.stringify({ since: p.desde, until: p.hasta }));
  u.searchParams.set('limit', '500');
  u.searchParams.set('access_token', c.token);
  const out: FilaInsights[] = [];
  let next: string | null = u.toString();
  for (let pagina = 0; next; pagina++) {
    // Antes se cortaba en silencio a las 50 páginas. Son 25.000 filas: la cuenta tiene ~33
    // regiones, 6 plataformas y 19 combinaciones de edad y género. Llegar acá es otra cosa rota.
    if (pagina >= TOPE_PAGINAS) throw new FalloMeta(`Meta devolvió más de ${TOPE_PAGINAS} páginas`, 'meta');
    const r: Response = await fetch(next, { cache: 'no-store', signal: AbortSignal.timeout(ESPERA_MS) });
    const b = (await r.json().catch(() => null)) as { data?: unknown; paging?: { next?: unknown }; error?: { message?: unknown; code?: unknown } } | null;
    if (!b) throw new FalloMeta(`Meta contestó HTTP ${r.status} sin un cuerpo legible`, 'meta');
    if (b.error) {
      const n = Number(b.error.code);
      const codigo = Number.isFinite(n) ? n : null;
      throw new FalloMeta(String(b.error.message ?? 'Error de Meta'), codigo === 190 ? 'token_vencido' : 'meta', codigo);
    }
    if (Array.isArray(b.data)) for (const fila of b.data) if (fila && typeof fila === 'object') out.push(fila as FilaInsights);
    next = typeof b.paging?.next === 'string' ? b.paging.next : null;
  }
  return out;
}

/**
 * Las filas de la cuenta del workspace en curso con UN desglose, para el período. Tira
 * `FalloMeta` (con su `motivo`) si no se puede leer.
 */
export async function desglosesCuenta(p: { desde: string; hasta: string; breakdown: Desglose }): Promise<FilaInsights[]> {
  const c = await conexion();
  const clave = `${c.ws}|${c.cuenta}|${p.desde}|${p.hasta}|${p.breakdown}`;
  const ahora = Date.now();
  const guardada = memo.get(clave);
  if (guardada && guardada.vence > ahora) return guardada.filas;

  const filas = pedir(c, p);
  memo.delete(clave);
  memo.set(clave, { vence: ahora + MEMO_MS, filas });
  filas.catch(() => { if (memo.get(clave)?.filas === filas) memo.delete(clave); });
  // Una instancia vive días: lo vencido se va, y si igual sobra, lo más viejo.
  if (memo.size > TOPE_MEMO) {
    for (const [k, v] of memo) if (v.vence <= ahora) memo.delete(k);
    for (const k of memo.keys()) { if (memo.size <= TOPE_MEMO) break; if (k !== clave) memo.delete(k); }
  }
  return filas;
}
