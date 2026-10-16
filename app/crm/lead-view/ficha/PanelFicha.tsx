'use client';

// =============================================================================
// PanelFicha — el panel de la derecha mientras se personaliza la ficha (el de propiedades del Dashboard)
// =============================================================================
// Martín (14/10/2026): «edita todo en la misma tab... no los hagas con un modal diferente... y que ahí mismo
// se configure qué datos sin marcar notifica». Primero, LA TAB QUE SE ESTÁ MIRANDO (16/10/2026, Martín: «Que se
// pueda cambiar el nombre de las tabs internas... que se pueda ver "epico"»): su nombre (también con doble clic en la
// pestaña), su plantilla (la galería, ./GaleriaTab.tsx), la vista épica y «Volver a la plantilla» de esa tab. Después,
// de TODA la ficha de este funnel:
//   · LA PLANTILLA de toda la ficha y por qué la eligió MaKo, otra a mano, y «Volver toda la ficha».
//   · EL ESTILO: el PanelEstilo del Dashboard (plantilla de estilo, color y letra; lib/graficos-temas.ts, no
//     uno nuevo) y el tamaño de las tarjetas (la densidad).
//   · LOS AVISOS de «datos sin marcar» de este funnel, con su interruptor. Reemplazan al modal de avisos. Las
//     asistencias van sin interruptor: una reunión que ya pasó siempre avisa (NO_IGNORABLES).
// Todo guarda solo (useFichaDelFunnel). El aviso corto de arriba dice a quién le cambia.
// =============================================================================

import { useLayoutEffect, useRef, useState } from 'react';
import { Switch } from '@/app/_ui/Toggle';
import { Dropdown } from '@/app/components/Dropdown';
import { PanelEstilo } from '@/app/dashboard/PanelEstilo';
import { DATOS_AVISABLES, NO_IGNORABLES } from '@/lib/datos-aviso';
import { DENSIDADES, NOMBRE_TAB, type TabFicha } from '@/lib/ficha/catalogo';
import { PLANTILLAS_FICHA, plantillaFicha, type PlantillaId } from '@/lib/ficha/plantillas';
import { plantillaTabPorId } from '@/lib/ficha/plantillas-tab';
import { TOPE_NOMBRE_TAB, type CambioFicha } from '@/lib/ficha/config';
import type { FichaDelFunnel } from '@/lib/ficha/config-server';
import { altoDelPanel } from './armar';

const GRUPOS = ['Reuniones', 'Venta', 'Equipo y contacto'] as const;
const DE_MAKO = '__mako';

export function PanelFicha({ ficha, tab, onCambio, onPlantillas }: {
  ficha: FichaDelFunnel;
  /** La tab que se está personalizando. */
  tab: TabFicha;
  onCambio: (c: CambioFicha) => void;
  /** Abre la galería de plantillas de esta tab, en el lugar de la tab. */
  onPlantillas: () => void;
}) {
  const ef = ficha.efectiva;
  const p = plantillaFicha(ef.plantilla);
  const deMako = plantillaFicha(ficha.eleccion.id);
  const tocada = ef.configuradas.length > 0 || ef.avisos.some((a) => a.por === 'a-mano');
  const pt = plantillaTabPorId(ef.plantillasTab[tab]);
  // «Volver a la plantilla» de la tab: su lista, su nombre y su épica (la plantilla elegida para la tab queda).
  const tabTocada = ef.tocadas.includes(tab) || ef.nombres[tab] !== NOMBRE_TAB[tab] || ef.epica[tab] !== !!pt?.epico;
  const porque = ef.plantillaAMano ? 'Elegida a mano.' : ficha.eleccion.porque;
  const ref = useAltoVisible();
  return (
    <aside ref={ref} className="fb-panel" aria-label="Personalizar la ficha" onClick={(e) => e.stopPropagation()}>
      <div className="fb-panel-cab">
        <div className="fb-panel-tit">Ficha de «{ficha.funnel.nombre}»</div>
        <p className="fb-panel-linea">Cambia para todo el equipo en este funnel.</p>
      </div>

      <section className="fb-panel-sec" aria-label="Esta tab">
        <div className="fb-panel-sub">Esta tab</div>
        <label className="lk-estilo-tit" htmlFor={`fb-nombre-${tab}`} style={{ display: 'block' }}>Nombre</label>
        <NombreTab key={`${tab}:${ef.nombres[tab]}`} id={`fb-nombre-${tab}`} valor={ef.nombres[tab]} deSiempre={NOMBRE_TAB[tab]}
          onGuardar={(nombre) => onCambio({ op: 'nombre', tab, nombre })} />
        <div className="lk-estilo-tit">Plantilla</div>
        <div className="fb-panel-fila">
          <span className="fb-panel-valor">{pt?.nombre ?? 'Sugerida'}</span>
          <button type="button" className="fb-boton-texto" onClick={onPlantillas}>Cambiar</button>
        </div>
        <div className="fb-aviso" style={{ marginTop: 8 }}>
          <Switch label="Vista épica" checked={ef.epica[tab]} onChange={(v) => onCambio({ op: 'epica', tab, epica: v })} />
        </div>
        <button type="button" className="fb-boton-texto" style={{ marginTop: 8 }} disabled={!tabTocada} onClick={() => onCambio({ op: 'volver', tab })}
          title="Sus bloques, su nombre y su vista como los trae su plantilla.">
          Volver a la plantilla
        </button>
      </section>

      <section className="fb-panel-sec" aria-label="Plantilla de toda la ficha">
        <div className="fb-panel-sub">Toda la ficha</div>
        <div style={{ fontSize: 14, fontWeight: 650 }}>{p.nombre}</div>
        <p className="fb-panel-linea" style={{ padding: 0 }}>{porque}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <Dropdown
            value={ef.plantillaAMano ? ef.plantilla : DE_MAKO}
            ariaLabel="Usar otra plantilla"
            // Todo el ancho del panel: a 190 px «La de MaKo (Llamada con R1 y R2)» salía cortada (banco, 16/10/2026).
            width="100%"
            options={[
              { value: DE_MAKO, label: `La de MaKo (${deMako.nombre})` },
              ...PLANTILLAS_FICHA.filter((x) => x.id !== ficha.eleccion.id || ef.plantillaAMano).map((x) => ({ value: x.id, label: x.nombre })),
            ]}
            onChange={(v) => onCambio({ op: 'plantilla', plantilla: v === DE_MAKO ? null : (v as PlantillaId) })}
          />
          <button type="button" className="fb-boton-texto" disabled={!tocada} onClick={() => onCambio({ op: 'volver' })}
            title="Las tabs, sus nombres y los avisos como los trae la plantilla. El estilo queda.">
            Volver toda la ficha
          </button>
        </div>
      </section>

      <section className="fb-panel-sec" aria-label="Estilo de la ficha">
        <div className="fb-panel-sub">Estilo</div>
        <div className="lk-estilo-tit">Tarjetas</div>
        <div className="fb-segmentos" role="group" aria-label="Tamaño de las tarjetas">
          {DENSIDADES.map((d) => (
            <button key={d.id} type="button" className="fb-herr" aria-pressed={ef.estilo.densidad === d.id}
              onClick={() => { if (ef.estilo.densidad !== d.id) onCambio({ op: 'densidad', densidad: d.id }); }}>
              {d.nombre}
            </button>
          ))}
        </div>
        <PanelEstilo tema={ef.estilo.tema} onCambiar={(tema) => onCambio({ op: 'tema', tema })} />
      </section>

      <section className="fb-panel-sec" aria-label="Avisos de datos sin marcar">
        <div className="fb-panel-sub">Avisos de datos sin marcar</div>
        {GRUPOS.map((g) => (
          <div key={g}>
            <div className="fb-panel-grupo">{g}</div>
            {DATOS_AVISABLES.filter((d) => d.grupo === g).map((d) => {
              const estado = ef.avisos.find((a) => a.id === d.id);
              const fijo = NO_IGNORABLES.has(d.id);
              return (
                fijo ? (
                  <div key={d.id} className="fb-aviso" title="Una reunión que ya pasó siempre avisa: falta decir qué ocurrió.">
                    <span>{d.label}</span>
                    <span className="fb-aviso-fijo">Siempre</span>
                  </div>
                ) : (
                  <div key={d.id} className="fb-aviso">
                    <Switch label={d.label} checked={estado?.avisa ?? true} onChange={(v) => onCambio({ op: 'aviso', paso: d.id, avisa: v })} />
                  </div>
                )
              );
            })}
          </div>
        ))}
      </section>
    </aside>
  );
}

/**
 * El nombre de la tab: guarda al salir o con Enter, Escape vuelve al de antes. Vacío = el de siempre. Va también con
 * doble clic en la pestaña (../LeadTabs.tsx); acá es para una pantalla táctil, donde el doble clic no se descubre.
 */
function NombreTab({ id, valor, deSiempre, onGuardar }: { id: string; valor: string; deSiempre: string; onGuardar: (v: string | null) => void }) {
  const [v, setV] = useState(valor);
  const guardar = () => {
    const t = v.trim();
    if (t === valor || (!t && valor === deSiempre)) { setV(valor); return; }
    onGuardar(t || null);
  };
  return (
    <input id={id} className="fb-campo" value={v} maxLength={TOPE_NOMBRE_TAB} placeholder={deSiempre}
      onChange={(e) => setV(e.target.value)} onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { e.stopPropagation(); setV(valor); }
      }} />
  );
}

/**
 * El alto máximo del panel es lo que se VE del contenedor que scrollea (el cuerpo del pop-up, o la ventana en
 * /crm/[id]), no la ventana entera: en el pop-up la cabecera y el pie se comen ~265 px y el panel terminaba debajo
 * del área visible (`altoDelPanel`, ./armar.ts). Va en una variable que lee ./ficha-css.ts; sin medir, el respaldo
 * de la hoja. Se vuelve a medir si cambia el tamaño del contenedor o de la ventana.
 */
function useAltoVisible() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sc: HTMLElement | null = null;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if (o === 'auto' || o === 'scroll') { sc = p; break; }
    }
    const medir = () => el.style.setProperty('--fb-panel-alto', `${altoDelPanel(sc ? sc.clientHeight : window.innerHeight)}px`);
    medir();
    const ro = sc && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (sc) ro?.observe(sc);
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, []);
  return ref;
}
