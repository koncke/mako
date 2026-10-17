// =============================================================================
// /m/admin/copywriting — «Copy Method» (Copywriting › Method) en el teléfono: el cerebro de redacción de MaKo
// =============================================================================
// La herramienta del super admin de escritorio (app/admin/copywriting) destilada: la metodología curada (cargada o
// no, y «Cargar metodología») y el swipe de ejemplos reales (la lista, guardar uno nuevo y borrarlo). Lee lo MISMO
// que escritorio (lib/copywriting-metodo.ts) y escribe por la MISMA ruta (/api/mako/copywriting), con su puerta.
//
// Referencia de app real: Readwise en el teléfono (el «swipe file» es una colección de textos guardados: una fila
// por texto con su fuente debajo y tres líneas del cuerpo; guardar uno nuevo es una hoja que sube).
//
// Quién: la MISMA pregunta que escritorio y que la ruta (`soloOwner`): el rol GLOBAL admin (o la sesión legacy).
// No es `requireMovil({ navKey })`: la key 'admin-copywriting' es de ADMIN_NAV, no de TODOS_LOS_ITEMS, y
// `puedeVerKey` diría que no a todos. Sin fila en SECCIONES_MAS: se llega por la barra de secciones de Copywriting
// (sólo el super admin la ve con «Method»), y la cabecera la pone la page.
// =============================================================================

import './admin-copywriting.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { listEjemplos, metodoSembrado } from '@/lib/copywriting-metodo';
import { CabeceraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { nombreTab, seccionesTabM, vistaDe } from '../../_creacion/secciones';
import { CopyMethodM } from './CopyMethodM';

export const dynamic = 'force-dynamic';

export default async function CopyMethodPagina() {
  const ctx = await requireMovil();
  if (!(ctx.sesion.rol === 'admin' || ctx.sesion.legacy)) redirect(await rutaConWs(HOME_MOVIL));
  const secciones = seccionesTabM('copywriting', vistaDe(ctx));
  const datos = await Promise.all([metodoSembrado(), listEjemplos()]).catch(() => null);
  return (
    <PantallaM>
      <CabeceraM titulo="Copy Method" padre={{ href: '/m/copywriting', label: 'Ads Writer' }} />
      <SeccionesTabM etiqueta={nombreTab('copywriting')} secciones={secciones} activa="admin-copywriting" />
      {datos
        ? <CopyMethodM metodo={datos[0]} ejemplos={datos[1]} />
        : <ErrorM frase="No se pudo leer el cerebro de copywriting. Es un problema nuestro: vuelve a intentar." />}
    </PantallaM>
  );
}
