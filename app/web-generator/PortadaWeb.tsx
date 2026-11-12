'use client';

// =============================================================================
// La portada de Web Generator con el armazón de Create: el chat de MaKo a la izquierda y tus landings a un toque (11/11/2026)
// =============================================================================
// Martín, 11/11/2026 (por el Cerebro), con la captura de /web-generator: «¿Dónde está el chat de MaKo para ir a trabajar las
// páginas anteriores que yo estaba trabajando?». La portada de outliers del mismo día se había quedado SOLA, a pantalla completa,
// y rompía la regla de Create (memoria «Create: UN solo diseño», 29/10): el chat de MaKo SIEMPRE a la izquierda, los proyectos al
// costado con la flecha y «Nueva». Es `PantallaCrear` (app/_crear/PantallaCrear.tsx), el MISMO de Image y de las demás tabs:
//   · a la izquierda, la tarjeta del chat de MaKo; su «←» da vuelta la tarjeta a TUS LANDINGS (las del Panel, por última vez
//     tocada), cada una abre su editor;
//   · «Nueva landing» lleva al Panel (`?panel=1`): ahí están «¿Qué vas a crear hoy?» con sus modos (generar, importar, analizar,
//     replicar) y todas las plantillas;
//   · en el centro, la portada: las plantillas y los outliers (./OutliersLandings.tsx).
// =============================================================================

import { useMemo, type ReactNode } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { PantallaCrear } from '@/app/_crear/PantallaCrear';
import type { LandingResumen } from '@/lib/editor-landing/api-tipos';
import { RUTA_PANEL, proyectosDeLandings } from './portada-reglas';

export function PortadaWeb({ docs, errorLista, children }: { docs: readonly LandingResumen[]; errorLista: string | null; children: ReactNode }) {
  const router = useRouter();
  const proyectos = useMemo(() => proyectosDeLandings(docs), [docs]);
  return (
    <PantallaCrear
      tab="Web Generator"
      nuevo="Nueva landing"
      proyectos={proyectos}
      errorProyectos={errorLista}
      onReintentar={() => router.refresh()}
      plantillas={[]}
      onPlantilla={() => null}
      ejemplos={[]}
      alNuevo={() => router.push(RUTA_PANEL)}
      pieLista={<Link href={RUTA_PANEL}>Ver todo en el Panel</Link>}
      // La portada de outliers va SIN el chat (12/11/2026); «Mis landings» abre la lista a la izquierda.
      portada
    >
      {children}
    </PantallaCrear>
  );
}
