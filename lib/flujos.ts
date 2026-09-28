// =============================================================================
// flujos — runtime del FLUJO (dispara por evento y ejecuta los pasos)
// =============================================================================
// dispararEvento(evento, ctx) lo llaman los choke points ya cableados (calendly/
// fathom/meta-leads/chatwoot), al lado del emitirDelCatalogo existente. Lee los
// flujos ACTIVOS, matchea el evento + filtro, y ejecuta los pasos EN ORDEN hasta
// el primer 'esperar' (los pasos con espera necesitan el cron drenador — pendiente).
//
// Pasos:
//   · mensaje/aviso_dueno  → lo manda al grupo de MaKo del dueño (IA adapta el texto).
//   · mensaje/wa_lead + accion → van por la COLA DE CONFIRMACIÓN (mako_acciones_
//     pendientes): MaKo propone y el dueño confirma con un "sí" (nunca dispara solo).
// Best-effort: nunca lanza (no debe romper el webhook).

import 'server-only';
import { listarFlujosActivos } from './plantillas';
import { generarMensajeAviso } from './plantillas';
import { enviarAlGrupoMaKo, getGrupoJidMaKo } from './mako-grupo';
import { crearPendiente } from './mako-pendientes';
import { abrirInsistencia } from './insistencias';
import { OWNER_WS, runWithWorkspace } from './workspace';
import type { EventoFlujo, Paso } from './flujos-tipos';

export type CtxFlujo = { ws?: number; leadId?: number; leadNombre?: string; reunion?: 'R1' | 'R2'; texto?: string };

/** Dispara los flujos ACTIVOS que matchean un evento. Best-effort. */
export async function dispararEvento(evento: EventoFlujo, ctx: CtxFlujo = {}): Promise<void> {
  try {
    const ws = ctx.ws ?? OWNER_WS;
    // ⚠️ Los flujos se leen DENTRO del workspace del evento, no del request.
    // Antes se leían sueltos y el store estaba clavado al dueño: los flujos de la
    // agencia se ejecutaban dentro del grupo de cada cliente. Hoy el store es por
    // workspace con herencia (lib/plantillas.ts), y esto es lo que la hace valer —
    // sin el runWithWorkspace, un webhook resolvería el ws del request (o ninguno).
    const flujos = await runWithWorkspace(ws, () => listarFlujosActivos());
    for (const { id, flujo } of flujos) {
      const d = flujo.disparador;
      if (d.tipo !== 'evento' || d.evento !== evento) continue;
      if (d.filtro?.reunion && ctx.reunion && d.filtro.reunion !== ctx.reunion) continue;
      await runWithWorkspace(ws, () => ejecutarPasos(id, flujo.pasos, ws, ctx));
    }
  } catch (e) {
    console.error('[flujos] dispararEvento:', e instanceof Error ? e.message : String(e));
  }
}

async function ejecutarPasos(flujoId: string, pasos: Paso[], ws: number, ctx: CtxFlujo): Promise<void> {
  for (const paso of pasos) {
    if (paso.tipo === 'esperar') break; // los pasos con espera necesitan el cron drenador (pendiente)
    try { await ejecutarPaso(flujoId, paso, ws, ctx); }
    catch (e) { console.error(`[flujos] paso de ${flujoId}:`, e instanceof Error ? e.message : String(e)); }
  }
}

async function ejecutarPaso(flujoId: string, paso: Paso, ws: number, ctx: CtxFlujo): Promise<void> {
  // INSISTIR: el mensaje sale AHORA y además queda una insistencia abierta. Vuelve
  // cada `cadaMin` hasta `veces`, o hasta que alguien escriba «ok» en el grupo.
  // El techo (5 veces, 30 min) lo recorta `sanearInsistir` adentro de abrirInsistencia:
  // acá no se valida nada a mano, para que haya UN solo lugar donde vive el tope.
  if (paso.tipo === 'insistir') {
    const contexto = [ctx.leadNombre && `Lead: ${ctx.leadNombre}`, ctx.reunion && `Reunión: ${ctx.reunion}`, ctx.texto].filter(Boolean).join(' · ');
    const texto = await generarMensajeAviso(flujoId, contexto).catch(() => paso.texto) || paso.texto;
    await enviarAlGrupoMaKo(ws, texto);
    // El texto que vuelve es el MISMO que salió, no uno nuevo generado cada vez: si
    // cada repetición se redactara distinta, el dueño leería cuatro avisos que parecen
    // cuatro hechos. Es el mismo hecho insistiendo.
    await abrirInsistencia(ws, { flujoId, leadId: ctx.leadId ?? null, texto, cadaMin: paso.cadaMin, veces: paso.veces });
    return;
  }
  if (paso.tipo === 'mensaje') {
    if (paso.canal === 'aviso_dueno') {
      // MaKo adapta el texto (referencia) con el contexto y lo manda al grupo del dueño.
      const contexto = [ctx.leadNombre && `Lead: ${ctx.leadNombre}`, ctx.reunion && `Reunión: ${ctx.reunion}`, ctx.texto].filter(Boolean).join(' · ');
      const texto = await generarMensajeAviso(flujoId, contexto).catch(() => paso.texto) || paso.texto;
      await enviarAlGrupoMaKo(ws, texto);
      return;
    }
    // wa_lead → SIEMPRE por confirmación (regla del negocio: nunca disparar auto al lead).
    const jid = await getGrupoJidMaKo(ws);
    if (jid) {
      await crearPendiente(ws, {
        grupoJid: jid, tipo: 'flujo_wa_lead',
        payload: { flujoId, leadId: ctx.leadId ?? null, texto: paso.texto },
        resumen: `Mandarle un WhatsApp a ${ctx.leadNombre ?? `lead #${ctx.leadId}`}: "${paso.texto.slice(0, 60)}"`,
        origen: `flujo:${flujoId}`, ttlMin: 240,
      });
    }
    return;
  }
  if (paso.tipo === 'accion') {
    // Toda acción del flujo va por la cola de confirmación (nunca auto).
    const jid = await getGrupoJidMaKo(ws);
    if (jid) {
      await crearPendiente(ws, {
        grupoJid: jid, tipo: `flujo_${paso.accion}`,
        payload: { flujoId, leadId: ctx.leadId ?? null, ...(paso.params ?? {}) },
        resumen: `Flujo "${flujoId}": ${paso.accion}${ctx.leadNombre ? ` para ${ctx.leadNombre}` : ''}`,
        origen: `flujo:${flujoId}`, ttlMin: 240,
      });
    }
  }
}
