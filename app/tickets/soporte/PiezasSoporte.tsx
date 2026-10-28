'use client';

// =============================================================================
// Las piezas del chat de Soporte (23/10/2026): el hilo, la tarjeta del ticket armado, la lista de tickets y su estado
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
import { TONO } from '@/app/_ui/tokens';
import { Dropdown } from '@/app/components/Dropdown';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { TIPOS } from '@/lib/tickets-reglas';
import { hayClave } from '@/lib/claves-en-el-chat';
import { AvisoClave } from '@/app/_chat/AvisoClave';
import { rotuloTipo } from '@/lib/soporte-chat';
import { hace } from '../navegador';
import { TONO_ESTADO } from './hilo-soporte';
import type { Soporte } from './useSoporte';

/** Quien contesta en Soporte: MaKo, con SU criatura (la estrella), en la cabecera y al lado de lo que dice (Martín, 23/10/2026:
 *  «En la ticketera de clientes, la criatura debe ser la de MaKo»). La de «Soporte» salía de su nombre: una verde y redonda. */
export const QUIEN_SOPORTE = { nombre: 'MaKo', aspecto: ASPECTO_MAKO };

/** El hilo, con la tarjeta del ticket armado en la última propuesta de MaKo. */
export function HiloSoporte({ s, hilo }: { s: Soporte; hilo: RefObject<HTMLElement | null> }) {
  // Lo nuevo se ve: el hilo baja con cada fila (como el del Ops Center).
  useEffect(() => { const h = hilo.current; if (h) h.scrollTop = h.scrollHeight; }, [s.items.length, s.abierto, hilo]);
  const enMensaje = (x: { id: string }): EnMensaje | null => (x.id === s.idTarjeta && !s.ticket ? { abajo: <TarjetaTicket s={s} /> } : null);
  return (
    <HiloMako items={s.items} quien={QUIEN_SOPORTE} ahora={Date.now()} escribiendo={s.escribiendo} tarjeta={null} onTarjeta={() => {}}
      onReintentar={s.reintentar} onDescartar={s.descartar} onRecargar={() => s.abrir(s.abierto)} onResponder={(t) => s.mandar(t)} enMensaje={enMensaje} />
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
        <button type="button" className="co-chip co-chip--primario" disabled={s.mandando || s.notasPendientes || s.leyendoCaja} onClick={() => void s.mandarTicket()}>
          {s.subiendo ? 'Subiendo archivos…' : s.mandando ? 'Mandando…' : s.notasPendientes ? 'Esperando tu nota…' : s.leyendoCaja ? 'Leyendo lo que adjuntaste…' : 'Mandárselo al equipo'}
        </button>
        <span className="ch-tarjeta__nota">Como «{rotuloTipo(tipo)}». Te aviso aquí cuando conteste.</span>
      </div>
    </div>
  );
}

/** El dibujo del botón: una lista (tres renglones con su viñeta), del grueso de los íconos de la casa. */
const ICONO_LISTA = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth="2.6" />
  </svg>
);
const NUEVO = 'nuevo';

/**
 * Sus tickets, detrás del botón con el ícono de lista de la cabecera, al lado de «Soporte» (Martín, 23/10/2026: «arriba en la
 * topbar donde dice "soporte" debería estar el botón con el ícono de lista, para ver los otros tickets con el status. No donde
 * los pusiste actualmente»). Es el desplegable de la casa (app/components/Dropdown.tsx, el del filtro de la barra): «Contarle a
 * MaKo» primero y cada ticket con su estado (el punto de su color y el rótulo).
 */
export function ListaTickets({ s }: { s: Soporte }) {
  const n = s.tickets.length;
  return (
    <Dropdown
      value={s.abierto === NUEVO ? NUEVO : String(s.abierto)}
      onChange={(v) => (v === NUEVO ? s.nuevo() : s.abrir(Number(v)))}
      options={[
        { value: NUEVO, label: 'Contarle a MaKo', sub: 'Un ticket nuevo', icono: 'agregar' },
        ...s.tickets.map((t) => ({ value: String(t.id), label: `#${t.id} · ${t.titulo}`, sub: t.rotulo, color: TONO[TONO_ESTADO[t.estado]].fill })),
      ]}
      search={n > 6} sinFlecha align="left" menuMinAncho={260} menuAncho={340}
      ariaLabel={n ? `Tus tickets (${n})` : 'Tus tickets'}
      botonLabel={<span className="sp-lista__boton">{ICONO_LISTA}{n > 0 && <span className="sp-lista__n">{n}</span>}</span>}
      buttonStyle={{ height: 32, padding: '0 9px', borderRadius: 999, color: 'var(--dim)' }}
    />
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
export function CajaSoporte({ s, movil = false, campo, seguir }: {
  s: Soporte; movil?: boolean; campo?: RefObject<HTMLTextAreaElement | null>; seguir?: () => HTMLElement | null;
}) {
  return (
    <CajaChat texto={s.texto} onTexto={s.setTexto} onMandar={() => { s.mandar(); }} enviando={s.enviando} apagado={s.apagado || s.cargando || s.mandando}
      // Lo escrito sale DETRÁS de una nota de voz que todavía se está pasando a texto (en el orden en que se mandaron).
      ocupado={s.notasPendientes}
      placeholder={s.placeholder} tituloMandar={s.ticket ? 'Mandárselo al equipo' : 'Contárselo a MaKo'} enterManda={!movil} campo={campo} seguir={seguir}
      // Una clave pegada se tapa al guardar (lib/tickets-db.ts); antes, se le dice dónde va, como en la caja del Ops Center.
      arriba={hayClave(s.texto) ? <AvisoClave /> : undefined}
      // Capturas, fotos, PDF y documentos (28/10/2026, Martín: «solamente permite emojis»): lib/tickets-adjuntos.ts.
      adjuntos={s.adjuntosCaja} estado={s.errorAdjunto}
      // Lo que la caja LEE (un .pptx, un audio) también es de su conversación, como lo adjuntado (la verificación de 05d7c3187).
      conversacion={s.claveCaja} onLeyendo={s.onLeyendo}
      // La nota de voz sale en el acto y se pasa a texto por detrás (useSoporte.ts → `nota`).
      onGrabada={s.onGrabada}
      {...(movil ? { fila: 'm-operaciones-caja__fila' } : {})} />
  );
}
