'use client';

// =============================================================================
// La pantalla de un área en desarrollo
// =============================================================================
// Misma forma en TODAS: sub-tabs arriba, «Roadmap» SIEMPRE primera, y abajo de
// ella el Change History. Un área puede sumar sus propias sub-tabs al lado —las
// bibliotecas de Ads Writer, el catálogo del semáforo— y viven en `../paneles`.
//
// Por qué el orden es fijo: el registro es lo que hace que cambiar o debuguear
// esa tab no arranque de cero, así que es lo primero que tenés que ver al
// entrar. Si la herramienta va primero, el registro no se lee nunca.

import { useState } from 'react';
import { Pagina, PageHeader, Tabs, Status, ButtonLink, type Tab } from '@/app/_ui';
import { Roadmap, ChangeHistory } from '../_registro/Registro';
import type { Registro } from '../_registro/tipos';
import type { AreaDev } from '../areas';
import { subTabsDe, panelDe } from '../paneles';

export function RegistroArea({ area, registro }: { area: AreaDev; registro: Registro }) {
  const hechas = registro.partes.filter((p) => p.estado === 'hecha').length;
  const tabs: Tab[] = [{ id: 'roadmap', label: 'Roadmap' }, ...subTabsDe(area.slug)];
  const [tab, setTab] = useState('roadmap');

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
        // Un área por construir no tiene pantalla a la que saltar: el botón
        // llevaría a un 404 y prometería algo que no existe.
        accion={area.verEnApp ? <ButtonLink href={area.verEnApp} variant="secondary">Ver en la app →</ButtonLink> : undefined}
      />

      {/* Con una sola tab la barra es ruido: no hay a dónde ir. */}
      {tabs.length > 1 && <Tabs tabs={tabs} activa={tab} onCambio={setTab} />}

      {tab === 'roadmap' ? (
        <>
          <Roadmap partes={registro.partes} />
          <ChangeHistory hitos={registro.bitacora} />
        </>
      ) : (
        panelDe(area.slug, tab)
      )}
    </Pagina>
  );
}
