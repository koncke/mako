'use client';

// =============================================================================
// Media Buyer — el panel de agentes («4 Active» de adamigo-3) (25/10/2026)
// =============================================================================
// Arriba, los cuatro agentes de MaKo (los de AdAmigo: Strategist, Media Buyer, Creative Designer, Protect), cada uno con su
// estado y sus tres botones: pausar o prender, automático (el rayo) y editar (sus tácticas, en Automatizaciones). Por
// debajo cada agente maneja sus tácticas (mb-modelo.ts → TACTICAS_DE): no hay un segundo interruptor.
// Abajo, los agentes PROPIOS («Custom Agents»): una regla escrita en palabras y cada cuánto la mira MaKo. Lo que dejan
// siempre espera a una persona (lib/media-buyer/agentes-propios.ts), así que no llevan rayo.
// =============================================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { AgentePropio } from '@/lib/media-buyer/agentes-propios';
import type { ConfigTacticas, TacticasResueltas } from '@/lib/media-buyer/tacticas';
import { NOMBRE_AGENTE, QUE_HACE, TACTICAS_DE, estadoDeAgente, type Agente } from './mb-modelo';
import { EtiquetaAgente, Ic } from './Autopilot';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';

type Propio = Exclude<Agente, 'tu'>;
const AGENTES: Propio[] = ['estratega', 'media_buyer', 'disenador', 'protect'];
const TACTICA_DE: Record<Propio, 'surf' | 'stop_loss' | 'calidad' | 'ganador'> = { media_buyer: 'surf', protect: 'stop_loss', estratega: 'calidad', disenador: 'ganador' };

const sv = (d: ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
const IcPausa = () => sv(<><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>);
const IcPlay = () => sv(<path d="M7 4.5v15l12-7.5z" />);
const IcRayo = () => sv(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />);
const IcLapiz = () => sv(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>);
const IcMas = () => sv(<path d="M12 5v14M5 12h14" />);

const nuevoId = () => `ag-${Math.random().toString(36).slice(2, 10)}`;

export function contarActivos(r: TacticasResueltas, encendido: boolean, propios: AgentePropio[]): number {
  if (!encendido) return 0;
  return AGENTES.filter((a) => estadoDeAgente(a, r) !== 'pausado').length + propios.filter((p) => p.estado === 'activo').length;
}

export function PanelAgentes({ resueltas, config, pilotoPermitido, sinPiloto, propios, onTacticas, onPropio, onBorrarPropio, onCerrar, pie }: {
  resueltas: TacticasResueltas;
  config: ConfigTacticas;
  pilotoPermitido: boolean;
  /** Por qué no hay automático (el plan, la prueba gratis): va en el rayo apagado. */
  sinPiloto: string;
  propios: AgentePropio[];
  onTacticas: (c: ConfigTacticas) => Promise<boolean>;
  onPropio: (a: AgentePropio) => Promise<boolean>;
  onBorrarPropio: (id: string) => Promise<void>;
  onCerrar: () => void;
  /** Lo que va al pie (los links a Ajustes y Automatizaciones: el panel cuelga de la tuerca). */
  pie?: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [armando, setArmando] = useState<AgentePropio | null>(null);
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) onCerrar(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [onCerrar]);

  const cambiar = async (a: Propio, estado: 'apagada' | 'propone' | 'automatica') => {
    setOcupado(a);
    // Sólo las tácticas de ESTE agente: el servidor las mezcla con lo guardado (una copia vieja no pisa a las demás).
    await onTacticas(Object.fromEntries(TACTICAS_DE[a].map((t) => [t, { ...(config[t] ?? {}), estado }])));
    setOcupado(null);
  };

  return (
    <div className="aa-agentes" ref={caja} role="dialog" aria-label="Agentes">
      <h3 className="aa-seccion">Agentes</h3>
      <ul className="aa-ag-lista">
        {AGENTES.map((a) => {
          const e = estadoDeAgente(a, resueltas);
          return (
            <li key={a} className="aa-ag">
              <span className="aa-ag-txt">
                <EtiquetaAgente d={{ tactica: TACTICA_DE[a] }} />
                <small>{QUE_HACE[a]}</small>
              </span>
              <span className="aa-ag-estado" data-e={e}>{e === 'pausado' ? 'Pausado' : e === 'automatico' ? 'Automático' : 'Activo'}</span>
              <span className="aa-ag-botones">
                <button type="button" className="aa-ag-b" disabled={ocupado === a} title={e === 'pausado' ? 'Prender' : 'Pausar'} aria-label={`${e === 'pausado' ? 'Prender' : 'Pausar'} ${NOMBRE_AGENTE[a]}`}
                  onClick={() => void cambiar(a, e === 'pausado' ? 'propone' : 'apagada')}>{e === 'pausado' ? <IcPlay /> : <IcPausa />}</button>
                <button type="button" className="aa-ag-b" data-on={e === 'automatico' ? '1' : '0'} disabled={ocupado === a || (!pilotoPermitido && e !== 'automatico')}
                  title={pilotoPermitido ? (e === 'automatico' ? 'Que proponga y espere tu OK' : 'Que lo haga solo, dentro de tus topes') : sinPiloto}
                  aria-label={`Automático: ${NOMBRE_AGENTE[a]}`} aria-pressed={e === 'automatico'}
                  onClick={() => void cambiar(a, e === 'automatico' ? 'propone' : 'automatica')}><IcRayo /></button>
                <Link className="aa-ag-b" href={`/ads-manager/automatizaciones?t=${TACTICAS_DE[a][0]}`} title="Ajustar sus reglas" aria-label={`Ajustar ${NOMBRE_AGENTE[a]}`}><IcLapiz /></Link>
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className="aa-seccion">Agentes propios <small>{propios.length}</small></h3>
      {!armando && (
        <button type="button" className="aa-ag-nuevo" onClick={() => setArmando({ id: nuevoId(), nombre: '', regla: '', cada: 'dia', estado: 'activo', creado: '' })}>
          <IcMas />Nuevo agente
        </button>
      )}
      {armando && (
        <form className="aa-ag-form" onSubmit={async (ev) => { ev.preventDefault(); setOcupado(armando.id); const ok = await onPropio(armando); setOcupado(null); if (ok) setArmando(null); }}>
          <input placeholder="Nombre (por ejemplo: «Cuida el costo»)" value={armando.nombre} maxLength={60} onChange={(e) => setArmando({ ...armando, nombre: e.target.value })} aria-label="Nombre del agente" />
          <textarea placeholder="Qué mira y qué hace. Por ejemplo: «Pausa todo conjunto que pase de $15 por lead en los últimos 3 días»." rows={3} maxLength={600}
            value={armando.regla} onChange={(e) => setArmando({ ...armando, regla: e.target.value })} aria-label="La regla" />
          <div className="aa-ag-form-pie">
            <span className="aa-seg" role="group" aria-label="Cada cuánto">
              {(['dia', 'semana'] as const).map((c) => <button key={c} type="button" aria-pressed={armando.cada === c} onClick={() => setArmando({ ...armando, cada: c })}>{c === 'dia' ? 'Cada día' : 'Los lunes'}</button>)}
            </span>
            <button type="button" className="aa-sec" onClick={() => setArmando(null)}>Cancelar</button>
            <button type="submit" className="aa-aplicar" disabled={ocupado === armando.id || armando.nombre.trim().length < 2 || armando.regla.trim().length < 10}>Guardar</button>
          </div>
          <p className="aa-ag-nota">Lo que proponga va a «Hoy» y espera tu OK: nunca lo hace solo.</p>
        </form>
      )}
      {propios.length > 0 && (
        <ul className="aa-ag-lista">
          {propios.map((p) => (
            <li key={p.id} className="aa-ag">
              <span className="aa-ag-txt">
                <b>{p.nombre}</b>
                <small title={p.regla}>{p.regla}</small>
              </span>
              <span className="aa-ag-estado" data-e={p.estado === 'activo' ? 'propone' : 'pausado'}>{p.estado === 'activo' ? (p.cada === 'dia' ? 'Cada día' : 'Los lunes') : 'Pausado'}</span>
              <span className="aa-ag-botones">
                <button type="button" className="aa-ag-b" disabled={ocupado === p.id} aria-label={`${p.estado === 'activo' ? 'Pausar' : 'Prender'} ${p.nombre}`}
                  onClick={async () => { setOcupado(p.id); await onPropio({ ...p, estado: p.estado === 'activo' ? 'pausado' : 'activo' }); setOcupado(null); }}>{p.estado === 'activo' ? <IcPausa /> : <IcPlay />}</button>
                <button type="button" className="aa-ag-b" aria-label={`Cambiar ${p.nombre}`} onClick={() => setArmando(p)}><IcLapiz /></button>
                <button type="button" className="aa-ag-b" disabled={ocupado === p.id} aria-label={`Borrar ${p.nombre}`}
                  onClick={async () => { setOcupado(p.id); await onBorrarPropio(p.id); setOcupado(null); }}><IconoBorrar size={16} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {pie && <div className="aa-ag-pie">{pie}</div>}
    </div>
  );
}
