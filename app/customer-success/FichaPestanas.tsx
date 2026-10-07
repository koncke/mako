'use client';

// =============================================================================
// FichaPestanas — Resumen, Pagos, Llamadas e Historial de la ficha de un cliente
// =============================================================================
// Pedido de Martín (05/10/2026): «una tab de "Resumen" antes de "Prioridades", que
// contenga los datos más importantes del cliente… Un apartado de "Notas" para que el
// usuario pueda escribir lo que quiera sobre ese cliente. Y tal vez otra tab con las
// llamadas de fathom que se tuvo con ese cliente».
//
// ⚠️ LAS NOTAS SON LAS DEL CRM, EL MISMO COMPONENTE (`NotasCard`). Un cliente es un lead
// ganado: no hay tabla de clientes, así que las notas que se escriben acá son las que se
// ven en su ficha del CRM, y al revés. Una segunda forma de guardarlas habría partido en
// dos la respuesta a «¿qué anoté de este cliente?».
//
// ⚠️ LOS DATOS DEL CLIENTE SON LA «INFORMACIÓN PRINCIPAL» DEL CRM, EL MISMO COMPONENTE
// (06/10/2026): «los datos que deben aparecer son esos 4 de la captura, menos dirección, con
// sus botones para poder ir al WhatsApp o copiar». Se fueron de acá la Entrega (pasó a los
// desplegables de la cabecera, ./FichaEntrega.tsx), el Trabajo («para eso ya está la sección
// de Prioridades», que ahora se llama Tareas y lleva «Ver en el Plan»), y la venta (vive en
// la tab Pagos, con el mismo DealDetailsCard del CRM).
//
// ⚠️ PAGOS E HISTORIAL PIDEN SUS DATOS AL ABRIRSE, como las Notas: son componentes del CRM
// que se reusan tal cual y traen su lectura (ver `pagosDeClienteAction`). El resto de la
// ficha sigue llegando con el HTML.

import { useState, type ReactNode } from 'react';
import { Spinner } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
// ⚠️ SÓLO TIPOS: el contrato trae los prompts del análisis, y esto corre en el navegador.
import type { AnalisisEntregaVista, GravedadRiesgo, QuienPaso } from '@/lib/closing-entrega-contrato';
import { NotasCard } from '@/app/crm/lead-view/NotasCard';
import { InfoPrincipalCard } from '@/app/crm/lead-view/InfoPrincipalCard';
import { AuditHistory } from '@/app/crm/lead-view/AuditHistory';
import { DealDetailsCard } from '@/app/crm/[id]/DealDetailsCard';
import type { Lead } from '@/lib/leads';
import type { Pago } from '@/lib/pagos';
import type { Stage } from '@/lib/pipeline';
import type { ClienteCruce } from './cruce';
import type { LlamadaCliente } from './ficha-datos';

/** `YYYY-MM-DD` → «12 sep 2026». Al mediodía UTC para que ningún huso lo corra de día. */
function dia(iso: string | null | undefined): string | null {
  const d = (iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = new Date(`${d}T12:00:00Z`);
  if (Number.isNaN(t.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(t);
}

export function ResumenCliente({ c }: { c: ClienteCruce }) {
  const contacto = c.ficha?.contacto;
  return (
    <div className="fr">
      <InfoPrincipalCard leadId={c.leadId} nombre={c.nombre} empresa={c.empresa}
        email={c.email ?? null} telefono={contacto?.telefono ?? null} web={contacto?.web ?? null} />
      <div className="fr-notas">
        <NotasCard leadId={c.leadId} />
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/** Lo que leen Pagos e Historial, una sola vez por ficha. */
export type DatosCrm =
  | 'cargando'
  | { ok: true; lead: Lead; pagos: Pago[]; etapas: Stage[] }
  | { ok: false; error: string };

function Cargando({ children }: { children: ReactNode }) {
  return <p className="fl-nada fl-cargando"><Spinner size={14} /> {children}</p>;
}

export function PagosCliente({ datos }: { datos: DatosCrm }) {
  if (datos === 'cargando') return <><Cargando>Leyendo sus pagos</Cargando><style dangerouslySetInnerHTML={{ __html: CSS }} /></>;
  if (!datos.ok) return <><p className="fl-nada">No pude leer sus pagos. {datos.error}</p><style dangerouslySetInnerHTML={{ __html: CSS }} /></>;
  return <DealDetailsCard lead={datos.lead} pagos={datos.pagos} />;
}

/**
 * EL HISTORIAL ES EL DEL CRM, y ahí ya cae lo de Customer Success: mover de etapa escribe
 * «Entrega: <producto>» en `lead_audit` (lib/cs-mover-etapa.ts), y renombrar al cliente
 * desde su ficha también (`guardarDatosClienteAction`). Espera a las etapas del CRM sólo
 * para pintar «Etapa» con su rótulo; si no llegaron, lo dibuja igual con la clave.
 */
export function HistorialCliente({ leadId, datos }: { leadId: number; datos: DatosCrm }) {
  if (datos === 'cargando') return <><Cargando>Leyendo su historial</Cargando><style dangerouslySetInnerHTML={{ __html: CSS }} /></>;
  return <AuditHistory leadId={leadId} stages={datos.ok ? datos.etapas : undefined} />;
}

const TIPO: Record<NonNullable<LlamadaCliente['tipo']>, string> = { venta: 'Venta', entrega: 'Entrega' };
const GRAVEDAD: Record<GravedadRiesgo, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const QUIEN: Record<QuienPaso, string> = { cliente: 'Cliente', equipo: 'Equipo' };

/** Segundos → «12:03». El segundo lo puso el código al encontrar la cita en la grabación. */
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Lo que MaKo leyó de una sesión de entrega (#107): el resumen, los riesgos con su chip y
 * su cita, y los próximos pasos. Pedido: «cada sesión de entrega analizada se despliega con
 * resumen, riesgos (chip de gravedad + cita) y próximos pasos. Minimalismo».
 *
 * ⚠️ «Ninguno» NO es «no se pudo leer»: una lista vacía acá es un análisis que miró la
 * sesión y no encontró riesgos —que es un dato, y bueno—. Lo no analizado no llega a esta
 * pieza: la fila no se despliega.
 */
function AnalisisSesion({ a, url }: { a: AnalisisEntregaVista; url: string | null }) {
  // El minuto de la cita abre la grabación en ESE segundo, con el mismo `?timestamp=` que ya
  // arma la API de MaKo para las citas del Closing Analyst (`conSegundo`, closing.run.ts).
  const enSegundo = (t: number) => (url ? `${url}${url.includes('?') ? '&' : '?'}timestamp=${Math.round(t)}` : null);
  return (
    <div className="fl-an">
      {a.resumen && <p className="fl-res">{a.resumen}</p>}
      <p className="fl-h">Riesgos</p>
      {a.riesgos.length ? (
        <ul className="fl-rs">
          {a.riesgos.map((r, i) => (
            <li key={i}>
              <span className={`fl-g fl-g-${r.gravedad}`}>{GRAVEDAD[r.gravedad]}</span>
              <span className="fl-rt">
                {r.riesgo}
                {/* Una cita vacía es una que el modelo dio y no está en la grabación: no se
                    dibuja entre comillas, porque se leería como lo que dijo el cliente. */}
                {r.cita && (
                  <span className="fl-cita">
                    «{r.cita}»
                    {r.t_seconds != null && (enSegundo(r.t_seconds)
                      ? <a className="fl-min" href={enSegundo(r.t_seconds)!} target="_blank" rel="noopener noreferrer">{mmss(r.t_seconds)}</a>
                      : <span className="fl-min">{mmss(r.t_seconds)}</span>)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="fl-vacio">Ninguno.</p>}
      <p className="fl-h">Próximos pasos</p>
      {a.pasos.length ? (
        <ul className="fl-ps">
          {a.pasos.map((p, i) => (
            <li key={i}><span className="fl-quien">{QUIEN[p.quien]}</span><span>{p.que}</span></li>
          ))}
        </ul>
      ) : <p className="fl-vacio">Ninguno.</p>}
    </div>
  );
}

export function LlamadasCliente({ llamadas }: { llamadas: LlamadaCliente[] | null | undefined }) {
  // Cuáles están desplegadas. Por posición: la lista es la misma mientras la ficha está
  // abierta (viaja con el HTML), y dos sesiones pueden compartir título o no tener link.
  const [abiertas, setAbiertas] = useState<ReadonlySet<number>>(() => new Set());
  const alternar = (i: number) => setAbiertas((prev) => {
    const s = new Set(prev);
    if (s.has(i)) s.delete(i); else s.add(i);
    return s;
  });
  return (
    <>
      {/* `undefined` = la pantalla que montó la ficha no las trae; para quien mira es lo
          mismo que no poder leerlas, y se dice igual. Y «no pude leer» no se pinta como
          «no hay ninguna»: son dos pantallas. */}
      {!llamadas ? (
        <p className="fl-nada">No pude leer sus llamadas.</p>
      ) : !llamadas.length ? (
        <p className="fl-nada">Todavía no hay llamadas grabadas con este cliente.</p>
      ) : (
        <ul className="fl">
          {llamadas.map((l, i) => {
            const abierta = !!l.analisis && abiertas.has(i);
            const alto = !!l.analisis?.riesgos.some((r) => r.gravedad === 'alta');
            return (
              <li key={`${l.url ?? ''}-${i}`}>
                <div className="fl-fila">
                  <span className="fl-f">{dia(l.fecha) ?? 'Sin fecha'}</span>
                  <span className="fl-t">
                    {/* Sólo una sesión ANALIZADA se despliega: el título es el botón, con
                        el chevron que dice que hay algo adentro. Las demás no cambian. */}
                    {l.analisis ? (
                      <button type="button" className="fl-abrir" aria-expanded={abierta}
                        aria-label={`${abierta ? 'Ocultar' : 'Ver'} el análisis de ${l.titulo}`}
                        onClick={() => alternar(i)}>
                        <span className={abierta ? 'fl-chev fl-chev-on' : 'fl-chev'}><Icon name="chevron" size={14} /></span>
                        <b>{l.titulo}</b>
                      </button>
                    ) : <b>{l.titulo}</b>}
                    {l.tipo && <span className="fl-tag">{TIPO[l.tipo]}</span>}
                    {alto && <span className="fl-g fl-g-alta">Riesgo alto</span>}
                  </span>
                  {l.duracionMin != null && <span className="fl-d">{l.duracionMin} min</span>}
                  {l.url
                    ? <a className="fl-a" href={l.url} target="_blank" rel="noopener noreferrer">Abrir →</a>
                    : <span className="fl-a fl-sin">Sin link</span>}
                </div>
                {abierta && l.analisis && <AnalisisSesion a={l.analisis} url={l.url} />}
              </li>
            );
          })}
        </ul>
      )}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad y la
// ruta contesta 200 con el layout entero y sin cuerpo (AGENTS.md).
const CSS = `
/* Dos columnas en la ficha ancha: los datos y las notas. En una ventana angosta las notas
   bajan. */
/* ⚠️ LAS DOS CAJAS MIDEN LO MISMO (06/10/2026): «que el apartado de NOTAS tenga el mismo
   tamaño que el recuadro de al lado». La fila se estira a la más alta (align-items:stretch)
   y la caja de las Notas, que vive adentro de un envoltorio, llena su celda: sin el
   height:100% se estiraba el envoltorio y la caja seguía del alto de su contenido. */
.fr{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; align-items:stretch; }
.fr-notas{ display:flex; flex-direction:column; min-width:0; }
.fr-notas > section{ flex:1; box-sizing:border-box; }
@media (max-width: 900px){ .fr{ grid-template-columns:minmax(0,1fr); } }

/* Las llamadas: una lista, la fecha adelante para que se lea de arriba abajo como lo que es,
   un historial. */
.fl{ list-style:none; margin:0; padding:0; }
.fl > li{ padding:12px 2px; border-bottom:1px solid var(--border); }
.fl > li:last-child{ border-bottom:0; }
.fl-fila{ display:flex; align-items:baseline; gap:14px; }
.fl-f{ flex:0 0 110px; font-size:12.5px; color:var(--dim); font-variant-numeric:tabular-nums; }
.fl-t{ flex:1; min-width:0; display:flex; align-items:baseline; gap:8px; }
.fl-t b{ font-size:14px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fl-tag{ flex:none; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px;
  background:var(--surface-2); color:var(--dim); }
.fl-d{ flex:none; font-size:12.5px; color:var(--dim); font-variant-numeric:tabular-nums; }
.fl-a{ flex:none; font-size:12.5px; font-weight:600; color:var(--primary); text-decoration:none; }
.fl-a:hover{ text-decoration:underline; }
.fl-sin{ color:var(--faint); font-weight:500; }
.fl-nada{ margin:16px 2px; font-size:13.5px; color:var(--faint); }
.fl-cargando{ display:flex; align-items:center; gap:8px; }

/* La sesion de entrega analizada: el titulo es el boton que la despliega. Sin caja: el
   analisis cuelga debajo de su fila, con la sangria de la fecha, y se lee como parte de
   ella. */
.fl-abrir{ display:flex; align-items:baseline; gap:6px; min-width:0; padding:0; border:0; background:none;
  font:inherit; color:inherit; text-align:left; cursor:pointer; }
.fl-abrir:hover b{ color:var(--primary); }
.fl-chev{ flex:none; display:inline-flex; align-self:center; color:var(--dim); transform:rotate(-90deg);
  transition:transform .15s ease; }
.fl-chev-on{ transform:none; }
.fl-g{ flex:none; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; }
.fl-g-alta{ background:var(--bad-bg); color:var(--bad); }
.fl-g-media{ background:var(--warn-bg); color:var(--warn); }
.fl-g-baja{ background:var(--surface-2); color:var(--dim); }
.fl-an{ margin:10px 0 2px 124px; display:flex; flex-direction:column; gap:6px; }
.fl-res{ margin:0 0 6px; font-size:13.5px; line-height:1.55; color:var(--ink); white-space:pre-line; }
.fl-h{ margin:6px 0 0; font-size:11.5px; font-weight:600; letter-spacing:.02em; color:var(--dim); }
.fl-rs, .fl-ps{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.fl-rs li, .fl-ps li{ display:flex; align-items:baseline; gap:10px; font-size:13.5px; color:var(--ink); }
.fl-rs .fl-g{ min-width:44px; text-align:center; }
.fl-rt{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.fl-cita{ font-size:12.5px; color:var(--dim); font-style:italic; }
.fl-min{ margin-left:6px; font-style:normal; font-variant-numeric:tabular-nums; color:var(--faint); text-decoration:none; }
a.fl-min:hover{ color:var(--primary); text-decoration:underline; }
.fl-quien{ flex:none; min-width:52px; font-size:12px; font-weight:600; color:var(--dim); }
.fl-vacio{ margin:0; font-size:13px; color:var(--faint); }
@media (max-width: 700px){ .fl-an{ margin-left:0; } }
`;
