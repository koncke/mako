'use client';

// =============================================================================
// PlantillaDeModelo — «Plantilla del negocio» en la ficha de una cuenta del Agency Dashboard (MAU-01, 27/10/2026)
// =============================================================================
// Mauricio: «una base tipo copy paste que disminuya mi intervención de iniciar de cero». Se elige el modelo del cliente
// (tres tarjetas, una elegida) y «Aplicar» le arma su funnel, su tablero y la guía en su Plan (lib/plantillas-modelo.ts).
// Aplicarla dos veces no duplica: lo dice el resumen.

import { useState } from 'react';
import { MODELOS_CLIENTE, PLANTILLAS_MODELO, type ModeloCliente } from '@/lib/plantillas-modelo-reglas';
import { aplicarPlantillaAction } from './actions';

export function PlantillaDeModelo({ clienteWs, onError }: { clienteWs: number; onError: (m: string) => void }) {
  const [modelo, setModelo] = useState<ModeloCliente>('tienda-b2c');
  const [ocupado, setOcupado] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);

  const aplicar = async () => {
    if (ocupado) return;
    setOcupado(true);
    setHecho(null);
    try {
      const r = await aplicarPlantillaAction(clienteWs, modelo);
      if (r.ok) setHecho(r.resumen);
      else onError(r.error);
    } catch {
      onError('No pude aplicar la plantilla.');
    } finally { setOcupado(false); }
  };

  return (
    <div className="pm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pm-opciones" role="radiogroup" aria-label="Modelo de su negocio">
        {MODELOS_CLIENTE.map((id) => {
          const p = PLANTILLAS_MODELO[id];
          return (
            <button key={id} type="button" role="radio" aria-checked={modelo === id} className="pm-op" data-on={modelo === id}
              onClick={() => { setModelo(id); setHecho(null); }}>
              <b>{p.nombre}</b><span>{p.para}</span>
            </button>
          );
        })}
      </div>
      <div className="pm-pie">
        <span className="pm-que">Funnel, tablero y la guía para cargar sus datos, en su cuenta.</span>
        <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado} onClick={() => void aplicar()}>
          {ocupado ? 'Aplicando…' : 'Aplicar plantilla'}
        </button>
      </div>
      {hecho && <p className="pm-hecho" role="status">{hecho}</p>}
    </div>
  );
}

const CSS = `
.pm{ margin:0 0 14px; }
.pm-opciones{ display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
.pm-op{ display:flex; flex-direction:column; gap:3px; text-align:left; border:1px solid var(--border); background:var(--surface);
  border-radius:12px; padding:10px 12px; font:inherit; color:var(--ink); cursor:pointer; }
.pm-op b{ font-size:14px; font-weight:700; }
.pm-op span{ font-size:12.5px; line-height:1.35; color:var(--dim); }
.pm-op[data-on="true"]{ border-color:var(--primary); box-shadow:0 0 0 1px var(--primary); }
.pm-pie{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:10px; }
.pm-que{ font-size:12.5px; color:var(--dim); }
.pm-hecho{ margin:10px 0 0; font-size:13.5px; color:var(--good); font-weight:600; }
@media (max-width: 640px){ .pm-opciones{ grid-template-columns:1fr; } .pm-pie{ flex-direction:column; align-items:stretch; } }
`;
