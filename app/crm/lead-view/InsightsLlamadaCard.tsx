'use client';

// =============================================================================
// InsightsLlamadaCard — lo que salió de la LLAMADA, al lado de lo que el lead
// contestó en el formulario
// =============================================================================
// DECISIÓN DEL DUEÑO (04/10/2026): «las respuestas del Calendly son diferentes,
// debería haber un apartado para los insights que salieron de la llamada». Las
// dos cosas se muestran por separado y cada apartado dice de dónde salió: el del
// formulario vive dentro del bloque de cada reunión («Respuestas del formulario
// de Calendly»), éste vive abajo y lo firma MaKo.
//
// ⚠️ LO QUE AFIRMA LO ESCRIBIÓ UN MODELO, ASÍ QUE VA COMO MaKo. No es un estilo:
// el rótulo, la marca y la forma salen de `lib/mako-gramatica.ts` vía la
// primitive <Mako>, que es lo que hace que «lo que dijo el lead» y «lo que leyó
// la IA» no se puedan confundir en ninguna pantalla del producto.
//
// Los datos NO viajan por props desde el server a propósito: este apartado lo
// monta `ReunionesCard`, que se dibuja desde DOS parents (el modal del CRM, que
// es client, y la ruta /crm/[id], que es server). Pedirlo acá es lo que permite
// que el apartado exista en los dos sin tocar ninguno de los dos.
// =============================================================================

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Mako } from '@/app/_ui';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { repartirPorReunion, type InsightLlamada } from '@/lib/insights-llamada-reparto';
import type { FathomLink } from '@/lib/leads';
import { insightsDeLlamadaAction } from '../insights-actions';

const MONO = "'Geist Mono', monospace";
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const nota: CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--dim)' };

/** Una llamada con el rótulo de la reunión a la que pertenece. */
type Rotulada = { label: string; c: InsightLlamada };

/** El resumen de la charla y las objeciones: lo que respalda lo que la fila afirma. */
function Evidencia({ c }: { c: InsightLlamada }): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {c.resumen && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' }}>{c.resumen}</p>}
      {c.objeciones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {c.objeciones.map((o, i) => (
            <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ fontSize: 11.5, color: o.handled ? 'var(--dim)' : 'var(--bad)', marginBottom: 3 }}>
                {o.handled ? 'Objeción respondida' : 'Objeción abierta'}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{o.quote}</div>
              {o.note && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4, lineHeight: 1.45 }}>{o.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightsLlamadaCard({ leadId, links, hayGrabacion }: {
  leadId: number;
  /** Las grabaciones cargadas en la ficha: deciden a qué reunión va cada análisis. */
  links: FathomLink[];
  /** Si no hay ninguna grabación, el vacío no es un vacío: todavía no hay nada que escuchar. */
  hayGrabacion: boolean;
}) {
  const [fase, setFase] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [llamadas, setLlamadas] = useState<InsightLlamada[]>([]);

  useEffect(() => {
    let vivo = true;
    insightsDeLlamadaAction(leadId)
      .then((r) => {
        if (!vivo) return;
        // ⚠️ UN FALLO DE LECTURA NO SE PINTA COMO «todavía no la escuché»: eso
        // manda a pagar un análisis que puede estar hecho. Son dos estados.
        if (r.ok) { setLlamadas(r.llamadas); setFase('listo'); } else { setFase('error'); }
      })
      .catch(() => { if (vivo) setFase('error'); });
    return () => { vivo = false; };
  }, [leadId]);

  if (fase === 'cargando') return null;

  if (fase === 'error') {
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ ...sectLabel, marginBottom: 8 }}>Lo que salió de la llamada</div>
        <p style={nota}>No pude leer el análisis. Recarga la ficha.</p>
      </div>
    );
  }

  if (!llamadas.length) {
    // Sin grabación no falta nada: el bloque de la reunión ya dice que no hay.
    if (!hayGrabacion) return null;
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ ...sectLabel, marginBottom: 8 }}>Lo que salió de la llamada</div>
        <p style={nota}>
          MaKo todavía no escuchó esta llamada.{' '}
          <Link href={`/crm/${leadId}/resumen`} style={{ color: 'var(--accent)' }}>Analizarla</Link>
        </p>
      </div>
    );
  }

  const { R1, R2, otras } = repartirPorReunion(llamadas, links);
  const filas: Rotulada[] = [
    ...R1.map((c) => ({ label: 'Reunión 1', c })),
    ...R2.map((c) => ({ label: 'Reunión 2', c })),
    // `otras` se dibuja igual: es una llamada analizada que no matchea ninguna
    // grabación cargada ni trae tipo. Esconderla sería tirar el análisis.
    ...otras.map((c) => ({ label: 'Llamada', c })),
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...sectLabel, marginBottom: 10 }}>Lo que salió de la llamada</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filas.map(({ label, c }) => (
          <Mako
            key={c.recordingId}
            estado="explica"
            titulo={`${label} · ${c.outcome ?? 'Sin definir'}`}
            detalle={c.proximoPaso ?? undefined}
            cuando={c.callDate ? fmtDDMMYYYY(c.callDate) : undefined}
            // Sin resumen ni objeciones no hay nada que respaldar, y un chevron
            // que abre un modal vacío es una promesa que no se cumple. La fila
            // sigue abriendo por `ver`, que lleva a la llamada entera.
            evidencia={c.resumen || c.objeciones.length ? <Evidencia c={c} /> : undefined}
            evidenciaRotulo="Lo que dijo en la llamada"
            ver={{ capacidad: 'llamadas', label: 'Ver la llamada entera' }}
          />
        ))}
      </div>
    </div>
  );
}
