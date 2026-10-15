'use client';

// =============================================================================
// PlantillasSemana — «Crear › Plantilla de semana» del Calendario: armar la semana que se mira con una plantilla
// =============================================================================
// Martín (13/10/2026): «que tenga IA que te ayude o "templates"». Lo que quedó de esa galería es la mitad de los
// templates. La caja «¿Qué vas a crear hoy?» y el armado de la semana con IA se FUERON el 14/10/2026, textual: «No
// pongas "¿Que vamos a crar hoy?", eso no es necesario, eliminalo completamente». En su lugar, al entrar sin Google
// Calendar salta el modal de conectarlo (CalendarioApp.tsx); y esta galería ya no se abre sola: se elige desde «Crear».
//
// Lo que no se ve en la firma:
//   · TODO CAE EN LA SEMANA QUE SE ESTÁ MIRANDO (`lunes`): una plantilla son días de la semana y horas.
//   · Una plantilla se agenda en el acto: la eligió la persona viendo qué trae; quien monta ofrece «Deshacer».
//   · `onCerrar` con identidad fija, y mientras se guarda no se cierra.

import { useMemo, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import {
  PLANTILLAS_CALENDARIO, filtrarPlantillasCalendario, entradasDePlantilla, rotuloDeRango,
  type EntradaEvento, type PlantillaCalendario,
} from '@/lib/calendario-modelo';

const CSS = `
.nc-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:12px}
.nc-tarjeta{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:16px;min-height:124px;box-sizing:border-box;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer;transition:border-color .14s ease,box-shadow .14s ease,transform .14s ease}
.nc-tarjeta:hover:not(:disabled),.nc-tarjeta:focus-visible{border-color:var(--primary);box-shadow:0 2px 12px color-mix(in srgb,var(--ink) 10%,transparent);outline:none}
.nc-tarjeta:active:not(:disabled){transform:scale(.98)}
.nc-tarjeta:disabled{cursor:default;opacity:.55}
.nc-buscar{display:flex;align-items:center;gap:8px;padding:0 12px;height:40px;box-sizing:border-box;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface);color:var(--dim)}
.nc-buscar:focus-within{border-color:var(--primary)}
.nc-buscar input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--ink);font:inherit;font-size:14px}
@media (prefers-reduced-motion: reduce){.nc-tarjeta{transition:none}.nc-tarjeta:active:not(:disabled){transform:none}}
`;

export function PlantillasSemana({ lunes, guardando, onCerrar, onPlantilla }: {
  /** El lunes de la semana que se está mirando: ahí cae todo. */
  lunes: string;
  guardando: boolean;
  onCerrar: () => void;
  onPlantilla: (p: PlantillaCalendario, entradas: EntradaEvento[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const cerrar = useCerrarEstable(onCerrar, guardando);
  const plantillas = useMemo(() => filtrarPlantillasCalendario(PLANTILLAS_CALENDARIO, busca), [busca]);
  const semana = rotuloDeRango('semana', lunes);

  return (
    <Modal titulo="Plantilla de semana" ancho={900} sinFiletes onCerrar={cerrar}>
      <style>{CSS}</style>
      <div data-plantillas-calendario="" style={S.todo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label className="nc-buscar" style={{ flex: '1 1 260px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" />
            </svg>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar plantilla" aria-label="Buscar plantilla" />
          </label>
          <span style={S.dim}>{semana}</span>
        </div>

        <div className="nc-grilla">
          {plantillas.map((p) => (
            <button key={p.id} type="button" className="nc-tarjeta" data-plantilla={p.id} disabled={guardando}
              onClick={() => onPlantilla(p, entradasDePlantilla(p, lunes))}>
              <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>{p.emoji}</span>
              <span style={S.nombre}>{p.nombre}</span>
              <span style={S.linea}>{p.linea}</span>
            </button>
          ))}
        </div>
        {!plantillas.length && <div style={S.linea}>Ninguna plantilla con eso</div>}
      </div>
    </Modal>
  );
}

const S: Record<string, CSSProperties> = {
  todo: { display: 'flex', flexDirection: 'column', gap: 16 },
  dim: { fontSize: 13, color: 'var(--dim)' },
  nombre: { fontSize: 15, fontWeight: 700, lineHeight: 1.25 },
  linea: { fontSize: 13, color: 'var(--dim)', lineHeight: 1.4 },
};
