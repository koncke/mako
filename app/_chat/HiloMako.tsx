'use client';

// =============================================================================
// El hilo de un chat con MaKo, con la cara del Centro de Operaciones (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md: la conversación de la pieza única. Dibuja el `ItemHilo` del teléfono
// (app/m/mako/chat-ui.ts: lo que el turno guardó, lo que espera confirmación, los avisos) con las formas del Centro
// (app/admin/operaciones/Hilo.tsx): lo de la persona en una burbuja a la derecha, lo de MaKo suelto a la izquierda
// con su muñeco (Grok Bot), la píldora del día cuando cambia (WhatsApp). El texto de MaKo va por <Markdown>.
//
// ⚠️ LA HORA ES LA DEL NAVEGADOR DE QUIEN MIRA, no la de Argentina: el Centro es de Martín y fija su reloj; este chat
//    es de cualquier negocio (AGENTS.md, la zona horaria por ubicación).

import type { ReactNode } from 'react';
import { Markdown } from '@/app/_components/Markdown';
import Link from '@/app/_ui/Link';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ERROR_INCIERTO, textoConArchivos, type ItemHilo } from '@/app/m/mako/chat-ui';
import { TarjetaAccion, type ItemPropuesta } from './TarjetaAccion';
import { ArchivosHilo } from './ArchivosHilo';

const hora = (iso: string | null): string => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
};
const diaDe = (iso: string | null): string | null => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t).toDateString() : null;
};
function rotuloDia(iso: string, ahora: number): string {
  const t = Date.parse(iso);
  const dia = (x: number) => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const d = Math.round((dia(ahora) - dia(t)) / 86_400_000);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  return new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export type Quien = { nombre: string; aspecto?: Parameters<typeof Muneco>[0]['aspecto'] };

/** Lo de MaKo: su muñeco y lo que dijo (o la tarjeta), a la izquierda. */
function DeMako({ quien, children, rotulo }: { quien: Quien; children: ReactNode; rotulo?: string }) {
  return (
    <div className="co-el">
      <Muneco titulo={quien.nombre} aspecto={quien.aspecto} animo="despierto" size={26} />
      <div className="co-el__cuerpo">
        {rotulo && <p className="co-el__rotulo">{rotulo}</p>}
        {children}
      </div>
    </div>
  );
}

export function HiloMako({ items, quien, ahora, escribiendo, tarjeta, onTarjeta, onReintentar, onRecargar }: {
  items: readonly ItemHilo[];
  /** El chat: su muñeco va al lado de lo que dice MaKo. */
  quien: Quien;
  ahora: number;
  /** MaKo está contestando (los segundos que lleva), o null. */
  escribiendo: { segs: number } | null;
  /** La tarjeta que está corriendo (sólo una por vez). */
  tarjeta: { id: number; accion: 'confirmar' | 'cancelar' } | null;
  onTarjeta: (x: ItemPropuesta, accion: 'confirmar' | 'cancelar') => void;
  /** Mandar otra vez lo que NO llegó (un 4xx). */
  onReintentar: (id: string) => void;
  /** Lo que no se sabe si llegó: se recarga y se mira, nunca se reintenta a ciegas. */
  onRecargar: () => void;
}) {
  const filas: ReactNode[] = [];
  let ultimoDia: string | null = null;
  items.forEach((x) => {
    if (x.k === 'msg' && x.at) {
      const d = diaDe(x.at);
      if (d && d !== ultimoDia) { filas.push(<span key={`d-${x.id}`} className="co-dia">{rotuloDia(x.at, ahora)}</span>); ultimoDia = d; }
    }
    if (x.k === 'msg' && x.role === 'user') {
      const archivos = x.archivos ?? [];
      const texto = archivos.length ? textoConArchivos(x.texto) : x.texto;
      const pie = <span className="co-burbuja__pie">{x.estado === 'enviando' ? 'Enviando…' : hora(x.at)}</span>;
      filas.push(
        <div key={x.id} className="co-yo">
          {archivos.length > 0 && <ArchivosHilo archivos={archivos} />}
          {texto ? <p className="co-burbuja">{texto}{pie}</p> : <p className="ch-pie-suelto">{pie}</p>}
          {x.estado === 'error' && (
            <p className="co-nota co-nota--mal" role="alert">{x.error}{' '}
              <button type="button" className="ch-enlace" onClick={() => onReintentar(x.id)}>Reintentar</button></p>
          )}
          {x.estado === 'incierto' && (
            <p className="co-nota co-nota--mal" role="alert">{x.error ?? ERROR_INCIERTO}{' '}
              <button type="button" className="ch-enlace" onClick={onRecargar}>Recargar el chat</button></p>
          )}
        </div>,
      );
      return;
    }
    if (x.k === 'msg') {
      filas.push(
        <DeMako key={x.id} quien={quien}>
          <div className="ch-md"><Markdown text={x.texto} /></div>
          {/* Lo pedido que se hace en otra pantalla: el link para ir, como el «Ir a …» de los otros chats (tanda 10). */}
          {!!x.irA?.length && (
            <div className="ch-ira">{x.irA.map((l) => <Link key={l.link} className="co-chip" href={l.link}>{`Ir a ${l.titulo}`}</Link>)}</div>
          )}
        </DeMako>,
      );
      return;
    }
    if (x.k === 'aviso') {
      filas.push(x.tono === 'plataforma'
        ? <p key={x.id} className="co-nota co-nota--mal" role="status">{x.texto}</p>
        : <DeMako key={x.id} quien={quien}><div className="ch-md"><Markdown text={x.texto} /></div></DeMako>);
      return;
    }
    if (x.k === 'pantalla') {
      filas.push(
        <DeMako key={x.id} quien={quien}>
          <div className="ch-tarjeta">
            <p className="ch-tarjeta__resumen"><strong>{x.p.titulo}</strong></p>
            <p className="ch-tarjeta__nota">Se revisa y se confirma en su pantalla.</p>
            <div className="ch-tarjeta__botones"><a className="co-chip" href={x.p.escritorio}>Abrir para revisar</a></div>
          </div>
        </DeMako>,
      );
      return;
    }
    filas.push(
      <DeMako key={x.id} quien={quien}>
        <TarjetaAccion x={x} enCurso={tarjeta?.id === x.t.pendienteId ? tarjeta.accion : null}
          bloqueada={!!tarjeta && tarjeta.id !== x.t.pendienteId} onCorrer={(a) => onTarjeta(x, a)} />
      </DeMako>,
    );
  });
  if (escribiendo) {
    filas.push(
      <DeMako key="escribiendo" quien={quien}>
        <p className="co-el__rotulo" role="status">
          {'MaKo está escribiendo…'}{escribiendo.segs >= 20 ? ' · puede tardar un par de minutos' : ''}
        </p>
      </DeMako>,
    );
  }
  return <>{filas}</>;
}
