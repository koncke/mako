// =============================================================================
// /api/onboarding/arranque — el chat de arranque (el onboarding de MaKo es una conversación)
// =============================================================================
// GET  → { ok, vista }                       lo que la pantalla dibuja (lib/onboarding-arranque-server.ts)
// POST → { action: 'intro' }                 ya vio la animación del principio
//        { action: 'responder', texto?, opcion? }   la respuesta a la pregunta de la etapa actual
//        { action: 'sesion', sesionId }      la conversación de la oferta que se abrió en el funnel principal
//        { action: 'telefono', telefono }    prepara el link para que la persona le escriba a MaKo (MaKo no le escribe primero)
//        { action: 'whatsapp' }              ¿ya llegó su mensaje? Si llegó, avanza; si no, contesta corto (la pantalla lo pregunta cada pocos segundos)
//        { action: 'avisos', sinSoporte? }   vuelve a mirar si el teléfono tiene los avisos; `sinSoporte` es «Mi teléfono no puede»
//        { action: 'cerrar' }                deja escrito el perfil, el producto y la oferta, y cierra los pasos
//
// La conversación de la OFERTA no pasa por acá: va por /api/offer (turnos, archivos, armar la oferta), la
// misma de la tab. Acá sólo lo que el arranque suma alrededor: quién es, el CRM, el teléfono y el cierre.
// Las reglas (en qué etapa está, qué se acepta como respuesta) son puras: lib/onboarding-arranque.ts.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { wsDelOnboarding } from '@/lib/onboarding-guard';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { desbloquearOnboarding, frenoDeArranque } from '@/lib/onboarding-guardia-server';
import { borrarSettingSi, cambiarSettingSi, getSettingEstricto } from '@/lib/settings';
import { getContactoReportes, getPerfil, setContactoReportes } from '@/lib/perfil';
import { setDiagnosticoFase } from '@/lib/fase-store';
import { asegurarGrupoMaKo, estadoVerificacionEntrante, getGrupoJidMaKo, pedirMensajeDeVerificacion, verificarCodigoContacto } from '@/lib/mako-grupo';
import { leerSesion } from '@/lib/offer-sesiones';
import { idDelFunnelDefault } from '@/lib/funnels';
import { estaImpersonando } from '@/lib/workspace';
import { getEstadoOnboarding } from '@/lib/onboarding-state';
import { chartKeyDePersona } from '@/lib/mako-turno-app-reglas';
import { AVISOS_SIN_SOPORTE } from '@/lib/avisos-telefono-reglas';
import { CODIGO_CARGADO, MENSAJE_MANDADO, etapaDeArranque, leerRespuesta, mensajesDeArranque, pisaElNombreDelPerfil, telefonoEscrito, type EstadoArranque } from '@/lib/onboarding-arranque';
import { loQueContesto } from '@/lib/onboarding-historial';
import {
  FaltaParaCerrar, anotarRespuesta, asegurarFunnelPrincipal, hechosConfirmados, cerrarArranque, hiloDelOnboarding, guardarEstadoArranque, guardarNombre, guardarNombreNegocio,
  hechosDelArranque, propuestaDeCrm, sembrarCrmPrincipal, vistaArranque,
} from '@/lib/onboarding-arranque-server';

export const dynamic = 'force-dynamic';
// El CRM a medida le pide a la IA al llegar a su pregunta (`propuestaDeCrm`, con su plazo de 45 s).
export const maxDuration = 120;

/** El reclamo del cierre: más que `maxDuration`, para que no venza con el otro todavía corriendo. */
const CLAVE_CERRANDO = 'onboarding.cerrando';
const VENCE_CIERRE_MS = 3 * 60_000;

const no = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lo guardado, leído ESTRICTO (una lectura caída tira: decidir sobre `{}` haría preguntar todo de nuevo). */
async function estadoEstricto(): Promise<EstadoArranque> {
  const raw = await getSettingEstricto('onboarding.arranque');
  if (!raw) return {};
  try { return JSON.parse(raw) as EstadoArranque; } catch { return {}; }
}

export async function GET() {
  const g = await wsDelOnboarding();
  if ('error' in g) return no(g.status, g.error);
  try {
    return NextResponse.json({ ok: true, vista: await vistaArranque() });
  } catch (e) {
    return no(500, msg(e));
  }
}

export async function POST(req: NextRequest) {
  const g = await wsDelOnboarding();
  if ('error' in g) return no(g.status, g.error);
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return no(400, 'body inválido'); }
  // Lo que la respuesta dejó dibujado queda en el historial del onboarding (21/10/2026, lib/onboarding-historial.ts).
  // Con el onboarding ya terminado sólo anota el POST que lo cierra: un POST viejo no le suma variantes (segunda revisión).
  const listo = async (extra: Record<string, unknown> = {}, o: { cierre?: boolean } = {}) =>
    NextResponse.json({ ok: true, ...extra, vista: await vistaArranque({ anotar: o.cierre ? 'cierre' : true }) });
  // Quién escribe, SÓLO para la guardia (la ráfaga por usuario): nunca para los datos del negocio (el contacto de los
  // reportes es el del negocio, ver 'telefono').
  const usuarioGuardia = (await getUsuarioActual().catch(() => null))?.email ?? null;
  // Prepara el pedido para el WhatsApp que dio (desde su tarjeta o escrito en la caja del chat): la persona le escribe a MaKo, MaKo no le escribe.
  const pedirCodigo = async (e: EstadoArranque, h: Awaited<ReturnType<typeof hechosDelArranque>>, confirmado: Awaited<ReturnType<typeof hechosConfirmados>>, digitos: string) => {
    // El contacto de los reportes es el del NEGOCIO: lo que ya tenía guardado, o el email del admin
    // del negocio (el perfil que se está mirando). Nunca el de quien está logueado: el super admin o
    // una agencia que hacen el arranque mirando al cliente se quedaban con sus reportes.
    const [previo, perfil] = await Promise.all([getContactoReportes().catch(() => null), getPerfil().catch(() => null)]);
    await setContactoReportes({
      // El nombre del PERFIL si es uno de verdad (sexta revisión, 21/10: lo leído sin toque, «Cómo Estás», llegaba a los
      // reportes); con el perfil en un email, el perfil ya tiene el confirmado con el toque.
      nombre: previo?.nombre || (!pisaElNombreDelPerfil(perfil?.nombre) ? perfil?.nombre : '') || e.nombre || undefined,
      email: previo?.email || perfil?.email || undefined,
      telefono: digitos,
    });
    // Sin el negocio todavía (el WhatsApp va primero): vacío, y el grupo nace con el nombre del workspace (`verificarCodigoContacto`).
    const r = await pedirMensajeDeVerificacion(g.ws, digitos, e.negocio || '');
    if (!r.ok) return no(422, r.error);
    await guardarEstadoArranque({ telefono: r.yaVerificado ? 'verificado' : 'codigo', telefonoNumero: `+${digitos}`, telefonoEntrante: r.yaVerificado ? undefined : true });
    await anotarRespuesta(e, h, `+${digitos}`, confirmado);
    // Ya verificado: la conversación dibuja el código como cargado sin pedirlo, y ésa es su respuesta (segunda revisión).
    if (r.yaVerificado) await anotarRespuesta({ ...e, telefono: 'verificado', telefonoNumero: `+${digitos}` }, h, CODIGO_CARGADO, confirmado);
    return listo();
  };

  try {
    switch (body.action) {
      case 'intro': {
        await guardarEstadoArranque({ introVista: true });
        return listo();
      }

      case 'responder': {
        const e = await estadoEstricto();
        const h = await hechosDelArranque(e);
        // Para el historial, ANTES de escribir nada (la respuesta que cierra la fase guarda el diagnóstico que se compara).
        const confirmado = await hechosConfirmados(h);
        const etapa = etapaDeArranque(e, h);
        const texto = typeof body.texto === 'string' ? body.texto : undefined;
        const opcion = typeof body.opcion === 'number' ? body.opcion : undefined;
        const opcionTexto = typeof body.opcionTexto === 'string' ? body.opcionTexto : undefined;
        // La pregunta que contesta (cuarta revisión, 21/10): un toque viejo no confirma una lectura que no vio.
        const pregunta = typeof body.pregunta === 'string' ? body.pregunta.slice(0, 2_000) : undefined;

        // ⛔ La guardia (17/10/2026): la ráfaga, el bloqueo y el troleo, antes de anotar nada. Una opción tocada no
        // se mira (la escribió MaKo); lo escrito, sí.
        const freno = await frenoDeArranque({ req, ws: g.ws, usuario: usuarioGuardia, texto: opcion === undefined ? texto : undefined });
        if (freno) return NextResponse.json({ ok: false, error: freno.error, ...(freno.bloqueado ? { bloqueado: true } : {}), vista: await vistaArranque() }, { status: freno.status });

        // El código del WhatsApp: se verifica contra lo que MaKo mandó (lib/mako-grupo.ts).
        if (etapa === 'codigo' && texto && /^\D*\d{6}\D*$/.test(texto)) {
          const r = await verificarCodigoContacto(g.ws, texto.replace(/\D/g, ''));
          if (!r.ok) return no(422, r.error);
          await guardarEstadoArranque({ telefono: 'verificado' });
          // El código no se guarda: queda lo que dibuja la conversación.
          await anotarRespuesta(e, h, CODIGO_CARGADO, confirmado);
          return listo();
        }

        // El WhatsApp escrito en la caja vale igual que el de la tarjeta.
        const escrito = etapa === 'telefono' && opcion === undefined && texto ? telefonoEscrito(texto) : null;
        if (escrito) return await pedirCodigo(e, h, confirmado, escrito);

        const lectura = leerRespuesta(e, h, { texto, opcion, opcionTexto, pregunta });
        // La pregunta cambió (una pestaña vieja): no se anota nada y vuelve la conversación de HOY.
        if (!lectura.ok && lectura.cambio) return NextResponse.json({ ok: false, error: lectura.error, vista: await vistaArranque() }, { status: 409 });
        if (!lectura.ok) return no(422, lectura.error);
        // Quién contesta el onboarding (20/10/2026, revisión del Cerebro): el chat «Onboarding» es para esa persona, no para
        // otro admin que entre primero al Ops Center. Se anota con su primera respuesta, nunca mirando como super admin.
        const dueno = !e.dueno && !(await estaImpersonando().catch(() => true)) ? (await getUsuarioActual().then((p) => (p ? chartKeyDePersona(p) : null)).catch(() => null)) : null;
        const patch = { ...lectura.patch, ...(dueno ? { dueno } : {}) };

        // El CRM se siembra ANTES de guardar la elección: si la siembra falla, la pregunta sigue abierta.
        let aviso: string | undefined;
        if (patch.crmTipo) {
          const r = await sembrarCrmPrincipal(patch.crmTipo, e.negocio ?? '', e.crmPropuesta?.tipo === patch.crmTipo ? e.crmPropuesta.etapas : undefined);
          aviso = r.aviso;
        }
        // El diagnóstico, al contestar la última pregunta: todo en modo 'plan'; en 'oferta', lo que faltó
        // después de armar la oferta (el canal puede venir de lo que contestó en la conversación de Offer).
        if (lectura.fase) await setDiagnosticoFase(lectura.fase, lectura.faseCanal ?? patch.canal ?? e.canal);
        if (patch.nombre) await guardarNombre(patch.nombre);
        if (patch.negocio) await guardarNombreNegocio(patch.negocio);
        // El WhatsApp va primero (30/10/2026): su contacto y su grupo nacieron antes de saber estos dos nombres.
        if (patch.nombre) {
          const c = await getContactoReportes().catch(() => null);
          if (c?.telefono && !c.nombre) await setContactoReportes({ ...c, nombre: patch.nombre }).catch(() => {});
        }
        if (patch.negocio && (await getGrupoJidMaKo(g.ws).catch(() => null))) await asegurarGrupoMaKo(g.ws, { nombre: patch.negocio }).catch(() => {});
        const nuevo = await guardarEstadoArranque(patch);
        // Lo que contestó, TAL CUAL, en el historial del onboarding (lib/onboarding-historial.ts): con lo dibujado se perdía
        // el toque de cada confirmación («Sí, se llama así»), porque la pantalla muestra el dato confirmado.
        await anotarRespuesta(e, h, loQueContesto(mensajesDeArranque(e, h), { texto, opcion }), confirmado);
        // Al entrar a la oferta, la conversación nace en el funnel principal: que exista.
        if (h.modo === 'oferta' && etapaDeArranque(nuevo, h) === 'oferta') await asegurarFunnelPrincipal().catch(() => {});
        // El CRM a medida (20/10/2026, pedido del 18/10, punto 10): al pasar del PDF o de la fase a la pregunta del CRM, MaKo lo
        // arma UNA vez con lo que vende. Los hechos se releen: la última respuesta de la fase recién guardó el diagnóstico.
        if (h.conCrm && (etapa === 'pdf' || etapa === 'cobro' || etapa === 'fase') && nuevo.crmPropuesta === undefined && !nuevo.crmTipo) {
          const h2 = await hechosDelArranque(nuevo);
          if (etapaDeArranque(nuevo, h2) === 'crm') await guardarEstadoArranque({ crmPropuesta: await propuestaDeCrm(nuevo, h2.canalNegocio).catch(() => null) });
        }
        return listo(aviso ? { aviso } : {});
      }

      case 'sesion': {
        const id = typeof body.sesionId === 'number' && Number.isInteger(body.sesionId) ? body.sesionId : null;
        if (id == null) return no(400, 'Falta la conversación.');
        // La conversación tiene que ser de ESTE negocio (leerSesion lee con el workspace del pedido) y estar
        // en su funnel principal: es la que se vuelve su oferta y su primer CRM.
        const [s, funnelDefault] = await Promise.all([leerSesion(id), idDelFunnelDefault().catch(() => null)]);
        if (!s) return no(404, 'No encontré esa conversación.');
        if (funnelDefault != null && s.funnelId !== funnelDefault) return no(409, 'Esa conversación no es la de tu funnel principal.');
        await guardarEstadoArranque({ sesionId: id });
        return listo();
      }

      case 'telefono': {
        // Cada pedido arma un código: la ráfaga y el bloqueo también valen acá.
        const frenoTel = await frenoDeArranque({ req, ws: g.ws, usuario: usuarioGuardia });
        if (frenoTel) return NextResponse.json({ ok: false, error: frenoTel.error, ...(frenoTel.bloqueado ? { bloqueado: true } : {}), vista: await vistaArranque() }, { status: frenoTel.status });
        const e = await estadoEstricto();
        const h = await hechosDelArranque(e);
        const confirmado = await hechosConfirmados(h);
        // «Pedir otro» desde la tarjeta del mensaje (venció, o no se pudo armar): otro código para el mismo número, sin anotar otra respuesta.
        if (etapaDeArranque(e, h) === 'codigo' && e.telefonoEntrante && e.telefonoNumero) {
          const r = await pedirMensajeDeVerificacion(g.ws, e.telefonoNumero.replace(/\D/g, ''), e.negocio || '');
          if (!r.ok) return no(422, r.error);
          if (r.yaVerificado) await guardarEstadoArranque({ telefono: 'verificado' });
          return listo();
        }
        if (etapaDeArranque(e, h) !== 'telefono') return no(409, 'Ahora no estoy esperando tu teléfono.');
        const crudo = typeof body.telefono === 'string' ? body.telefono : '';
        const digitos = crudo.replace(/\D/g, '');
        if (digitos.length < 8) return no(422, 'Escribe tu número completo, con el código de país.');
        return await pedirCodigo(e, h, confirmado, digitos);
      }

      // ¿Ya llegó su mensaje por WhatsApp? Lo confirma el webhook (lib/mako-grupo.ts → confirmarPorMensajeEntrante); acá sólo
      // se lee y, si llegó, la conversación avanza. Sin novedad contesta corto: la pantalla lo pregunta cada pocos segundos.
      case 'whatsapp': {
        const e = await estadoEstricto();
        if (e.telefono !== 'codigo' || !e.telefonoEntrante) return NextResponse.json({ ok: true, sigue: false });
        const v = await estadoVerificacionEntrante(g.ws);
        if (v?.estado !== 'verificado') return NextResponse.json({ ok: true, sigue: true, whatsapp: v });
        const h = await hechosDelArranque(e);
        const confirmado = await hechosConfirmados(h);
        // El número que lo mandó es el que quedó probado (`decidirLlegada` exige que sea el mismo que dio).
        await guardarEstadoArranque({ telefono: 'verificado' });
        await anotarRespuesta(e, h, MENSAJE_MANDADO, confirmado);
        return listo();
      }

      // El paso de los avisos: que estén activados se MIDE (`avisosDeQuienEntra`), así que releer ya lo hace avanzar. «Mi teléfono no puede» es lo único que se guarda.
      case 'avisos': {
        const e = await estadoEstricto();
        const h = await hechosDelArranque(e);
        if (body.sinSoporte === true && etapaDeArranque(e, h) === 'avisos') {
          const confirmado = await hechosConfirmados(h);
          await guardarEstadoArranque({ avisos: 'sin-soporte' });
          await anotarRespuesta(e, h, AVISOS_SIN_SOPORTE, confirmado);
        }
        return listo();
      }

      // Que exista el funnel principal antes de abrir la conversación de la oferta (la pantalla lo pide
      // cuando le falta: si el intento de cuando contestó el objetivo falló, esto lo reintenta).
      case 'preparar': {
        await asegurarFunnelPrincipal();
        return listo();
      }

      // El chat «Onboarding» del Ops Center con esta conversación, tal cual (20/10/2026): la pantalla lo pide al terminar
      // y entra a él. Una sola vez (lib/onboarding-arranque-server.ts → hiloDelOnboarding).
      case 'hilo': {
        // Sólo con el onboarding TERMINADO (20/10/2026, revisión del Cerebro): una pestaña vieja o un POST a mano lo armaban
        // con la conversación a medias, y la proyección de Offer escondía después la de verdad.
        if ((await getEstadoOnboarding()).status !== 'done') return NextResponse.json({ ok: true, chat: null });
        return NextResponse.json({ ok: true, chat: await hiloDelOnboarding() });
      }

      // El super admin, mirando a un cliente bloqueado por la guardia, lo desbloquea desde el mismo onboarding.
      case 'desbloquear': {
        if (!(await getSesionAdmin())) return no(403, 'Solo el equipo de MaKo puede desbloquear un onboarding.');
        await desbloquearOnboarding();
        return listo();
      }

      case 'cerrar': {
        // ⚠️ DOS DISPOSITIVOS A LA VEZ (3/11/2026): con el paso de los avisos, el teléfono activa y la computadora lo ve a los 4 segundos, así que los dos llegan al cierre juntos.
        // `cerrarArranque` no es atómico: dos a la vez dejaban la oferta y el producto repetidos. Gana uno; el otro relee hasta verlo terminado. Vence solo: si el que ganó murió, se puede volver a intentar.
        const marca = new Date().toISOString();
        const previa = await getSettingEstricto(CLAVE_CERRANDO);
        const vigente = !!previa && Date.now() - Date.parse(previa) < VENCE_CIERRE_MS;
        if (vigente || !(await cambiarSettingSi(CLAVE_CERRANDO, previa, marca))) return NextResponse.json({ ok: true, enCurso: true, vista: await vistaArranque() });
        try {
          const r = await cerrarArranque();
          return listo(r.avisos.length ? { aviso: r.avisos.join(' ') } : {}, { cierre: true });
        } finally {
          await borrarSettingSi(CLAVE_CERRANDO, marca).catch(() => {});
        }
      }

      default:
        return no(400, 'acción desconocida');
    }
  } catch (e) {
    if (e instanceof FaltaParaCerrar) return no(409, e.message);
    return no(500, msg(e));
  }
}
