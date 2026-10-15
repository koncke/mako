// =============================================================================
// /perfil/instalar — «Tu cuenta» › Instalar la app (15/10/2026)
// =============================================================================
// En la computadora: un QR que abre MaKo en el celular, y los pasos para dejarla en la pantalla de
// inicio. En el teléfono esta misma URL es /m/cuenta/instalar (lib/movil-rutas.ts), con los pasos
// guiados. Antes era una pantalla SÓLO del teléfono y la computadora rebotaba a /perfil; con «Tu
// cuenta» tiene su sección en los dos lados, con el mismo nombre.

import QRCode from 'qrcode';
import { requireRolWs } from '@/lib/tab-access';
import { leerPerfil } from '@/lib/perfil';
import { APP_BASE_URL } from '@/lib/app-url';
import { TITULO_CUENTA, seccionesCuenta } from '@/lib/ajustes-secciones';
import { AjustesPagina, CuerpoGrupo, GrupoAjustes, TituloAjustes } from '../../_ui/Ajustes';

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
    <AjustesPagina lugar={TITULO_CUENTA} secciones={seccionesCuenta(deOtro, 'instalar')} activa="instalar">
      <TituloAjustes titulo="Instalar la app" bajada="MaKo en tu celular, con los avisos al instante." />
      <GrupoAjustes titulo="Ábrela en tu celular" descripcion="Escanea el código con la cámara y entra con tu cuenta de siempre.">
        <CuerpoGrupo>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap', paddingTop: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el server */}
            {qr && <img src={qr} alt="Código QR para abrir MaKo en el celular" width={168} height={168} style={{ borderRadius: 12, background: '#fff', border: '1px solid var(--border)', flex: 'none' }} />}
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.9, flex: '1 1 240px' }}>
              <li>Escanea el código con la cámara.</li>
              <li>En iPhone, toca Compartir y elige «Agregar a inicio».</li>
              <li>En Android, toca «Instalar» en el menú del navegador.</li>
              <li>Abre MaKo desde el ícono nuevo y prende los avisos.</li>
            </ol>
          </div>
          <p className="aj-texto" style={{ margin: '16px 0 0' }}>O escribe en el celular: <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{url.replace(/^https?:\/\//, '')}</span></p>
        </CuerpoGrupo>
      </GrupoAjustes>
    </AjustesPagina>
  );
}
