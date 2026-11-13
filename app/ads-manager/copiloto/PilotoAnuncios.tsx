'use client';

// =============================================================================
// Marketing CoPilot nuevo — el piloto automático de ANUNCIOS (12/11/2026)
// =============================================================================
// Es el Media Buyer de verdad, con el molde de la maqueta (vuelta 14: «el piloto en una columna: "Espera tu OK" arriba y "Lo que
// hice" con "Ver más"»): las decisiones de /api/media-buyer. «Aprobar» las LANZA (lib/media-buyer/ejecutar.ts → lanzar, con sus
// topes), «No» las descarta y «Deshacer» vuelve atrás lo que se hizo (si nadie lo tocó a mano después). Sin «Espera tu OK» si no
// hay nada esperando. Una baja de 80 % o más vuelve como «confírmalo»: eso se confirma en la pantalla del Media Buyer, con su
// tarjeta (no se aprueba a ciegas desde acá).
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { CriaturaMako } from '@/app/onboarding/CriaturaMako';
import type { Decision, EstadoEntidad } from '@/lib/media-buyer/tipos';
import { Grafico } from './iconos';

const VER = 5;

async function api(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; confirmar?: string; ajuste?: string | null }> {
  try {
    const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'No pude conectarme.' }; }
}
async function releer(): Promise<Decision[] | null> {
  try { const r = await (await fetch('/api/media-buyer', { cache: 'no-store' })).json(); return r.ok ? (r.decisiones as Decision[]) : null; } catch { return null; }
}

const plata = (n: number | undefined, moneda: string | null) => (n == null ? null : `${moneda && moneda !== 'USD' ? `${moneda} ` : 'US$ '}${n.toLocaleString('es', { maximumFractionDigits: 2 })}`);
function AntesDespues({ antes, despues, moneda }: { antes: EstadoEntidad; despues: EstadoEntidad; moneda: string | null }) {
  if (antes.presupuesto != null && despues.presupuesto != null && antes.presupuesto !== despues.presupuesto) {
    const pct = antes.presupuesto > 0 ? Math.round(((despues.presupuesto - antes.presupuesto) / antes.presupuesto) * 100) : null;
    return <div className="frn-dec2__num"><s>{plata(antes.presupuesto, moneda)}</s><span>→</span><b>{plata(despues.presupuesto, moneda)}</b><small>por día</small>{pct != null && <em>{pct > 0 ? '+' : ''}{pct} %</em>}</div>;
  }
  if (antes.estado && despues.estado && antes.estado !== despues.estado) {
    return <div className="frn-dec2__num"><b>{despues.estado === 'PAUSED' ? 'Apagar' : 'Prender'}</b></div>;
  }
  return null;
}

const hora = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso); const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  const hm = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoy.toDateString()) return `Hoy, ${hm}`;
  if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hm}`;
  return `${d.toLocaleDateString('es', { day: 'numeric', month: 'short' })}, ${hm}`;
};

export function PilotoAnuncios({ conectada, existeTabla, piloto, decisiones, onDecisiones, avisar }: {
  conectada: boolean; existeTabla: boolean; piloto: { encendido: boolean; modo: 'propone' | 'piloto' } | null;
  decisiones: Decision[]; onDecisiones: (d: Decision[]) => void; avisar: (m: string, tono?: 'bad' | 'good') => void;
}) {
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);
  if (!conectada) {
    return (
      <section className="frn-card cop-vacio">
        <h2 className="frn-card__t">Piloto automático de tus anuncios</h2>
        <p>Conecta tu cuenta de anuncios y te propongo qué subir, qué apagar y qué probar, con el dato de cada decisión.</p>
        <ConectarViaZernio red="metaads" volver="/ads-manager/copiloto?paso=piloto&tarjeta=anuncios">Conectar anuncios</ConectarViaZernio>
      </section>
    );
  }
  const esperan = decisiones.filter((d) => d.estado === 'abierta');
  const hice = decisiones.filter((d) => d.estado === 'aplicada' || d.estado === 'deshecha')
    .sort((a, b) => (b.aplicadaAt ?? b.creada).localeCompare(a.aplicadaAt ?? a.creada));
  const visibles = todas ? hice : hice.slice(0, VER);

  const accion = async (d: Decision, op: 'lanzar' | 'descartar' | 'deshacer', ok: string) => {
    setOcupada(d.id);
    const r = await api({ op, id: d.id });
    setOcupada(null);
    if (r.confirmar) { avisar(`${r.confirmar} Confírmalo en el Media Buyer.`, 'bad'); return; }
    if (r.ok) avisar(r.ajuste ? `${ok}. ${r.ajuste}` : ok, 'good'); else avisar(r.error || 'No se pudo.', 'bad');
    const nuevas = await releer();
    if (nuevas) onDecisiones(nuevas);
  };

  return (
    <div className="frn-pila">
      <div className="frn-subtabs">
        <span className="frn-subtabs__aire" />
        <Link className="frn-btn frn-btn--ghost" href="/dashboard?hoja=marketing"><Grafico />Métricas</Link>
      </div>
      {(!piloto || !piloto.encendido || piloto.modo !== 'piloto') && (
        <section className="frn-card frn-rem frn-rem--ancho">
          <p className="frn-rem__h">{!existeTabla ? 'El piloto todavía no está listo en tu cuenta.' : piloto?.encendido ? 'Hoy te propongo y tú apruebas: nada se hace solo.' : 'El piloto está apagado: no reviso tu cuenta cada día.'}</p>
          <Link className="frn-btn" href="/ads-manager/ajustes">Configurar piloto</Link>
        </section>
      )}
      {esperan.length > 0 && (
        <section className="frn-card">
          <h2 className="frn-card__t">Espera tu OK</h2>
          <ul className="frn-decs2">
            {esperan.map((d) => (
              <li key={d.id} className="frn-dec2">
                {d.anuncioBase?.miniatura ? <img className="frn-dec2__img" src={d.anuncioBase.miniatura} alt="" loading="lazy" /> : <span className="frn-dec2__img" aria-hidden />}
                <div className="frn-dec2__txt">
                  <b>{d.titulo}</b>
                  <p>{d.porque.join(' ')}</p>
                  {d.numeros[0] && <span className="frn-dec2__topes">{d.numeros[0].condicion}: {d.numeros[0].valor}</span>}
                </div>
                <AntesDespues antes={d.antes} despues={d.despues} moneda={d.moneda} />
                <div className="frn-dec2__acc">
                  <button type="button" className="frn-btn frn-btn--primary frn-btn--chico" disabled={ocupada != null} onClick={() => accion(d, 'lanzar', 'Hecho')}>{ocupada === d.id ? '…' : 'Aprobar'}</button>
                  <button type="button" className="frn-btn frn-btn--ghost frn-btn--chico" disabled={ocupada != null} onClick={() => accion(d, 'descartar', 'Listo, no lo hago')}>No</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="frn-card">
        <h2 className="frn-card__t">Lo que hice</h2>
        {visibles.length ? (
          <ol className="frn-evs">
            {visibles.map((d) => (
              <li key={d.id} className="frn-ev frn-ev--mako">
                <span className="frn-ev__mako"><CriaturaMako size={22} /></span>
                <div>
                  <span className="frn-ev__h">{hora(d.aplicadaAt ?? d.creada)}{d.estado === 'deshecha' ? ' · deshecho' : ''}</span>
                  <p><b>{d.titulo}</b> {d.porque[0] ?? ''}</p>
                  {d.numeros[0] && <span className="frn-ev__dato">{d.numeros[0].valor}</span>}
                </div>
                {d.estado === 'aplicada' && <button type="button" className="frn-chip" disabled={ocupada != null} onClick={() => accion(d, 'deshacer', 'Deshecho')}>{ocupada === d.id ? '…' : 'Deshacer'}</button>}
              </li>
            ))}
          </ol>
        ) : <p className="frn-rem__h">Todavía no hice nada en tu cuenta.</p>}
        {hice.length > VER && <button type="button" className="frn-btn frn-btn--ghost frn-btn--ancho" onClick={() => setTodas((v) => !v)}>{todas ? 'Ver menos' : 'Ver más'}</button>}
      </section>
    </div>
  );
}
