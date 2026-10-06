'use client';

// =============================================================================
// FichaPestanas — el «Resumen» y las «Llamadas» de la ficha de un cliente
// =============================================================================
// Pedido de Martín (05/10/2026): «una tab de "Resumen" antes de "Prioridades", que
// contenga los datos más importantes del cliente… Un apartado de "Notas" para que el
// usuario pueda escribir lo que quiera sobre ese cliente. Y tal vez otra tab con las
// llamadas de fathom que se tuvo con ese cliente».
//
// ⚠️ ES UNA LISTA CON FILETES, NO UNA PILA DE CAJAS (AGENTS.md: «un grupo de cosas del
// mismo tipo es una lista con filete»). Los datos de un cliente son renglones de la misma
// clase —un rótulo y un valor— y una tarjeta por dato sería el contenedor perezoso.
//
// ⚠️ LAS NOTAS SON LAS DEL CRM, EL MISMO COMPONENTE (`NotasCard`). Un cliente es un lead
// ganado: no hay tabla de clientes, así que las notas que se escriben acá son las que se
// ven en su ficha del CRM, y al revés. Una segunda forma de guardarlas habría partido en
// dos la respuesta a «¿qué anoté de este cliente?».
//
// ⚠️ NADA DE ESTO PIDE DATOS AL ABRIRSE, salvo las Notas (que traen su lectura y no se
// copiaron a propósito). Todo lo demás llega con el cliente (`c.ficha`, armado en
// page.tsx): la ficha no tiene estado de carga y no lo va a tener por esto.

import type { ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { NotasCard } from '@/app/crm/lead-view/NotasCard';
import type { ClienteCruce } from './cruce';
import type { TrabajoDeCliente } from './trabajo';
import { tiempoEnEtapa } from './en-etapa';
import { conteoDeTrabajo, fraseConteo, rutaPlanDeCliente, type EntregaDeCliente, type LlamadaCliente } from './ficha-datos';

/** `YYYY-MM-DD` → «12 sep 2026». Al mediodía UTC para que ningún huso lo corra de día. */
function dia(iso: string | null | undefined): string | null {
  const d = (iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = new Date(`${d}T12:00:00Z`);
  if (Number.isNaN(t.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(t);
}

const usd = (n: number) => `US$ ${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

export function ResumenCliente({ c, trabajo }: { c: ClienteCruce; trabajo: TrabajoDeCliente | null }) {
  const contacto = c.ficha?.contacto;
  const entregas = c.ficha?.entregas;
  const conteo = trabajo ? conteoDeTrabajo(trabajo) : null;
  const desde = dia(c.fechaCierre);
  const inicio = dia(contacto?.fechaInicioServicio);
  const tel = contacto?.telefono ?? null;

  return (
    <div className="fr">
      <dl className="fr-lista">
        {/* La entrega primero: es lo que esta pantalla existe para mirar. Un renglón por
            servicio, con la misma regla que el kanban (ver `entregasDe`). */}
        {entregas === null ? (
          <Fila k="Entrega"><span className="fr-nada">No pude leer la entrega.</span></Fila>
        ) : entregas && entregas.length > 0 ? (
          <Fila k="Entrega">
            <span className="fr-ents">
              {entregas.map((e) => <LineaEntrega key={e.productoId} e={e} />)}
            </span>
          </Fila>
        ) : null}

        <Fila k="Cliente desde">{desde ?? <span className="fr-nada">—</span>}</Fila>
        {inicio && <Fila k="Inicio del servicio">{inicio}</Fila>}

        <Fila k="Email">
          {c.email ? <a className="fr-a" href={`mailto:${c.email}`}>{c.email}</a> : <span className="fr-nada">—</span>}
        </Fila>
        <Fila k="Teléfono">
          {/* Con la lectura caída no se dice «—»: eso afirmaría que no tiene teléfono. */}
          {contacto === null
            ? <span className="fr-nada">No lo pude leer.</span>
            : tel ? <a className="fr-a" href={`tel:${tel.replace(/[^\d+]/g, '')}`}>{tel}</a> : <span className="fr-nada">—</span>}
        </Fila>

        {/* La plata, SÓLO si hay venta cargada: un «US$ 0» sobre un monto que nadie
            escribió es una afirmación sobre el negocio. Lo cobrado sale de los pagos. */}
        {contacto?.montoCierreUsd != null && contacto.montoCierreUsd > 0 && (
          <Fila k="Venta">
            {usd(contacto.montoCierreUsd)}
            {contacto.totalCobradoUsd != null && (
              <span className="fr-sec"> · cobrado {usd(contacto.totalCobradoUsd)}</span>
            )}
          </Fila>
        )}

        <Fila k="Trabajo">
          <span className="fr-trabajo">
            {conteo ? <span>{fraseConteo(conteo)}</span> : <span className="fr-nada">No pude leer su tablero.</span>}
            {/* ⚠️ AL PLAN, NO A UNA COPIA. «Para que no sea tan confuso y copiar toda la
                tab de PLAN en el detail… que haya un botón que te redirija con el filtro ya
                puesto» (05/10/2026). Va con el `Link` de la casa: preserva el `?ws=`, o el
                super admin terminaría mirando SU plan y no el de este cliente. */}
            <Link className="fr-plan" href={rutaPlanDeCliente(c.leadId)}>Ver en el Plan →</Link>
          </span>
        </Fila>
      </dl>

      <div className="fr-notas">
        <NotasCard leadId={c.leadId} />
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

function Fila({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="fr-fila">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function LineaEntrega({ e }: { e: EntregaDeCliente }) {
  const t = tiempoEnEtapa(e.desde);
  return (
    <span className="fr-ent">
      <span className="fr-serv">{e.servicio}</span>
      {e.etapa === null ? (
        // Su etapa se borró del catálogo: el kanban lo lista aparte, y acá se dice igual.
        <span className="fr-nada">Etapa que ya no existe</span>
      ) : (
        <span className="fr-etapa">
          <span className="fr-dot" style={{ background: e.color ?? 'var(--faint)' }} aria-hidden />
          {e.fase ? `${e.fase} · ${e.etapa}` : e.etapa}
        </span>
      )}
      {/* Sin fila el reloj no arrancó, y no se inventa un «recién». */}
      {t && <span className={t.trabado ? 'fr-hace mal' : 'fr-hace'} title={t.trabado ? 'Lleva mucho en esta etapa' : undefined}>{t.frase}</span>}
    </span>
  );
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
/* Dos columnas en la ficha ancha: los datos y las notas. La ficha mide 1560, y una lista de
   rótulo y valor estirada a ese ancho deja el valor a un metro de su rótulo. En una ventana
   angosta las notas bajan. */
.fr{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:28px; align-items:start; }
@media (max-width: 900px){ .fr{ grid-template-columns:minmax(0,1fr); } }
.fr-lista{ margin:0; }
.fr-fila{ display:flex; align-items:baseline; gap:16px; padding:11px 2px; border-bottom:1px solid var(--border); }
.fr-fila:last-child{ border-bottom:0; }
.fr-fila dt{ flex:0 0 140px; margin:0; font-size:12.5px; font-weight:500; color:var(--dim); }
.fr-fila dd{ flex:1; min-width:0; margin:0; font-size:14px; color:var(--ink); overflow-wrap:anywhere; }
.fr-nada{ color:var(--faint); }
.fr-sec{ color:var(--dim); }
.fr-a{ color:var(--ink); text-decoration:none; }
.fr-a:hover{ color:var(--primary); text-decoration:underline; }
.fr-ents{ display:flex; flex-direction:column; gap:6px; }
.fr-ent{ display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px; }
.fr-serv{ font-weight:600; }
.fr-etapa{ display:inline-flex; align-items:center; gap:6px; }
.fr-dot{ width:8px; height:8px; border-radius:999px; flex:none; }
.fr-hace{ font-size:12.5px; color:var(--dim); }
.fr-hace.mal{ color:var(--bad); font-weight:600; }
.fr-trabajo{ display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 14px; }
.fr-plan{ font-size:12.5px; font-weight:600; color:var(--primary); text-decoration:none; white-space:nowrap; }
.fr-plan:hover{ text-decoration:underline; }

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
`;
