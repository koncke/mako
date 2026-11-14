// =============================================================================
// /video-editor/<id> — el editor de un proyecto
// =============================================================================
// Mismo guard que el inicio (../acceso.ts: hoy, sólo el super admin). El id es el
// del proyecto en el almacenamiento local del motor; si no existe, el
// EditorProvider crea uno nuevo y reemplaza la URL (ver
// _opencut/components/providers/editor-provider.tsx).
//
// `?desde=<ref>` es «Editar en el editor» de Video Generator
// (`/video-editor/nuevo?desde=montaje:12`). La ref se resuelve ACÁ, en el
// workspace de la sesión, y al cliente baja sólo `{ titulo, archivo, url }`: la
// url la arma el server, nunca viene del navegador (../desde/desde.ts).
//
// `?plantilla=<id>` es «Utilizar plantilla» con la línea de tiempo ocupada
// (`/video-editor/nuevo?plantilla=testimonio`, ../plantilla/ArmarPlantilla.tsx). El
// id se valida acá contra el catálogo: al cliente baja el id o `null` (no existe).
//
// Las señales del negocio (lib/plantillas-sugeridas-server.ts) se leen acá, en paralelo:
// la pestaña Plantillas abre con las sugeridas primero y no salta (../sugeridas.tsx).

import { getWorkspaceActual } from '@/lib/workspace';
import { plantillaPorId } from '@/lib/editor-video/plantillas';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { VideoEditorCliente } from '../VideoEditorCliente';
import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { requireEditorVideo } from '../acceso';
import { resolverDesde } from '../desde/resolver';
import { leerClaveDesarme, plantillaDeDesarme, textoDeDesarme } from '@/lib/video-desarmar';
import { desarmeGuardado, estiloDeGaleria } from '@/lib/video-desarmar-servidor';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const revalidate = 0;

export default async function VideoEditorProyectoPage({ params, searchParams }: {
  params: Promise<{ proyecto: string }>;
  searchParams: Promise<{ desde?: string | string[]; plantilla?: string | string[]; propuesta?: string | string[]; desarme?: string | string[] }>;
}) {
  await requireEditorVideo();
  // El workspace de la pestaña, validado por el proxy: separa el almacenamiento
  // local del motor por cliente (ver espacio.ts).
  const [ws, senales] = await Promise.all([getWorkspaceActual(), senalesDelNegocio().catch(() => null)]);
  const { proyecto } = await params;
  const { desde, plantilla, propuesta, desarme } = await searchParams;
  // La propuesta que trae el link de la API o del Ops Center («Aceptar en el editor»): el editor abre su chat en ÉSA.
  // Sólo un uuid (mig 0302): lo demás se ignora en vez de viajar al cliente.
  const idPropuesta = typeof propuesta === 'string' && UUID.test(propuesta) ? propuesta : null;
  const origen = typeof desde === 'string' && desde ? await resolverDesde(desde) : undefined;
  const idPlantilla = typeof plantilla === 'string' && plantilla ? (plantillaPorId(plantilla)?.id ?? null) : undefined;
  // `?desarme=<red>.<id>` (ticket 97, app/video-editor/Desarmar.tsx → «Abrir en el editor»): la plantilla «toca para reemplazar»
  // del video desarmado y la receta para el chat. Se arman ACÁ con lo que guardó ESTE negocio: al cliente no baja la clave de
  // nadie más, y un video que no está desarmado baja `null` (la pantalla de «no pude armar la plantilla»).
  const desarmado = typeof desarme === 'string' && desarme ? await armarDesarmado(desarme) : undefined;
  // El marco de toda tab de Create (app/_crear/reglas.ts): la barra lateral se queda (pedido de Martín del 12/10) y el
  // editor llena lo que queda al lado de la tarjeta del chat.
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <VideoEditorCliente vista="editor" proyectoId={proyecto} ws={ws} desde={origen} plantilla={idPlantilla} propuesta={idPropuesta} senales={senales} desarmado={desarmado} />
    </Pagina>
  );
}

async function armarDesarmado(crudo: string) {
  const clave = leerClaveDesarme(crudo);
  const g = clave ? await desarmeGuardado(`${clave.red}.${clave.id}`).catch(() => null) : null;
  if (!g) return null;
  const estilo = estiloDeGaleria(g)?.id ?? null;
  const { plantilla, recorte, textosFuera } = plantillaDeDesarme(g, estilo);
  return { plantilla, mensaje: textoDeDesarme(g, estilo, { recorte, textosFuera }) };
}
