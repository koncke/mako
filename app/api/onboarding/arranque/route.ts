// =============================================================================
// /api/onboarding/arranque — el chat de arranque (el onboarding de MaKo es una conversación)
// =============================================================================
// GET  → { ok, vista }                       lo que la pantalla dibuja (lib/onboarding-arranque-server.ts)
// POST → { action: 'intro' }                 ya vio la animación del principio
//        { action: 'responder', texto?, opcion? }   la respuesta a la pregunta de la etapa actual
//        { action: 'sesion', sesionId }      la conversación de la oferta que se abrió en el funnel principal
//        { action: 'telefono', telefono }    manda el código por WhatsApp
//        { action: 'cerrar' }                deja escrito el perfil, el producto y la oferta, y cierra los pasos
//
// La conversación de la OFERTA no pasa por acá: va por /api/offer (turnos, archivos, armar la oferta), la
// misma de la tab. Acá sólo lo que el arranque suma alrededor: quién es, el CRM, el teléfono y el cierre.
// Las reglas (en qué etapa está, qué se acepta como respuesta) son puras: lib/onboarding-arranque.ts.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { wsDelOnboarding } from '@/lib/onboarding-guard';
import { getUsuarioActual } from '@/lib/auth';
import { getSettingEstricto } from '@/lib/settings';
import { setContactoReportes } from '@/lib/perfil';
import { setDiagnosticoFase } from '@/lib/fase-store';
import { enviarCodigoVerificacion, verificarCodigoContacto } from '@/lib/mako-grupo';
import { leerSesion } from '@/lib/offer-sesiones';
import { idDelFunnelDefault } from '@/lib/funnels';
import { etapaDeArranque, leerRespuesta, type EstadoArranque } from '@/lib/onboarding-arranque';
import {
  FaltaParaCerrar, asegurarFunnelPrincipal, cerrarArranque, guardarEstadoArranque, guardarNombre, guardarNombreNegocio,
  hechosDelArranque, sembrarCrmPrincipal, vistaArranque,
} from '@/lib/onboarding-arranque-server';

export const dynamic = 'force-dynamic';

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
  const listo = async (extra: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...extra, vista: await vistaArranque() });

  try {
    switch (body.action) {
      case 'intro': {
        await guardarEstadoArranque({ introVista: true });
        return listo();
      }

      case 'responder': {
        const e = await estadoEstricto();
        const h = await hechosDelArranque(e);
        const etapa = etapaDeArranque(e, h);
        const texto = typeof body.texto === 'string' ? body.texto : undefined;
        const opcion = typeof body.opcion === 'number' ? body.opcion : undefined;

        // El código del WhatsApp: se verifica contra lo que MaKo mandó (lib/mako-grupo.ts).
        if (etapa === 'codigo' && texto && /^\D*\d{6}\D*$/.test(texto)) {
          const r = await verificarCodigoContacto(g.ws, texto.replace(/\D/g, ''));
          if (!r.ok) return no(422, r.error);
          await guardarEstadoArranque({ telefono: 'verificado' });
          return listo();
        }

        const lectura = leerRespuesta(e, h, { texto, opcion });
        if (!lectura.ok) return no(422, lectura.error);
        const patch = lectura.patch;

        // El CRM se siembra ANTES de guardar la elección: si la siembra falla, la pregunta sigue abierta.
        let aviso: string | undefined;
        if (patch.crmTipo) {
          const r = await sembrarCrmPrincipal(patch.crmTipo, e.negocio ?? '');
          aviso = r.aviso;
        }
        // El diagnóstico del modo 'plan', al contestar la última pregunta.
        if (lectura.fase) await setDiagnosticoFase(lectura.fase, patch.canal ?? e.canal);
        if (patch.nombre) await guardarNombre(patch.nombre);
        if (patch.negocio) await guardarNombreNegocio(patch.negocio);
        const nuevo = await guardarEstadoArranque(patch);
        // Al entrar a la oferta, la conversación nace en el funnel principal: que exista.
        if (h.modo === 'oferta' && etapaDeArranque(nuevo, h) === 'oferta') await asegurarFunnelPrincipal().catch(() => {});
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
        const e = await estadoEstricto();
        const h = await hechosDelArranque(e);
        if (etapaDeArranque(e, h) !== 'telefono') return no(409, 'Ahora no estoy esperando tu teléfono.');
        const crudo = typeof body.telefono === 'string' ? body.telefono : '';
        const digitos = crudo.replace(/\D/g, '');
        if (digitos.length < 8) return no(422, 'Escribe tu número completo, con el código de país.');
        const usuario = await getUsuarioActual().catch(() => null);
        await setContactoReportes({ nombre: e.nombre || undefined, email: usuario?.email || undefined, telefono: digitos });
        const r = await enviarCodigoVerificacion(g.ws, digitos, e.negocio || 'tu negocio');
        if (!r.ok) return no(422, r.error);
        await guardarEstadoArranque({ telefono: r.yaVerificado ? 'verificado' : 'codigo', telefonoNumero: `+${digitos}` });
        return listo();
      }

      case 'cerrar': {
        const r = await cerrarArranque();
        return listo(r.avisos.length ? { aviso: r.avisos.join(' ') } : {});
      }

      default:
        return no(400, 'acción desconocida');
    }
  } catch (e) {
    if (e instanceof FaltaParaCerrar) return no(409, e.message);
    return no(500, msg(e));
  }
}
