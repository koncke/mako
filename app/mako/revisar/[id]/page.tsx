// =============================================================================
// /mako/revisar/[id] — revisar, corregir y confirmar una propuesta de acción GENÉRICA
// =============================================================================
// Una acción `pantalla` sin pantalla propia (lib/api-mako) deja una fila `accion`
// en `propuestas` y manda este link. Acá se pinta un formulario desde los
// `parametros` de la operación, con el input guardado como valor inicial.
//
// El guard es el de /crm/revisar/[id]: cualquier sesión, y `getPropuesta` scopea al
// workspace del que mira. Cuando devuelve null se distingue «el link está mal» de
// «es de otra cuenta» (NoEsTuyo), porque se resuelven distinto.
//
// ⚠️ El registro (porId) se lee SOLO acá, en el server. El cliente recibe datos
// planos: tests/api-mako-registro.test.ts prohíbe importar valores del registro en
// un 'use client'. Y quién decide lo vuelve a comprobar la server action
// (ctxDeBandeja): lo que se pasa como `puedeDecidir` es solo para no ofrecerle
// botones a quien igual va a recibir un «no».
// =============================================================================

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { getPropuesta, duenoDePropuesta } from '@/lib/propuestas';
import { rutaDePropuesta } from '@/lib/propuestas-tipos';
import { getRolWsEfectivo, getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { porId } from '@/lib/api-mako/registro';
import { esAccion } from '@/lib/api-mako/tipos';
import { plano } from '@/lib/bandeja-filas';
import { NoEsTuyo } from '@/app/crm/revisar/[id]/NoEsTuyo';
import { RevisarAccion, type OperacionPlana } from './RevisarAccion';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// El techo de la PÁGINA gobierna sus server actions (docs/hallazgos-infra.md). Acá
// se confirman acciones que corren IA o analizan llamadas: sin
// esto la plataforma corta a mitad de camino y la propuesta queda «aplicándose»
// sin resultado, con la escritura hecha a medias.
export const maxDuration = 300;

const ORIGEN: Record<string, string> = { whatsapp: 'Por WhatsApp', claude: 'Por la API', app: 'Desde el chat de la app' };

// `plano` (un parámetro sin el `ejemplo`, que no viaja bien al cliente) vive en
// lib/bandeja-filas.ts: lo comparte el Inbox del teléfono.

function fmtFecha(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz });
  } catch {
    return iso;
  }
}

export default async function RevisarAccionPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await getUsuarioActual();
  if (!sesion) redirect(await rutaConWs('/inicio'));

  const { id } = await params;
  const prop = await getPropuesta(id).catch(() => null);

  // Una propuesta de otro tipo (un lead) tiene su pantalla: se manda ahí en vez
  // de decir «no es tuya» sobre algo que sí lo es.
  if (prop && prop.tipo !== 'accion') redirect(await rutaConWs(rutaDePropuesta(prop.tipo, prop.id)));

  if (!prop) {
    const dueno = await duenoDePropuesta(id);
    const esAdmin = sesion.rol === 'admin';
    return (
      <NoEsTuyo
        existe={!!dueno}
        deQuien={esAdmin ? (dueno?.nombre ?? '') : ''}
        wsDestino={esAdmin ? (dueno?.workspaceId ?? null) : null}
        textos={{
          titulo: 'Esta acción no es de tu cuenta', lugarDeOtro: 'su bandeja de MaKo',
          botonDeOtro: 'Ir a la bandeja de', botonMio: 'Ir a mi bandeja', ruta: '/mako/revisar',
        }}
      />
    );
  }

  const opId = String(prop.datos.operacion ?? '');
  const def = porId(opId);
  const operacion: OperacionPlana | null = def && esAccion(def)
    ? { id: def.id, titulo: def.titulo, descripcion: def.descripcion, escribe: def.escribe, reversible: def.reversible, parametros: def.parametros.map(plano) }
    : null;

  const payload = (prop.datos.payload && typeof prop.datos.payload === 'object' && !Array.isArray(prop.datos.payload)
    ? prop.datos.payload
    : {}) as Record<string, unknown>;

  const [rol, ws] = await Promise.all([getRolWsEfectivo(), getWorkspaceActual()]);
  const tz = ws != null ? await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : TZ_DEFAULT;

  return (
    <RevisarAccion
      id={prop.id}
      operacion={operacion}
      operacionId={opId}
      payload={payload}
      resumen={prop.resumen}
      estado={prop.estado}
      resultado={prop.resultado}
      origen={prop.origen ? (ORIGEN[prop.origen] ?? prop.origen) : null}
      createdAt={fmtFecha(prop.createdAt, tz)}
      puedeDecidir={rol === 'admin'}
    />
  );
}
