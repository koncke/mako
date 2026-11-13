'use client';

// =============================================================================
// Marketing CoPilot — el retargeting sin VSL, en el piloto de Anuncios (13/11/2026)
// =============================================================================
// Martín (13/11): «retargeting sin VSL: MaKo revisa las conversaciones cada semana y marca en el CRM». Lo hace lib/retargeting.ts
// (del chat «MaKo en la app»): cada lunes lee las charlas de WhatsApp de los leads y los marca con etiquetas del CRM, sin mover la
// etapa. Acá se ve lo que hizo (cuántos en cada grupo) y se dispara lo que pide la persona:
//   · «Pasarlas al CRM»: las charlas con movimiento que todavía no tienen lead, con el alta de /chats (el tope del plan y los
//     duplicados viven ahí). Nunca lo hace MaKo solo.
// Los dos públicos de Meta («MaKo · No avanzaron» y «MaKo · Compraron») se prenden en la configuración del piloto.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import type { VistaRT } from '@/lib/retargeting-motor';

const GRUPOS: ReadonlyArray<readonly [keyof VistaRT['segmentos'], string]> = [
  ['no_respondio', 'No respondieron'], ['no_siguio', 'No siguieron'], ['no_compro', 'No compraron'], ['compro', 'Compraron'],
];

type Paso = { ok: boolean; creados?: number; yaEstaban?: number; elegir?: Array<{ id: number; nombre: string }>; error?: string };

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

export function Retargeting({ vista, avisar }: { vista: VistaRT | null; avisar: (m: string, tono?: 'bad' | 'good') => void }) {
  const [v, setV] = useState(vista);
  const [pasando, setPasando] = useState(false);
  const [elegir, setElegir] = useState<Paso['elegir'] | null>(null);
  if (!v) return null;

  const pasar = async (funnelId?: number) => {
    setPasando(true);
    try {
      const r = await (await fetch('/api/copiloto/piloto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'pasar-chats', ...(funnelId ? { funnelId } : {}) }) })).json() as Paso;
      if (r.elegir?.length) { setElegir(r.elegir); return; }
      if (!r.ok) { avisar(r.error || 'No pude pasarlas al CRM.', 'bad'); return; }
      setElegir(null);
      setV({ ...v, chatsSinLead: Math.max(0, v.chatsSinLead - (r.creados ?? 0) - (r.yaEstaban ?? 0)) });
      avisar(`Listo: ${r.creados ?? 0} ${r.creados === 1 ? 'lead nuevo' : 'leads nuevos'} en tu CRM.`, 'good');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No pude conectarme.', 'bad');
    } finally { setPasando(false); }
  };

  const pub = v.publicosMeta;
  return (
    <section className="frn-card cop-rt">
      <div className="frn-card__head"><h2 className="frn-card__t">Retargeting de tus conversaciones</h2><Link className="frn-chip" href="/crm">Ver en el CRM</Link></div>
      <p className="cop-rt__p">{v.ultimaRevision ? `Revisé tus charlas de WhatsApp el ${fecha(v.ultimaRevision)} y marqué en el CRM a quién volver a hablarle.` : 'Cada lunes reviso tus charlas de WhatsApp y marco en el CRM a quién volver a hablarle.'}</p>
      <ul className="cop-rt__grupos">
        {GRUPOS.map(([k, t]) => <li key={k}><b className="frn-num">{v.segmentos[k] ?? 0}</b><span>{t}</span></li>)}
      </ul>
      {pub.prendido && (
        <p className="cop-rt__p">En Meta mantengo «MaKo · No avanzaron»{pub.noAvanzaron ? ` (${pub.noAvanzaron.personas} personas)` : ''} y «MaKo · Compraron»{pub.compraron ? ` (${pub.compraron.personas})` : ''}.{pub.aviso ? ` ${pub.aviso}` : ''}</p>
      )}
      {v.chatsSinLead > 0 && (
        <div className="cop-rt__sinlead">
          <p><b>{v.chatsSinLead} {v.chatsSinLead === 1 ? 'conversación' : 'conversaciones'} sin lead</b> en los últimos 7 días.</p>
          {elegir ? (
            <div className="cop-acciones">{elegir.map((f) => <button key={f.id} type="button" className="frn-btn frn-btn--ghost frn-btn--chico" disabled={pasando} onClick={() => pasar(f.id)}>A {f.nombre}</button>)}</div>
          ) : (
            <button type="button" className="frn-btn frn-btn--primary frn-btn--chico" disabled={pasando} onClick={() => pasar()}>{pasando ? 'Pasándolas…' : 'Pasarlas al CRM'}</button>
          )}
        </div>
      )}
    </section>
  );
}

export const CSS_RETARGETING = `
.frn .cop-rt { display: flex; flex-direction: column; gap: 14px; }
.frn .cop-rt__p { margin: 0; font-size: 15.5px; line-height: 1.5; color: var(--ink); max-width: 75ch; }
.frn .cop-rt__grupos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.frn .cop-rt__grupos li { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: 14px; background: var(--panel); }
.frn .cop-rt__grupos b { font-size: 28px; font-weight: 700; color: var(--ink); }
.frn .cop-rt__grupos span { font-size: 15px; color: var(--ink); }
.frn .cop-rt__sinlead { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 14px 16px; border-radius: 14px; box-shadow: inset 0 0 0 1px var(--hair); }
.frn .cop-rt__sinlead p { margin: 0; font-size: 15.5px; color: var(--ink); }
@container frn (max-width: 700px) { .frn .cop-rt__grupos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;
