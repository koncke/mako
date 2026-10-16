'use client';

// =============================================================================
// PanelFicha — el panel de la derecha mientras se personaliza la ficha (el de propiedades del Dashboard)
// =============================================================================
// Martín (14/10/2026): «edita todo en la misma tab... no los hagas con un modal diferente... y que ahí mismo
// se configure qué datos sin marcar notifica». Tres cosas, de TODA la ficha de este funnel:
//   · LA PLANTILLA en uso y por qué la eligió MaKo, otra a mano, y «Volver a la plantilla».
//   · EL ESTILO: el PanelEstilo del Dashboard (plantilla de estilo, color y letra; lib/graficos-temas.ts, no
//     uno nuevo) y el tamaño de las tarjetas (la densidad).
//   · LOS AVISOS de «datos sin marcar» de este funnel, con su interruptor. Reemplazan al modal de avisos. Las
//     asistencias van sin interruptor: una reunión que ya pasó siempre avisa (NO_IGNORABLES).
// Todo guarda solo (useFichaDelFunnel). El aviso corto de arriba dice a quién le cambia.
// =============================================================================

import { Switch } from '@/app/_ui/Toggle';
import { Dropdown } from '@/app/components/Dropdown';
import { PanelEstilo } from '@/app/dashboard/PanelEstilo';
import { DATOS_AVISABLES, NO_IGNORABLES } from '@/lib/datos-aviso';
import { DENSIDADES } from '@/lib/ficha/catalogo';
import { PLANTILLAS_FICHA, plantillaFicha, type PlantillaId } from '@/lib/ficha/plantillas';
import type { CambioFicha } from '@/lib/ficha/config';
import type { FichaDelFunnel } from '@/lib/ficha/config-server';

const GRUPOS = ['Reuniones', 'Venta', 'Equipo y contacto'] as const;
const DE_MAKO = '__mako';

export function PanelFicha({ ficha, onCambio }: { ficha: FichaDelFunnel; onCambio: (c: CambioFicha) => void }) {
  const ef = ficha.efectiva;
  const p = plantillaFicha(ef.plantilla);
  const deMako = plantillaFicha(ficha.eleccion.id);
  const tocada = ef.tocadas.length > 0 || ef.avisos.some((a) => a.por === 'a-mano') || ef.plantillaAMano;
  const porque = ef.plantillaAMano ? 'Elegida a mano.' : ficha.eleccion.porque;
  return (
    <aside className="fb-panel" aria-label="Personalizar la ficha" onClick={(e) => e.stopPropagation()}>
      <div className="fb-panel-cab">
        <div className="fb-panel-tit">Ficha de «{ficha.funnel.nombre}»</div>
        <p className="fb-panel-linea">Cambia para todo el equipo en este funnel.</p>
      </div>

      <section className="fb-panel-sec" aria-label="Plantilla">
        <div className="fb-panel-sub">Plantilla</div>
        <div style={{ fontSize: 14, fontWeight: 650 }}>{p.nombre}</div>
        <p className="fb-panel-linea" style={{ padding: 0 }}>{porque}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <Dropdown
            value={ef.plantillaAMano ? ef.plantilla : DE_MAKO}
            ariaLabel="Usar otra plantilla"
            width={190}
            options={[
              { value: DE_MAKO, label: `La de MaKo (${deMako.nombre})` },
              ...PLANTILLAS_FICHA.filter((x) => x.id !== ficha.eleccion.id || ef.plantillaAMano).map((x) => ({ value: x.id, label: x.nombre })),
            ]}
            onChange={(v) => onCambio({ op: 'plantilla', plantilla: v === DE_MAKO ? null : (v as PlantillaId) })}
          />
          <button type="button" className="fb-boton-texto" disabled={!tocada} onClick={() => onCambio({ op: 'volver' })}
            title="Las tabs y los avisos como los trae la plantilla. El estilo queda.">
            Volver a la plantilla
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
