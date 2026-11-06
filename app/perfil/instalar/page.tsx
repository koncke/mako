// =============================================================================
// /perfil/instalar — Settings › Instalar la app (15/10/2026; las tres, 24/10/2026; como Linear, 25/10/2026)
// =============================================================================
// LAS TRES INSTALACIONES (24/10/2026, Martín: «"Instalar la App" tiene que tener las 3 instalaciones: la app Mobile, Desktop y la
// extensión»): la computadora, el teléfono y el navegador. Lo que se ve lo dibuja ./InstalarApp.tsx (copiada de la página de
// descargas de Linear el 25/10/2026); acá se arma lo de servidor: el QR y la versión de la extensión.
// En el teléfono esta misma URL es /m/cuenta/instalar (lib/movil-rutas.ts), con los pasos guiados del teléfono.

import QRCode from 'qrcode';
import { requireRolWs } from '@/lib/tab-access';
import { leerPerfil, usuarioPropio } from '@/lib/perfil';
import { getUsuarioActual } from '@/lib/auth';
import { APP_BASE_URL } from '@/lib/app-url';
import { TITULO_CUENTA } from '@/lib/ajustes-secciones';
import { gruposDeAjustes } from '@/lib/ajustes-negocio';
import { AjustesPagina } from '../../_ui/Ajustes';
import { EXTENSION_URL_TIENDA, VERSION_EN_TIENDA } from '@/lib/extension-tienda';
import { InstalarApp, ParaQueSirve, VER_ESCRITORIO } from './InstalarApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InstalarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs(['closer', 'setter']);
  // `?ver=escritorio`: «Para qué sirve» MaKo en la computadora (6/11/2026). Lo lee el server: un link copiado abre lo mismo.
  if ((await searchParams).ver === VER_ESCRITORIO) {
    const deOtro = await leerPerfil().then((p) => p.vista.deOtro, () => false);
    return (
      <AjustesPagina lugar={TITULO_CUENTA} grupos={await gruposDeAjustes(deOtro, 'instalar')} activa="instalar">
        <ParaQueSirve />
      </AjustesPagina>
    );
  }
  // La raíz de MaKo, sin pantalla ni `?ws=`: el teléfono la abre con su versión (proxy → /m) y entra a
  // la cuenta de quien escanea, no a la que esta computadora esté mirando.
  const url = APP_BASE_URL;
  const [qr, deOtro, sesion, propio] = await Promise.all([
    QRCode.toDataURL(url, { margin: 1, width: 360 }).catch(() => null),
    leerPerfil().then((p) => p.vista.deOtro, () => false),
    getUsuarioActual(),
    usuarioPropio(),
  ]);
  // MaKo sin conexión (28/10/2026): de la PERSONA frente al teclado. Una sesión sin fila propia no tiene llave; mirando a otro,
  // la copia no se guarda (/api/sin-conexion/copia) y la fila lo dice.
  const sinConexion = sesion?.email && propio
    ? { email: sesion.email, noDisponible: deOtro ? 'No se puede mientras miras la cuenta de otro.' : null }
    : null;
  return (
    <AjustesPagina lugar={TITULO_CUENTA} grupos={await gruposDeAjustes(deOtro, 'instalar')} activa="instalar">
      <InstalarApp qr={qr} url={url} sinConexion={sinConexion}
        extension={{ version: VERSION_EN_TIENDA, tienda: EXTENSION_URL_TIENDA }} />
    </AjustesPagina>
  );
}
