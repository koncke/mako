'use client';

// =============================================================================
// TrackingTimelineCard — actividad del lead con fecha y hora, evento por evento
// =============================================================================
// "03/07/2026 14:04 · Ingresó a la landing" / "Reprodujo el VSL" / "Llegó al
// 40% del VSL" / "Abandonó en el 73%" / "Hizo clic en «Agendar ahora»". Con la
// URL de la landing y el título del VSL cuando el beacon los manda (pruebas A/B
// multi-landing / multi-VSL).
//
// 'use client' por la zona horaria: la hora de cada evento va en la zona del
// WORKSPACE, que se resuelve en el server (useTzWorkspace). Era un componente de
// server en /crm/[id] y de cliente dentro del modal LeadSheet; ahora es siempre
// de cliente. No pierde nada: solo pinta props ya serializables.

import type { CSSProperties } from 'react';
import type { TrackingEvent } from '@/lib/leads';
import { useTzWorkspace } from './useTzWorkspace';
import Link from '@/app/_ui/Link';
import { textoDeClic } from './clic-detalle';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const fmtTs = (iso: string, tz: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d).replace(',', ' ·');
};

function descripcion(e: TrackingEvent): { texto: string; detalle: string | null; color: string } {
  switch (e.tipo) {
    case 'pageview':
      return { texto: 'Ingresó a la landing', detalle: e.landing_url, color: 'var(--accent)' };
    case 'click': {
      // Qué se apretó, no sólo que hubo un clic: el dato viaja en el evento desde
      // la mig 0133 y lo lee `textoDeClic`. Ámbar porque es el único tipo que no
      // habla del video: el ojo tiene que poder separarlo de la retención.
      const c = textoDeClic(e.detalle);
      return { texto: c.que, detalle: c.adonde, color: 'var(--warn)' };
    }
    case 'scroll':
      // La otra mitad de la visita: cuánto LEYÓ, no sólo qué apretó. El % es de la
      // PÁGINA, así que la frase lo dice — con «Llegó al 50%» a secas se lee como
      // retención de video, que es el disfraz que `getTrackingEvents` ya cortó del
      // lado del dato.
      return { texto: e.porcentaje != null ? `Bajó hasta el ${e.porcentaje}% de la página` : 'Bajó por la página', detalle: null, color: 'var(--accent)' };
    case 'play':
      return { texto: 'Reprodujo el VSL', detalle: e.vsl_titulo ?? (e.video_id ? `video ${e.video_id}` : null), color: 'var(--primary)' };
    case 'exit':
      return { texto: e.porcentaje != null ? `Abandonó el VSL en el ${e.porcentaje}%` : 'Abandonó el VSL', detalle: e.vsl_titulo, color: 'var(--bad)' };
    default:
      return { texto: e.porcentaje != null ? `Llegó al ${e.porcentaje}% del VSL` : 'Siguió mirando el VSL', detalle: e.vsl_titulo, color: 'var(--good)' };
  }
}

/**
 * `pixelPuesto` = el Pixel de MaKo está midiendo de verdad (`landingRecibioEventos`,
 * la MISMA señal que el semáforo de /integraciones, para que las dos pantallas no
 * puedan contradecirse). Se usa sólo en el vacío: si llegaron eventos, el Pixel
 * está puesto y no hay nada que ofrecer.
 *
 * Por defecto `true` para no acusar de falta de Pixel a quien no pasó el dato: un
 * cartel que dice «conéctalo» sobre algo ya conectado manda a desconectar y
 * reconectar lo que funciona.
 */
export function TrackingTimelineCard({ eventos, pixelPuesto = true }: { eventos: TrackingEvent[]; pixelPuesto?: boolean }) {
  const tz = useTzWorkspace();
  // Los hitos de retención cada 5% son ruido en la lista: nos quedamos con los
  // pageviews, plays, clics, abandonos y el hito MÁXIMO de cada racha de
  // retención. Los clics NO se colapsan: apretar dos veces el mismo botón es un
  // dato (el link no llevó a ningún lado, o la persona volvió a intentarlo), y el
  // snippet ya los topea en 40 por carga.
  const filtrados: TrackingEvent[] = [];
  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i];
    // El scroll se colapsa por lo mismo: el snippet manda 25/50/75/100 y el punto
    // exacto al irse, así que una visita entera deja hasta cinco renglones que
    // dicen la misma cosa. Queda el más profundo de cada racha.
    if (e.tipo !== 'retencion' && e.tipo !== 'scroll') { filtrados.push(e); continue; }
    // eventos está ordenado desc: el primero de cada racha es el hito más alto.
    const prev = filtrados[filtrados.length - 1];
    if (!prev || prev.tipo !== e.tipo) filtrados.push(e);
  }

  if (!filtrados.length) {
    // ⚠️ SIN PIXEL, EL VACÍO NO ES DEL LEAD: es del negocio. Decir «entró antes del
    // tracking» a quien nunca pegó el código manda a buscar una causa que no
    // existe, y el control vive tres pantallas más allá. El link aterriza en el
    // modal que ENTREGA el código (`?servicio=landing` abre esa tarjeta), no en la
    // grilla de /integraciones: un link que promete un control y deja a la persona
    // frente a veintipico de tarjetas se lee como un producto roto.
    if (!pixelPuesto) {
      return (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 10 }}>Actividad registrada</div>
          <p style={{ fontSize: 14, color: 'var(--faint)', margin: '0 0 14px' }}>
            Nada registrado: el Pixel de MaKo no está midiendo tu página. Con el código puesto, cada visita, clic y scroll aparece aquí.
          </p>
          <Link
            href="/integraciones?servicio=landing"
            style={{ display: 'inline-block', fontSize: 13.5, fontWeight: 600, padding: '9px 16px', borderRadius: 10, background: 'var(--primary)', color: 'var(--on-primary)', textDecoration: 'none' }}
          >
            Conectar el Pixel
          </Link>
        </section>
      );
    }
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Actividad registrada</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>
          Sin eventos registrados para este lead: entró antes del tracking, o llegó por instant form sin pasar por la landing. No hay forma de reconstruirlo.
        </p>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Actividad registrada</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filtrados.slice(0, 40).map((e, i) => {
          const d = descripcion(e);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{fmtTs(e.ts, tz)}</span>
              <span aria-hidden style={{ flex: 'none', width: 8, height: 8, borderRadius: 999, background: d.color, alignSelf: 'center' }} />
              <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>{d.texto}</span>
              {d.detalle && <span style={{ fontSize: 12.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320, whiteSpace: 'nowrap' }}>{d.detalle}</span>}
            </div>
          );
        })}
        {filtrados.length > 40 && <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '4px 0 0' }}>Mostrando los últimos 40 eventos.</p>}
      </div>
    </section>
  );
}
