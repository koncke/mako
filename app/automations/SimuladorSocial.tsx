'use client';

// =============================================================================
// SimuladorSocial — «Probar» de Instagram y de Messenger, como un DM de la app
// =============================================================================
// Sexta tanda, CRON 5: «que la interfaz editable y "probar" se parezcan a Instagram». Es SÓLO la cara:
// el recorrido (las condiciones, las esperas, los hilos, lo que contesta «Si responde») lo corre
// PanelProbar con el motor de siempre (lib/simulador-grafo.ts) y le pasa los mensajes; acá se dibujan
// como en Instagram o en Messenger. Así las dos pruebas no pueden decidir distinto.
//
// Sin «Probar en Instagram» de verdad, a propósito: Meta no deja escribirle primero a nadie, así que un
// envío real a la cuenta de quien prueba falla siempre salvo que esa persona le haya escrito a la cuenta
// en las últimas 24 h (lib/canal-social.ts).

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { IDENTIDAD_SOCIAL, NOMBRE_CANAL, type CanalSocial } from '@/lib/canal-social';
import { BurbujaSocial, ArchivoSocial, CabeceraSocial, LogoSocial } from './social-ui';

const CSS = `
@keyframes mk-social-entra { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes mk-social-punto { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mk-social-msg { animation: none !important; } }
`;

export function SimuladorSocial({ canal, mensajes, typing, onEnviarTexto, negocio }: {
  canal: CanalSocial;
  mensajes: HiloMsg[];
  typing: { lado: 'left' | 'right'; autor?: string } | null;
  /** Lo que escribe el lead de prueba: PanelProbar pausa la salida y corre «Si responde». */
  onEnviarTexto: (texto: string) => Promise<boolean>;
  negocio: string;
}) {
  const [texto, setTexto] = useState('');
  const fin = useRef<HTMLDivElement | null>(null);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [mensajes.length, typing]);
  const ident = IDENTIDAD_SOCIAL[canal];

  const mandar = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    await onEnviarTexto(t);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', border: `1px solid ${ident.borde}`, borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
      <style>{CSS}</style>
      <CabeceraSocial canal={canal} nombre={negocio.trim() || 'Tu negocio'} detalle={NOMBRE_CANAL[canal]} derecha={<LogoSocial canal={canal} size={20} />} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mensajes.map((m) => {
          if (m.tipo === 'sistema') {
            return (
              <div key={m.id} className="mk-social-msg" style={{ alignSelf: 'center', maxWidth: '90%', padding: '3px 10px', borderRadius: 999, background: 'var(--surface-2)', fontSize: 11.5, color: m.tono === 'bad' ? 'var(--bad)' : m.tono === 'ok' ? 'var(--good)' : 'var(--dim)', animation: 'mk-social-entra .22s ease-out' }}>{m.texto}</div>
            );
          }
          // COMO LO VE EL LEAD, igual que el teléfono de WhatsApp de «Probar»: lo que manda el negocio
          // llega a la IZQUIERDA (gris, como un DM recibido) y lo que escribe el lead de prueba sale a la
          // derecha con el color de la app. `fromMe` es el lead (así lo arma PanelProbar).
          const delNegocio = !m.fromMe;
          const esArchivo = m.tipo === 'image' || m.tipo === 'video' || m.tipo === 'document';
          return (
            <div key={m.id} className="mk-social-msg" style={{ alignSelf: delNegocio ? 'flex-start' : 'flex-end', maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: delNegocio ? 'flex-start' : 'flex-end', gap: 4, animation: 'mk-social-entra .22s ease-out' }}>
              {esArchivo && <ArchivoSocial canal={canal} saliente={!delNegocio} url={m.mediaUrl ?? null} mime={m.mediaMime ?? null} nombre={m.nombreArchivo ?? null} />}
              {m.tipo === 'audio' && <span style={{ fontSize: 12, color: 'var(--warn)' }}>Nota de voz: no sale por {NOMBRE_CANAL[canal]}</span>}
              {/* El pie de un archivo va como su propio mensaje: así llega por Instagram (lib/canal-zernio.ts). */}
              {m.texto && m.tipo !== 'audio' && <BurbujaSocial canal={canal} saliente={!delNegocio}>{m.texto}</BurbujaSocial>}
            </div>
          );
        })}
        {typing && (
          <div aria-label="Escribiendo" style={{ alignSelf: typing.lado === 'left' ? 'flex-start' : 'flex-end', display: 'inline-flex', gap: 4, padding: '10px 14px', borderRadius: 20, background: 'var(--surface-2)' }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dim)', animation: `mk-social-punto 1.2s ${i * 0.15}s infinite` }} />)}
          </div>
        )}
        <div ref={fin} />
      </div>
      <form onSubmit={(e) => void mandar(e)} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, margin: '0 10px 10px', padding: '4px 6px 4px 14px', borderRadius: 22, border: '1px solid var(--border-strong)' }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Responde como el lead…" aria-label="Responde como el lead"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 14, padding: '7px 0' }} />
        <button type="submit" disabled={!texto.trim()} style={{ flex: 'none', border: 'none', background: 'none', color: canal === 'instagram' ? '#5B51D8' : '#0084FF', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', padding: '6px 8px', opacity: texto.trim() ? 1 : 0.4, fontFamily: 'inherit' }}>Enviar</button>
      </form>
    </div>
  );
}
