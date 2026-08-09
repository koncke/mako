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
import { useSearchParams } from 'next/navigation';
import { Pagina, PageHeader, Tabs, Status, ButtonLink, type Tab } from '@/app/_ui';
import { Roadmap, ChangeHistory } from '../_registro/Registro';
import { RoadmapDelPlan, HistorialDeGit, Trampa } from '../_registro/Derivados';
import type { Registro } from '../_registro/tipos';
import type { AreaDev } from '../areas';
import type { CommitArea } from '../_historial.generado';
import type { TareaRoadmap } from '../roadmap';
import { subTabsDe, panelDe } from '../paneles';

export function RegistroArea({
  area, registro, tareas, commits,
}: {
  area: AreaDev;
  registro: Registro;
  tareas: TareaRoadmap[];
  commits: CommitArea[];
}) {
  const hechas = registro.partes.filter((p) => p.estado === 'hecha').length;
  const tabs: Tab[] = [{ id: 'roadmap', label: 'Roadmap' }, ...subTabsDe(area.slug)];
  // `?tab=<id>` abre una sub-tab directo. Sirve para dos cosas: mandar el link de
  // UN panel en vez de «entrá y clickeá la segunda pestaña», y poder verificar el
  // panel desde afuera — con la pane del navegador oculta, un clic sintético no
  // llega al onClick de React y no hay forma de cambiar de tab. Mismo patrón que
  // `/integraciones?ops=1`. Un id que no existe cae en Roadmap, que es el default.
  const pedida = useSearchParams().get('tab');
  const [tab, setTab] = useState(tabs.some((t) => t.id === pedida) ? pedida! : 'roadmap');
  // Seis áreas tienen bitácora escrita a mano. Manda ella: tiene el pedido
  // TEXTUAL del dueño y el porqué, que ningún mensaje de commit contiene.
  const conBitacora = registro.partes.length > 0 || registro.bitacora.length > 0;

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
          {area.nota && <Trampa nota={area.nota} />}
          {conBitacora ? (
            <>
              <Roadmap partes={registro.partes} />
              <RoadmapDelPlan tareas={tareas} proyectos={area.proyectos ?? []} />
              <ChangeHistory hitos={registro.bitacora} />
            </>
          ) : (
            <RoadmapDelPlan tareas={tareas} proyectos={area.proyectos ?? []} />
          )}
          <HistorialDeGit commits={commits} conBitacora={conBitacora} />
        </>
      ) : (
        panelDe(area.slug, tab)
      )}
    </Pagina>
  );
}
