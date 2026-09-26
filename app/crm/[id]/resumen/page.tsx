// =============================================================================
// /crm/[id]/resumen — la pantalla que MaKo linkea por WhatsApp
// =============================================================================
// Se abre EN EL CELULAR: antes de la reunión (¿quién es este tipo?) y después
// (¿qué pasó y qué quedó pendiente?). Un solo link para los dos momentos, con
// el orden cambiado: si la llamada ya ocurrió, el resumen va arriba de todo;
// si todavía no, arriba va quién es y qué contestó al agendar.
//
// TRES REGLAS QUE LA DEFINEN, y que son la diferencia con /crm/[id]:
//
//  1. NO SE EDITA NADA. Es para leer parado, con la reunión por empezar. Todo
//     lo que se toca vive en la ficha completa, linkeada abajo.
//  2. UNA COLUMNA. Nada de tabs, nada de tarjetas al costado: en un teléfono
//     una segunda columna es una fila más abajo que nadie ve.
//  3. SIN CHROME. El sidebar no tiene tratamiento móvil y `MakoConfirmGate`
//     suma su tarjeta de cambios en todo /crm — los dos se desmontan acá vía
//     `esVistaSinChrome` (app/_components/PublicRouteGate.tsx).
//
// No gasta un peso de IA: todo sale de lo ya analizado (ver lib/lead-resumen.ts).
// =============================================================================

import { notFound, redirect } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Pagina, PermissionState } from '@/app/_ui';
import { requireCapa } from '@/lib/tab-access';
import { getResumenLead, type LlamadaResumen } from '@/lib/lead-resumen';
import { estadoDelAnalisis } from '@/lib/closing-job';
import { AnalizarLlamada } from './AnalizarLlamada';
import { workspaceDeLeadParaAdmin } from '@/lib/leads';
import { getPipelineStagesDeLead } from '@/lib/funnels';
import { getWorkspaceActual } from '@/lib/workspace';
import { deriveStageKey, stageMetaOpt, DEFAULT_STAGES, type Stage } from '@/lib/pipeline';
import { fechaHoraEnTz, fmtDDMMYYYY } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SANS = "'Geist', sans-serif";

// Una sola columna, medida de lectura, centrada. El ancho vive acá y en ningún
// otro lado: nada de lo de adentro lleva ancho propio (regla de la casa — un
// max-width en una pieza interna deja media caja vacía a la derecha).
const columna: CSSProperties = { maxWidth: 640, marginInline: 'auto', width: '100%', fontFamily: SANS };

const caja: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 16, padding: '18px 18px 20px', marginTop: 14,
};

/** Título de sección: texto normal, no un rótulo en monospace (sin kicker). */
function Seccion({ titulo, children, nota }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section style={caja}>
      <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, letterSpacing: '.01em', color: 'var(--dim)', textTransform: 'uppercase' }}>{titulo}</h2>
      {nota && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--dim)' }}>{nota}</p>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

/** Un dato: rótulo chico arriba, valor grande abajo. Se lee de un vistazo. */
function Dato({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 3 }}>{k}</div>
      <div style={{ fontSize: 15.5, lineHeight: 1.45, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{v}</div>
    </div>
  );
}

/**
 * Botón de contacto. `TOUCH` de la casa es 44 px: en un teléfono un link de
 * texto al lado de otro se toca mal, y estos tres son lo primero que se usa.
 */
function Contacto({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      style={{
        flex: 1, minWidth: 0, minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 7, padding: '0 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)',
        color: 'var(--ink)', fontSize: 14.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </a>
  );
}

const TONO_COLOR: Record<string, string> = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' };

/** Cuándo fue/es una reunión: con hora si la hay, si no el día, nunca el ISO crudo. */
function cuandoFue(iso: string | null, fecha: string | null, tz: string): string {
  if (iso) return fechaHoraEnTz(iso, tz);
  if (fecha) return fmtDDMMYYYY(fecha);
  return 'sin agendar';
}

/** El bloque de UNA llamada: resultado, resumen, objeciones y próximo paso. */
function Llamada({ ll, tz, principal }: { ll: LlamadaResumen; tz: string; principal: boolean }) {
  const abiertas = ll.objeciones.filter((o) => !o.handled);
  const resueltas = ll.objeciones.filter((o) => o.handled);
  const cuando = fechaHoraEnTz(ll.startedAt, tz);
  const titulo = principal ? 'Lo que pasó en la llamada' : `${ll.tipo ?? 'Llamada'}${cuando ? ` · ${cuando}` : ''}`;

  return (
    <Seccion titulo={titulo} nota={principal ? [ll.tipo, cuando, ll.duracionMin ? `${ll.duracionMin} min` : null].filter(Boolean).join(' · ') : undefined}>
      {ll.outcome && (
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, color: TONO_COLOR[ll.outcomeTone ?? ''] ?? 'var(--ink)' }}>
          {ll.outcome}
        </div>
      )}
      {ll.resumen && <p style={{ margin: '10px 0 0', fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink)' }}>{ll.resumen}</p>}

      {/* Las ABIERTAS primero y con marca propia: es lo único de la pantalla que
          hay que resolver. Una lista mezclada las esconde entre las resueltas. */}
      {abiertas.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bad)' }}>
            {abiertas.length === 1 ? 'Quedó 1 objeción sin resolver' : `Quedaron ${abiertas.length} objeciones sin resolver`}
          </div>
          {abiertas.map((o, i) => (
            <div key={i} style={{ marginTop: 9, paddingLeft: 11, borderLeft: '3px solid var(--bad)' }}>
              <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink)' }}>“{o.quote}”</div>
              {o.note && <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--dim)', marginTop: 3 }}>{o.note}</div>}
            </div>
          ))}
        </div>
      )}
      {resueltas.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dim)' }}>
            {resueltas.length === 1 ? 'Y 1 que sí respondiste' : `Y ${resueltas.length} que sí respondiste`}
          </div>
          {resueltas.map((o, i) => (
            <div key={i} style={{ marginTop: 8, paddingLeft: 11, borderLeft: '3px solid var(--border)' }}>
              <div style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--dim)' }}>“{o.quote}”</div>
            </div>
          ))}
        </div>
      )}

      {ll.proximoPaso && (
        <div style={{ marginTop: 16, padding: '12px 13px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 3 }}>El próximo paso</div>
          <div style={{ fontSize: 15.5, lineHeight: 1.5, color: 'var(--ink)' }}>{ll.proximoPaso}</div>
        </div>
      )}

      {ll.url && (
        <a href={ll.url} target="_blank" rel="noreferrer"
          style={{ display: 'inline-block', marginTop: 14, fontSize: 14.5, fontWeight: 600, color: 'var(--primary)' }}>
          Ver la grabación →
        </a>
      )}
    </Seccion>
  );
}

/**
 * El lead no está en ESTE workspace. Dos caminos, y la diferencia es quién sos:
 *
 *  · SUPER ADMIN → el lead existe, solo que en otro cliente. Se lo manda ahí con
 *    `?ws=`, que es el mecanismo YA auditado (proxy.ts lo acepta solo si la
 *    sesión firmada dice admin, y borra el header interno en cada request). No se
 *    lee el lead por afuera del scope: se lo redirige y de ahí manda el camino de
 *    siempre. El chequeo `!== wsActual` es el corta-bucle: sin él, un lead que no
 *    aparece ni con el `?ws=` correcto redirige para siempre.
 *
 *  · CUALQUIER OTRO → una pantalla que dice qué pasó y a dónde ir. Nunca el 404
 *    crudo de Next, que afirma que la página no existe cuando lo que no coincide
 *    es la cuenta. Y nunca de QUIÉN es: probando ids, un error que nombra al
 *    dueño reconstruye la cartera de clientes ajena.
 */
async function ResumenAjeno({ leadId }: { leadId: number }) {
  const [wsDueno, wsActual] = await Promise.all([
    workspaceDeLeadParaAdmin(leadId),
    getWorkspaceActual().catch(() => null),
  ]);
  if (wsDueno != null && wsDueno !== wsActual) redirect(`/crm/${leadId}/resumen?ws=${wsDueno}`);

  return (
    <Pagina densidad="compacta">
      <div style={columna}>
        <PermissionState
          motivo="ajeno"
          que="Este lead"
          accion={{ label: 'Ir a mi CRM', href: '/crm' }}
        />
      </div>
    </Pagina>
  );
}

export default async function ResumenLeadPage({ params }: { params: Promise<{ id: string }> }) {
  // Mismo permiso que el resto del CRM. No lleva `guardOnboarding`: esta
  // pantalla se abre desde un WhatsApp con la reunión encima, y mandar a
  // completar el onboarding en ese momento es perder la reunión.
  await requireCapa('crm');
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) notFound();

  const data = await getResumenLead(idNum);
  if (!data) return <ResumenAjeno leadId={idNum} />;
  const { lead, tz, llamadas, respuestas, origen, proximaReunion, grabaciones, borradorSeguimiento } = data;

  // DEL LEAD: el resumen rotula la etapa de ESE lead.
  const stagesRaw = await getPipelineStagesDeLead(lead).catch(() => [] as Stage[]);
  const stages = stagesRaw.length ? stagesRaw : DEFAULT_STAGES;
  const sm = stageMetaOpt(stages, lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead));

  const ultima = llamadas[0] ?? null;
  const anteriores = llamadas.slice(1);
  // El orden de la pantalla cambia con el momento: con una llamada ya analizada
  // lo primero es qué pasó; sin ella, lo primero es con quién te vas a sentar.
  const yaHablaron = Boolean(ultima);

  // ¿Ya hubo algo que analizar? Ofrecer «Analizar la llamada» sobre una reunión
  // que todavía no pasó promete algo que no existe, y barre Fathom para nada.
  // Alcanza con cualquiera de las tres, porque cada una falla por su lado: la
  // grabación puede estar cargada a mano sin fecha, la hora puede haber pasado
  // sin que nadie marque nada, y la asistencia puede estar marcada (incluso en
  // «no vino») sin que el análisis haya corrido — que es justo el caso que
  // destapó esto.
  const inicioReunion = lead.junta_2_at ?? lead.junta_1_at;
  const inicioMs = inicioReunion ? Date.parse(inicioReunion) : NaN;
  const reunionPaso = grabaciones.length > 0
    || (Number.isFinite(inicioMs) && inicioMs <= Date.now())
    || lead.asistio_j1 != null
    || lead.asistio_j2 != null;

  // El estado del análisis on-demand: es lo que decide entre ofrecer el botón y
  // mostrar que ya está corriendo. Vive en la base justamente para que cerrar la
  // pantalla no lo pierda.
  const job = !yaHablaron && reunionPaso ? await estadoDelAnalisis(idNum).catch(() => null) : null;

  const tel = (lead.telefono ?? '').replace(/\D/g, '');

  const quienEs = (
    <>
      {respuestas.length > 0 && (
        <Seccion titulo="Lo que contestó al agendar">
          {respuestas.map((r) => <Dato key={r.pregunta} k={r.pregunta} v={r.respuesta} />)}
        </Seccion>
      )}
      {(origen.campana || origen.anuncio || origen.canal) && (
        <Seccion titulo="De dónde vino">
          {origen.anuncio && <Dato k="Anuncio" v={origen.anuncio} />}
          {origen.campana && <Dato k="Campaña" v={origen.campana} />}
          {origen.canal && <Dato k="Canal" v={origen.canal} />}
        </Seccion>
      )}
    </>
  );

  return (
    <Pagina densidad="compacta">
      <div style={columna}>
        {/* ── Quién es ─────────────────────────────────────────────────────── */}
        <header>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-.01em' }}>{lead.nombre}</h1>
          {lead.empresa && <div style={{ marginTop: 3, fontSize: 16, color: 'var(--dim)' }}>{lead.empresa}</div>}
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {sm && (
              <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                {sm.label}
              </span>
            )}
            {proximaReunion && (
              <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--mako)', color: 'var(--mako-ink)' }}>
                {proximaReunion.cual} · {fechaHoraEnTz(proximaReunion.iso, tz)}
              </span>
            )}
          </div>
        </header>

        {/* ── Contacto: lo primero que se toca ─────────────────────────────── */}
        {(tel || lead.email) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {tel && <Contacto href={`https://wa.me/${tel}`}>WhatsApp</Contacto>}
            {tel && <Contacto href={`tel:+${tel}`}>Llamar</Contacto>}
            {lead.email && <Contacto href={`mailto:${lead.email}`}>Email</Contacto>}
          </div>
        )}

        {yaHablaron && ultima && <Llamada ll={ultima} tz={tz} principal />}

        {/* ── El seguimiento que MaKo dejó escrito ──────────────────────────
            Antes esto se anunciaba en el WhatsApp («te dejé el mensaje listo»)
            sin dar dónde leerlo. Vive acá justamente para poder abrirlo: se ve
            el texto completo, y el botón lleva al lugar donde se manda. */}
        {borradorSeguimiento && (
          <Seccion titulo="MaKo te escribió el seguimiento" nota="Todavía no se envió. Revísalo y envíalo desde el WhatsApp de MaKo.">
            <div style={{ padding: '13px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 15.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {borradorSeguimiento.texto}
            </div>
            <Link href={`/whatsapp?lead=${lead.id}`} style={{ display: 'inline-block', marginTop: 12, fontSize: 15, fontWeight: 600, color: 'var(--primary)' }}>
              Revisarlo y mandarlo →
            </Link>
          </Seccion>
        )}

        {quienEs}
        {/* Sin análisis, la pantalla dejó de ser un cartel y pasó a ser el lugar
            donde se resuelve: el botón lo dispara acá mismo. Existe porque una
            reunión puede haber ocurrido igual —la analiza sola el webhook, pero
            si eso falló no había ninguna forma de pedirlo desde el teléfono. */}
        {!yaHablaron && (
          <Seccion
            titulo={reunionPaso ? 'Todavía no analicé la llamada' : 'Todavía no hablaron'}
            nota={reunionPaso
              ? 'La reunión ya pasó. Puedo escuchar la grabación y dejarte aquí el resumen, las objeciones y el próximo paso.'
              : 'Cuando termine la reunión, aquí abajo aparece el resumen de la charla, las objeciones y el próximo paso.'}
          >
            {reunionPaso
              ? <AnalizarLlamada leadId={idNum} job={job} hayGrabacion={grabaciones.length > 0} />
              : <div style={{ fontSize: 15, color: 'var(--dim)' }}>Sin llamadas analizadas para este lead.</div>}
          </Seccion>
        )}

        {/* ── La agenda ────────────────────────────────────────────────────── */}
        {/* `junta_N_at` (ISO con hora) es lo que deja Calendly hoy; `fecha_junta_N`
            es solo el día y es lo único que tienen los leads viejos. Sin el
            fallback formateado, esas fichas mostraban «2025-11-25» crudo. */}
        <Seccion titulo="Las reuniones">
          <Dato k="Reunión 1" v={cuandoFue(lead.junta_1_at, lead.fecha_junta_1, tz)} />
          {lead.asistio_j1 != null && <Dato k="¿Asistió a la R1?" v={lead.asistio_j1 ? 'Sí' : 'No se presentó'} />}
          {(lead.junta_2_at || lead.fecha_junta_2) && (
            <Dato k="Reunión 2" v={cuandoFue(lead.junta_2_at, lead.fecha_junta_2, tz)} />
          )}
          {lead.asistio_j2 != null && <Dato k="¿Asistió a la R2?" v={lead.asistio_j2 ? 'Sí' : 'No se presentó'} />}
          {grabaciones.length > 0 && (
            <Dato
              k="Grabaciones"
              v={
                <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {grabaciones.map((g) => (
                    <a key={g.url} href={g.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>{g.label}</a>
                  ))}
                </span>
              }
            />
          )}
        </Seccion>

        {/* ── Las charlas anteriores, para no perder el hilo ────────────────── */}
        {anteriores.map((ll) => <Llamada key={ll.recordingId} ll={ll} tz={tz} principal={false} />)}

        <div style={{ marginTop: 20, paddingBottom: 8 }}>
          <Link href={`/crm/${lead.id}`} style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)' }}>
            Abrir la ficha completa →
          </Link>
        </div>
      </div>
    </Pagina>
  );
}
