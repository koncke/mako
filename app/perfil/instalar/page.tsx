// =============================================================================
// /perfil/instalar — Settings › Instalar la app (15/10/2026; las tres, 24/10/2026)
// =============================================================================
// LAS TRES INSTALACIONES (24/10/2026, Martín: «"Instalar la App" tiene que tener las 3 instalaciones: la app Mobile, Desktop y la
// extensión»). Como las páginas de descarga de Notion o Slack: una tarjeta por lugar, cada una con su acción a la vista.
//   · En tu teléfono: el QR que abre MaKo en el celular y los pasos para dejarla en la pantalla de inicio (lo de siempre).
//   · En tu computadora: la app de escritorio (la descarga de IA del cliente, `DescargarMaKo`: el sistema de esta computadora).
//   · En tu navegador: la extensión (la versión del zip, `EXTENSION_VERSION`), con su página de pasos (/extension/instalar).
// En el teléfono esta misma URL es /m/cuenta/instalar (lib/movil-rutas.ts), con los pasos guiados del teléfono.

import QRCode from 'qrcode';
import { requireRolWs } from '@/lib/tab-access';
import { leerPerfil } from '@/lib/perfil';
import { APP_BASE_URL } from '@/lib/app-url';
import { TITULO_CUENTA } from '@/lib/ajustes-secciones';
import { gruposDeAjustes } from '@/lib/ajustes-negocio';
import { AjustesPagina, TituloAjustes } from '../../_ui/Ajustes';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { DescargarElOtro, DescargarMaKo } from '@/app/integraciones/CuentasYDispositivos';
import { EXTENSION_VERSION } from '@/lib/extension-version';
import { EXTENSION_EN_TIENDA, EXTENSION_URL_TIENDA, EXTENSION_URL_ZIP } from '@/lib/extension-tienda';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InstalarPage() {
  await requireRolWs(['closer', 'setter']);
  // La raíz de MaKo, sin pantalla ni `?ws=`: el teléfono la abre con su versión (proxy → /m) y entra a
  // la cuenta de quien escanea, no a la que esta computadora esté mirando.
  const url = APP_BASE_URL;
  const [qr, deOtro] = await Promise.all([
    QRCode.toDataURL(url, { margin: 1, width: 360 }).catch(() => null),
    leerPerfil().then((p) => p.vista.deOtro, () => false),
  ]);
  return (
    <AjustesPagina lugar={TITULO_CUENTA} grupos={await gruposDeAjustes(deOtro, 'instalar')} activa="instalar">
      <TituloAjustes titulo="Instalar la app" bajada="MaKo en tu teléfono, en tu computadora y en tu navegador." />
      <div className="aj-instalar">
        <section className="aj-instalar__tarjeta" aria-labelledby="inst-tel">
          <span className="aj-instalar__icono"><IconoMenu nombre="celular" size={22} /></span>
          <h2 id="inst-tel" className="aj-instalar__titulo">En tu teléfono</h2>
          <p className="aj-instalar__texto">Tus chats y los avisos al instante. Escanea el código con la cámara.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el server */}
          {qr && <img className="aj-instalar__qr" src={qr} alt="Código QR para abrir MaKo en el celular" width={140} height={140} />}
          <ol className="aj-instalar__pasos">
            <li>En iPhone: Compartir › «Agregar a inicio».</li>
            <li>En Android: «Instalar» en el menú del navegador.</li>
          </ol>
          <p className="aj-instalar__nota">O escribe en el celular: <b>{url.replace(/^https?:\/\//, '')}</b></p>
        </section>
        <section className="aj-instalar__tarjeta" aria-labelledby="inst-pc">
          <span className="aj-instalar__icono"><IconoMenu nombre="computadora" size={22} /></span>
          <h2 id="inst-pc" className="aj-instalar__titulo">En tu computadora</h2>
          <p className="aj-instalar__texto">Tu Ops Center contesta con tu Claude desde tu computadora. Sin la app, el chat no escribe.</p>
          {/* Corto, en una línea: el sistema lo dice su `title` y, abajo, el del otro. */}
          <DescargarMaKo className="aj-instalar__boton" texto="Descargar MaKo" />
          <DescargarElOtro className="aj-instalar__nota aj-instalar__otro" />
        </section>
        <section className="aj-instalar__tarjeta" aria-labelledby="inst-ext">
          <span className="aj-instalar__icono"><IconoMenu nombre="link" size={22} /></span>
          <h2 id="inst-ext" className="aj-instalar__titulo">En tu navegador</h2>
          <p className="aj-instalar__texto">La extensión de MaKo para Chrome: completa tus leads desde tu WhatsApp Web.</p>
          {EXTENSION_EN_TIENDA
            ? <a className="aj-instalar__boton" href={EXTENSION_URL_TIENDA} target="_blank" rel="noreferrer">Agregar a Chrome</a>
            : <a className="aj-instalar__boton" href={EXTENSION_URL_ZIP} download>Descargar la extensión</a>}
          <a className="aj-instalar__nota aj-instalar__otro" href="/extension/instalar">{`Versión ${EXTENSION_VERSION} · Cómo instalarla`}</a>
        </section>
      </div>
    </AjustesPagina>
  );
}
