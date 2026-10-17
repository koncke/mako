// =============================================================================
// /m/configuraciones — «Configuración del negocio» en el teléfono (17/10/2026). En la URL, /configuraciones.
// =============================================================================
// Referencia: Ajustes de iOS y los ajustes del workspace de Slack y Notion en el celular. Es una lista agrupada con una
// fila por sección, cada una con su ícono, y cada fila abre su pantalla con «‹ Atrás» fijo. La computadora es la misma
// lista (lib/ajustes-secciones.ts: el índice de la izquierda de app/_ui/Ajustes.tsx) en el MISMO orden y con los MISMOS
// rótulos. El teléfono saca la bajada de cada sección.
//
// Cada sección con pantalla vive debajo (/m/configuraciones/<clave>, `SECCIONES_NEGOCIO_M`), con la ruta de escritorio de
// siempre (/equipo, /integraciones, /configuraciones/plan…). Las dos del super admin que no la tienen son General (el
// horario de envío por día y el criterio de reuniones, un texto largo) y Método (las credenciales de la plataforma, claves
// que se pegan). Esas dos son una fila «En la computadora» con su motivo.
//
// Qué secciones se ofrecen lo decide el server con la sesión (`disponiblesNegocio`), igual que en escritorio. Cada pantalla
// igual se cuida sola con su puerta. La puerta del índice es la del menú de la foto: la key `configuraciones`, sólo
// quien administra el negocio.
// =============================================================================

import './configuraciones.css';
import { requireMovil } from '@/lib/movil-guard';
import { seccionesNegocio } from '@/lib/ajustes-secciones';
import { disponiblesNegocio } from '@/lib/ajustes-negocio';
import { RUTA_CONFIG_M, SECCIONES_NEGOCIO_M } from '@/lib/movil-rutas';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { FilaM, ListaM, PantallaM } from '@/app/m/_ui';
import { FilaEnComputadoraM } from '@/app/m/_ui/EnComputadoraM';

export const dynamic = 'force-dynamic';

/** Lo que dice la hoja de una sección que se usa en la computadora. */
const EN_LA_COMPUTADORA: Record<string, string> = {
  general: 'El horario de envío se arma por día y hora, y el criterio de reuniones es un texto largo: se editan en la computadora.',
  metodo: 'Las credenciales de la plataforma son claves largas que se copian de cada servicio y se pegan: se cargan en la computadora.',
};

const icono = (n: NombreIconoMenu) => <span className="m-icono" aria-hidden><IconoMenu nombre={n} size={18} /></span>;

export default async function ConfiguracionNegocioM() {
  await requireMovil({ navKey: 'configuraciones' });
  const secciones = seccionesNegocio(await disponiblesNegocio());
  return (
    <PantallaM>
      <ListaM>
        {secciones.map((s) => (s.key in SECCIONES_NEGOCIO_M
          ? <FilaM key={s.key} navegacion leading={icono(s.icono)} titulo={s.label} href={`${RUTA_CONFIG_M}/${s.key}`} />
          : <FilaEnComputadoraM key={s.key} leading={icono(s.icono)} titulo={s.label} href={s.href}
              motivo={EN_LA_COMPUTADORA[s.key] ?? 'Esta sección se usa en la computadora.'} />))}
      </ListaM>
    </PantallaM>
  );
}
