'use client';

// =============================================================================
// Chats — la pestaña de entrada del Centro: los chats de Claude con su punto y lo que hizo cada uno
// =============================================================================
// Martín (15/10/2026): «Al principio debería haber una tab que simule los chats... "En curso" podría ser el
// ícono verde en los chats de grok... "Pushes" podría estar en un apartado tipo historial de cada chat».
// La cáscara de Grok espera las capturas de su cuenta; esto ya muestra lo que se mide: la lista de chats
// (lib/centro-chats.ts) con su estado y su edad, y adentro de cada uno su conversación (lo que se le pidió y
// lo que hizo). La lista dice de dónde sale: hoy sólo la cuenta 1 tiene cartero.
// ⚠️ Un chat es una SESIÓN: lo anotado sin sesión se ve aparte, marcado «por nombre».

import { Fragment, useMemo, useState, type KeyboardEvent } from 'react';
import { historialDelChat, type ChatCentro, type EstadoChat, type TrabajoP } from '@/lib/centro-chats';
import { ROTULO_TIPO, hace, pushDelCommit, type PedidoP, type PushP } from '@/lib/progreso-reglas';

const ROTULO: Record<EstadoChat, string> = { trabajando: 'Trabajando', abierto: 'Abierto', cerrado: 'Cerrado', sin_dato: 'Sin dato' };
const TONO: Record<EstadoChat, string> = { trabajando: 'good', abierto: 'info', cerrado: 'neutro', sin_dato: 'neutro' };

function Estado({ c, ahora }: { c: ChatCentro; ahora: number }) {
  return (
    <span title={c.viejo && c.vistoAt ? 'El cartero no da vueltas: es lo último que vio' : undefined}>
      <span className={`prog-dot prog-dot--${c.viejo ? 'neutro' : TONO[c.estado]}`} aria-hidden />
      {ROTULO[c.estado]}
      {c.viejo && c.vistoAt != null && <span className="prog-meta">{`visto ${hace(c.vistoAt, ahora)}`}</span>}
    </span>
  );
}

function Conversacion({ c, pedidos, trabajos, pushes, ahora }: {
  c: ChatCentro; pedidos: ReadonlyMap<string, PedidoP>; trabajos: readonly TrabajoP[]; pushes: readonly PushP[]; ahora: number;
}) {
  const lineas = historialDelChat(c, pedidos, trabajos);
  if (!lineas.length) {
    return <p className="prog-meta">{c.porNombre ? 'Sin pedidos anotados en estos días.' : 'Todavía no anotó trabajo con su sesión: lo de antes del 16/10 está en el chat «por nombre».'}</p>;
  }
  return (
    <div className="prog-actividad">
      {lineas.map((l, i) => {
        if (l.tipo === 'trabajo') {
          return <div key={i} className="prog-paso"><span className="prog-dot prog-dot--info" aria-hidden /><strong>Trabajo firmado</strong><span className="prog-meta">{hace(l.instante, ahora)}</span></div>;
        }
        if (l.tipo === 'derivado') {
          return (
            <div key={i} className="prog-paso">
              <span className="prog-dot prog-dot--warn" aria-hidden /><strong>Martín pidió acá</strong>
              <span className="prog-meta">{`${hace(l.instante, ahora)} · lo trabajó ${l.trabajaron.join(', ') || 'nadie todavía'}`}</span>
              <p className="prog-texto">{l.pedido.texto}</p>
            </div>
          );
        }
        return (
          <Fragment key={i}>
            <div className="prog-paso">
              <span className="prog-dot prog-dot--warn" aria-hidden /><strong>Martín pidió</strong>
              <span className="prog-meta">{`${hace(l.instante, ahora)}${l.desde ? ` · desde ${l.desde}` : ''}`}</span>
              <p className="prog-texto">{l.pedido.texto}</p>
            </div>
            {l.pasos.map((s, j) => (
              <div key={j} className="prog-paso">
                <span className={`prog-dot prog-dot--${s.tipo === 'implementacion' ? 'good' : 'info'}`} aria-hidden />
                <strong>{ROTULO_TIPO[s.tipo] ?? s.tipo}</strong><span className="prog-meta">{hace(s.instante, ahora)}</span>
                <p className="prog-texto">{s.titulo}</p>
                {s.commits.map((k) => {
                  const push = pushDelCommit(k.sha, pushes);
                  return <p key={k.sha} className="prog-commit"><code>{k.sha.slice(0, 9)}</code> {k.msg}{push && <span className="prog-meta">{`subió ${hace(push.creado, ahora)}`}</span>}</p>;
                })}
              </div>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}

export function ChatsCentro({ chats, cuentas, pedidos, trabajos, pushes, ahora }: {
  chats: ChatCentro[];
  /** Qué cuentas tienen cartero: la lista dice de dónde sale. */
  cuentas: string[];
  pedidos: PedidoP[];
  trabajos: TrabajoP[];
  pushes: PushP[];
  ahora: number;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);
  const alternar = (k: string) => setAbierto((a) => (a === k ? null : k));
  const teclado = (k: string) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(k); } };
  return (
    <>
      <p className="prog-nota">
        {cuentas.length ? `El estado sale del cartero de ${cuentas.join(', ')}; los chats de otras cuentas aparecen por lo que anotaron.` : 'Sin cartero: los chats aparecen por lo que anotaron en sus bitácoras.'}
        {' '}Los marcados «por nombre» son lo anotado antes del 16/10, sin sesión.
      </p>
      {!chats.length ? <p className="prog-vacio">Ningún chat con actividad en estos días.</p> : (
        <div className="prog-caja">
          <table className="prog-tabla">
            <thead><tr><th>Chat</th><th style={{ width: '22%' }}>Estado</th><th className="prog-opc" style={{ width: '10%' }}>Cuenta</th><th className="prog-opc" style={{ width: '10%' }}>Pedidos</th><th style={{ width: '14%' }}>Actividad</th></tr></thead>
            <tbody>
              {chats.map((c) => (
                <Fragment key={c.clave}>
                  <tr className="prog-fila" tabIndex={0} aria-expanded={abierto === c.clave} onClick={() => alternar(c.clave)} onKeyDown={teclado(c.clave)}>
                    <td title={c.titulo}>{c.titulo}{c.porNombre && <span className="prog-meta">por nombre</span>}</td>
                    <td><Estado c={c} ahora={ahora} /></td>
                    <td className="prog-opc">{c.cuenta ?? '—'}</td>
                    <td className="prog-opc prog-num">{c.pedidos.length || '—'}</td>
                    <td className="prog-num">{hace(c.actividad, ahora)}</td>
                  </tr>
                  {abierto === c.clave && <tr className="prog-detalle"><td colSpan={5}><Conversacion c={c} pedidos={porId} trabajos={trabajos} pushes={pushes} ahora={ahora} /></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
