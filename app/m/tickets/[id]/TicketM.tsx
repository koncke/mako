'use client';

// =============================================================================
// Un ticket: el estado, la conversación y la caja de responder (Intercom en el celular)
// =============================================================================
// Lo de la computadora (`DetalleCliente`), sin cambiar nada de lo que hace: «Responder» cuando el equipo preguntó algo
// (primario) o para sumar un dato (secundario), y el cierre dicho en una frase cuando ya no se puede responder. Después
// de responder, `router.refresh()`: la conversación la vuelve a leer el server, que es de donde sale.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { haptico } from '@/lib/haptico';
import { TIPOS, TOPES, type TicketCliente } from '@/lib/tickets-reglas';
import { contestarTicketAction } from '@/app/tickets/acciones';
import { hace } from '@/app/tickets/navegador';
import { PildoraM, useConexion, useToastM } from '@/app/m/_ui';
import { TONO_TICKET } from '../modelo';

const alFinal = () => window.scrollTo({ top: document.documentElement.scrollHeight });

export function TicketM({ t }: { t: TicketCliente }) {
  const tipo = TIPOS.find((x) => x.clave === t.tipo)?.corto ?? '';
  useEffect(() => { alFinal(); }, []);
  return (
    <>
      <header className="m-tickets-cab">
        <p className="m-tickets-meta">#{t.id}{tipo ? ` · ${tipo}` : ''}</p>
        <h2 className="m-tickets-titulo">{t.titulo}</h2>
        <PildoraM tono={TONO_TICKET[t.estado]}>{t.rotulo}</PildoraM>
        {t.canal && <p className="m-tickets-meta">{t.canal}</p>}
      </header>
      {/* El historial: cada cambio de estado con su fecha (22/10/2026), como en la computadora. */}
      <ol className="tickets-historial" aria-label="Historial del ticket">
        {t.historial.map((p) => (
          <li key={`${p.paso}-${p.at}`} className="tickets-historial__paso" data-paso={p.paso}>
            <span className="tickets-historial__rotulo">{p.rotulo}</span>
            <span className="tickets-historial__cuando">{hace(p.at)}</span>
          </li>
        ))}
      </ol>
      <ol className={`m-tickets-hilo${t.puedeResponder ? ' m-tickets-hilo--composer' : ''}`}>
        {t.lineas.map((l, i) => (
          <li key={i} className={`m-tickets-burbuja m-tickets-burbuja--${l.quien}`}>
            <span className="m-tickets-burbuja__quien">{l.quien === 'tu' ? 'Tú' : 'Equipo de MaKo'} · {hace(l.at)}</span>
            {l.texto}
          </li>
        ))}
      </ol>
      {t.puedeResponder
        ? <Responder id={t.id} pregunta={t.estado === 'tu_respuesta'} />
        : <p className="m-tickets-cerrado">Este ticket está cerrado. Si vuelve a pasar, levanta uno nuevo.</p>}
    </>
  );
}

function Responder({ id, pregunta }: { id: number; pregunta: boolean }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mandando, setMandando] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const contestar = async () => {
    const x = texto.trim();
    if (!x || mandando) return;
    setMandando(true); setError(null);
    try {
      const r = await contestarTicketAction(id, x);
      if (!r.ok) { haptico('error'); setError(r.error); return; }
      setTexto('');
      if (area.current) area.current.style.height = '';
      haptico('success');
      toast('Respondido');
      router.refresh();
      window.setTimeout(alFinal, 300);
    } catch {
      haptico('error'); setError('No salió. Revisa tu conexión y vuelve a mandarlo.');
    } finally {
      setMandando(false);
    }
  };

  return (
    <div className="m-tickets-composer" data-m-sin-barra>
      {error && <p className="m-tickets-error" role="alert">{error}</p>}
      <div className="m-tickets-composer__fila">
        <textarea
          ref={area}
          rows={1}
          aria-label="Responder al equipo"
          placeholder={!enLinea ? 'Sin conexión' : pregunta ? 'Contesta lo que te preguntó el equipo' : 'Suma un dato si te falta algo'}
          value={texto}
          maxLength={TOPES.nota}
          disabled={!enLinea || mandando}
          onChange={(e) => {
            setTexto(e.target.value); setError(null);
            const el = e.target; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
          }}
        />
        <button type="button" className="m-tickets-enviar" aria-label="Responder" aria-busy={mandando || undefined}
          disabled={!texto.trim() || !enLinea || mandando} onClick={() => { void contestar(); }}>
          {mandando ? <span className="mk-spin m-tickets-spin" aria-hidden /> : <IconoMenu nombre="enviar" size={20} />}
        </button>
      </div>
    </div>
  );
}
