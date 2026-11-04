// =============================================================================
// «Instalar la app»: MaKo en la computadora, en el teléfono y en el navegador (24/10/2026; rediseñada el 25/10/2026)
// =============================================================================
// Martín (24/10): «"Instalar la App" tiene que tener las 3 instalaciones»; y (25/10): «En settings no me gusta el diseño de
// "Perfil, Notificaciones, Instalar App..."... Fijate pagina por pagina como lo hacen otras apps». Eran tres tarjetas iguales en
// fila, cada una con su párrafo, un botón y una nota, y el QR adentro de una de ellas. COPIADA de la página de descargas de Linear
// (linear.app/download, abierta y mirada el 25/10/2026): una sección por lugar, con su frase a la izquierda y a la derecha UNA FILA
// POR SISTEMA con su botón («macOS · Download», «iOS · Scan QR · Open store»). Acá: Windows y Mac con su descarga, el teléfono
// con el código para la cámara y los dos pasos, y Chrome con la extensión.
// Sin estado: la monta la página (de servidor) con el QR ya armado, y el arnés de diseño la dibuja igual.
// 25/10/2026 (Martín: «Pusiste textos previo a la configuración que están muy de sobra»): sin la bajada ni la frase de cada
// sección; cada fila dice qué instala en una línea. Lo que pasa al abrir el instalador sigue en el `title` del botón.

import type { ReactNode } from 'react';
import { FilaAjustes, GrupoAjustes, TituloAjustes } from '@/app/_ui/Ajustes';
import { AVISO_GATEKEEPER, AVISO_SMARTSCREEN } from '@/lib/ia-pc-reglas';
import { SinConexion } from './SinConexion';

/** La descarga del instalador de cada sistema: la misma ruta que usan el chat sin la app y «Tus cuentas de IA». */
export const DESCARGA_DE = { windows: '/api/ia-pc/descargar?os=windows', mac: '/api/ia-pc/descargar?os=mac' } as const;

export function InstalarApp({ qr, url, extension, sinConexion }: {
  /** El código para la cámara del teléfono (un data URL), o null si no se pudo armar. */
  qr: string | null;
  /** La dirección de MaKo, la que abre el teléfono. */
  url: string;
  /** La versión es la que da la tienda, no la del repo: es la que esta persona se lleva al tocar el botón. */
  extension: { version: string; tienda: string };
  /** MaKo sin conexión en esta computadora (28/10/2026, ./SinConexion.tsx). null = sesión sin persona: no se ofrece. */
  sinConexion?: { email: string; noDisponible: string | null } | null;
}) {
  const boton = (href: string, texto: ReactNode, opts: { afuera?: boolean; titulo?: string } = {}) => (
    <a className="aj-boton" data-variante="borde" href={href} title={opts.titulo}
      {...(opts.afuera ? { target: '_blank', rel: 'noreferrer' } : {})}>{texto}</a>
  );
  return (
    <>
      <TituloAjustes titulo="Instalar la app" />

      <GrupoAjustes titulo="En tu computadora">
        {/* Corto, como Linear («macOS · Download»): lo que dice el sistema al abrirlo va en el `title` del botón. */}
        <FilaAjustes icono="computadora" titulo="Windows" detalle="Instalador .exe"
          fin={boton(DESCARGA_DE.windows, 'Descargar', { titulo: AVISO_SMARTSCREEN })} />
        <FilaAjustes icono="computadora" titulo="Mac" detalle="MaKo.app en un .zip"
          fin={boton(DESCARGA_DE.mac, 'Descargar', { titulo: AVISO_GATEKEEPER })} />
        {sinConexion && <SinConexion email={sinConexion.email} noDisponible={sinConexion.noDisponible} />}
      </GrupoAjustes>

      <GrupoAjustes titulo="En tu teléfono">
        <div className="aj-telefono">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el server */}
          {qr && <img className="aj-telefono__qr" src={qr} alt="Código QR para abrir MaKo en el celular" width={148} height={148} />}
          <ol className="aj-telefono__pasos">
            <li><b>iPhone:</b> en Safari, Compartir › «Agregar a inicio».</li>
            <li><b>Android:</b> en Chrome, el menú ⋮ › «Instalar app».</li>
            <li>O escribe en el celular <b>{url.replace(/^https?:\/\//, '')}</b>.</li>
          </ol>
        </div>
      </GrupoAjustes>

      <GrupoAjustes titulo="En tu navegador">
        <FilaAjustes icono="web" titulo="Extensión para Chrome" detalle={`Versión ${extension.version}`}
          fin={boton(extension.tienda, 'Agregar a Chrome', { afuera: true })} />
        <FilaAjustes icono="pregunta" titulo="Cómo instalarla" href="/extension/instalar" />
      </GrupoAjustes>
    </>
  );
}
