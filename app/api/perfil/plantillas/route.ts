// =============================================================================
// /api/perfil/plantillas — los mensajes de MaKo, pero del CLIENTE
// =============================================================================
// El MISMO protocolo que `/api/admin/plantillas`, con otro guard: allá manda
// `getSesionAdmin()` (el super-admin de la agencia), acá el admin del WORKSPACE.
// Dos guards porque son dos preguntas distintas: quién puede tocar los mensajes
// de la agencia, y quién puede tocar los del negocio que está mirando.
//
// El protocolo se mantiene IDÉNTICO a propósito: así `PlantillasView` —la
// pantalla de /mensajes, con su lista y su chat— se monta en la tab de
// Notificaciones cambiando una prop, sin una segunda copia del componente que se
// quedaría vieja en la primera edición.
//
// Lo que hace que esto sea seguro es que `lib/plantillas.ts` ya es POR WORKSPACE
// con lo del dueño como default heredado (commit 13b53c71): escribe siempre en el
// workspace actual, así que un cliente no le puede cambiar el texto a otro.

import { NextResponse, type NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import {
  listarPlantillas, getPlantilla, setTextoPlantilla, setEnabledPlantilla, setCanalesPlantilla, setFrecuenciaPlantilla, setPosicionesPlantilla,
  borrarPlantilla, crearPlantilla, generarMensajeAviso, getFlujo, setFlujo, resetTextoPlantilla,
  setTituloPlantilla, setAsuntoPlantilla, setCategoriaPlantilla, setBorradorPlantilla, publicarBorrador,
} from '@/lib/plantillas';
import { getProgramado, setProgramado, NoAgendable } from '@/lib/avisos-programados';
import { acusesDe, setAcuses } from '@/lib/insistencias';

import { esFlujoValido } from '@/lib/flujos-tipos';
import { sanearFrecuencia } from '@/lib/disparador-mensaje';
import { seEditaElTexto, esAvisoSoloSuperAdmin, CATEGORIAS_AVISO, type CategoriaAviso } from '@/lib/avisos-catalogo';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Admin del workspace: decide qué mensajes salen por la línea de SU negocio. */
async function denegado(): Promise<NextResponse | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Solo el administrador del workspace puede editar los mensajes.' }, { status: 403 });
  }
  return null;
}

/**
 * LOS AVISOS DEL SUPER ADMIN (`AVISOS_SOLO_SUPERADMIN`, lib/avisos-catalogo.ts: la caída y la vuelta del
 * WhatsApp, la grabación de Fathom) no los toca el admin del NEGOCIO: 404, no 403 (a quien no le corresponde,
 * no existe). El super admin pasa — mirando un cliente sigue siendo admin de plataforma —, aunque su lugar
 * para configurarlos es /mensajes (/api/admin/plantillas). Esconderlos de la lista no alcanzaba: un POST con el
 * id los prendía y apagaba igual.
 */
async function soloDelSuperAdmin(id: string | null | undefined): Promise<NextResponse | null> {
  if (!id || !esAvisoSoloSuperAdmin(id) || (await getSesionAdmin())) return null;
  return NextResponse.json({ ok: false, error: 'no existe' }, { status: 404 });
}

export async function GET(req: NextRequest) {
  const no = await denegado();
  if (no) return no;
  try {
    const id = new URL(req.url).searchParams.get('id');
    const ajeno = await soloDelSuperAdmin(id);
    if (ajeno) return ajeno;
    if (id) return NextResponse.json({ ok: true, plantilla: await getPlantilla(id) });
    return NextResponse.json({ ok: true, plantillas: await listarPlantillas() });
  } catch (e) {
    console.error(`[api:perfil/plantillas GET] ${msg(e)}`);
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const no = await denegado();
  if (no) return no;
  let b: {
    action?: string; id?: string; texto?: string; enabled?: boolean; canales?: { wa?: boolean; email?: boolean }; contexto?: string;
    titulo?: string; asunto?: string; categoria?: CategoriaAviso; requiereRespuesta?: boolean; flujo?: unknown;
    frecuenciaMin?: number;
    posiciones?: Record<string, { x: number; y: number }>;
    cron?: unknown;
    acuses?: unknown;
  };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  // ANTES del switch: vale para TODAS las acciones con id (texto, prender, canales, frecuencia, el lienzo…).
  const ajeno = await soloDelSuperAdmin(b.id);
  if (ajeno) return ajeno;

  const faltaId = () => NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });

  /**
   * El TEXTO de un aviso administrativo no lo toca el cliente: son hechos
   * técnicos y exactos (Meta deshabilitó la cuenta, la plantilla se aprobó) y
   * lo que valen es la precisión. El guard va en el SERVIDOR y no sólo en la
   * pantalla: esconder el campo no impide un POST.
   *
   * Prender y apagar SÍ es suyo: elige qué recibe, no qué dice.
   */
  // ⚠️ Y TAMPOCO EL DE UN AVISO CUYO TEXTO ARMA EL CÓDIGO (sexta tanda, 09/10/2026): siete de los ocho
  // del cliente mandan un texto armado con lo que se midió y no leen la plantilla, así que editarla
  // no cambiaba nada de lo que llega. `seEditaElTexto` es la MISMA pregunta que hace el editor.
  const esAdministrativo = (id: string) => !seEditaElTexto(id);
  const noEditable = () => NextResponse.json(
    { ok: false, error: 'Este aviso lo redacta MaKo con lo que pasa cada vez: su texto no se edita.' },
    { status: 403 },
  );
  try {
    switch (b.action) {
      case 'crear': {
        const p = await crearPlantilla({
          titulo: b.titulo ?? '', categoria: b.categoria ?? 'aviso',
          requiereRespuesta: b.requiereRespuesta, texto: b.texto,
        });
        return NextResponse.json({ ok: true, plantilla: p });
      }
      case 'texto':
        if (!b.id) return faltaId();
        if (esAdministrativo(b.id)) return noEditable();
        await setTextoPlantilla(b.id, b.texto ?? '');
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      // «Volver al original» = BORRAR mi texto y volver a heredar el del dueño.
      // Escribir '' no alcanza: pisaría el suyo y caería al ejemplo de fábrica.
      case 'reset':
        if (!b.id) return faltaId();
        if (esAdministrativo(b.id)) return noEditable();
        await resetTextoPlantilla(b.id);
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      case 'enabled':
        if (!b.id) return faltaId();
        await setEnabledPlantilla(b.id, b.enabled !== false);
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      case 'canales': {
        if (!b.id) return faltaId();
        // Elegir POR DÓNDE le llega un mensaje es suyo, igual que prenderlo o apagarlo:
        // no cambia lo que el mensaje DICE. Por eso no pasa por `esAdministrativo`, que
        // protege el texto de los avisos que redacta MaKo.
        const c = (b.canales ?? {}) as { wa?: unknown; email?: unknown };
        await setCanalesPlantilla(b.id, {
          ...(typeof c.wa === 'boolean' ? { wa: c.wa } : {}),
          ...(typeof c.email === 'boolean' ? { email: c.email } : {}),
        });
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      }
      case 'frecuencia': {
        if (!b.id) return faltaId();
        // CADA CUÁNTO es suyo, igual que el canal y el interruptor: no cambia lo que el
        // mensaje DICE, así que no pasa por `esAdministrativo`. Y no puede producir uno de
        // más — el choke point toma el MAYOR entre esto y lo que pide el call site.
        await setFrecuenciaPlantilla(b.id, sanearFrecuencia(b.frecuenciaMin));
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      }
      case 'posiciones': {
        if (!b.id) return faltaId();
        // DÓNDE puso cada tarjeta es suyo, como el canal y la frecuencia: no cambia
        // lo que el mensaje dice ni a quién le llega. El saneo de los números vive en
        // `setPosicionesPlantilla`, que es la única puerta al store.
        await setPosicionesPlantilla(b.id, b.posiciones ?? {});
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      }
      /**
       * EL BORRADOR Y PUBLICAR pasan por el MISMO guard que `texto`: cambian lo
       * que el mensaje DICE. Guardar sin publicar no lo vuelve inocuo — el
       * borrador es el texto que se va a publicar, y si el aviso lo redacta MaKo
       * no se edita ni en borrador.
       */
      case 'borrador':
        if (!b.id) return faltaId();
        if (esAdministrativo(b.id)) return noEditable();
        await setBorradorPlantilla(b.id, b.texto ?? '');
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      case 'publicar': {
        if (!b.id) return faltaId();
        if (esAdministrativo(b.id)) return noEditable();
        const publico = await publicarBorrador(b.id);
        return NextResponse.json({ ok: true, publico, plantilla: await getPlantilla(b.id) });
      }
      case 'asunto':
        if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
        await setAsuntoPlantilla(b.id, b.asunto ?? '');
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      case 'titulo':
        if (!b.id) return faltaId();
        // CÓMO LO LLAMA en su lista es suyo, como el canal: no cambia lo que el
        // mensaje dice ni a quién le llega, y el `id` sigue siendo el mismo — así
        // que no pasa por `esAdministrativo`.
        await setTituloPlantilla(b.id, b.titulo ?? '');
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      case 'categoria':
        if (!b.id) return faltaId();
        if (!CATEGORIAS_AVISO.includes(b.categoria as CategoriaAviso)) return NextResponse.json({ ok: false, error: 'categoría inválida' }, { status: 400 });
        await setCategoriaPlantilla(b.id, b.categoria as CategoriaAviso);
        return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
      /**
       * EL CRON POR TIEMPO. Es suyo, como el canal y el interruptor: decide CUÁNDO
       * le llega, no qué dice. El saneo y el tope viven en `sanearCron`, que es la
       * única puerta, y la zona la resuelve y la congela `setProgramado`.
       *
       * ⚠️ Y mandar `cron: null` DESAGENDA — es como se elige «que lo dispare una
       * acción» o «a mano» sin dejar la fila vencida, que el drenador leería en
       * cada tick para siempre.
       */
      case 'cron-get':
        if (!b.id) return faltaId();
        return NextResponse.json({ ok: true, programado: await getProgramado(b.id) });
      case 'cron-set':
        if (!b.id) return faltaId();
        // Un texto de ejemplo no se agenda: es un 400 con el motivo, no el 500 de una
        // escritura que falló (ver `motivoNoAgendable` en lib/cron-aviso.ts).
        try { return NextResponse.json({ ok: true, programado: await setProgramado(b.id, b.cron ?? null) }); }
        catch (e) { if (e instanceof NoAgendable) return NextResponse.json({ ok: false, error: e.message }, { status: 400 }); throw e; }
      /**
       * LAS PALABRAS QUE CORTAN LOS RECORDATORIOS. Son del NEGOCIO —el webhook que
       * las compara recibe un mensaje del grupo y no sabe a cuál de los avisos le
       * está contestando— así que valen para todos sus mensajes, y la pantalla lo
       * dice donde se editan. No pasan por `esAdministrativo`: eligen CUÁNDO deja de
       * insistir, no qué dice el mensaje.
       */
      case 'acuses-get': {
        const ws = await getWorkspaceActual();
        return NextResponse.json({ ok: true, acuses: ws == null ? [] : await acusesDe(ws) });
      }
      case 'acuses-set': {
        const ws = await getWorkspaceActual();
        if (ws == null) return NextResponse.json({ ok: false, error: 'sin workspace' }, { status: 400 });
        return NextResponse.json({ ok: true, acuses: await setAcuses(ws, b.acuses) });
      }
      case 'borrar':
        if (!b.id) return faltaId();
        return NextResponse.json({ ok: true, ...(await borrarPlantilla(b.id)) });
      case 'probar':
        if (!b.id) return faltaId();
        return NextResponse.json({ ok: true, texto: await generarMensajeAviso(b.id, b.contexto || 'Usa datos de ejemplo realistas.') });
      case 'flujo-get':
        if (!b.id) return faltaId();
        return NextResponse.json({ ok: true, flujo: await getFlujo(b.id) });
      case 'flujo-set': {
        if (!b.id) return faltaId();
        // El flujo que contesta sale de la MISMA escritura, no de una relectura: era la
        // cuarta ida a la misma fila en un solo POST.
        return NextResponse.json({ ok: true, flujo: await setFlujo(b.id, esFlujoValido(b.flujo) ? b.flujo : null) });
      }
      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    console.error(`[api:perfil/plantillas POST] ${msg(e)}`);
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
