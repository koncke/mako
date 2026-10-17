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
import { funnelsDeBloque, type OpcionesElegidas, type PiezaGeneral, type ValoresVariables } from '@/lib/general-piezas';
import { ContextoGeneral, type ContextoDeGeneral } from '../dashboard/ElementoGeneral';
import { EditarObjetivo } from './EditarObjetivo';
import type { DatosGeneral } from './datos-tipos';
import { CSS_BLOQUES } from './bloques/comun';
import { BloqueOkrs, BloqueKpis, BloqueSemaforo, MuestraOkrs, MuestraSemaforo, NuevoOkr } from './bloques/Norte';
import { BloqueMetaObjetivo, BloqueAccion, MuestraMetaObjetivo, MuestraAccion } from './bloques/Meta';
import { BloquePrioridades, BloqueProyectos, BloqueTareas, BloqueDeadlines, MuestraPrioridades, MuestraProyectos, MuestraTareas, MuestraDeadlines } from './bloques/Plan';
import { BloqueMiDia, BloqueLlamadas, BloquePublicaciones, MuestraMiDia, MuestraLlamadas, MuestraPublicaciones } from './bloques/Agenda';
import { BloquePendientes, BloqueFunnel, BloqueCobranza, BloqueMes, MuestraFunnel, MuestraCobranza, MuestraMes } from './bloques/Negocio';

/** Un bloque con sus datos y sus opciones. */
export function dibujarBloque(e: Elemento, d: DatosGeneral): ReactNode {
  const g = e.general;
  if (!g) return null;
  const op = g.opciones;
  const funnel = g.funnel ?? null;
  switch (g.pieza) {
    case 'cabecera': return <BloqueMetaObjetivo d={d.cabecera} op={op} />;
    case 'accion': return <BloqueAccion d={d.cabecera} op={op} />;
    case 'tareas': return <BloqueTareas d={d.plan} op={op} />;
    case 'deadlines': return <BloqueDeadlines d={d.plan} op={op} />;
    case 'objetivos': return <BloqueOkrs d={d.okrs} op={op} />;
    case 'kpis': return <BloqueKpis d={d.kpis} op={op} />;
    case 'semaforo': return <BloqueSemaforo d={d.semaforo} op={op} />;
    case 'prioridades': return <BloquePrioridades d={d.plan} op={op} />;
    case 'proyectos': return <BloqueProyectos d={d.plan} op={op} />;
    case 'agenda': return <BloqueMiDia d={d.calendario} op={op} />;
    case 'llamadas': return <BloqueLlamadas d={d.calendario} op={op} />;
    case 'pendientes': return <BloquePendientes d={d.pendientes} />;
    case 'funnel': return <BloqueFunnel d={d.funnels} funnel={funnel} op={op} />;
    case 'cobranza': return <BloqueCobranza d={d.cobranza} elegidos={funnelsDeBloque(g)} funnels={d.funnels} op={op} />;
    case 'mes': return <BloqueMes d={d.mes} op={op} />;
    case 'publicaciones': return <BloquePublicaciones d={d.calendario} op={op} />;
  }
}

/**
 * La vista previa de un bloque (el menú y las miniaturas de las plantillas): con datos de ejemplo y con las opciones que
 * trae (`op`); los que no tienen ejemplo (la meta con su período, los KPIs, los pendientes), con los de verdad.
 */
export function muestraDeBloque(pieza: PiezaGeneral, d: DatosGeneral, op?: OpcionesElegidas): ReactNode {
  switch (pieza) {
    case 'cabecera': return <MuestraMetaObjetivo d={d.cabecera} op={op} />;
    case 'accion': return <MuestraAccion op={op} />;
    case 'objetivos': return <MuestraOkrs op={op} />;
    case 'kpis': return <BloqueKpis d={d.kpis} op={op} />;
    case 'semaforo': return <MuestraSemaforo op={op} />;
    case 'tareas': return <MuestraTareas op={op} />;
    case 'prioridades': return <MuestraPrioridades op={op} />;
    case 'deadlines': return <MuestraDeadlines op={op} />;
    case 'proyectos': return <MuestraProyectos op={op} />;
    case 'agenda': return <MuestraMiDia op={op} />;
    case 'llamadas': return <MuestraLlamadas op={op} />;
    case 'pendientes': return <BloquePendientes d={d.pendientes} />;
    case 'funnel': return <MuestraFunnel op={op} />;
    case 'cobranza': return <MuestraCobranza />;
    case 'mes': return <MuestraMes op={op} />;
    case 'publicaciones': return <MuestraPublicaciones op={op} />;
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
    muestra: (p, op) => muestraDeBloque(p, datos, op),
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
