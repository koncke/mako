// =============================================================================
// baja-cuenta — «Eliminar mi cuenta»: pedirlo, la marca del super admin y el mail al terminar (3/11/2026)
// =============================================================================
// Las reglas, en lib/baja-cuenta-reglas.ts. El orden de pedirlo:
//   1. La fila (`bajas_cuenta`). Sin ella no se hace nada más: un pedido que no quedó anotado no lo va a ejecutar nadie, y
//      la persona tiene que saberlo (la pantalla manda a escribir a soporte).
//   2. Lo que apaga, sólo la primera vez (el índice único hace que el segundo toque no repita nada):
//      · el negocio entero: deja de cobrar (`darDeBajaMiPlan`) y se pausa, que apaga sus crons (lib/workspace.ts);
//      · la persona: `estado = 'suspendido'`, que corta su sesión en el próximo pedido (lib/auth.ts).
//   3. Los dos mails: a la persona con la fecha, y a equipo@ para que el plazo no dependa de abrir una pantalla.
//
// ⚠️ EL NEGOCIO DE PRUEBA Y EL DE LA CUENTA DE REVISIÓN (`WS_REVISION`) NO APAGAN NADA: el revisor de las tiendas puede tocar este
//    botón (docs/tiendas-play-appstore.md, paso 5). Si lo suspendiera, el próximo revisor no entra y la app se rechaza por 2.1(a). El
//    pedido se anota con `prueba` y la pantalla dice lo mismo.
// ⚠️ LO QUE SE BORRA SE ELIGE CON LA FILA DE LA PERSONA, nunca con la pestaña: `?ws=` no decide nada acá.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getUsuarioActual } from './auth';
import { estaImpersonando, wsSuperAdmin } from './workspace';
import { avisarDePlataforma } from './invitaciones';
import { EMAIL_MAKO } from './app-url';
import { WS_PRUEBAS } from './auth-session';
import { WS_REVISION } from './cuenta-revision-reglas';
import { darDeBajaMiPlan } from './cobros';
import {
  PLAZO_BAJA_DIAS, alcanceDeLaBaja, fechaDeLaBaja, motivoSinBaja, textoDeLaBaja, venceDe, type AlcanceBaja,
} from './baja-cuenta-reglas';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type FilaUsuario = { id: number; email: string; nombre: string | null; rol: string | null; rol_ws: string | null; workspace_id: number | null };

export type EstadoBaja =
  | { puede: false; motivo: string }
  | { puede: true; alcance: AlcanceBaja; negocio: string | null; pendienteHasta: string | null };

async function filaDe(usuarioId: number): Promise<FilaUsuario | null> {
  const { data, error } = await getSupabaseServer().from('usuarios')
    .select('id, email, nombre, rol, rol_ws, workspace_id').eq('id', usuarioId).maybeSingle();
  if (error) throw new Error(`usuarios: ${error.message}`);
  return (data as FilaUsuario | null) ?? null;
}

/** El id de la fila de ESTA sesión. La pestaña no decide: `?ws=` no entra acá. */
async function idDeLaSesion(): Promise<number | null> {
  const s = await getUsuarioActual();
  return !s || s.legacy || !/^\d+$/.test(s.sub) ? null : Number(s.sub);
}

async function alcanceYNegocio(u: FilaUsuario): Promise<{ alcance: AlcanceBaja; negocio: string | null }> {
  const db = getSupabaseServer();
  let otrosAdmins = 0;
  let negocio: string | null = null;
  if (u.workspace_id != null) {
    // «Sin poder leer» no puede leerse como «no hay otros»: eso borraría el negocio de quien no es el último.
    const [ad, ws] = await Promise.all([
      db.from('usuarios').select('id').eq('workspace_id', u.workspace_id).eq('rol_ws', 'admin').neq('estado', 'suspendido').neq('id', u.id),
      db.from('workspaces').select('nombre').eq('id', u.workspace_id).maybeSingle(),
    ]);
    if (ad.error) throw new Error(`admins del negocio: ${ad.error.message}`);
    otrosAdmins = (ad.data ?? []).length;
    negocio = (ws.data as { nombre?: string | null } | null)?.nombre?.trim() || null;
  }
  const wsPlataforma = await wsSuperAdmin().catch(() => undefined);
  return { alcance: alcanceDeLaBaja({ rolWs: u.rol_ws, otrosAdmins, ws: u.workspace_id, wsPlataforma }), negocio };
}

/** Lo que la pantalla necesita antes de abrir la confirmación. */
export async function estadoDeMiBaja(): Promise<EstadoBaja> {
  const id = await idDeLaSesion();
  const u = id == null ? null : await filaDe(id);
  const motivo = motivoSinBaja({ rol: u?.rol ?? null, impersonando: await estaImpersonando(), tieneFila: !!u });
  if (motivo || !u) return { puede: false, motivo: motivo ?? 'Sin cuenta.' };
  const [{ alcance, negocio }, pendiente] = await Promise.all([
    alcanceYNegocio(u),
    getSupabaseServer().from('bajas_cuenta').select('vence_at').eq('usuario_id', u.id).eq('estado', 'pendiente').maybeSingle(),
  ]);
  return { puede: true, alcance, negocio, pendienteHasta: (pendiente.data as { vence_at?: string } | null)?.vence_at ?? null };
}

export type ResultadoPedirBaja =
  | { ok: true; alcance: AlcanceBaja; hasta: string; yaEstaba: boolean; avisos: string[] }
  | { ok: false; error: string; status: number };

/**
 * Pedir la baja de la cuenta de ESTA sesión. `alcanceVisto` es lo que la pantalla le mostró: si otro admin se fue mientras tanto, «tu negocio sigue» pasó a
 * ser «se borra el negocio», y eso no se ejecuta sin que lo haya leído (lo encontró la revisión del 3/11/2026).
 */
export async function pedirBajaDeMiCuenta(alcanceVisto?: AlcanceBaja | null): Promise<ResultadoPedirBaja> {
  const id = await idDeLaSesion();
  return pedirBajaDe(id, await estaImpersonando(), alcanceVisto);
}

/** `avisarDePlataforma` NO tira: devuelve `enviado`. Un `.catch` acá no ve nada. */
async function mandar(m: Parameters<typeof avisarDePlataforma>[0]): Promise<string | null> {
  const r = await avisarDePlataforma(m).catch((e) => ({ enviado: false as const, error: msg(e) }));
  return r.enviado ? null : (r.error ?? 'no salió');
}

/** Lo de arriba sin la sesión (el test lo corre de verdad). Idempotente: el segundo pedido devuelve el primero y no apaga nada. */
export async function pedirBajaDe(usuarioId: number | null, impersonando: boolean, alcanceVisto?: AlcanceBaja | null): Promise<ResultadoPedirBaja> {
  const u = usuarioId == null ? null : await filaDe(usuarioId);
  const motivo = motivoSinBaja({ rol: u?.rol ?? null, impersonando, tieneFila: !!u });
  if (motivo || !u) return { ok: false, error: motivo ?? 'Sin cuenta.', status: 403 };

  const db = getSupabaseServer();
  const { alcance, negocio } = await alcanceYNegocio(u);
  if (alcanceVisto && alcanceVisto !== alcance) return { ok: false, error: 'Cambió lo que se borra. Léelo de nuevo antes de confirmar.', status: 409 };
  const ws = u.workspace_id;
  // El negocio de la cuenta de revisión de las tiendas también se anota y no se borra: el revisor tiene que poder probar «Eliminar mi
  // cuenta», y el siguiente tiene que poder entrar (lib/cuenta-revision-reglas.ts). Va aparte de WS_PRUEBAS a propósito: ése no es un
  // negocio de prueba donde se pueda romper.
  const prueba = ws != null && ((WS_PRUEBAS as readonly number[]).includes(ws) || ws === WS_REVISION);
  const ahora = Date.now();
  const hasta = venceDe(ahora);

  const { error } = await db.from('bajas_cuenta').insert({
    usuario_id: u.id, negocio_id: ws, alcance, email: u.email, nombre: u.nombre, negocio, prueba,
    pedida_at: new Date(ahora).toISOString(), vence_at: hasta,
  });
  if (error) {
    if (error.code === '23505') {
      const { data } = await db.from('bajas_cuenta').select('alcance, vence_at').eq('usuario_id', u.id).eq('estado', 'pendiente').maybeSingle();
      const f = data as { alcance: AlcanceBaja; vence_at: string } | null;
      return { ok: true, alcance: f?.alcance ?? alcance, hasta: f?.vence_at ?? hasta, yaEstaba: true, avisos: [] };
    }
    console.error('[baja-cuenta] no pude anotar el pedido:', error.message);
    return { ok: false, error: `No pudimos anotar tu pedido. Escríbenos a ${EMAIL_MAKO}.`, status: 500 };
  }

  const avisos: string[] = [];
  let pausoNegocio = false;
  if (!prueba) {
    if (alcance === 'negocio' && ws != null) {
      // La plata primero, como `agencia-baja`. Si no se pudo cortar, se sigue igual y el super admin lo ve: el pedido ya está
      // anotado y frenar acá dejaría la cuenta prendida con un pedido de borrarla.
      const r = await darDeBajaMiPlan(ws, u.nombre || u.email).catch((e) => ({ ok: false as const, resumen: msg(e) }));
      if (!r.ok && !/no se cobra por la pasarela/i.test(r.resumen)) avisos.push(`El plan: ${r.resumen}`);
      const { data: pausados, error: ePausa } = await db.from('workspaces').update({ estado: 'pausado', updated_at: new Date().toISOString() }).eq('id', ws).eq('estado', 'activo').select('id');
      if (ePausa) avisos.push(`La pausa: ${ePausa.message}`);
      pausoNegocio = (pausados ?? []).length > 0;
    }
    const { data: suspendidos, error: eSusp } = await db.from('usuarios').update({ estado: 'suspendido' }).neq('estado', 'suspendido').eq('id', u.id).select('id');
    if (eSusp) avisos.push(`Suspender a la persona: ${eSusp.message}`);
    const suspendioUsuario = (suspendidos ?? []).length > 0;
    const { error: eMarca } = await db.from('bajas_cuenta').update({ pauso_negocio: pausoNegocio, suspendio_usuario: suspendioUsuario }).eq('usuario_id', u.id).eq('estado', 'pendiente');
    if (eMarca) avisos.push(`Anotar lo que apagó: ${eMarca.message}`);
    // Dos admins a la vez: los dos leyeron «queda otro», y ninguno se lleva el negocio. Se dice: lo decide el super admin.
    if (alcance === 'persona' && ws != null && u.rol_ws === 'admin') {
      const { data: quedan } = await db.from('usuarios').select('id').eq('workspace_id', ws).eq('rol_ws', 'admin').neq('estado', 'suspendido');
      if (!(quedan ?? []).length) avisos.push('El negocio se quedó sin ningún admin activo.');
    }
  }

  const t = textoDeLaBaja(alcance, negocio);
  const dia = fechaDeLaBaja(hasta);
  const noSalioPersona = await mandar({
    to: u.email, asunto: 'Recibimos tu pedido para eliminar tu cuenta de MaKo', preheader: `Se borra antes del ${dia}.`, tag: 'baja-cuenta',
    cuerpo: ['Hola,', '', t.que, '', `Se borra antes del ${dia}, y te avisamos por este correo al terminar.`, '',
      `Si no fuiste tú, o cambiaste de idea, escríbenos a ${EMAIL_MAKO} antes de esa fecha.`].join('\n'),
  });
  if (noSalioPersona) avisos.push(`El mail a la persona: ${noSalioPersona}`);
  const noSalioEquipo = await mandar({
    to: EMAIL_MAKO, asunto: `Eliminar cuenta: ${negocio ?? u.email}${prueba ? ' (prueba)' : ''}`, preheader: `Antes del ${dia}.`, tag: 'baja-cuenta-equipo',
    cuerpo: [`${u.email} pidió eliminar ${alcance === 'negocio' ? `el negocio entero (${negocio ?? `#${ws}`})` : 'su cuenta'}.`, '',
      `Hay plazo hasta el ${dia} (${PLAZO_BAJA_DIAS} días). Se ejecuta en Admin › Overview, en el aviso de las bajas.`,
      ...(avisos.length ? ['', 'Lo que no salió:', ...avisos.map((a) => `· ${a}`)] : [])].join('\n'),
  });
  if (noSalioEquipo) avisos.push(`El aviso a equipo@: ${noSalioEquipo}`);
  if (avisos.length) await db.from('bajas_cuenta').update({ notas: avisos.join(' · ').slice(0, 1000) }).eq('usuario_id', u.id).eq('estado', 'pendiente');
  if (avisos.length) console.error(`[baja-cuenta] usuario ${u.id}:`, avisos.join(' · '));
  return { ok: true, alcance, hasta, yaEstaba: false, avisos };
}

// ── Lo que ve y hace el super admin ──────────────────────────────────────────────

export type FilaBaja = {
  id: number; usuario_id: number; negocio_id: number | null; alcance: AlcanceBaja; email: string | null; nombre: string | null; negocio: string | null;
  prueba: boolean; pauso_negocio: boolean; suspendio_usuario: boolean; pedida_at: string; vence_at: string; estado: 'pendiente' | 'hecha' | 'cancelada'; cerrada_at: string | null; cerrada_por: string | null; notas: string | null;
};

/** Las pendientes, la que vence primero arriba. TIRA si no puede leer: «no pude» no es «no hay nadie». */
export async function bajasPendientes(): Promise<FilaBaja[]> {
  const { data, error } = await getSupabaseServer().from('bajas_cuenta').select('*').eq('estado', 'pendiente').order('vence_at', { ascending: true }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as FilaBaja[];
}

/**
 * Cierra una fila y le saca los datos personales: queda la constancia, no la persona.
 * ⚠️ Si el mail final no salió, el correo se queda (`noSalio`): es lo único con lo que se le puede avisar después, y se dice en `notas`.
 */
async function cerrar(id: number, estado: 'hecha' | 'cancelada', autor: string, noSalio?: string | null): Promise<void> {
  const { error } = await getSupabaseServer().from('bajas_cuenta').update({
    estado, cerrada_at: new Date().toISOString(), cerrada_por: autor.slice(0, 320),
    ...(noSalio ? { notas: `No salió el mail final: ${noSalio}`.slice(0, 1000) } : { notas: null, email: null, nombre: null, negocio: null }),
  }).eq('id', id).eq('estado', 'pendiente');
  if (error) throw new Error(error.message);
}

/** El mail final. Devuelve por qué no salió, o null. */
async function avisarQueTermino(f: Pick<FilaBaja, 'email' | 'alcance' | 'negocio'>): Promise<string | null> {
  if (!f.email) return null;
  const noSalio = await mandar({
    to: f.email, asunto: 'Tu cuenta de MaKo se eliminó', preheader: 'Ya está hecho.', tag: 'baja-cuenta-hecha',
    cuerpo: ['Hola,', '', f.alcance === 'negocio' ? `Se eliminó ${f.negocio ? `«${f.negocio}»` : 'tu negocio'} con todos sus datos.` : 'Se eliminaron tu usuario y tus datos personales.', '',
      'Gracias por haber usado MaKo.'].join('\n'),
  });
  if (noSalio) console.error('[baja-cuenta] no salió el mail final:', noSalio);
  return noSalio;
}

/**
 * El negocio ya se borró (`eliminarWorkspace`, con su nombre escrito): cierra sus pedidos y avisa. Nunca tira: el borrado ya pasó.
 * ⚠️ CON `avisos` NO LE DICE «con todos sus datos»: algo quedó (un archivo, la línea, la voz). El pedido sigue abierto con la nota, y el super admin lo termina
 * cuando esté resuelto (`terminarBaja`).
 */
export async function cerrarBajasDelNegocio(ws: number, autor: string, avisos: string[] = []): Promise<void> {
  try {
    const { data, error } = await getSupabaseServer().from('bajas_cuenta').select('*').eq('negocio_id', ws).eq('estado', 'pendiente');
    if (error) throw new Error(error.message);
    for (const f of (data ?? []) as FilaBaja[]) {
      if (avisos.length) {
        await getSupabaseServer().from('bajas_cuenta').update({ notas: `Se borró, y quedó: ${avisos.join(' · ')}`.slice(0, 1000) }).eq('id', f.id);
        continue;
      }
      await cerrar(f.id, 'hecha', autor, await avisarQueTermino(f));
    }
  } catch (e) {
    console.error(`[baja-cuenta] no pude cerrar los pedidos del ws ${ws}:`, msg(e));
  }
}

/** Borrar a una PERSONA pedida. El negocio entero no pasa por acá: va por `eliminarWorkspace`, con el nombre escrito a mano. */
export async function ejecutarBajaDePersona(id: number, autor: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabaseServer();
  const { data, error } = await db.from('bajas_cuenta').select('*').eq('id', id).eq('estado', 'pendiente').maybeSingle();
  if (error) return { ok: false, error: error.message };
  const f = data as FilaBaja | null;
  if (!f) return { ok: false, error: 'Ese pedido ya no está pendiente.' };
  if (f.alcance !== 'persona') return { ok: false, error: 'Es el negocio entero: se borra con «Eliminar…» en su fila, con el nombre escrito.' };
  if (f.prueba) return { ok: false, error: 'Es del negocio de prueba: se cancela, no se borra.' };
  const plataforma = await wsSuperAdmin().catch(() => null);
  if (f.negocio_id != null && f.negocio_id === plataforma) return { ok: false, error: 'Es del espacio de la plataforma.' };
  // Si era admin y no queda otro activo, el negocio se quedaría sin nadie: eso se resuelve con el negocio, no con la persona.
  const { data: fila } = await db.from('usuarios').select('rol_ws').eq('id', f.usuario_id).maybeSingle();
  if ((fila as { rol_ws?: string | null } | null)?.rol_ws === 'admin' && f.negocio_id != null) {
    const { data: quedan } = await db.from('usuarios').select('id').eq('workspace_id', f.negocio_id).eq('rol_ws', 'admin').neq('estado', 'suspendido').neq('id', f.usuario_id);
    if (!(quedan ?? []).length) return { ok: false, error: 'Es el último admin de su negocio: se borra el negocio, con «Eliminar…» en su fila, o se cancela.' };
  }
  const { borrarFotosDeUsuario } = await import('./reset-workspace');
  const fotos = await borrarFotosDeUsuario(f.usuario_id);
  const { data: borrados, error: eDel } = await db.from('usuarios').delete().eq('id', f.usuario_id).eq('rol', 'usuario').select('id');
  if (eDel) return { ok: false, error: eDel.message };
  if (!(borrados ?? []).length) return { ok: false, error: 'No la encontré como usuario común: revisa la fila antes de cerrar el pedido.' };
  const noSalio = await avisarQueTermino(f);
  try { await cerrar(f.id, 'hecha', autor, noSalio ?? (fotos.length ? fotos.join(' · ') : null)); } catch (e) { return { ok: false, error: `La persona se borró, pero el pedido no se cerró: ${msg(e)}` }; }
  return { ok: true };
}

/** El negocio ya no está y lo que había quedado se resolvió: le avisa y cierra. */
export async function terminarBaja(id: number, autor: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabaseServer();
  const { data, error } = await db.from('bajas_cuenta').select('*').eq('id', id).eq('estado', 'pendiente').maybeSingle();
  if (error) return { ok: false, error: error.message };
  const f = data as FilaBaja | null;
  if (!f) return { ok: false, error: 'Ese pedido ya no está pendiente.' };
  if (f.negocio_id != null) {
    const { data: ws } = await db.from('workspaces').select('id').eq('id', f.negocio_id).maybeSingle();
    if (ws) return { ok: false, error: 'Ese negocio todavía existe: se borra con «Eliminar…» en su fila.' };
  }
  try { await cerrar(f.id, 'hecha', autor, await avisarQueTermino(f)); } catch (e) { return { ok: false, error: msg(e) }; }
  return { ok: true };
}

/** Cancelar: se arrepintió. Le devuelve lo que el pedido le apagó, salvo el plan: eso lo elige de nuevo. */
export async function cancelarBaja(id: number, autor: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabaseServer();
  const { data, error } = await db.from('bajas_cuenta').select('*').eq('id', id).eq('estado', 'pendiente').maybeSingle();
  if (error) return { ok: false, error: error.message };
  const f = data as FilaBaja | null;
  if (!f) return { ok: false, error: 'Ese pedido ya no está pendiente.' };
  // Sólo lo que apagó ESTE pedido: un negocio pausado por impago, o una persona suspendida por otro motivo, siguen como estaban.
  if (!f.prueba) {
    if (f.suspendio_usuario) {
      const { error: eU } = await db.from('usuarios').update({ estado: 'activo' }).eq('id', f.usuario_id).eq('estado', 'suspendido');
      if (eU) return { ok: false, error: eU.message };
    }
    if (f.pauso_negocio && f.negocio_id != null) {
      const { error: eW } = await db.from('workspaces').update({ estado: 'activo', updated_at: new Date().toISOString() }).eq('id', f.negocio_id).eq('estado', 'pausado');
      if (eW) return { ok: false, error: eW.message };
    }
  }
  try { await cerrar(f.id, 'cancelada', autor); } catch (e) { return { ok: false, error: msg(e) }; }
  return { ok: true };
}
