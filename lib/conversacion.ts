// =============================================================================
// conversacion — la conversación de un turno de MaKo, leída de donde PASÓ (12/11/2026; las reglas: lib/conversacion-reglas.ts)
// =============================================================================
// Una sola entrada para todos los chats: `conversacionDelTurno`. Hoy la usan los grupos de WhatsApp (lib/mako-doer-in.ts), prendida por
// negocio (`conversacionPrendida`: primero la plataforma y Código Inmobiliario); los chats de la app la suman con su adaptador.
// DE DÓNDE SALE, por canal:
//   · GRUPO: la base es el hilo del grupo (`grupo_mensajes`: el de WhatsApp y el de la app son UN hilo por negocio, con personas, MaKo,
//     el equipo y los avisos con su `aviso_tipo`). La memoria del turno (`mako_doer_conv`) completa por id lo que el modelo leyó y la
//     persona no (un adjunto leído). Y el chat de la línea (el store de Evolution, con los `fromMe`) suma lo que se mandó a MANO por la
//     línea y no pasó por ningún código nuestro: el pedido del correo de Sellers del 11/11 a las 23:33 no estaba ni en el hilo.
//   · PRIVADO: la memoria del turno y el chat de la línea con esa persona.
// Si una fuente no contesta, sigue con las otras; si no contesta ninguna, null y el turno sigue con su memoria (lib/mako-doer-in.ts).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { chatDelGrupo } from './evolution';
import { memoriaDelGrupo, type FilaConv } from './mako-doer-conv';
import { firmadoPorElEquipo, textoDelMensajeDelChat, type MensajeDelChat } from './hilo-real';
import {
  fundirFuentes, turnosDelHilo, ultimoDeMaKoEn, TOPE_TOKENS, type CanalDelTurno, type EntradaDelHilo, type TurnoDelModelo,
} from './conversacion-reglas';

/** Dónde se prende por negocio (`si`/`no`); sin el ajuste, la lista de abajo. */
export const KEY_CONVERSACION = 'mako.conversacion';
/** Los negocios donde arranca prendida (el plan del 11/11): la plataforma y Código Inmobiliario, los de los tres casos. */
export const NEGOCIOS_DE_ARRANQUE: readonly number[] = [13];

/** ¿Este negocio arma el turno con `conversacionDelTurno`? La plataforma y los de arranque, salvo que su ajuste diga `no`. */
export async function conversacionPrendida(ws: number): Promise<boolean> {
  const ajuste = await runWithWorkspace(ws, () => getSetting(KEY_CONVERSACION)).catch(() => null);
  if (ajuste === 'no') return false;
  if (ajuste === 'si') return true;
  if (NEGOCIOS_DE_ARRANQUE.includes(ws)) return true;
  return ws === (await wsSuperAdmin().catch(() => null));
}

export type Conversacion = {
  turnos: TurnoDelModelo[];
  /** Lo de antes de la ventana, para los hechos con fecha del system (`bloqueYaSeHablo`). */
  hechos: FilaConv[];
  /** El resumen de lo que quedó afuera del tope, si ya hay uno guardado (lo arma el resumidor, fuera del turno). */
  resumen: string | null;
  ultimoDeMaKo: string | null;
  /** Todo lo que se juntó, en orden (para medir y para los tests). */
  entradas: EntradaDelHilo[];
};

/** El resumen guardado de una conversación (lo escribe lib/conversacion-resumen.ts, con su candado). */
export const KEY_RESUMEN = (clave: string): string => `mako.conversacion.resumen.${clave}`;

type FilaDelHilo = { id: number; autor_tipo: string; usuario_id: number | null; autor_nombre: string | null; texto: string | null; aviso_tipo: string | null; wa_message_id: string | null; wa_at: string | null; created_at: string; adjunto: { tipo?: string; nombre?: string } | null };

async function delHiloDelGrupo(ws: number, desdeMs: number): Promise<EntradaDelHilo[] | null> {
  const db = getSupabaseServer();
  const [h, inv] = await Promise.all([
    db.from('grupo_mensajes').select('id, autor_tipo, usuario_id, autor_nombre, texto, aviso_tipo, wa_message_id, wa_at, created_at, adjunto')
      .eq('workspace_id', ws).gte('created_at', new Date(desdeMs).toISOString()).order('created_at', { ascending: false }).limit(200),
    db.from('grupo_invitados').select('usuario_id').eq('workspace_id', ws).is('salio_at', null).limit(200),
  ]);
  if (h.error) return null;
  const invitados = new Set(((inv.data ?? []) as Array<{ usuario_id: number | null }>).map((x) => x.usuario_id).filter((x): x is number => x != null));
  return ((h.data ?? []) as FilaDelHilo[]).flatMap((f): EntradaDelHilo[] => {
    const adj = f.adjunto?.tipo ? `[${f.adjunto.tipo === 'imagen' ? 'foto' : f.adjunto.tipo}${f.adjunto.nombre ? ` ${f.adjunto.nombre}` : ''}]` : '';
    const texto = [adj, (f.texto ?? '').trim()].filter(Boolean).join(' ');
    if (!texto) return [];
    const rol = f.autor_tipo === 'mako' ? (f.aviso_tipo ? 'aviso' : 'mako') : f.autor_tipo === 'equipo' ? 'equipo'
      : f.autor_tipo === 'persona' ? (f.usuario_id != null && invitados.has(f.usuario_id) ? 'invitado' : 'persona') : null;
    if (!rol) return [];
    return [{ id: f.wa_message_id ?? `app:${f.id}`, at: Date.parse(f.wa_at ?? f.created_at), rol, quien: f.autor_nombre, texto }];
  });
}

/** La memoria del turno como fuente: completa por id lo que el modelo leyó y la persona no (lo leído de un adjunto). */
function deLaMemoria(filas: ReadonlyArray<{ role: 'user' | 'assistant'; content: string; created_at: string; wa_message_id?: string | null }>): EntradaDelHilo[] {
  return filas.map((f) => ({ id: f.wa_message_id ?? null, at: Date.parse(f.created_at), rol: f.role === 'assistant' ? 'mako' : 'persona', texto: f.content }));
}

/** El chat de la línea como fuente: lo de la línea es de MaKo, salvo lo firmado por el equipo. */
function deLaLinea(chat: readonly MensajeDelChat[], idsDelEquipo: ReadonlySet<string>): EntradaDelHilo[] {
  return chat.flatMap((m): EntradaDelHilo[] => {
    const texto = textoDelMensajeDelChat(m);
    const s = Number(m.messageTimestamp);
    if (!texto || !Number.isFinite(s)) return [];
    const at = s < 1e12 ? s * 1000 : s;
    const id = m.key?.id ?? null;
    if (!m.key?.fromMe) return [{ id, at, rol: 'persona', quien: m.pushName ?? null, texto }];
    const delEquipo = (!!id && idsDelEquipo.has(id)) || firmadoPorElEquipo(texto);
    return [{ id, at, rol: delEquipo ? 'equipo' : 'mako', texto }];
  });
}

/**
 * LA ENTRADA: la conversación de este turno, cortada por tokens. `clave`: la de la conversación (el jid del grupo o de la persona).
 * `instancia`: la línea que recibió (para leer su chat). `excluirIds`/`textoActual`: el mensaje que se atiende. null si no se pudo
 * leer nada: quien llama sigue con lo de antes.
 */
export async function conversacionDelTurno(p: {
  canal: CanalDelTurno; ws: number; clave: string; instancia?: string | null; excluirIds?: readonly string[]; textoActual?: string;
  presupuesto?: number; citadoId?: string | null; idsDelEquipo?: ReadonlySet<string>; ahoraMs?: number;
}): Promise<Conversacion | null> {
  const ahora = p.ahoraMs ?? Date.now();
  const desde = ahora - 14 * 3_600_000;
  const [hilo, memoria, chat] = await Promise.all([
    p.canal === 'grupo' ? delHiloDelGrupo(p.ws, desde).catch(() => null) : Promise.resolve([] as EntradaDelHilo[]),
    memoriaDelGrupo(p.ws, p.clave, { turnos: 40 }).catch(() => null),
    p.instancia ? chatDelGrupo(p.instancia, p.clave).catch(() => null) : Promise.resolve(null),
  ]);
  if (!hilo && !memoria && !chat) return null;
  const entradas = fundirFuentes(hilo ?? [], deLaMemoria(memoria?.recienteFilas ?? []), deLaLinea(chat ?? [], p.idsDelEquipo ?? new Set()));
  const corte = turnosDelHilo(entradas, {
    ahoraMs: ahora, presupuesto: p.presupuesto ?? TOPE_TOKENS[p.canal], excluirIds: new Set(p.excluirIds ?? []), textoActual: p.textoActual,
  });
  const resumen = await runWithWorkspace(p.ws, () => getSetting(KEY_RESUMEN(p.clave))).catch(() => null);
  return {
    turnos: corte.turnos, hechos: memoria?.antes ?? [], resumen: resumen || null,
    ultimoDeMaKo: ultimoDeMaKoEn(corte.usados, { ahoraMs: ahora, citadoId: p.citadoId }), entradas,
  };
}
