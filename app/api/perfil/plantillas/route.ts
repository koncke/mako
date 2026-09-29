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
  listarPlantillas, getPlantilla, setTextoPlantilla, setEnabledPlantilla,
  borrarPlantilla, crearPlantilla, generarMensajeAviso, getFlujo, setFlujo, resetTextoPlantilla,
} from '@/lib/plantillas';
import { esFlujoValido } from '@/lib/flujos-tipos';
import { CATALOGO_AVISOS, type CategoriaAviso } from '@/lib/avisos-catalogo';

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

export async function GET(req: NextRequest) {
  const no = await denegado();
  if (no) return no;
  try {
    const id = new URL(req.url).searchParams.get('id');
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
    action?: string; id?: string; texto?: string; enabled?: boolean; contexto?: string;
    titulo?: string; categoria?: CategoriaAviso; requiereRespuesta?: boolean; flujo?: unknown;
  };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const faltaId = () => NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });

  /**
   * El TEXTO de un aviso administrativo no lo toca el cliente: son hechos
   * técnicos y exactos (Meta deshabilitó la cuenta, la plantilla se aprobó) y
   * lo que valen es la precisión. El guard va en el SERVIDOR y no sólo en la
   * pantalla: esconder el campo no impide un POST.
   *
   * Prender y apagar SÍ es suyo: elige qué recibe, no qué dice.
   */
  const esAdministrativo = (id: string) => CATALOGO_AVISOS.find((c) => c.id === id)?.soloSuperAdmin === true;
  const noEditable = () => NextResponse.json(
    { ok: false, error: 'Este aviso lo redacta MaKo y no se puede editar: informa algo técnico y tiene que decir exactamente lo que pasó.' },
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
        await setFlujo(b.id, esFlujoValido(b.flujo) ? b.flujo : null);
        return NextResponse.json({ ok: true, flujo: await getFlujo(b.id) });
      }
      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    console.error(`[api:perfil/plantillas POST] ${msg(e)}`);
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
