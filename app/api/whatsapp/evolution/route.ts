// =============================================================================
// API interna: conexión del WhatsApp NO oficial (Evolution) del workspace
// =============================================================================
// GET  ?linea= → estado de UNA línea (sin `linea`, la de por default) + la lista de líneas
//                del negocio, para el desplegable.
// POST → { action:'conectar', linea? }        → crea/reusa la instancia y devuelve el QR.
//        { action:'nueva-linea', etiqueta? }  → «Agregar otro número»: una línea nueva + su QR.
//        { action:'estado', linea? }          → estado EN VIVO (para el polling del modal).
//        { action:'refrescar', linea? }       → QR nuevo sin recrear.
//        { action:'desconectar', linea? }     → logout + delete (una línea extra se va del negocio).
//        { action:'renombrar-linea', linea, etiqueta } · { action:'predeterminar-linea', linea }
//
// ⚠️ `linea` viene del navegador y NO se confía: cada función de lib/evolution.ts la pasa por
// `elegirLinea`, que exige que sea del workspace de la sesión. Una línea ajena no se toca.
// Guard: solo el admin del workspace (conectar un número es config sensible).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import {
  conectar, estadoEnVivo, refrescarQr, desconectar, getInstanciaRow, evolutionConfigurado,
  sondearSocket, motivoCaida,
  estadoWebhook, repararWebhook,
  listarLineas, renombrarLinea, predeterminarLinea,
} from '@/lib/evolution';
import { rotuloLinea, sanearEtiqueta } from '@/lib/lineas-whatsapp';
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

/** La línea que nombra el pedido: un string no vacío, o nada (= la de por default). */
const lineaDe = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function GET(req: NextRequest) {
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
    // ⚠️ PERO EL SONDEO NO PUEDE COLGAR LA PANTALLA: va con presupuesto de 4s.
    // Hasta el 11/09/2026 la sonda traia los grupos, y en una cuenta con muchos no
    // terminaba (`mako_ws11` >30s, la voz de MaKo >90s): con este tope el chip
    // quedaba en «no pude comprobarlo» sobre lineas perfectas. La sonda actual
    // contesta en ~250ms (ver `sondearSocket`), asi que el tope ya no recorta el
    // camino normal: solo corta un Evolution colgado.
    //
    // Y las TRES respuestas se tratan distinto, que es todo el punto:
    //   vivo   → conectado, medido.
    //   muerto → desconectado, medido (Evolution contesto «Connection Closed»).
    //   no contesto a tiempo → NO se afirma nada: se cae a la fila y se marca
    //     `confirmado: false`, para que el chip diga que no pudo comprobarlo en
    //     vez de pintar un verde que no midio nadie.
    const pedida = lineaDe(req.nextUrl.searchParams.get('linea'));
    const lineas = await listarLineas();
    const row = await getInstanciaRow(pedida);
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
      // De qué línea habla este estado, y todas las del negocio para el desplegable. El
      // rótulo se arma acá con la misma función que usa la pantalla: nunca el instance_name.
      linea: row?.instance_name ?? null,
      lineas: lineas.map((l, i) => ({
        linea: l.instance_name, rotulo: rotuloLinea(l, i), etiqueta: l.etiqueta,
        numero: l.numero, estado: l.estado, esDefault: l.es_default,
      })),
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

  let body: { action?: string; linea?: unknown; etiqueta?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const linea = lineaDe(body.linea);

  try {
    if (body.action === 'conectar') {
      const r = await conectar({ linea });
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, estado: r.estado, qr: r.qr, linea: r.linea });
    }
    if (body.action === 'nueva-linea') {
      const r = await conectar({ nueva: true, etiqueta: sanearEtiqueta(body.etiqueta) });
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, estado: r.estado, qr: r.qr, linea: r.linea });
    }
    if (body.action === 'renombrar-linea') {
      if (!linea) return Response.json({ ok: false, error: 'falta la línea' }, { status: 400 });
      await renombrarLinea(linea, sanearEtiqueta(body.etiqueta));
      return Response.json({ ok: true });
    }
    if (body.action === 'predeterminar-linea') {
      if (!linea) return Response.json({ ok: false, error: 'falta la línea' }, { status: 400 });
      await predeterminarLinea(linea);
      return Response.json({ ok: true });
    }
    if (body.action === 'estado') {
      const s = await estadoEnVivo(linea);
      return Response.json({ ok: true, ...s });
    }
    if (body.action === 'refrescar') {
      const r = await refrescarQr(linea);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, qr: r.qr });
    }
    if (body.action === 'desconectar') {
      const r = await desconectar(linea);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, movidas: r.movidas ?? 0 });
    }
    if (body.action === 'webhook-estado') {
      // Salud del espejo de mensajes (webhook Evolution → app).
      const s = await estadoWebhook(linea);
      return Response.json({ ok: true, ...s });
    }
    if (body.action === 'reparar-webhook') {
      const r = await repararWebhook(linea);
      return Response.json({ ok: r.ok, estado: r.estado, error: r.error });
    }
    if (body.action === 'sincronizar') {
      // "Sincronizar todo": trae los chats de Evolution al espejo a pedido, de ESA línea.
      const r = await sincronizarDesdeEvolution(linea);
      return Response.json({ ok: true, ...r });
    }
    if (body.action === 'borrar-chats') {
      // Empezar de 0: borra el espejo de mensajes de ESA línea (sin línea, el del negocio entero).
      const n = await borrarEspejoNoOficial(linea);
      return Response.json({ ok: true, borrados: n });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:whatsapp/evolution POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
