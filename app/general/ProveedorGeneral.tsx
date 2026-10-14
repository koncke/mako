'use client';

// =============================================================================
// ProveedorGeneral — lo que General le presta al editor: cómo se dibuja cada bloque, qué se define en su panel y su
// vista previa (app/dashboard/ElementoGeneral.tsx explica el contexto)
// =============================================================================
// Vive en app/general y no en app/dashboard A PROPÓSITO: el Dashboard monta el mismo editor y no tiene por qué cargar
// el código de los bloques de General (ni el tablero del Plan que traen sus tarjetas). El editor sólo conoce el
// contexto; el dibujo lo pone quien lo monta.
// =============================================================================

import { useMemo, type ReactNode } from 'react';
import type { Elemento } from '@/lib/graficos-catalogo';
import type { PiezaGeneral, ValoresVariables } from '@/lib/general-piezas';
import { ContextoGeneral, type ContextoDeGeneral } from '../dashboard/ElementoGeneral';
import { EditarObjetivo } from './EditarObjetivo';
import type { DatosGeneral } from './datos-tipos';
import { CSS_BLOQUES } from './bloques/comun';
import { BloqueCabecera, BloqueOkrs, BloqueKpis, BloqueSemaforo, MuestraOkrs, MuestraSemaforo, NuevoOkr } from './bloques/Norte';
import { BloquePrioridades, BloqueProyectos, MuestraPrioridades, MuestraProyectos } from './bloques/Plan';
import { BloqueMiDia, BloqueLlamadas, BloquePublicaciones, MuestraMiDia, MuestraLlamadas, MuestraPublicaciones } from './bloques/Agenda';
import { BloquePendientes, BloqueFunnel, BloqueCobranza, BloqueMes, MuestraFunnel, MuestraCobranza, MuestraMes } from './bloques/Negocio';

/** Un bloque con sus datos y sus opciones. */
export function dibujarBloque(e: Elemento, d: DatosGeneral): ReactNode {
  const g = e.general;
  if (!g) return null;
  const op = g.opciones;
  const funnel = g.funnel ?? null;
  switch (g.pieza) {
    case 'cabecera': return <BloqueCabecera d={d.cabecera} />;
    case 'objetivos': return <BloqueOkrs d={d.okrs} op={op} />;
    case 'kpis': return <BloqueKpis d={d.kpis} op={op} />;
    case 'semaforo': return <BloqueSemaforo d={d.semaforo} op={op} />;
    case 'prioridades': return <BloquePrioridades d={d.plan} op={op} />;
    case 'proyectos': return <BloqueProyectos d={d.plan} op={op} />;
    case 'agenda': return <BloqueMiDia d={d.calendario} op={op} />;
    case 'llamadas': return <BloqueLlamadas d={d.calendario} op={op} />;
    case 'pendientes': return <BloquePendientes d={d.pendientes} />;
    case 'funnel': return <BloqueFunnel d={d.funnels} funnel={funnel} op={op} />;
    case 'cobranza': return <BloqueCobranza d={d.cobranza} funnel={funnel} funnels={d.funnels} op={op} />;
    case 'mes': return <BloqueMes d={d.mes} op={op} />;
    case 'publicaciones': return <BloquePublicaciones d={d.calendario} op={op} />;
  }
}

/** La vista previa de un bloque para el menú: con datos de ejemplo; los que no tienen (el hero, los KPIs, los pendientes), con los de verdad. */
export function muestraDeBloque(pieza: PiezaGeneral, d: DatosGeneral): ReactNode {
  switch (pieza) {
    case 'cabecera': return <BloqueCabecera d={d.cabecera} />;
    case 'objetivos': return <MuestraOkrs />;
    case 'kpis': return <BloqueKpis d={d.kpis} />;
    case 'semaforo': return <MuestraSemaforo />;
    case 'prioridades': return <MuestraPrioridades />;
    case 'proyectos': return <MuestraProyectos />;
    case 'agenda': return <MuestraMiDia />;
    case 'llamadas': return <MuestraLlamadas />;
    case 'pendientes': return <BloquePendientes d={d.pendientes} />;
    case 'funnel': return <MuestraFunnel />;
    case 'cobranza': return <MuestraCobranza />;
    case 'mes': return <MuestraMes />;
    case 'publicaciones': return <MuestraPublicaciones />;
  }
}

/**
 * Lo que un bloque define AHÍ MISMO, en su panel (14/10/2026, Martín: «Hay bloques que en la configuración se deben
 * definir allí mismo ciertas cosas... Como el objetivo del trimestre, que me gustaría que se llamen (OKRs)»): los OKRs
 * se crean y se editan desde el panel de «OKRs» y del hero. Lo demás se define en su bloque (los KPIs, con «+ agregar»).
 */
export function configurarBloque(e: Elemento, d: DatosGeneral): ReactNode {
  const pieza = e.general?.pieza;
  if ((pieza !== 'objetivos' && pieza !== 'cabecera') || !d.okrs.ok) return null;
  const { anio, quarter, lista } = d.okrs.d;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>Tus OKRs</span>
      {lista.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {lista.map((o, i) => (
            <EditarObjetivo key={o.id} objetivo={o} anio={anio} quarter={quarter} disparador={(
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13.5 }} title="Editar este OKR">
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)', fontWeight: 500 }}>{o.titulo}</span>
                <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: o.pct == null ? 'var(--faint)' : o.atrasado ? 'var(--warn)' : 'var(--good)' }}>{o.pct == null ? '—' : `${o.pct}%`}</span>
                <span style={{ flex: 'none', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Editar</span>
              </span>
            )} />
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Todavía no hay OKRs.</span>
      )}
      <NuevoOkr anio={anio} quarter={quarter} secundario />
    </div>
  );
}

export function ProveedorGeneral({ datos, variables, children }: { datos: DatosGeneral; variables: ValoresVariables; children: ReactNode }) {
  const valor = useMemo<ContextoDeGeneral>(() => ({
    dibujar: (e) => dibujarBloque(e, datos),
    configurar: (e) => configurarBloque(e, datos),
    muestra: (p) => muestraDeBloque(p, datos),
    variables,
    funnels: datos.funnels.ok ? datos.funnels.d.map((f) => ({ id: f.id, nombre: f.nombre })) : null,
  }), [datos, variables]);
  return (
    <ContextoGeneral valor={valor}>
      <style>{CSS_BLOQUES}</style>
      {children}
    </ContextoGeneral>
  );
}
