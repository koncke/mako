'use client';

// =============================================================================
// ficha/pagos/cliente-en-cs — el bloque «Cliente en CS» de la tab Pagos (17/11/2026)
// =============================================================================
// Estaba en lib/ficha/catalogo.ts y en las plantillas de Pagos sin componente, y la ficha lo saltaba callada. Lo que dice
// (docs/diseno-ficha-bloques.md, fila `cliente-en-cs`): en un ganado, el estado del cliente en Customer Success, la etapa
// de entrega y desde cuándo, el avance y el acceso al curso, y su cuenta de MaKo. Si está de baja con cuotas que la
// cobranza le sigue recordando, lo avisa. Cierra con «Abrir en Customer Success».
//
// ⚠️ ES DE SÓLO LECTURA: cada dato tiene su único escritor en Customer Success. Aquí no hay un botón que escriba.
// ⚠️ LEE CON SU ACTION AL MONTARSE (../tipos.ts, punto 3): ./cliente-en-cs-actions.ts. Lo que se dibuja es puro y con
//    test (lib/cliente-en-cs.ts): este archivo sólo lo pinta en uno de sus tres diseños (chips, checklist, tarjeta).
// ⚠️ EL AVISO DE LA BAJA SE CALCULA CON LAS CUOTAS DE LA FICHA (`ctx.data.pagos`): al dar de baja las cuotas en el bloque
//    Cuotas, la ficha se relee y el aviso se va sin volver a pedir nada.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { Button, ButtonLink, Status } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { sinClienteEnCs, vistaClienteEnCs, type ClienteEnCsLeido, type PasoCs, type VistaClienteEnCs } from '@/lib/cliente-en-cs';
import type { PropsBloque } from '../tipos';
import { clienteEnCsAction } from './cliente-en-cs-actions';
import { Aviso, TONO_UI, Tarjeta, msg, nada } from './piezas';

const ABRIR = 'Abrir en Customer Success';
const chips: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const fila: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '9px 0', borderBottom: '1px solid var(--border)' };
const rotuloFila: CSSProperties = { fontSize: 13, color: 'var(--dim)', minWidth: 0 };
const detalle: CSSProperties = { fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' };

/** Lo leído, atado al lead que lo pidió: si la ficha cambia de lead, lo del anterior no se dibuja ni un instante. */
type Leido = { leadId: number; ahora: number } & ({ fase: 'leido'; leido: ClienteEnCsLeido } | { fase: 'error'; error: string });

export function ClienteEnCs({ ctx, titulo, diseno, editando, epico }: PropsBloque) {
  const { lead } = ctx;
  const aplica = !sinClienteEnCs(lead);
  const [res, setRes] = useState<Leido | null>(null);
  useEffect(() => {
    if (!aplica) return;
    let vivo = true;
    // `ahora` se toma al llegar la lectura (no en el render): es contra lo que se cuenta «entró hace 3 días».
    clienteEnCsAction(lead.id).then(
      (r) => { if (vivo) setRes(r.ok ? { leadId: lead.id, ahora: Date.now(), fase: 'leido', leido: r.leido } : { leadId: lead.id, ahora: Date.now(), fase: 'error', error: r.error }); },
      (e: unknown) => { if (vivo) setRes({ leadId: lead.id, ahora: Date.now(), fase: 'error', error: msg(e) }); },
    );
    return () => { vivo = false; };
  }, [lead.id, aplica]);
  if (!aplica) return null;

  const actual = res && res.leadId === lead.id ? res : null;

  if (!actual) return <Tarjeta titulo={titulo}><p style={nada}>Leyendo…</p></Tarjeta>;
  if (actual.fase === 'error') {
    return (
      <Tarjeta titulo={titulo}>
        <div role="alert" style={{ borderRadius: 11, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>
          No pude leer lo de Customer Success: {actual.error}
          <ReportarASoporte />
        </div>
      </Tarjeta>
    );
  }

  const cuotas = [...(ctx.data?.pagos ?? []), ...(ctx.data?.tratos ?? []).flatMap((t) => t.pagos)];
  const v = vistaClienteEnCs({ leido: actual.leido, cuotas, esSuscripcion: lead.venta_tipo === 'suscripcion', hoy: ctx.hoy, ahora: actual.ahora });
  if (!v) return null;
  return <VistaDelCliente v={v} titulo={titulo} diseno={diseno} editando={editando} epico={epico} />;
}

/** Lo que se DIBUJA, sin leer nada (17/11/2026): separado de la lectura para mirarlo con datos de ejemplo. */
export function VistaDelCliente({ v, titulo, diseno, editando, epico }: { v: VistaClienteEnCs; titulo: string; diseno: string; editando: boolean; epico: boolean }) {
  // Personalizando la ficha no se navega: el botón se ve, pero no lleva a ningún lado.
  const abrir = (href: string) => (editando
    ? <Button size="sm" variant="secondary" disabled>{ABRIR}</Button>
    : <ButtonLink href={href} size="sm" variant="secondary">{ABRIR}</ButtonLink>);
  return (
    <Tarjeta titulo={titulo} derecha={<Status tono={TONO_UI[v.estado.tono]}>{v.estado.texto}</Status>}>
      {diseno === 'checklist' ? <Checklist v={v} epico={epico} /> : diseno === 'tarjeta' ? <Renglones v={v} epico={epico} /> : <Chips v={v} epico={epico} />}
      {v.aviso && <Aviso tono="ambar">{v.aviso}</Aviso>}
      <div>{abrir(v.href)}</div>
    </Tarjeta>
  );
}

/** Lo que va en grande cuando la tab va épica: la etapa (o el estado), sin metadata. */
function Titular({ v }: { v: VistaClienteEnCs }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: v.titular.tono === 'ambar' ? 'var(--warn)' : v.titular.tono === 'rojo' ? 'var(--bad)' : 'var(--ink)' }}>{v.titular.texto}</span>
      {v.titular.detalle && <span style={{ fontSize: 14, color: 'var(--dim)' }}>{v.titular.detalle}</span>}
    </div>
  );
}

/** «Arranque · entró ayer · 40% visto»: un chip por dato. */
function Chips({ v, epico }: { v: VistaClienteEnCs; epico: boolean }) {
  return (
    <>
      {epico && <Titular v={v} />}
      {v.chips.length > 0 && (
        <div style={chips}>
          {v.chips.map((c) => <Status key={c.clave} tono={TONO_UI[c.tono]}>{c.texto}</Status>)}
        </div>
      )}
    </>
  );
}

/** Un renglón por dato: qué es, lo que dice y el detalle debajo. */
function Renglones({ v, epico }: { v: VistaClienteEnCs; epico: boolean }) {
  return (
    <>
      {epico && <Titular v={v} />}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {v.renglones.map((r) => (
          <div key={r.clave} style={fila}>
            <span style={rotuloFila}>{r.rotulo}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, minWidth: 0, maxWidth: '100%' }}>
              <Status tono={TONO_UI[r.tono]}>{r.texto}</Status>
              {r.detalle && <span style={detalle}>{r.detalle}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const MARCA: Readonly<Record<PasoCs['hecho'], { color: string; fondo: string; titulo: string }>> = {
  si: { color: 'var(--good)', fondo: 'var(--good-bg)', titulo: 'Hecho' },
  no: { color: 'var(--faint)', fondo: 'transparent', titulo: 'Pendiente' },
  'no-se': { color: 'var(--dim)', fondo: 'var(--surface-2)', titulo: 'No se pudo leer' },
};

/** «Listo para entregar»: cada paso con su marca. `no-se` (no se pudo leer) se dibuja distinto de «no». */
function Checklist({ v, epico }: { v: VistaClienteEnCs; epico: boolean }) {
  const todos = v.pasos.length > 0 && v.listos === v.pasos.length;
  return (
    <>
      <span style={{ fontSize: epico ? 30 : 14, fontWeight: 700, color: todos ? 'var(--good)' : 'var(--ink)' }}>
        {todos ? 'Todo listo para entregar' : `${v.listos} de ${v.pasos.length} pasos`}
      </span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {v.pasos.map((p) => {
          const m = MARCA[p.hecho];
          return (
            <li key={p.clave} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span role="img" title={m.titulo} aria-label={m.titulo} style={{ flex: 'none', width: 18, height: 18, borderRadius: 999, border: `1.5px solid ${m.color}`, background: m.fondo, color: m.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                {p.hecho === 'si' && <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 5.2l2 2L8 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                {p.hecho === 'no-se' && <span aria-hidden style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>?</span>}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: p.hecho === 'si' ? 'var(--ink)' : 'var(--dim)' }}>{p.texto}</span>
                {(p.detalle || p.hecho === 'no-se') && <span style={detalle}>{p.detalle ?? 'No se pudo leer'}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
