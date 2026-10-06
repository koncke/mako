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

import type { ReactNode } from 'react';
import { Spinner } from '@/app/_ui';
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

export function LlamadasCliente({ llamadas }: { llamadas: LlamadaCliente[] | null | undefined }) {
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
          {llamadas.map((l, i) => (
            <li key={`${l.url ?? ''}-${i}`}>
              <span className="fl-f">{dia(l.fecha) ?? 'Sin fecha'}</span>
              <span className="fl-t">
                <b>{l.titulo}</b>
                {l.tipo && <span className="fl-tag">{TIPO[l.tipo]}</span>}
              </span>
              {l.duracionMin != null && <span className="fl-d">{l.duracionMin} min</span>}
              {l.url
                ? <a className="fl-a" href={l.url} target="_blank" rel="noopener noreferrer">Abrir →</a>
                : <span className="fl-a fl-sin">Sin link</span>}
            </li>
          ))}
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
.fr{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; align-items:start; }
@media (max-width: 900px){ .fr{ grid-template-columns:minmax(0,1fr); } }

/* Las llamadas: una lista, la fecha adelante para que se lea de arriba abajo como lo que es,
   un historial. */
.fl{ list-style:none; margin:0; padding:0; }
.fl li{ display:flex; align-items:baseline; gap:14px; padding:12px 2px; border-bottom:1px solid var(--border); }
.fl li:last-child{ border-bottom:0; }
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
`;
