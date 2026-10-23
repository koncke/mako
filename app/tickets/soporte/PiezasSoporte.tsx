'use client';

// =============================================================================
// Las piezas del chat de Soporte (23/10/2026): el hilo, la tarjeta del ticket armado, la tira de tickets y su estado
// =============================================================================
// El hilo y la caja son los del Ops Center (HiloMako, CajaChat): «el mismo diseño que un chat» (Martín, 22/10/2026). Lo
// propio de Soporte —la diferencia con los otros chats— es que cada conversación termina en un TICKET: la tarjeta con lo
// que se le va a mandar al equipo, y arriba sus tickets con en qué anda cada uno.
// ⚠️ Trae CSS (las piezas del Ops Center): quien lo importa desde algo que lee un test lo carga con next/dynamic.

import '@/app/admin/operaciones/centro.css';
import '@/app/tickets/tickets.css';
import './soporte.css';
import { useEffect, type RefObject } from 'react';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import { CajaChat } from '@/app/_chat/CajaChat';
import { Status } from '@/app/_ui';
import { TIPOS } from '@/lib/tickets-reglas';
import { rotuloTipo } from '@/lib/soporte-chat';
import { hace } from '../navegador';
import { TONO_ESTADO } from './hilo-soporte';
import type { Soporte } from './useSoporte';

/** Quien contesta en Soporte: su criatura en la cabecera y al lado de lo que dice MaKo o el equipo. */
export const QUIEN_SOPORTE = { nombre: 'Soporte' };

/** El hilo, con la tarjeta del ticket armado en la última propuesta de MaKo. */
export function HiloSoporte({ s, hilo }: { s: Soporte; hilo: RefObject<HTMLElement | null> }) {
  // Lo nuevo se ve: el hilo baja con cada fila (como el del Ops Center).
  useEffect(() => { const h = hilo.current; if (h) h.scrollTop = h.scrollHeight; }, [s.items.length, s.abierto, hilo]);
  const enMensaje = (x: { id: string }): EnMensaje | null => (x.id === s.idTarjeta && !s.ticket ? { abajo: <TarjetaTicket s={s} /> } : null);
  return (
    <HiloMako items={s.items} quien={QUIEN_SOPORTE} ahora={Date.now()} escribiendo={null} tarjeta={null} onTarjeta={() => {}}
      onReintentar={s.reintentar} onRecargar={() => s.abrir(s.abierto)} onResponder={(t) => s.mandar(t)} enMensaje={enMensaje} />
  );
}

/** El ticket que se va a mandar: qué es (lo puede cambiar), el título y todo lo que contó, y el botón. */
export function TarjetaTicket({ s }: { s: Soporte }) {
  const b = s.borrador;
  if (!b) return null;
  const tipo = s.tipoElegido ?? b.tipo;
  return (
    <div className="ch-tarjeta sp-tarjeta" data-tarjeta="ticket">
      <div className="ch-tarjeta__cabeza"><span>Lo que le mando al equipo</span></div>
      <p className="ch-tarjeta__resumen"><strong>{b.titulo}</strong></p>
      <div className="sp-tipos" role="radiogroup" aria-label="Qué es">
        {TIPOS.map((t) => (
          <button key={t.clave} type="button" role="radio" aria-checked={tipo === t.clave} className="co-chip"
            aria-pressed={tipo === t.clave} onClick={() => s.setTipoElegido(t.clave)}>{t.rotulo}</button>
        ))}
      </div>
      <p className="ch-tarjeta__nota sp-tarjeta__detalle">{b.descripcion}</p>
      {s.errorTarjeta && <p className="ch-tarjeta__nota sp-tarjeta__error" role="status">{s.errorTarjeta}</p>}
      <div className="ch-tarjeta__botones">
        <button type="button" className="co-chip co-chip--primario" disabled={s.mandando} onClick={() => void s.mandarTicket()}>
          {s.mandando ? 'Mandando…' : 'Mandárselo al equipo'}
        </button>
        <span className="ch-tarjeta__nota">Como «{rotuloTipo(tipo)}». Te aviso aquí cuando conteste.</span>
      </div>
    </div>
  );
}

/** La tira de arriba: empezar una conversación nueva y cada ticket con en qué anda. */
export function TiraTickets({ s }: { s: Soporte }) {
  return (
    <nav className="sp-tira" aria-label="Tus tickets">
      <button type="button" className="co-chip sp-tira__nuevo" aria-pressed={s.abierto === 'nuevo'} onClick={s.nuevo}>
        <span aria-hidden>＋</span> Contarle a MaKo
      </button>
      {s.tickets.map((t) => (
        <button key={t.id} type="button" className="co-chip sp-tira__ticket" aria-pressed={s.abierto === t.id} onClick={() => s.abrir(t.id)}
          title={`#${t.id} · ${t.titulo} · ${t.rotulo}`}>
          <span className="sp-tira__num">#{t.id}</span>
          <span className="sp-tira__titulo">{t.titulo}</span>
          <Status tono={TONO_ESTADO[t.estado]}>{t.rotulo}</Status>
        </button>
      ))}
    </nav>
  );
}

/** Arriba de la conversación de un ticket: en qué anda, con cada paso y cuándo (el historial). */
export function EstadoDelTicket({ s }: { s: Soporte }) {
  const t = s.ticket;
  if (!t) return null;
  return (
    <div className="sp-estado">
      <span className="sp-estado__titulo">#{t.id} · {t.titulo}</span>
      <Status tono={TONO_ESTADO[t.estado]} solido>{t.rotulo}</Status>
      <ol className="tickets-historial sp-historial" aria-label="Historial del ticket">
        {t.historial.map((p) => (
          <li key={`${p.paso}-${p.at}`} className="tickets-historial__paso" data-paso={p.paso}>
            <span className="tickets-historial__rotulo">{p.rotulo}</span>
            <span className="tickets-historial__cuando">{hace(p.at)}</span>
          </li>
        ))}
      </ol>
      {t.canal && <span className="sp-estado__canal">{t.canal}</span>}
    </div>
  );
}

/** La caja única, con lo que dice según dónde está la conversación. */
export function CajaSoporte({ s, movil = false }: { s: Soporte; movil?: boolean }) {
  return (
    <CajaChat texto={s.texto} onTexto={s.setTexto} onMandar={() => { s.mandar(); }} enviando={s.enviando} apagado={s.apagado || s.cargando}
      placeholder={s.placeholder} tituloMandar={s.ticket ? 'Mandárselo al equipo' : 'Contárselo a MaKo'} enterManda={!movil}
      {...(movil ? { fila: 'm-operaciones-caja__fila' } : {})} />
  );
}
