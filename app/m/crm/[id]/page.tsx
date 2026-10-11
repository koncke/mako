// =============================================================================
// /m/crm/[id] — la ficha del lead en el teléfono (LECTURA, una columna, sin pestañas)
// =============================================================================
// Nombre grande, etapa y producto; Llamar · WhatsApp · Agendar; «Siguiente acción»
// como la única tarjeta; la última llamada analizada; lo que contestó al agendar y
// de dónde vino; lo demás plegado. Al pie, «Abrir en la computadora» (pagos,
// tracking, historial, edición y el wizard viven allá).
//
// ⚠️ maxDuration = 60: el sheet de agendar llama a reagendarReunionAction y a
// reservarR2Action, y las server actions heredan el techo de la PÁGINA que las monta.
// Reagendar puede tardar ~28 s (moverEvento en Google): sin esto la plataforma corta
// con la fila ya guardada y la pantalla dice que falló algo que se hizo.
// =============================================================================

import '../crm.css';
import { requireMovil } from '@/lib/movil-guard';
import { fichaMovil } from '@/lib/crm-movil';
import { getWorkspaceActual } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import Link from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { SeccionM, VacioM } from '@/app/m/_ui';
import { FichaAcciones } from './FichaAcciones';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fechaCorta = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace('.', '');

function Plegada({ titulo, n, children }: { titulo: string; n?: number; children: React.ReactNode }) {
  return (
    <details className="mc-plegada">
      <summary>
        {titulo}
        {n != null && <span className="mc-plegada__n">{n}</span>}
        <span className="mc-plegada__ico" style={n != null ? undefined : { marginLeft: 'auto' }}><Icon name="chevron" size={18} /></span>
      </summary>
      <div className="mc-plegada__cuerpo">{children}</div>
    </details>
  );
}

export default async function FichaLeadMovil({ params }: { params: Promise<{ id: string }> }) {
  await requireMovil({ navKey: 'crm' });
  const { id: crudo } = await params;
  const id = Number(crudo);
  const ws = await getWorkspaceActual();
  const f = Number.isInteger(id) && id > 0 ? await fichaMovil(id) : null;
  if (!f) {
    return <VacioM frase="Ese lead no está en esta cuenta." accion={{ rotulo: 'Volver al CRM', href: '/m/crm' }} />;
  }
  const desktop = conWs(`/crm/${f.id}`, ws);
  const s = f.siguiente;

  return (
    <div className="mc-ficha">
      <h1 className="mc-nombre">{f.nombre}</h1>
      <div className="mc-sub">
        {f.casa?.etapaLabel && <span className="mc-pill">{f.casa.etapaLabel}</span>}
        {f.casa && <span className="mc-pill mc-pill--dim">{f.casa.nombre}</span>}
        {f.productos.length > 1 && <span className="mc-pill mc-pill--dim">+{f.productos.length - 1} producto{f.productos.length > 2 ? 's' : ''}</span>}
      </div>
      {f.empresa && <p className="mc-empresa">{f.empresa}</p>}

      <FichaAcciones
        id={f.id}
        nombre={f.nombre}
        email={f.email}
        tel={f.tel}
        waMe={f.waMe}
        tieneChat={!!f.chat}
        agenda={f.agenda}
        modoAgenda={f.modoAgenda}
        hoy={f.hoy}
        productos={f.productos}
      />

      <section className="mc-siguiente" aria-label="Siguiente acción">
        <span className="mc-siguiente__rot">Siguiente acción</span>
        {s ? (
          <>
            <span className="mc-siguiente__titulo">{s.titulo}</span>
            {s.detalle && <span className="mc-siguiente__detalle">{s.detalle}</span>}
            {s.tipo === 'etapa' && <a className="mc-siguiente__link" href={desktop}>Completar en la computadora</a>}
            {s.tipo === 'seguimiento' && f.chat && <Link className="mc-siguiente__link" href={`/m/crm/${f.id}/chat`}>Abrir el chat</Link>}
          </>
        ) : (
          <span className="mc-siguiente__detalle">Nada escrito todavía.</span>
        )}
      </section>

      {f.llamada && (
        <SeccionM titulo="Última llamada">
          <p className="mc-meta" style={{ marginBottom: 8 }}>{f.llamada.cuando}</p>
          {f.llamada.resultado && <div className="mc-resultado">{f.llamada.resultado}</div>}
          {f.llamada.resumen && <p className="mc-texto">{f.llamada.resumen}</p>}
          {f.llamada.abiertas.length > 0 && (
            <>
              <div className="mc-objeciones__rot">
                {f.llamada.abiertas.length === 1 ? 'Quedó 1 objeción sin resolver' : `Quedaron ${f.llamada.abiertas.length} objeciones sin resolver`}
              </div>
              <ul className="mc-objeciones">{f.llamada.abiertas.map((o, i) => <li key={i}>«{o}»</li>)}</ul>
            </>
          )}
          {f.llamada.resueltas > 0 && <p className="mc-meta" style={{ marginTop: 10 }}>Y {f.llamada.resueltas} que sí se respondieron.</p>}
          {f.llamada.proximoPaso && (
            <div className="mc-paso">
              <div className="mc-meta">El próximo paso</div>
              <p className="mc-texto">{f.llamada.proximoPaso}</p>
            </div>
          )}
        </SeccionM>
      )}

      <div className="mc-bloques">
        {f.respuestas.length > 0 && (
          <Plegada titulo="Lo que contestó al agendar" n={f.respuestas.length}>
            <dl className="mc-datos">
              {f.respuestas.map((r, i) => (<div key={i}><dt>{r.pregunta}</dt><dd>{r.respuesta}</dd></div>))}
            </dl>
          </Plegada>
        )}
        {(f.origen.campana || f.origen.anuncio || f.origen.canal) && (
          <Plegada titulo="De dónde vino">
            <dl className="mc-datos">
              {f.origen.canal && <div><dt>Canal</dt><dd>{f.origen.canal}</dd></div>}
              {f.origen.campana && <div><dt>Campaña</dt><dd>{f.origen.campana}</dd></div>}
              {f.origen.anuncio && <div><dt>Anuncio</dt><dd>{f.origen.anuncio}</dd></div>}
            </dl>
          </Plegada>
        )}
        <Plegada titulo="Notas" n={f.notas.length}>
          {f.notas.length ? f.notas.map((n) => (
            <div key={n.id} className="mc-nota">
              <p className="mc-texto">{n.texto}</p>
              <span className="mc-meta">{n.autor} · {fechaCorta(n.cuando, f.tz)}</span>
            </div>
          )) : <p className="mc-meta">Sin notas todavía.</p>}
        </Plegada>
        {f.productos.length > 1 && (
          <Plegada titulo="Productos" n={f.productos.length}>
            <dl className="mc-datos">
              {f.productos.map((p) => (<div key={p.funnelId}><dt>{p.nombre}{p.esCasa ? ' · principal' : ''}</dt><dd>{p.etapaLabel ?? 'Sin etapa'}</dd></div>))}
            </dl>
          </Plegada>
        )}
        <Plegada titulo="Contacto">
          <dl className="mc-datos">
            <div><dt>Teléfono</dt><dd>{f.telefono ? (f.telefono.length > 10 ? `+${f.telefono}` : f.telefono) : 'Sin teléfono'}</dd></div>
            <div><dt>Email</dt><dd>{f.email ? <a href={`mailto:${f.email}`} style={{ color: 'var(--primary)' }}>{f.email}</a> : 'Sin email'}</dd></div>
          </dl>
        </Plegada>
      </div>

      <div className="mc-pie">
        <a className="mk-btn mk-btn--tertiary mk-btn--lg mk-btn--full" href={desktop}>Abrir en la computadora</a>
      </div>
    </div>
  );
}
