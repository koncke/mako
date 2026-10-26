'use client';

// =============================================================================
// SumarseAgency — «Sumarme como Agency»: tres preguntas, una por pantalla, y al dashboard (25/10/2026)
// =============================================================================
// La misma metodología que Partners (docs/feedback-25-10-tarde.md punto 3: «posterior a apretar eso, un pequeño
// onboarding, que le pregunte algunas cosas»). Lo que contesta sirve: «¿quién paga hoy?» decide qué opción propone
// primero el alta de un cliente (lib/agency-reglas.ts, `quienPagaSugerido`). Nada es obligatorio: «Saltar» también suma.
// El núcleo es `sumarseComoAgency` (lib/agency.ts), que repregunta el plan.

import { useState } from 'react';
import { Modal } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { CUANTOS_CLIENTES, QUIEN_PAGA_HOY } from '@/lib/agency-reglas';
import { sumarmeComoAgencyAction } from './actions';

type Respuestas = { clientes: string | null; rubro: string; pagaHoy: string | null };

const ROTULO_CLIENTES: Record<(typeof CUANTOS_CLIENTES)[number], string> = { '1-5': 'De 1 a 5', '6-20': 'De 6 a 20', '21-50': 'De 21 a 50', '50+': 'Más de 50' };
const ROTULO_PAGA_HOY: Record<(typeof QUIEN_PAGA_HOY)[number], string> = { yo: 'Las pago yo', clientes: 'Las pagan mis clientes', depende: 'Depende del cliente' };

export function SumarseAgency({ onCerrar }: { onCerrar: () => void }) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [r, setR] = useState<Respuestas>({ clientes: null, rubro: '', pagaHoy: null });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const terminar = async (final: Respuestas) => {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    const res = await sumarmeComoAgencyAction(final).catch(() => ({ ok: false as const, error: 'No pude sumarte. Reintenta en un momento.' }));
    if (!res.ok) { setError(res.error); setOcupado(false); return; }
    router.refresh();
  };
  const siguiente = (nuevo: Partial<Respuestas>) => {
    const r2 = { ...r, ...nuevo };
    setR(r2);
    if (paso < 2) setPaso(paso + 1); else void terminar(r2);
  };

  const pie = (
    <div className="sa-pie">
      <span className="sa-puntos" aria-label={`Paso ${paso + 1} de 3`}>{[0, 1, 2].map((i) => <i key={i} data-on={i <= paso} />)}</span>
      {paso > 0 && <button type="button" className="sa-sec" onClick={() => setPaso(paso - 1)} disabled={ocupado}>Atrás</button>}
      {paso === 1
        ? <button type="button" className="sa-pri" onClick={() => siguiente({})} disabled={ocupado}>Seguir</button>
        : <button type="button" className="sa-sec" onClick={() => siguiente({})} disabled={ocupado}>Saltar</button>}
    </div>
  );

  return (
    <Modal titulo={['¿Cuántos clientes manejas hoy?', '¿A qué se dedican tus clientes?', '¿Quién paga hoy sus herramientas?'][paso]}
      encabezado="Sumarme como Agency" ancho={480} onCerrar={onCerrar} pie={pie}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {paso === 0 && (
        <div className="sa-opciones">
          {CUANTOS_CLIENTES.map((c) => (
            <button key={c} type="button" className="sa-op" data-on={r.clientes === c} disabled={ocupado} onClick={() => siguiente({ clientes: c })}>{ROTULO_CLIENTES[c]}</button>
          ))}
        </div>
      )}
      {paso === 1 && (
        <input className="sa-input" autoFocus maxLength={120} value={r.rubro} placeholder="Ej.: inmobiliarias, coaches, clínicas"
          onChange={(e) => setR({ ...r, rubro: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') siguiente({}); }}
          aria-label="A qué se dedican tus clientes" />
      )}
      {paso === 2 && (
        <div className="sa-opciones">
          {QUIEN_PAGA_HOY.map((q) => (
            <button key={q} type="button" className="sa-op" data-on={r.pagaHoy === q} disabled={ocupado} onClick={() => siguiente({ pagaHoy: q })}>{ROTULO_PAGA_HOY[q]}</button>
          ))}
          <p className="sa-nota">Con esto, al abrir la cuenta de un cliente te proponemos primero quién la paga. Siempre puedes cambiarlo.</p>
        </div>
      )}
      {ocupado && <p className="sa-nota">Sumándote…</p>}
      {error && <p className="sa-error" role="alert">{error}</p>}
    </Modal>
  );
}

// Sin backticks acá adentro.
const CSS = `
.sa-opciones{ display:flex; flex-direction:column; gap:8px; }
.sa-op{ text-align:left; border:1px solid var(--border); background:var(--surface); color:var(--ink); border-radius:12px; padding:13px 16px;
  font:inherit; font-size:15px; font-weight:600; cursor:pointer; transition:border-color .15s ease, background .15s ease; }
.sa-op:hover, .sa-op[data-on="true"]{ border-color:var(--primary); background:var(--primary-bg); }
.sa-input{ width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:12px; padding:13px 14px; font:inherit; font-size:15px;
  background:var(--surface); color:var(--ink); }
.sa-pie{ display:flex; align-items:center; gap:10px; width:100%; }
.sa-puntos{ display:inline-flex; gap:6px; margin-right:auto; }
.sa-puntos i{ width:7px; height:7px; border-radius:50%; background:var(--border-strong, var(--border)); }
.sa-puntos i[data-on="true"]{ background:var(--primary); }
.sa-pri, .sa-sec{ border-radius:10px; padding:9px 16px; font:inherit; font-size:14px; font-weight:650; cursor:pointer; }
.sa-pri{ border:1px solid var(--primary); background:var(--primary); color:var(--on-primary, #fff); }
.sa-sec{ border:1px solid var(--border); background:var(--surface); color:var(--ink); }
.sa-nota{ margin:10px 0 0; font-size:13px; color:var(--dim); }
.sa-error{ margin:10px 0 0; font-size:13.5px; font-weight:600; color:var(--bad); }
`;
