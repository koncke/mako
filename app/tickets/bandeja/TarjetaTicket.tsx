'use client';

// =============================================================================
// La tarjeta de un ticket: QUÉ PASÓ, QUIÉN lo levantó y QUÉ HAY QUE HACER, para entenderla en 3 segundos (22/10/2026)
// =============================================================================
// Martín (22/10, 17:25, con la captura del #5): «la información de la tarjeta se tiene que entender fácil y mucho más
// rápido... no se entiende ni de qué es el bug, ni qué hay que hacer, ni cómo se originó, o si lo levantó Mauricio o si
// lo detectó MaKo». De arriba hacia abajo:
//   1. QUÉ PASÓ, en una frase de producto, y el porqué en corto («MaKo no le pudo contestar a Mauricio en su chat» /
//      «No tenía una IA para contestarle»);
//   2. QUIÉN: la foto de la persona («Lo levantó Mauricio desde el chat de MaKo») o el logo de MaKo («Lo detectó MaKo
//      solo»), con dónde, el negocio si suma, y cuándo;
//   3. QUÉ HAY QUE HACER, en un renglón, y la nota del Cerebro como «Estado: …» en una línea;
//   4. el tipo CHEQUEADO contra el error (`tipoDe`) y la prioridad si apura;
//   5. «Detalle», plegado: el error técnico, la nota entera, lo que escribió la persona y los links.
// Todo eso sale de reglas (./mazo-reglas.ts → `leerTicket`), nunca de una IA.
//
// ⚠️ La tarjeta NO decide nada: dibuja. El gesto y los botones viven en ./MazoTickets.tsx.
// ⚠️ NADA DE CÓDIGO A LA VISTA: el error técnico sólo se ve al abrir «Detalle». Y el panel abierto SÍ scrollea
//    (`touch-action: pan-y`): el dedo vertical ahí es del texto, no del gesto (el mazo no arranca el arrastre sobre él).

import { useState } from 'react';
import { Icon } from '@/app/_components/icons';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { CaraTarjeta } from '@/app/_ui/TarjetaKanban';
import type { FilaTicket } from '@/lib/tickets-db';
import { haceCuanto, leerTicket, linkDeOrigen, nombreDe, origenDe, quienDiceLaNota, textoDeLaPersona, tipoCorto } from './mazo-reglas';

/** La cara de quien lo levantó, con la insignia de por dónde entró. */
export function CaraTicket({ t, tam = 48 }: { t: FilaTicket; tam?: number }) {
  const o = origenDe(t);
  const ins = Math.max(14, Math.round(tam * 0.4));
  const nombre = nombreDe(t);
  return (
    <span className="tickets-bandeja__cara" style={{ width: tam, height: tam }}>
      {/* Un teléfono no tiene iniciales: la cara de quien escribió por WhatsApp sin usuario lleva la W. */}
      <CaraTarjeta nombre={/^\+\d+$/.test(nombre) ? 'WhatsApp' : nombre} foto={t.foto ?? null} tam={tam} />
      <span className={`tickets-bandeja__insignia tickets-bandeja__insignia--${o.clave}`} title={`${o.rotulo} · ${o.detalle}`}
        style={{ width: ins, height: ins }}>
        <Icon name={o.icono} size={Math.max(8, Math.round(ins * 0.58))} />
      </span>
    </span>
  );
}

/** Por dónde entró: el ícono y la palabra. El detalle (teléfono o computadora, qué falló) va en el título. */
export function ChipOrigen({ t }: { t: FilaTicket }) {
  const o = origenDe(t);
  return (
    <span className={`tickets-bandeja__origen tickets-bandeja__origen--${o.clave}`} title={o.detalle}>
      <Icon name={o.icono} size={13} />{o.rotulo}
    </span>
  );
}

/** Lo plegado en «Detalle»: el error técnico, la nota entera, lo que escribió la persona y los links. */
export function DetalleDeLaTarjeta({ t, onVerTodo, id }: { t: FilaTicket; onVerTodo?: () => void; id?: string }) {
  const error = (t.contexto.error ?? '').replace(/\s*\(digest [^)]*\)/g, '').trim();
  const texto = textoDeLaPersona(t);
  const link = linkDeOrigen(t);
  return (
    <div className="tickets-bandeja__tecnico" id={id} data-sin-gesto="">
      {texto && <p className="tickets-bandeja__tecnico-texto">{texto}</p>}
      {error && <pre className="tickets-bandeja__tecnico-error"><code>{error}</code></pre>}
      {t.nota && <p className="tickets-bandeja__tecnico-nota"><b>{quienDiceLaNota(t.nota)}</b> {t.nota.texto}</p>}
      {(link || onVerTodo) && (
        <div className="tickets-bandeja__tecnico-links">
          {link && (
            <a className="tickets-bandeja__pildora tickets-bandeja__pildora--suave" href={link.href} target="_blank" rel="noopener noreferrer">
              {link.rotulo}<span aria-hidden> ↗</span>
            </a>
          )}
          {onVerTodo && <button type="button" className="tickets-bandeja__pildora" onClick={onVerTodo}>Ver todo</button>}
        </div>
      )}
    </div>
  );
}

export function TarjetaTicket({ t, ahora, onVerTodo, atras = false }: {
  t: FilaTicket;
  ahora: number;
  onVerTodo?: () => void;
  /** La de atrás del mazo: sólo qué pasó y quién (asoma, no se lee). */
  atras?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const d = leerTicket(t);
  const apura = t.prioridad === 'urgente' || t.prioridad === 'alta';
  const sub = [d.donde, d.negocio].filter((x): x is string => !!x);
  const idDetalle = `ticket-${t.id}-detalle`;
  return (
    <div className="tickets-bandeja__carta-cuerpo">
      <div className="tickets-bandeja__carta-que">
        <h2 className="tickets-bandeja__carta-titulo">{d.quePaso}</h2>
        {d.porque && <p className="tickets-bandeja__carta-porque">{d.porque}</p>}
      </div>

      <div className="tickets-bandeja__carta-de">
        {d.quien.mako
          ? <span className="tickets-bandeja__cara tickets-bandeja__cara--mako" title="MaKo"><MakoLogo size={44} animate={false} /></span>
          : <CaraTicket t={t} tam={44} />}
        <div className="tickets-bandeja__carta-de-texto">
          <strong>{d.quien.texto}</strong>
          <span className="tickets-bandeja__carta-sub">
            {/* Un solo texto que se corta al final: la pantalla, que va primero, no se pierde por el negocio. */}
            {sub.length > 0 && <span>{sub.join(' · ')} · </span>}
            <time dateTime={t.created_at} title={new Date(t.created_at).toLocaleString('es')}>{haceCuanto(t.created_at, ahora)}</time>
          </span>
        </div>
      </div>

      {!atras && (abierto
        ? <DetalleDeLaTarjeta t={t} onVerTodo={onVerTodo} id={idDetalle} />
        : (
          <div className="tickets-bandeja__carta-hacer">
            <p className="tickets-bandeja__hacer">
              <span className="tickets-bandeja__hacer-ico" aria-hidden><Icon name="flecha" size={15} /></span>{d.hacer}
            </p>
            {d.estado && <p className="tickets-bandeja__estado-linea"><b>Estado:</b> {d.estado}</p>}
          </div>
        ))}

      {!atras && (
        <footer className="tickets-bandeja__carta-pie">
          <span className={`tickets-bandeja__tipo tickets-bandeja__tipo--${d.tipo}`}>{tipoCorto(d.tipo)}</span>
          {apura && <span className={`tickets-bandeja__apura tickets-bandeja__apura--${t.prioridad}`}><i aria-hidden />{t.prioridad === 'urgente' ? 'Urgente' : 'Alta'}</span>}
          <span className="tickets-bandeja__carta-num">#{t.id}</span>
          <button type="button" className="tickets-bandeja__abrir-detalle" aria-expanded={abierto} aria-controls={abierto ? idDetalle : undefined}
            onClick={() => setAbierto((v) => !v)}>
            Detalle
            <span className={`tickets-bandeja__abrir-detalle-ico${abierto ? ' is-on' : ''}`} aria-hidden><Icon name="chevron" size={15} /></span>
          </button>
        </footer>
      )}
    </div>
  );
}
