// =============================================================================
// /api/admin/plantillas — CRUD de plantillas de aviso (editar/activar/crear/borrar)
// =============================================================================
// Solo admin. GET → lista completa (catálogo + custom, con enabled). GET ?id →
// una. GET ?ocultos=1 → los que el store eliminó de su lista. POST { action }: 'texto' |
// 'enabled' | 'reset' | 'crear' | 'borrar' | 'ocultar' | 'restaurar' | 'probar' (genera
// un ejemplo con IA desde la referencia) y las del lienzo.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  listarPlantillas, getPlantilla, setTextoPlantilla, setEnabledPlantilla, setCanalesPlantilla, setFrecuenciaPlantilla, setPosicionesPlantilla,
  borrarPlantilla, crearPlantilla, generarMensajeAviso, getFlujo, setFlujo,
  setTituloPlantilla, setAsuntoPlantilla, setCategoriaPlantilla, setBorradorPlantilla, publicarBorrador,
  ocultarPlantilla, restaurarPlantilla, conLaBaseDeLaPlataforma,
} from '@/lib/plantillas';
import { getProgramado, setProgramado, NoAgendable } from '@/lib/avisos-programados';
import { acusesDe, setAcuses } from '@/lib/insistencias';
import { getWorkspaceActual, wsSuperAdmin } from '@/lib/workspace';
import { CATEGORIAS_AVISO, type CategoriaAviso } from '@/lib/avisos-catalogo';
import { esFlujoValido } from '@/lib/flujos-tipos';
import { sanearFrecuencia } from '@/lib/disparador-mensaje';
import { PARAM_OCULTOS } from '@/lib/plantillas-ocultas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/**
 * EN EL WORKSPACE DE LA PLATAFORMA, /mensajes edita la BASE que heredan todos los negocios (decisión de Martín,
 * 10/10/2026: «Separar la base», lib/plantillas.ts → `KEY_BASE`); en el de un cliente que el super admin está
 * mirando, el store de ése, como siempre. El «MaKo en WhatsApp» del ws9 (/api/perfil/plantillas) edita su store.
 */
async function enSuStore<T>(fn: () => Promise<T>): Promise<T> {
  const [ws, base] = await Promise.all([getWorkspaceActual(), wsSuperAdmin()]);
  return ws === base ? conLaBaseDeLaPlataforma(fn) : fn();
}

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  return enSuStore(() => getEnSuStore(req));
}

async function getEnSuStore(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const id = params.get('id');
  if (id) { const p = await getPlantilla(id); return p ? NextResponse.json({ ok: true, plantilla: p }) : NextResponse.json({ ok: false, error: 'no existe' }, { status: 404 }); }
  // Los que el store eliminó de su lista (novena tanda): el mismo protocolo que /api/perfil/plantillas. Acá con
  // el catálogo entero, que es lo que esta vista lista (ya los trae con su marca `oculto`).
  if (params.get(PARAM_OCULTOS) === '1') return NextResponse.json({ ok: true, plantillas: await listarPlantillas({ vista: 'agencia', ocultos: true }) });
  return NextResponse.json({ ok: true, plantillas: await listarPlantillas({ vista: 'agencia' }) });
}

type Body = {
  action?: string; id?: string; texto?: string; enabled?: boolean; canales?: { wa?: boolean; email?: boolean }; contexto?: string;
  titulo?: string; asunto?: string; categoria?: CategoriaAviso; requiereRespuesta?: boolean; flujo?: unknown;
  frecuenciaMin?: number;
  posiciones?: Record<string, { x: number; y: number }>;
  cron?: unknown;
  acuses?: unknown;
};

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  return enSuStore(() => postEnSuStore(req));
}

async function postEnSuStore(req: NextRequest) {
  let b: Body;
  try { b = (await req.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  switch (b.action) {
    case 'crear': {
      if (!b.titulo?.trim() || !b.categoria) return NextResponse.json({ ok: false, error: 'faltan título/categoría' }, { status: 400 });
      const p = await crearPlantilla({ titulo: b.titulo, categoria: b.categoria, requiereRespuesta: b.requiereRespuesta, texto: b.texto });
      return NextResponse.json({ ok: true, plantilla: p });
    }
    case 'texto': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); await setTextoPlantilla(b.id, b.texto ?? ''); return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) }); }
    case 'reset': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); await setTextoPlantilla(b.id, ''); return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) }); }
    case 'enabled': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); await setEnabledPlantilla(b.id, b.enabled !== false); return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) }); }
    case 'canales': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      const c = (b.canales ?? {}) as { wa?: unknown; email?: unknown };
      await setCanalesPlantilla(b.id, {
        ...(typeof c.wa === 'boolean' ? { wa: c.wa } : {}),
        ...(typeof c.email === 'boolean' ? { email: c.email } : {}),
      });
      return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
    }
    case 'frecuencia': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      await setFrecuenciaPlantilla(b.id, sanearFrecuencia(b.frecuenciaMin));
      return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
    }
    case 'posiciones': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      await setPosicionesPlantilla(b.id, b.posiciones ?? {});
      return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
    }
    /* El borrador y publicar: acá no hay guard de texto porque el super-admin es
       el que REDACTA los avisos administrativos. El corte vive en la ruta del
       cliente, que es la que tiene a alguien a quien protegerle la precisión. */
    case 'borrador': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); await setBorradorPlantilla(b.id, b.texto ?? ''); return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) }); }
    case 'publicar': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); const publico = await publicarBorrador(b.id); return NextResponse.json({ ok: true, publico, plantilla: await getPlantilla(b.id) }); }
    case 'asunto': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); await setAsuntoPlantilla(b.id, b.asunto ?? ''); return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) }); }
    case 'titulo': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); await setTituloPlantilla(b.id, b.titulo ?? ''); return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) }); }
    case 'categoria': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      if (!CATEGORIAS_AVISO.includes(b.categoria as CategoriaAviso)) return NextResponse.json({ ok: false, error: 'categoría inválida' }, { status: 400 });
      await setCategoriaPlantilla(b.id, b.categoria as CategoriaAviso);
      return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
    }
    /* El cron por TIEMPO. `cron: null` desagenda. */
    case 'cron-get': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); return NextResponse.json({ ok: true, programado: await getProgramado(b.id) }); }
    case 'cron-set': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      // Un texto de ejemplo no se agenda: es un 400 con el motivo, no el 500 de una escritura que falló.
      try { return NextResponse.json({ ok: true, programado: await setProgramado(b.id, b.cron ?? null) }); }
      catch (e) { if (e instanceof NoAgendable) return NextResponse.json({ ok: false, error: e.message }, { status: 400 }); throw e; }
    }
    /* Las palabras que cortan los recordatorios: del workspace, no del mensaje. */
    case 'acuses-get': { const ws = await getWorkspaceActual(); return NextResponse.json({ ok: true, acuses: ws == null ? [] : await acusesDe(ws) }); }
    case 'acuses-set': {
      const ws = await getWorkspaceActual();
      if (ws == null) return NextResponse.json({ ok: false, error: 'sin workspace' }, { status: 400 });
      return NextResponse.json({ ok: true, acuses: await setAcuses(ws, b.acuses) });
    }
    /* `borrar` BORRA (una propia) en este catálogo, que lista también los ocultos: acá ocultar se leería como
       un tacho que no hace nada. `ocultar` y `restaurar` son los de /api/perfil/plantillas, por paridad de
       protocolo (lib/plantillas.ts, `ocultarPlantilla`). En la BASE (el workspace de la plataforma) los dos
       contestan `false` sin escribir: ahí apagarían o prenderían el mensaje de todos los clientes. */
    case 'borrar': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); return NextResponse.json({ ok: true, ...(await borrarPlantilla(b.id)) }); }
    case 'ocultar': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      if (!(await ocultarPlantilla(b.id))) return NextResponse.json({ ok: false, error: 'Este mensaje no se puede eliminar.' }, { status: 400 });
      return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
    }
    case 'restaurar': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      if (!(await restaurarPlantilla(b.id))) return NextResponse.json({ ok: false, error: 'Este mensaje no se puede recuperar.' }, { status: 400 });
      return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
    }
    case 'probar': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); return NextResponse.json({ ok: true, texto: await generarMensajeAviso(b.id, b.contexto || 'Usa datos de ejemplo realistas.') }); }
    case 'flujo-get': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); return NextResponse.json({ ok: true, flujo: await getFlujo(b.id) }); }
    case 'flujo-set': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      const flujo = b.flujo == null ? null : (esFlujoValido(b.flujo) ? b.flujo : null);
      if (b.flujo != null && !flujo) return NextResponse.json({ ok: false, error: 'flujo inválido' }, { status: 400 });
      // El flujo que contesta sale de la MISMA escritura, no de una relectura: era la
      // cuarta ida a la misma fila en un solo POST (medido: 992-1108 ms en total).
      return NextResponse.json({ ok: true, flujo: await setFlujo(b.id, flujo) });
    }
    default: return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  }
}
