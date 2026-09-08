// =============================================================================
// API interna: conexión del WhatsApp NO oficial (Evolution) del workspace
// =============================================================================
// GET  → estado cacheado + config (para pintar el chip y decidir si mostrar QR).
// POST → { action:'conectar' }    → crea/reusa la instancia y devuelve el QR.
//        { action:'estado' }      → estado EN VIVO (para el polling del modal).
//        { action:'refrescar' }   → QR nuevo sin recrear.
//        { action:'desconectar' } → logout + delete.
// Guard: solo el admin del workspace (conectar un número es config sensible).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import {
  conectar, estadoEnVivo, refrescarQr, desconectar, getInstanciaRow, evolutionConfigurado,
  sondearSocket, motivoCaida,
  estadoWebhook, repararWebhook,
} from '@/lib/evolution';
import { sincronizarDesdeEvolution, borrarEspejoNoOficial } from '@/lib/evolution-mensajes';

export const dynamic = 'force-dynamic';
// 'sincronizar' recorre hasta 100 chats con 60 mensajes cada uno contra
// Evolution: con el default se corta a la mitad y deja el espejo incompleto.
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede conectar el WhatsApp de empresa.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await soloAdmin();
  if (g) return g;
  try {
    // ⚠️ EL VERDE SALIA DE LA FILA, QUE ES EL CAMPO QUE SE SABE QUE MIENTE.
    //
    // `evolution_instancias.estado` lo escribe el webhook `connection.update` con
    // el `state` de Evolution, y este repo tiene MEDIDO que ese campo miente en
    // las dos direcciones (`lib/canal-vigilante.ts`, 08/09/2026): una instancia
    // con `open` contesta «Connection Closed» a toda operacion real. O sea que el
    // chip podia decir «API no Oficial conectada» en verde, con el numero al
    // lado, sobre una sesion muerta — y de ahi sale `canalCaido`, que es lo que
    // decide si «Envio real: ON» dice la verdad.
    //
    // ⚠️ PERO EL SONDEO NO PUEDE COLGAR LA PANTALLA. El unico chequeo que de
    // verdad exige el socket es traer los grupos, y en una cuenta con muchos
    // TARDA: medido el 08/09/2026, `mako_ws11` timeoutea a los 30s. Ponerlo sin
    // tope en el GET convertiria cada carga de /whatsapp en media minuto de
    // espera. Va con presupuesto de 4s.
    //
    // Y las TRES respuestas se tratan distinto, que es todo el punto:
    //   vivo   → conectado, medido.
    //   muerto → desconectado, medido (Evolution contesto «Connection Closed»).
    //   no contesto a tiempo → NO se afirma nada: se cae a la fila y se marca
    //     `confirmado: false`, para que el chip diga que no pudo comprobarlo en
    //     vez de pintar un verde que no midio nadie.
    const row = await getInstanciaRow();
    // Sin fila no hay instancia creada: nunca lo vinculo. No hay nada que
    // sondear, y sondear un nombre inventado gastaria 4s para contestar lo que
    // ya sabemos.
    const sondeo = row && evolutionConfigurado()
      ? await sondearSocket(row.instance_name, 4000)
      : 'sin_respuesta';
    const medido = sondeo === 'vivo' ? 'conectado' : sondeo === 'muerto' ? 'desconectado' : null;
    // POR QUE se cayo. Solo se pregunta si esta caida — en el camino feliz seria
    // una llamada de mas por carga de pantalla. Es lo que convierte «tu WhatsApp
    // esta desconectado» (que el dueno no cree, porque su TELEFONO anda) en «se
    // desvinculo el 3 de septiembre» (que puede ir a comprobar).
    const motivo = medido === 'desconectado' && row
      ? await motivoCaida(row.instance_name, 4000).catch(() => null)
      : null;
    return Response.json({
      ok: true,
      configurado: evolutionConfigurado(),
      // Con la sesion a medio vincular la fila dice 'conectando' y el sondeo
      // dice 'muerto' — y es cierto: todavia no hay socket. Gana la fila, o el
      // QR en pantalla se leeria como un fallo.
      estado: row?.estado === 'conectando' ? 'conectando' : (medido ?? row?.estado ?? 'desconectado'),
      confirmado: medido != null || row?.estado === 'conectando',
      numero: row?.numero ?? null,
      perfil: row?.perfil_nombre ?? null,
      caida: motivo,
    });
  } catch (e) {
    console.error(`[api:whatsapp/evolution GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin();
  if (g) return g;
  if (!evolutionConfigurado()) {
    return Response.json({ ok: false, error: 'Evolution API no está configurado en el servidor.' }, { status: 400 });
  }

  let body: { action?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'conectar') {
      const r = await conectar();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, estado: r.estado, qr: r.qr });
    }
    if (body.action === 'estado') {
      const s = await estadoEnVivo();
      return Response.json({ ok: true, ...s });
    }
    if (body.action === 'refrescar') {
      const r = await refrescarQr();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, qr: r.qr });
    }
    if (body.action === 'desconectar') {
      const r = await desconectar();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true });
    }
    if (body.action === 'webhook-estado') {
      // Salud del espejo de mensajes (webhook Evolution → app).
      const s = await estadoWebhook();
      return Response.json({ ok: true, ...s });
    }
    if (body.action === 'reparar-webhook') {
      const r = await repararWebhook();
      return Response.json({ ok: r.ok, estado: r.estado, error: r.error });
    }
    if (body.action === 'sincronizar') {
      // "Sincronizar todo": trae los chats de Evolution al espejo a pedido.
      const r = await sincronizarDesdeEvolution();
      return Response.json({ ok: true, ...r });
    }
    if (body.action === 'borrar-chats') {
      // Empezar de 0: borra el espejo de mensajes no oficial del workspace.
      const n = await borrarEspejoNoOficial();
      return Response.json({ ok: true, borrados: n });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:whatsapp/evolution POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
