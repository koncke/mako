// =============================================================================
// ReunionesCard — R1/R2 del lead, organizadas POR REUNIÓN
// =============================================================================
// Cada reunión es un bloque: fecha + asistencia (+ calificado en R1) + sus
// grabaciones de Fathom + las respuestas del formulario de Calendly de ESA
// agenda (R1 y R2 tienen forms propios). Al pie, el equipo y la confirmación.
//
// ⚠️ YA NO ES SÓLO PRESENTACIONAL: fecha, asistencia, calificado, closer, setter
// y confirmación de pago se CORRIGEN ACÁ, con un click sobre el valor. «Que ya no
// exista el botón de "editar" … sino que simplemente le doy click arriba y ya
// puedo sobre escribir» (Martín, 05/10/2026). Los gestos y sus candados viven en
// `./CampoEditable` y el catálogo en `app/crm/campo-inline.ts`; esta tarjeta sólo
// dice qué campo va en qué renglón y cuándo NO se puede tocar.
//
// ⚠️ Y DEBAJO, EN SU PROPIO APARTADO, lo que salió de la LLAMADA. Decisión del
// dueño (04/10/2026): «las respuestas del Calendly son diferentes, debería haber
// un apartado para los insights que salieron de la llamada». Lo que contestó al
// agendar y lo que dijo hablando son dos cosas: ninguna pisa a la otra y cada
// apartado dice de dónde salió (el de la llamada lo firma MaKo).

import type { CSSProperties, ReactNode } from 'react';
import type { Lead, FathomLink, RespuestaQA } from '@/lib/leads';
import type { MiembroEquipo } from '../actions';
import { AgendarR2 } from './AgendarR2';
import { InsightsLlamadaCard } from './InsightsLlamadaCard';
// Los campos que se editan EN EL LUGAR (fecha, sí/no, persona). Acá NO hay modo
// edición: cada dato se corrige donde se lee. Ver app/crm/campo-inline.ts.
import { FechaEditable, TriEditable, PersonaEditable, EnlaceFathomEditable } from './CampoEditable';
// El candado de «calificado» es UNO y vive en lib/calificado-reunion.ts: esta
// tarjeta y la de Tracking tienen que bloquear en el mismo caso.
import { calificadoSeDescarta } from '@/lib/calificado-reunion';
// El mismo criterio que reparte los análisis entre R1 y R2 decide acá en qué
// bloque va cada grabación. Con dos copias, el día que alguien acepte otra
// etiqueta el link queda en un bloque y su análisis en el otro.
import { etiquetaEsR2 } from '@/lib/insights-llamada-reparto';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

function BloqueReunion({ titulo, leadId, campoFecha, campoFathom, fecha, fallbackFecha = null, chips, fathom, respuestas, reunion }: {
  titulo: string;
  leadId: number;
  campoFecha: 'fecha_junta_1' | 'fecha_junta_2';
  /** El slot de `fathom_links` de ESTA reunión (se pega acá mismo). */
  campoFathom: 'fathom_r1' | 'fathom_r2';
  /** La fecha de LA REUNIÓN (la columna que se edita). */
  fecha: string | null;
  /** Lo que se muestra si la reunión todavía no tiene fecha propia (la de agendamiento). */
  fallbackFecha?: string | null;
  chips: ReactNode;
  fathom: FathomLink[];
  respuestas: RespuestaQA[];
  reunion: 'R1' | 'R2';
}) {
  // El SLOT es el primer link de esta reunión; si hubiera más de uno (el array
  // acepta varios y los webhooks viejos cargaron alguno), los demás se siguen
  // viendo y NO se pierden al corregir el slot — ver `ponerLinkFathom`.
  const [slot, ...extras] = fathom;
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{titulo}</span>
          <FechaEditable
            leadId={leadId}
            campo={campoFecha}
            valor={fecha}
            fallback={fallbackFecha}
            titulo={`Fecha de la ${titulo.toLowerCase()}`}
            estilo={{ fontFamily: MONO, fontSize: 12.5, color: fecha || fallbackFecha ? 'var(--dim)' : 'var(--faint)' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>{chips}</div>
      </div>

      {/* ⚠️ EL LINK DE LA GRABACIÓN SE PEGA ACÁ, no en un formulario. Era uno de los
          cuatro campos que mantenían vivo el botón «Editar lead →». El renglón sigue
          siendo el mismo recuadro de antes: lo que cambió es que la URL se sobrescribe
          con un click y el «Abrir →» quedó al lado en vez de envolver todo. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
          <span style={{ flex: 'none', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Grabación (Fathom)</span>
          <span style={{ flex: 1, minWidth: 160 }}>
            <EnlaceFathomEditable leadId={leadId} campo={campoFathom} url={slot?.url ?? null} titulo={`Link de Fathom de la ${titulo.toLowerCase()}`} />
          </span>
        </div>
        {extras.map((f, i) => (
          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{f.label || 'Grabación'} (Fathom)</span>
            <span style={{ fontSize: 12.5, color: 'var(--accent)' }}>Abrir →</span>
          </a>
        ))}
      </div>

      {respuestas.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', listStyle: 'none' }}>
            Respuestas del formulario de Calendly ({reunion}) · {respuestas.length} ▾
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {respuestas.map((r, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 3 }}>{r.q}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{r.a}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ReunionesCard({ lead, respuestas, equipo = [], closerDetectado }: { lead: Lead; respuestas?: { R1: RespuestaQA[]; R2: RespuestaQA[] }; equipo?: MiembroEquipo[]; closerDetectado?: string | null }) {
  const agendo = !!lead.fecha_junta_1 || !!lead.fecha_junta_2 || !!lead.fecha_agenda || lead.asistio_j1 != null;
  const links = ((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url);
  // Heurística de asignación de grabaciones: por etiqueta; lo no etiquetado va a R1.
  const esR2 = (f: FathomLink) => etiquetaEsR2(f.label);
  const fathomR1 = links.filter((f) => !esR2(f));
  const fathomR2 = links.filter(esR2);
  // ⚠️ Y UNA GRABACIÓN DE R2 BASTA PARA DIBUJAR EL BLOQUE, aunque no haya fecha. Desde
  // que el link de Fathom se pega ACÁ, el bloque es el único lugar donde ese link se
  // lee: sin esta condición, un lead con la grabación de la R2 cargada (por el webhook
  // de Fathom, que no escribe la fecha) la escondía — y el dato desaparecía de la
  // pantalla sin que nada lo dijera. Y vale igual para el `!tuvoR2` de «Agendar R2»: una
  // grabación de la R2 es la R2 ocurrida, así que ofrecer agendarla sería ofrecer una
  // segunda.
  const tuvoR2 = !!lead.fecha_junta_2 || lead.asistio_j2 != null || fathomR2.length > 0;
  const r1 = respuestas?.R1 ?? [];
  const r2 = respuestas?.R2 ?? [];

  if (!agendo) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Reuniones</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Este lead todavía no agendó ninguna reunión. Cuando agende (por Calendly o a mano) los datos de R1/R2 aparecen aquí.</p>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Reuniones</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BloqueReunion
          titulo="Reunión 1"
          reunion="R1"
          leadId={lead.id}
          campoFecha="fecha_junta_1"
          campoFathom="fathom_r1"
          fecha={lead.fecha_junta_1}
          fallbackFecha={lead.fecha_agenda}
          chips={<>
            {/* ⚠️ LA ASISTENCIA NO SE PUEDE MARCAR SIN FECHA DE REUNIÓN, y por eso acá
                ni se ofrece: `updateLead` fuerza `asistio_j1` a null cuando no hay
                `fecha_junta_1`, o sea que el click guardaría y el chip volvería solo a
                «Sin marcar». La salida está al lado — la fecha de arriba se corrige con
                un click y con eso esto se habilita. */}
            <TriEditable leadId={lead.id} campo="asistio_j1" valor={lead.asistio_j1} si="Asistió" no="No asistió" titulo="¿Asistió a la reunión 1?" bloqueado={!lead.fecha_junta_1} />
            {/* ⚠️ «Calificado» YA NO SE ESCONDE CUANDO NO ASISTIÓ, y no es un detalle:
                el MISMO dato se marca ahora en la pestaña Tracking (hay funnels sin
                reuniones, y es la señal que viaja a Meta). Si acá apareciera y
                desapareciera con otra condición, la misma pregunta tendría dos
                respuestas según la pestaña. Las dos usan el mismo control, la misma
                columna y el mismo candado: sólo se bloquea cuando CONSTA que no vino,
                que es el único caso en que `updateLead` descarta el dato. */}
            <TriEditable leadId={lead.id} campo="calificado" valor={lead.calificado} si="Calificado" no="No calificado" titulo="¿Era un lead calificado?" bloqueado={calificadoSeDescarta(lead)} />
          </>}
          fathom={fathomR1}
          respuestas={r1}
        />
        {tuvoR2 && (
          <BloqueReunion
            titulo="Reunión 2"
            reunion="R2"
            leadId={lead.id}
            campoFecha="fecha_junta_2"
            campoFathom="fathom_r2"
            fecha={lead.fecha_junta_2}
            chips={<TriEditable leadId={lead.id} campo="asistio_j2" valor={lead.asistio_j2} si="Asistió" no="No asistió" titulo="¿Asistió a la reunión 2?" bloqueado={!lead.fecha_junta_2} />}
            fathom={fathomR2}
            respuestas={r2}
          />
        )}
        {/* ⚠️ AL LADO DE LAS REUNIONES Y SÓLO SI TODAVÍA NO HAY R2. El caso que
            esto resuelve es salir de la R1 con la segunda reunión ya agendada, así
            que con una R2 encima el botón ofrecería una segunda — reagendar es
            otra cosa y se hace desde el wizard de etapa.

            Y `sin_r2` lo apaga igual: es «cierre sin Reunión 2», o sea una persona
            que ya declaró que esta venta no la lleva. Ofrecerle agendarla es
            ofrecerle deshacer una decisión que tomó en otra pantalla.

            El control se apaga solo si el negocio no puede usarlo (ver AgendarR2). */}
        {!tuvoR2 && !lead.sin_r2 && <AgendarR2 leadId={lead.id} email={lead.email ?? null} />}
      </div>

      {/* Lo que salió de la llamada. Va DEBAJO de los bloques y no adentro de
          cada uno, por una razón de datos: es UNA lectura por lead (una fila por
          grabación en closing_analyses) y partirla en dos la pediría dos veces.
          Cada fila dice a qué reunión pertenece. */}
      {/* Sin envoltorio a propósito: este apartado puede no dibujarse (sin
          grabación no falta nada), y una caja puesta desde afuera convierte ese
          `return null` en un hueco de 16 px que nadie puso. El margen va adentro. */}
      <InsightsLlamadaCard leadId={lead.id} links={links} hayGrabacion={links.length > 0} />

      {/* Agendamiento · Closer · Setter · Confirmación en recuadros que llegan hasta
          el ancho. Eran TRES: el agendamiento entró acá porque era el cuarto campo
          que sólo se podía corregir desde el formulario, y es de la misma familia
          que la confirmación de pago (una fecha del recorrido, no de una reunión).
          `auto-fit` en vez de las 4 columnas fijas: con 170 px de mínimo, en el modal
          angosto bajan a dos filas en vez de recortar el valor. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 16 }}>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Agendamiento</span>
          <div style={{ marginTop: 3 }}>
            <FechaEditable
              leadId={lead.id}
              campo="fecha_agenda"
              valor={lead.fecha_agenda}
              titulo="Fecha en que agendó"
              vacio="—"
              estilo={{ fontSize: 14, fontWeight: 600, color: lead.fecha_agenda ? 'var(--ink)' : 'var(--faint)' }}
            />
          </div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
          {/* Closer: si está vacío pero Fathom detectó uno, lo ofrecemos como sugerencia
              en el lugar del valor — elegirlo del desplegable es lo que lo guarda. */}
          <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Closer</span>
          <div style={{ marginTop: 3 }}>
            <PersonaEditable leadId={lead.id} campo="closer" valor={lead.closer ?? null} equipo={equipo} hint={closerDetectado && !lead.closer ? `${closerDetectado} (de Fathom)` : undefined} />
          </div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Setter</span>
          <div style={{ marginTop: 3 }}>
            <PersonaEditable leadId={lead.id} campo="setter" valor={lead.setter ?? null} equipo={equipo} />
          </div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Confirmación de pago</span>
          <div style={{ marginTop: 3 }}>
            <FechaEditable
              leadId={lead.id}
              campo="fecha_confirmacion"
              valor={lead.fecha_confirmacion}
              titulo="Fecha en que confirmó el pago"
              vacio="—"
              estilo={{ fontSize: 14, fontWeight: 600, color: lead.fecha_confirmacion ? 'var(--ink)' : 'var(--faint)' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
