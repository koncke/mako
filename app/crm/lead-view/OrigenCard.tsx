// =============================================================================
// OrigenCard — de dónde vino el lead (presentacional, compartido)
// =============================================================================
// Dos bloques, no una grilla suelta de tarjetas iguales:
//   1. CÓMO ENTRÓ — canal + fuente, dos columnas parejas.
//   2. DE QUÉ ANUNCIO — la jerarquía real de Meta (Campaña › Conjunto › Anuncio)
//      en UNA sola tarjeta, con un único "Abrir en Ads Manager →".
// Antes eran 4-5 minicards en un auto-fit: con 4 quedaba una huérfana sola en la
// segunda fila, y la jerarquía (que campaña, conjunto y anuncio son el MISMO
// camino, no tres datos independientes) no se leía por ningún lado.
//
// El link va al Ads Manager de MaKo (/ads-manager/<ad_id>), no a Meta. El ad_id lo
// resuelve el server (adIdDeLead en lib/queries): puede venir en meta_ad_id, en un
// utm_content numérico, o por el NOMBRE del anuncio en utm_content — el caso de la
// mayoría de los leads de Calendly.

import type { CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import type { Lead, VslEngagement } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };

function labelOrigen(origen: string | null): { texto: string; color: string } {
  switch (origen) {
    case 'instant_form': return { texto: 'Instant Form (Meta)', color: 'var(--accent)' };
    case 'calendly': return { texto: 'Calendly', color: 'var(--good)' };
    // Cal.com es OTRO producto, no una variante de Calendly. Sin este renglón, un
    // lead que reservó en Cal.com caía en «Orgánico / manual» — o sea, la ficha
    // decía que llegó solo justo sobre el lead que agendó una llamada.
    case 'calcom': return { texto: 'Cal.com', color: 'var(--good)' };
    // ⚠️ Y LO MISMO OTRA VEZ, con el canal más grande. El opt-in escribe
    // `origen_lead: 'landing'` desde que existe, así que el dato SIEMPRE estuvo bien
    // guardado: lo que faltaba era este renglón. Medido el 27/09/2026: 27 leads en
    // todo el producto —19 de un solo cliente, que son 19 de sus 21— se dibujaban
    // «Orgánico / manual» habiendo llegado por la landing. Se reportó como «todos me
    // aparecen como orgánico manual y todos estos vinieron del VSL funnel», y suena a
    // un dato perdido cuando es un `default` contestando por un case que no está.
    //
    // La regla: un `default` que AFIRMA algo del negocio («llegó solo») es una
    // afirmación, no un fallback. Cada valor que la columna puede tener lleva su case,
    // y el default se reserva para lo que de verdad no se sabe.
    case 'landing': return { texto: 'Formulario de tu landing', color: 'var(--accent)' };
    // No es un lead: es la fila que la prueba del Pixel crea para poder mostrar
    // su propia grabación. Se dice así, entero, porque quien la abre tiene que
    // entender en un renglón por qué hay un «PRUEBA» en su tablero.
    case 'prueba': return { texto: 'La creó la prueba del Pixel', color: 'var(--dim)' };
    // ⚠️ Y LOS TRES DE LAS ALTAS QUE NO ESTAMPABAN NADA (03/10/2026). Hasta entonces el
    // alta a mano, la importación, el alta desde el chat y el alta de un cliente en
    // Customer Success llamaban a `createLead` sin pasarle el origen, así que los
    // cuatro caminos caían en el `default` de abajo. O sea que la ficha de los 1.000
    // contactos de una lista en frío decía exactamente lo mismo que la de alguien que
    // llenó un formulario: «Orgánico / manual», que para la mitad de ellos era falso.
    //
    // Los ids salen del catálogo (`app/crm/origen-lead.ts`), que es el único lugar
    // donde viven los valores posibles. Acá vive el rótulo LARGO, el de la ficha, que
    // es otra superficie que la tarjeta del tablero: ahí entra una frase y en la
    // tarjeta una palabra. Que los dos cubran los mismos ids lo fija
    // tests/crm-origen-lead.test.ts.
    case 'carga_manual': return { texto: 'Lo cargaste a mano', color: 'var(--dim)' };
    case 'importacion': return { texto: 'Importado de un archivo', color: 'var(--dim)' };
    case 'chat_whatsapp': return { texto: 'Escribió por WhatsApp', color: 'var(--good)' };
    // Los crea Zernio (`createLead({ origen_lead: e.canal })`, lib/zernio-entrante.ts): un DM, un comentario o un
    // link. «Llegó», no «escribió»: con un comentario no escribió nada (duodécima tanda, 12/10/2026).
    case 'instagram': return { texto: 'Llegó por Instagram', color: 'var(--good)' };
    case 'messenger': return { texto: 'Llegó por Messenger', color: 'var(--good)' };
    // ⚠️ EL DEFAULT YA NO AFIRMA NADA. Decía «Orgánico / manual», que son dos hechos
    // del negocio —llegó solo, o lo cargamos nosotros— sobre una columna vacía, de la
    // que no se sabe ninguno de los dos. Con las cuatro altas estampando, acá sólo
    // llegan los leads que entraron antes de este cambio y los valores que algún
    // camino nuevo escriba sin pasar por el catálogo.
    default: return { texto: 'Sin dato de origen', color: 'var(--dim)' };
  }
}

function Item({ label, value, color }: { label: string; value: string | null; color?: string }) {
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{label}</div>
      <div style={{ fontSize: 14.5, color: value ? (color ?? 'var(--ink)') : 'var(--faint)', fontWeight: value ? 600 : 400, marginTop: 3, wordBreak: 'break-word' }}>{value ?? '—'}</div>
    </div>
  );
}

/** Un escalón de la jerarquía de Meta. El último (el anuncio) va destacado. */
function Nivel({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0' }}>
      <span style={{ ...sectLabel, flex: 'none', width: 78, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: fuerte ? 15 : 13.5, fontWeight: fuerte ? 650 : 500, color: fuerte ? 'var(--ink)' : 'var(--dim)', lineHeight: 1.4, wordBreak: 'break-word' }}>{valor}</span>
    </div>
  );
}

export function OrigenCard({ lead, vslEng, campana, adNombre, adId }: {
  lead: Lead; vslEng: VslEngagement;
  campana: { texto: string | null; tooltip: string | null };
  adNombre?: string | null;
  /** ad_id ya resuelto por el server; habilita el deep-link al Ads Manager. */
  adId?: string | null;
}) {
  void vslEng;
  const utmContent = lead.utm_content?.trim() || null;
  const utmEsId = !!utmContent && /^\d{6,}$/.test(utmContent);
  const campanaTexto = lead.meta_campaign_name ?? campana.texto;
  const conjunto = lead.meta_adset_name ?? null;
  const anuncio = adNombre ?? lead.meta_ad_name ?? (utmContent && !utmEsId ? utmContent : null) ?? (adId ? `Anuncio ${adId}` : null);
  const hayRuta = !!(campanaTexto || conjunto || anuncio);
  const tieneAtribucion = lead.origen_lead || hayRuta || lead.utm_campaign || lead.utm_source || lead.utm_content;

  if (!tieneAtribucion) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Origen del lead</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin datos de origen: este lead entró a mano, o antes de que existiera el tracking de campañas. No hay forma de reconstruirlo.</p>
      </section>
    );
  }

  const origen = labelOrigen(lead.origen_lead);
  const fuente = lead.utm_source ? (lead.utm_source === 'fb' ? 'Facebook' : lead.utm_source === 'ig' ? 'Instagram' : lead.utm_source) : null;
  const href = adId ? `/ads-manager/${adId}` : null;

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Origen del lead</div>

      {/* Cómo entró: dos columnas parejas, nunca una huérfana. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Item label="Canal de entrada" value={origen.texto} color={origen.color} />
        <Item label="Fuente" value={fuente} />
      </div>

      {/* De qué anuncio: la jerarquía completa en UNA tarjeta. */}
      {hayRuta && (
        <div style={{ ...miniCard, marginTop: 12, padding: '15px 17px', borderColor: href ? 'var(--primary)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--dim)', fontWeight: 600 }}>De qué anuncio vino</span>
            {href && (
              <Link href={href} title="Abrir este anuncio en tu Ads Manager"
                style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Abrir en Ads Manager →
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {campanaTexto && <Nivel label="Campaña" valor={campanaTexto} />}
            {conjunto && <Nivel label="Conjunto" valor={conjunto} />}
            {anuncio && <Nivel label="Anuncio" valor={anuncio} fuerte />}
          </div>
          {!href && anuncio && (
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6, lineHeight: 1.45 }}>
              No pude identificar el anuncio exacto en tu cuenta (el nombre no es único o todavía no sincronizó), así que no puedo abrirlo directo.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
