'use client';

// =============================================================================
// La pantalla de un área en desarrollo
// =============================================================================
// Misma forma que «MaKo UX/UI»: sub-tabs arriba, Roadmap y abajo el Change
// History. Hoy hay una sola sub-tab porque es lo que hay para mostrar; cuando
// un área tenga su propio catálogo de piezas o su banco de pruebas, se suma acá
// al lado de «Roadmap» sin tocar nada más.

import { Pagina, PageHeader, Tabs, Status, ButtonLink, type Tab } from '@/app/_ui';
import { Roadmap, ChangeHistory } from '../_registro/Registro';
import type { Registro } from '../_registro/tipos';
import type { AreaDev } from '../areas';

const TABS: Tab[] = [{ id: 'roadmap', label: 'Roadmap' }];

export function RegistroArea({ area, registro }: { area: AreaDev; registro: Registro }) {
  const hechas = registro.partes.filter((p) => p.estado === 'hecha').length;

  return (
    <Pagina>
      <PageHeader
        titulo={area.titulo}
        proposito={area.alcance}
        estado={
          registro.partes.length
            ? <Status tono={hechas === registro.partes.length ? 'good' : 'mako'}>{hechas} de {registro.partes.length}</Status>
            : undefined
        }
        accion={<ButtonLink href={area.verEnApp} variant="secondary">Ver en la app →</ButtonLink>}
      />

      <Tabs tabs={TABS} activa="roadmap" onCambio={() => {}} />

      <Roadmap partes={registro.partes} />
      <ChangeHistory hitos={registro.bitacora} />
    </Pagina>
  );
}
