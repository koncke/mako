'use client';

// =============================================================================
// La tarjeta de un ticket: QUIÉN lo levantó (su foto), por DÓNDE, cuándo, qué es y qué dijo (22/10/2026)
// =============================================================================
// Martín: «me falta mejor diseño en las tarjetas, ver quién levantó el ticket con su foto de perfil, por donde lo
// levantó, etc...». La cara es la de la familia de tarjetas (app/_ui/TarjetaKanban.tsx → CaraTarjeta: la foto, o las
// iniciales con su color), con la insignia del canal abajo a la derecha, como el CRM marca de dónde vino un lead (y como
// pide la comunidad de Intercom para su bandeja: el canal al lado del nombre, sin abrir la conversación).
// La foto es la del perfil de la persona (`usuarios.foto_url`, la misma que muestra /api/perfil y MiFoto en el Ops Center).
//
// ⚠️ La tarjeta NO decide nada: dibuja. El gesto y los botones viven en ./MazoTickets.tsx; las reglas, en ./mazo-reglas.ts.
// ⚠️ Texto corto (Martín): sin rótulos que repiten lo obvio. El error se ve como error (letra de código, en rojo); el
//    canal, con su ícono; la prioridad sólo si apura (Urgente, Alta).

import { Icon } from '@/app/_components/icons';
import { CaraTarjeta } from '@/app/_ui/TarjetaKanban';
import type { FilaTicket } from '@/lib/tickets-db';
import { errorCorto, haceCuanto, linkDeOrigen, nombreDe, origenDe, quienDiceLaNota, textoDeLaPersona, tipoCorto } from './mazo-reglas';

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

export function TarjetaTicket({ t, ahora, onVerTodo, atras = false }: {
  t: FilaTicket;
  ahora: number;
  onVerTodo?: () => void;
  /** La de atrás del mazo: sólo la cara y el título (asoma, no se lee). */
  atras?: boolean;
}) {
  const texto = textoDeLaPersona(t);
  const error = errorCorto(t.contexto.error);
  const link = linkDeOrigen(t);
  const apura = t.prioridad === 'urgente' || t.prioridad === 'alta';
  return (
    <div className="tickets-bandeja__carta-cuerpo">
      <header className="tickets-bandeja__carta-cab">
        <CaraTicket t={t} tam={52} />
        <div className="tickets-bandeja__carta-quien">
          <strong>{nombreDe(t)}</strong>
          <span className="tickets-bandeja__carta-sub">
            <span>{t.negocio ?? `Negocio ${t.workspace_id}`}</span>
            <time dateTime={t.created_at} title={new Date(t.created_at).toLocaleString('es')}>· {haceCuanto(t.created_at, ahora)}</time>
          </span>
        </div>
        <span className="tickets-bandeja__carta-num">#{t.id}</span>
      </header>

      <div className="tickets-bandeja__carta-chips">
        <span className={`tickets-bandeja__tipo tickets-bandeja__tipo--${t.tipo}`}>{tipoCorto(t.tipo)}</span>
        {apura && <span className={`tickets-bandeja__apura tickets-bandeja__apura--${t.prioridad}`}><i aria-hidden />{t.prioridad === 'urgente' ? 'Urgente' : 'Alta'}</span>}
        <ChipOrigen t={t} />
      </div>

      <h2 className="tickets-bandeja__carta-titulo">{t.titulo}</h2>

      {!atras && (
        <div className="tickets-bandeja__carta-medio">
          {texto && <p className="tickets-bandeja__carta-texto">{texto}</p>}
          {error && (
            <p className="tickets-bandeja__carta-error" title={t.contexto.error}>
              <Icon name="rayo" size={14} /><code>{error}</code>
            </p>
          )}
          {t.nota && (
            <p className="tickets-bandeja__carta-nota" title={t.nota.texto}>
              <b>{quienDiceLaNota(t.nota)}</b> {t.nota.texto}
            </p>
          )}
        </div>
      )}

      {!atras && (link || onVerTodo) && (
        <footer className="tickets-bandeja__carta-pie">
          {link && (
            <a className="tickets-bandeja__pildora tickets-bandeja__pildora--suave" href={link.href} target="_blank" rel="noopener noreferrer">
              {link.rotulo}<span aria-hidden> ↗</span>
            </a>
          )}
          {onVerTodo && <button type="button" className="tickets-bandeja__pildora" onClick={onVerTodo}>Ver todo</button>}
        </footer>
      )}
    </div>
  );
}
