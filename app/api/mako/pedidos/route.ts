// =============================================================================
// POST /api/mako/pedidos — separar e interpretar los pedidos sueltos de un mensaje a un chat de MaKo
// =============================================================================
// El punto de enganche COMPARTIDO de los chats (docs/diseno-mako-pedidos.md): el del Web Generator primero, el de
// Automations después, y cualquier chat nuevo. ANTES de mandarle el mensaje a su modelo, el chat pregunta acá:
//
//   body:      { texto: string, tab: Area, actualId?: string | number | null, actualNombre?: string }
//   respuesta: { ok: true, pedidos: PedidoResuelto[], propuesta: { texto, botones: ['Sí','Después'] } | null,
//                origen: 'reglas' | 'ia' }   ·   { ok: false, error } con 400 / 401 / 429
//
// Lo `actual` sigue por el camino de siempre del chat (sólo su texto); el resto se dibuja como burbuja de MaKo.
//
// Acá sólo se ARMA el contexto; lo que decide es lib/mako-pedidos.ts (puro, con tests):
//   · la VISTA de esta persona (`vistaDe`, canal 'app' y alcance 'proponer', como el chat de la app) y, con ella,
//     las operaciones del registro que `visible()` le deja ver: lo que su pantalla le esconde no se ofrece;
//   · los objetos de la tab (`objetosDeTab`), para «la otra», «la de Juan».
//
// NO es pública (no va a lib/rutas-publicas.ts): exige sesión y workspace. Llama a una IA gratis sólo cuando las
// reglas dudan (lib/mako-pedidos-ia.ts), con un plazo corto: por eso el límite por persona.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { rateLimit } from '@/lib/rate-limit';
import { vistaDe } from '@/lib/api-mako/vista';
import { canalKeyDe } from '@/lib/api-mako/canal';
import { REGISTRO, esArea, ordenarPorRelevancia, porId, visible } from '@/lib/api-mako/registro';
import { esAccion, esLectura, type Area, type Ctx, type OperacionDef, type Rol } from '@/lib/api-mako/tipos';
import { listar as listarLandings } from '@/lib/editor-landing/server';
import { interpretarMensaje } from '@/lib/mako-pedidos-ia';
import type { ContextoPedidos, ObjetoChat, OperacionChat, OrdenarOperaciones } from '@/lib/mako-pedidos';

export const dynamic = 'force-dynamic';
// La IA tiene 7,5 s de plazo (lib/mako-pedidos-ia.ts); el resto es leer la vista y los objetos.
export const maxDuration = 30;

const MAX_TEXTO = 4_000;
const err = (status: number, error: string) => Response.json({ ok: false, error }, { status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Los objetos de una tab del negocio, la última tocada arriba. UNA función por área: un chat nuevo agrega la suya
 * acá. Las que no están devuelven [] y el resolver pregunta «¿Cuál?» en vez de adivinar.
 */
async function objetosDeTab(tab: Area, rol: Rol): Promise<ObjetoChat[]> {
  if (tab === 'landing') {
    // La misma puerta que el Web Generator (app/api/landing-generator/route.ts): admin y la tab en su capa. Sin
    // eso, un closer leería por acá los nombres de las landings que su pantalla le esconde.
    if (rol !== 'admin' || !tabEnCapa('landing-writer', await getCapaActual().catch(() => null))) return [];
    // La misma función que el Panel del Web Generator: ya viene ordenada por `actualizado`, la última primero.
    const r = await listarLandings();
    if (!r.ok) {
      console.warn(`[api:mako/pedidos] no pude listar las landings: ${r.error}`);
      return [];
    }
    return r.docs.filter((d) => !d.papelera).map((d) => ({ id: String(d.id), nombre: d.titulo, tocadoAt: d.actualizado }));
  }
  // ENGANCHE: 'chatbot' (Automations) devuelve [] hasta que su chat se enganche. Cuando lo haga, va acá su función
  // —las automatizaciones del negocio sin las archivadas, la última tocada arriba— con la puerta de su página.
  return [];
}

const aOperacion = (d: OperacionDef): OperacionChat => ({
  id: d.id, area: d.area, tipo: esLectura(d) ? 'lectura' : 'accion', titulo: d.titulo, descripcion: d.descripcion,
});

/** La relevancia del REGISTRO (una sola implementación): el núcleo puro la recibe como función. */
const ordenar: OrdenarOperaciones = (ops, texto) => {
  const porIdChat = new Map(ops.map((o) => [o.id, o]));
  const defs = ops.map((o) => porId(o.id)).filter((d): d is OperacionDef => !!d);
  return ordenarPorRelevancia(defs, texto).map((d) => porIdChat.get(d.id)).filter((o): o is OperacionChat => !!o);
};

export async function POST(req: Request) {
  const sesion = await getUsuarioActual();
  if (!sesion) return err(401, 'Tu sesión venció.');
  const [ws, rolWs] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (!rolWs) return err(401, 'Tu sesión venció.');
  if (ws == null) return err(400, 'Elige una cuenta primero.');

  let body: { texto?: unknown; tab?: unknown; actualId?: unknown; actualNombre?: unknown };
  try { body = await req.json(); } catch { return err(400, 'Pedido inválido.'); }
  const texto = typeof body?.texto === 'string' ? body.texto.trim() : '';
  if (!texto) return err(400, 'Falta el mensaje.');
  if (texto.length > MAX_TEXTO) return err(400, 'El mensaje es muy largo.');
  const tab = typeof body.tab === 'string' && esArea(body.tab) ? body.tab : null;
  if (!tab) return err(400, 'Falta la tab.');
  if (!rateLimit(`mako-pedidos:${ws}:${sesion.sub}`, 60, 60_000)) return err(429, 'Muchos mensajes seguidos.');

  try {
    const rol: Rol = rolWs === 'admin' ? 'admin' : 'miembro';
    const ctxApi: Ctx = { ws, canal: 'app', canalKey: canalKeyDe('app', `ws${ws}`), alcance: 'proponer', rol, actor: sesion.email || sesion.sub };
    const vista = await vistaDe(ctxApi);
    const operaciones = REGISTRO.filter((d) => (esAccion(d) || esLectura(d)) && visible(d, vista)).map(aOperacion);
    const objetos = await objetosDeTab(tab, rol);

    const idActual = typeof body.actualId === 'number' || typeof body.actualId === 'string' ? String(body.actualId).trim() : '';
    const nombreActual = typeof body.actualNombre === 'string' ? body.actualNombre.trim().slice(0, 200) : '';
    const actual: ObjetoChat | null = idActual
      ? (objetos.find((o) => o.id === idActual) ?? { id: idActual, nombre: nombreActual })
      : null;

    const ctx: ContextoPedidos = { tab, actual, objetos, operaciones, ws, ordenar };
    const r = await interpretarMensaje(texto, ctx);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error(`[api:mako/pedidos] ${msg(e)}`);
    // Sin interpretación, el chat sigue por su camino de siempre con el mensaje entero.
    return Response.json({ ok: true, pedidos: [{ sobre: 'actual', texto }], propuesta: null, origen: 'reglas' });
  }
}
