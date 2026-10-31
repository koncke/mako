// =============================================================================
// pedidos-ingreso — la bandeja «Quieren entrar» del super admin (30/10/2026)
// =============================================================================
// Martín: «Me llegó una solicitud de ingreso de Gabriela González por la landing, eso como en agencia debería aparecerme en
// super admin para aceptarla». El Cerebro: «hoy toda persona que intenta entrar desaparece en silencio». Las reglas, en
// lib/pedidos-ingreso-reglas.ts; la pantalla, en app/admin/PedidosDeIngreso.tsx.
//
// Se llena por dos puertas:
//   · GOOGLE (app/api/auth/callback/google/route.ts): quien entra con Google sin tener cuenta. SÓLO con el correo que Google
//     confirmó: si no, cualquiera llena la bandeja con correos ajenos. La contraseña y el link por correo NO entran por lo mismo.
//   · /planes (`pedirPlanSinPasarela`, lib/compra-plan.ts): quien dejó sus datos. Con el rótulo «sin verificar».
//
// ⚠️ ES BEST EFFORT: entrar y pedir un plan nunca fallan por esto. `registrarPedido` no tira: sin poder registrar, contesta
// `false`, y el login dice lo de siempre en vez de prometer un pedido que no quedó.
// ⚠️ QUIEN YA TIENE USUARIO NO ES UN PEDIDO: tampoco un suspendido, que cae en el mismo «no autorizado» y no tiene que pedir
// entrar. Por eso se pregunta por el usuario y no por `resolverUsuario`. Y la bandeja no muestra a quien ya tiene usuario: darle
// de alta la saca sola, venga por donde venga el alta.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { buscarUsuarioPorEmail } from './usuarios';
import { altasPendientes, pendientesDeAprobar } from './agencia';
import { avisarDePlataforma } from './invitaciones';
import { EMAIL_MAKO, linkApp } from './app-url';
import { RUTA_QUIEREN_ENTRAR, pedidoQueVuelve, type FilaPedido, type PedidoNuevo } from './pedidos-ingreso-reglas';

const COLS = 'id, email, nombre, origen, correo_verificado, detalle, whatsapp, lead_id, intentos, primer_at, ultimo_at, estado';
const TOPE_BANDEJA = 50;

/** El aviso a Martín, la primera vez de cada correo. Los de /planes no: `pedirPlanSinPasarela` ya manda el suyo, con el plan. */
async function avisarPedidoNuevo(p: PedidoNuevo): Promise<void> {
  await avisarDePlataforma({
    to: EMAIL_MAKO, tag: 'pedido-ingreso', asunto: `${p.nombre ?? p.email} quiere entrar a MaKo`, preheader: 'Intentó entrar con Google y no tiene cuenta.',
    cuerpo: [`${p.nombre ?? 'Alguien'} (${p.email}) intentó entrar a MaKo con Google y no tiene cuenta.`, '', 'Para darle de alta, en «Quieren entrar»:', linkApp(RUTA_QUIEREN_ENTRAR, null)].join('\n'),
  });
}

/** Registra el pedido. true = quedó (nuevo o suma un intento); false = no es un pedido o no se pudo. No tira nunca. */
export async function registrarPedido(p: PedidoNuevo | null): Promise<boolean> {
  if (!p) return false;
  try {
    if (await buscarUsuarioPorEmail(p.email)) return false;
    const db = getSupabaseServer();
    const ahora = new Date().toISOString();
    const leerFila = async () => {
      const { data, error } = await db.from('pedidos_ingreso').select(COLS).eq('email', p.email).maybeSingle();
      if (error) throw new Error(error.message);
      return data as FilaPedido | null;
    };
    const sumar = async (f: FilaPedido) => {
      const { error } = await db.from('pedidos_ingreso').update(pedidoQueVuelve(f, p, ahora)).eq('id', f.id);
      if (error) throw new Error(error.message);
    };
    const ya = await leerFila();
    if (ya) { await sumar(ya); return true; }
    const { error } = await db.from('pedidos_ingreso').insert({
      email: p.email, nombre: p.nombre, origen: p.origen, correo_verificado: p.verificado, detalle: p.detalle, whatsapp: p.whatsapp,
      lead_id: p.leadId, primer_at: ahora, ultimo_at: ahora,
    });
    if (error) {
      // Dos pedidos a la vez del mismo correo: el índice único deja uno, y éste suma su intento.
      if ((error as { code?: string }).code !== '23505') throw new Error(error.message);
      const otra = await leerFila();
      if (otra) await sumar(otra);
      return true;
    }
    if (p.origen === 'google') await avisarPedidoNuevo(p).catch((e) => console.warn('[pedidos-ingreso] no pude avisar:', e instanceof Error ? e.message : String(e)));
    return true;
  } catch (e) {
    console.warn('[pedidos-ingreso] no pude registrar el pedido:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Lo que espera a Martín: los pendientes, sin quien ya tiene usuario. Tira si no se puede leer («no pude» no es «no hay nadie»). */
export async function pedidosPendientes(): Promise<{ pedidos: FilaPedido[]; hayMas: boolean }> {
  const db = getSupabaseServer();
  const { data, error } = await db.from('pedidos_ingreso').select(COLS).eq('estado', 'pendiente').order('ultimo_at', { ascending: false }).limit(TOPE_BANDEJA + 1);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaPedido[];
  const hayMas = filas.length > TOPE_BANDEJA;
  const vistas = filas.slice(0, TOPE_BANDEJA);
  if (!vistas.length) return { pedidos: [], hayMas: false };
  const { data: con, error: eCon } = await db.from('usuarios').select('email').in('email', vistas.map((f) => f.email));
  if (eCon) throw new Error(eCon.message);
  const conCuenta = new Set(((con ?? []) as Array<{ email: string }>).map((u) => u.email.toLowerCase()));
  return { pedidos: vistas.filter((f) => !conCuenta.has(f.email)), hayMas };
}

/** Cuánto espera a Martín, para el cartel de Customers. Sin poder leerlo, 0: el cartel es un atajo, y la bandeja de Accounts dice el error. */
export async function cuantoEspera(): Promise<{ quierenEntrar: number; deAgencias: number }> {
  const [quierenEntrar, carteras, altas] = await Promise.all([
    pedidosPendientes().then((r) => r.pedidos.length).catch(() => 0),
    pendientesDeAprobar().then((l) => l.length).catch(() => 0),
    altasPendientes().then((l) => l.length).catch(() => 0),
  ]);
  return { quierenEntrar, deAgencias: carteras + altas };
}

/** Lo saca de la bandeja. Queda guardado: si insiste, no vuelve ni manda otro aviso. */
export async function descartarPedido(id: number, quien: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Ese pedido no existe.' };
  const { data, error } = await getSupabaseServer().from('pedidos_ingreso')
    .update({ estado: 'descartado', decidido_por: quien, decidido_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Ese pedido no existe.' };
  return { ok: true };
}
