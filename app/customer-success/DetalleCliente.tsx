'use client';

// =============================================================================
// La ficha de un cliente — en tabs, como la ficha del CRM
// =============================================================================
// La card dice qué le pasa y nada más. Todo lo demás vive acá, partido en tabs
// por PREGUNTA y no por longitud:
//
//   Trabajo         ¿qué le debo?         el tablero: proyectos, tareas, recurrentes
//   Contrato        ¿qué le prometí?      `deal_promesa` + `deal_servicio` + el reloj
//   Conversaciones  ¿cuándo hablamos?     `closing_analyses` + `wa_mensajes`
//   Cobros          ¿qué me debe?         `pagos`
//   Contacto        ¿cómo lo ubico?       `leads`
//
// Cinco, y el techo son seis (app/_ui/Tabs.tsx). Las cinco se llenan con tablas
// que tienen `workspace_id`: ninguna es una promesa que en otro workspace esté
// vacía por construcción.
//
// ⚠️ LA SEXTA ERA «PROGRAMA» Y SE FUE. Mostraba el avance sobre las 44 clases del
// sistema de Mauricio (`lib/programa-catalogo.ts`, `cs_respuestas`, Whop). Es SU
// negocio, no un molde vacío: un cliente que entrara vería el material de él.
//
// ⚠️ CADA TAB PUEDE DECIR «NO PUDE LEER ESTO». `cobrosLeidos` y `contactoLeido`
// vienen de la cartera justamente para eso: una lectura fallida convertida en
// cero afirma «no debe nada» y «nadie le escribió» sobre datos que nunca se
// leyeron. Es la falla más cara de este repo y falla en la dirección tranquila.
//
// ⚠️ NO REPITE LA FICHA DEL CRM. Todo lo de la VENTA —origen, tracking, insights,
// historial de cambios— ya vive en `/crm/[id]` y ahí se queda: duplicarlo sería
// dos lugares donde vive un cliente y uno de los dos quedando viejo. Esto es la
// ENTREGA, y linkea a la ficha para el resto.

import { useState } from 'react';
import { Modal, Status, MONO } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import type { ClienteCartera, EstadoCliente } from '@/lib/cs-cartera';
// El nivel y su clave salen del módulo que los define; de ClientesApp sólo vienen
// las tres funciones de PRESENTACIÓN que las dos pantallas comparten. Ese import
// cruzado no es un ciclo: son constantes y funciones puras declaradas arriba del
// componente que importa a éste.
import { claveNivel } from '@/lib/cs-senal';
import { TONO_SENAL, relojTexto, trabajoTexto } from './ClientesApp';
import { TrabajoDelCliente } from './TrabajoCliente';
import type { ResumenTrabajo } from './trabajo';

type TabKey = 'trabajo' | 'contrato' | 'conversaciones' | 'cobros' | 'contacto';

export function DetalleCliente({ cliente: c, trabajo, tableroOk, guardando, onCerrar, onMarcar }: {
  cliente: ClienteCartera;
  /** Los números del tablero, que ya vinieron con la cartera. El badge sale de acá
   *  y no de una carga: una tab cuyo badge aparece tres segundos después salta a
   *  la vista. */
  trabajo: ResumenTrabajo | null;
  tableroOk: boolean;
  guardando: boolean;
  onCerrar: () => void;
  onMarcar: (estado: EstadoCliente) => void;
}) {
  const [tab, setTab] = useState<TabKey>('trabajo');

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    // El badge cuenta las ABIERTAS, no las recurrentes: un número que incluye lo
    // que se repite para siempre nunca baja, y un badge que nunca baja deja de
    // leerse.
    { key: 'trabajo', label: 'Trabajo', badge: trabajo?.abiertas || undefined },
    { key: 'contrato', label: 'Contrato' },
    { key: 'conversaciones', label: 'Conversaciones', badge: c.sesiones || undefined },
    { key: 'cobros', label: 'Cobros', badge: c.cuotasVencidas || undefined },
    { key: 'contacto', label: 'Contacto' },
  ];

  return (
    <Modal titulo={c.nombre} onCerrar={onCerrar} ancho={720}>
      <div className="dc">
        {/* La misma señal que se ve en la card. No se recalcula: dos cálculos de la
            misma señal son dos señales que van a divergir. */}
        <p className="dc-senal">
          <Status tono={TONO_SENAL[claveNivel(c.senal.nivel)]}>{c.senal.motivo}</Status>
        </p>

        <div className="dc-hi">
          <Hi k="Reloj" v={relojTexto(c.reloj)} />
          <Hi k="Último contacto" v={ultimoContactoTexto(c)} />
          <Hi k="Cobros" v={cobrosTexto(c)} />
          <Hi k="Trabajo" v={trabajoTexto(trabajo, tableroOk)} />
        </div>

        <nav className="dc-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key}
              className={tab === t.key ? 'es' : ''} onClick={() => setTab(t.key)}>
              {t.label}
              {t.badge ? <span className="bg">{t.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="dc-cuerpo">
          {/* `key` por cliente: sin eso, al saltar de un cliente a otro se ve un
              instante el trabajo del anterior. */}
          {tab === 'trabajo' && <TrabajoDelCliente key={c.leadId} leadId={c.leadId} nombre={c.nombre} resumen={trabajo} />}
          {tab === 'contrato' && <Contrato c={c} />}
          {tab === 'conversaciones' && <Conversaciones c={c} />}
          {tab === 'cobros' && <Cobros c={c} />}
          {tab === 'contacto' && <Contacto c={c} />}
        </div>

        <footer className="dc-pie">
          <Link href={`/crm/${c.leadId}`} className="dc-ficha">Abrir su ficha en el CRM →</Link>
          {/* Cerrar a un cliente es una DECISIÓN, no un cálculo: el contrato dice
              cuándo vence el plazo, no si el trabajo se terminó. */}
          <span className="dc-estado">
            {c.estado === 'activo' ? (
              <>
                <button disabled={guardando} onClick={() => onMarcar('pausado')}>Ponerlo en pausa</button>
                <button disabled={guardando} onClick={() => onMarcar('graduado')}>Marcar como terminado</button>
                <button disabled={guardando} onClick={() => onMarcar('baja')}>Se dio de baja</button>
              </>
            ) : (
              <button disabled={guardando} onClick={() => onMarcar('activo')}>Volver a ponerlo activo</button>
            )}
          </span>
        </footer>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Modal>
  );
}

/** ⚠️ «No pude leer» es un TERCER estado, y no se pinta como «nunca hablaron». */
function ultimoContactoTexto(c: ClienteCartera): string {
  if (!c.contactoLeido) return 'No lo pude leer';
  if (c.ultimoContactoHace === null) return 'Ninguno todavía';
  const como = c.ultimoContactoFue === 'whatsapp' ? 'WhatsApp' : 'llamada';
  return c.ultimoContactoHace === 0 ? `Hoy, por ${como}` : `Hace ${c.ultimoContactoHace} d, por ${como}`;
}

function cobrosTexto(c: ClienteCartera): string {
  if (!c.cobrosLeidos) return 'No los pude leer';
  if (c.cuotasVencidas > 0) return `${c.cuotasVencidas} ${c.cuotasVencidas === 1 ? 'vencida' : 'vencidas'}`;
  if (c.cuotasImpagasSinFecha > 0) return `${c.cuotasImpagasSinFecha} sin fecha`;
  return 'Sin vencidas';
}

function Hi({ k, v }: { k: string; v: string }) {
  return (
    <span className="hi">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </span>
  );
}

/** Lo que dice el contrato: es lo primero que hay que tener a mano antes de hablar
 *  con él, y es de donde sale el reloj de la card. */
function Contrato({ c }: { c: ClienteCartera }) {
  const r = c.reloj;
  const p = c.promesa;
  return (
    <>
      {/* ⚠️ No dice «no tiene contrato»: dice que NO ESTÁ CARGADO. Medido el
          26/09/2026: 6 de 14 clientes del ws1, 1 de 11 del ws11 y los 2 del ws13
          no tienen `deal_promesa` ni `deal_servicio` — y los del ws13 cerraron
          anteayer, que es el estado normal del día 1. */}
      {!c.tieneContrato && <p className="dc-nota">Su contrato no está cargado en su ficha del CRM.</p>}
      <dl className="dc-dl">
        {p.queEs && <Fila k="Qué se le vendió" v={p.queEs} />}
        {p.resultado && <Fila k="Le prometiste" v={p.resultado} />}
        {p.garantia && (
          <Fila k="Garantía" v={p.garantia}
            nota="Cambia qué significa pasarse del plazo para ESTE cliente." />
        )}
        {p.sesiones && <Fila k="Sesiones pactadas" v={p.sesiones} />}
        <Fila
          k="Duración"
          v={r.semanasTotales ? `${r.semanasTotales} semanas` : 'No la dice el contrato'}
          tono={r.semanasTotales ? undefined : 'warn'}
          nota={r.fuente === 'ficha' ? 'Sale de la ficha, no del contrato.' : undefined}
        />
        <Fila
          k="Arrancó"
          v={r.arranque ? r.arranque.slice(0, 10) : 'Sin fecha'}
          tono={r.arranque ? undefined : 'warn'}
          nota={r.fuenteArranque === 'cierre'
            ? 'No hay fecha de inicio cargada: se usa la del cierre de la venta.'
            : undefined}
        />
        {c.cierre && <Fila k="Cerró" v={c.cierre.slice(0, 10)} />}
        {r.terminado && (
          <Fila k="Plazo" v="Se pasó" tono="warn"
            nota="Pasarse del plazo no es haber terminado: eso lo decides tú abajo." />
        )}
      </dl>
    </>
  );
}

/** Las dos fuentes de «¿cuándo hablamos?», juntas: una llamada analizada y un
 *  WhatsApp son la misma pregunta, y separarlas en dos tabs deja a cada workspace
 *  con una vacía (medido: ws1 143 sesiones y 0 del ws11; ws11 561 mensajes). */
function Conversaciones({ c }: { c: ClienteCartera }) {
  if (!c.contactoLeido) {
    return <Vacio titulo="No pude leer sus conversaciones"
      detalle="Mientras tanto no se puede decir si hablaron o no." />;
  }
  if (c.ultimoContactoHace === null) {
    return <Vacio titulo="Todavía no hay ninguna conversación registrada"
      detalle="Aparecen solas cuando se analiza una llamada suya o llega un WhatsApp." />;
  }
  return (
    <dl className="dc-dl">
      <Fila k="Último contacto" v={ultimoContactoTexto(c)} />
      {c.esperaRespuestaHace !== null && (
        <Fila k="Te escribió" v={`hace ${c.esperaRespuestaHace} ${c.esperaRespuestaHace === 1 ? 'día' : 'días'}`}
          tono="bad" nota="Nadie le contestó después de ese mensaje." />
      )}
      {c.ultimoMensajeHace !== null && (
        <Fila k="Último WhatsApp" v={`hace ${c.ultimoMensajeHace} ${c.ultimoMensajeHace === 1 ? 'día' : 'días'}`} />
      )}
      <Fila k="Llamadas analizadas" v={`${c.sesiones}`} />
      {c.sesiones > 0 && (
        <Fila k="La última" v={c.ultimaSesionTitulo ?? 'Sin título'}
          nota={c.ultimaSesionHace !== null ? `hace ${c.ultimaSesionHace} días` : undefined} />
      )}
    </dl>
  );
}

function Cobros({ c }: { c: ClienteCartera }) {
  if (!c.cobrosLeidos) {
    return <Vacio titulo="No pude leer sus cobros"
      detalle="Mientras tanto no se puede decir si debe algo." />;
  }
  // ⚠️ «SIN CUOTAS VENCIDAS» NO ES «ESTÁ AL DÍA». Una cuota impaga SIN
  // `fecha_esperada` no se puede declarar vencida —impaga y vencida son dos
  // cosas— y se cuenta aparte: son 2 de las 3 impagas del ws11.
  if (!c.cuotasVencidas && !c.cuotasImpagasSinFecha) {
    return <Vacio titulo="Sin cuotas vencidas"
      detalle="Lo que se le cobró y lo que falta se carga en su ficha del CRM." />;
  }
  return (
    <dl className="dc-dl">
      {c.cuotasVencidas > 0 && <Fila k="Cuotas vencidas" v={`${c.cuotasVencidas}`} tono="bad" />}
      {c.cuotaVencidaDias !== null && (
        <Fila k="La más vieja" v={`hace ${c.cuotaVencidaDias} días`} tono="bad" />
      )}
      {c.cuotasImpagasSinFecha > 0 && (
        <Fila k="Impagas sin fecha" v={`${c.cuotasImpagasSinFecha}`} tono="warn"
          nota="Sin fecha de cobro no se pueden dar por vencidas. Se cargan en su ficha del CRM." />
      )}
    </dl>
  );
}

function Contacto({ c }: { c: ClienteCartera }) {
  return (
    <dl className="dc-dl">
      <Fila k="Empresa" v={c.empresa ?? 'Sin cargar'} tono={c.empresa ? undefined : 'warn'} />
      <Fila k="Email" v={c.email ?? 'Sin cargar'} tono={c.email ? undefined : 'warn'} />
      <Fila k="Teléfono" v={c.telefono ?? 'Sin cargar'} tono={c.telefono ? undefined : 'warn'} />
    </dl>
  );
}

function Fila({ k, v, nota, tono }: { k: string; v: string; nota?: string; tono?: 'mako' | 'warn' | 'bad' }) {
  return (
    <div className="dc-fila">
      <dt>{k}</dt>
      <dd>
        {tono ? <Status tono={tono}>{v}</Status> : v}
        {nota && <span className="nota">{nota}</span>}
      </dd>
    </div>
  );
}

function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="dc-vacio">
      <p className="t">{titulo}</p>
      <p className="d">{detalle}</p>
    </div>
  );
}

const CSS = `
.dc-senal{ margin:0 0 16px; }
.dc-hi{ display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:14px;
  padding:0 0 18px; border-bottom:1px solid var(--border); }
.dc-hi .hi{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.dc-hi .k{ font-family:${MONO}; font-size:10px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--faint); }
.dc-hi .v{ font-size:14.5px; font-weight:600; letter-spacing:-.01em; color:var(--ink);
  font-variant-numeric:tabular-nums; line-height:1.35; }

.dc-tabs{ display:flex; gap:2px; flex-wrap:wrap; margin:16px 0 0;
  border-bottom:1px solid var(--border); }
.dc-tabs button{ background:none; border:0; border-bottom:2px solid transparent; margin-bottom:-1px;
  padding:9px 12px; font:inherit; font-size:13.5px; color:var(--dim); cursor:pointer;
  display:flex; align-items:center; gap:6px; }
.dc-tabs button:hover{ color:var(--ink); }
.dc-tabs button.es{ color:var(--ink); font-weight:600; border-bottom-color:var(--primary); }
.dc-tabs .bg{ font-family:${MONO}; font-size:10px; padding:1px 6px; border-radius:999px;
  background:var(--surface-2); color:var(--dim); }
.dc-tabs button.es .bg{ background:var(--primary); color:#fff; }

.dc-cuerpo{ padding:18px 0 4px; min-height:150px; }
.dc-nota{ margin:0 0 14px; font-size:13.5px; line-height:1.5; color:var(--dim); }
.dc-dl{ margin:0; }
.dc-fila{ display:grid; grid-template-columns:150px 1fr; gap:14px; padding:11px 0;
  border-bottom:1px solid var(--border); }
.dc-fila:last-child{ border-bottom:0; }
.dc-fila dt{ font-size:13px; color:var(--faint); }
.dc-fila dd{ margin:0; font-size:14.5px; display:flex; flex-direction:column; gap:4px;
  align-items:flex-start; overflow-wrap:anywhere; }
.dc-fila .nota{ font-size:12.5px; line-height:1.45; color:var(--faint); }
@media (max-width:560px){ .dc-fila{ grid-template-columns:1fr; gap:4px; } }

.dc-vacio{ padding:26px 0; }
.dc-vacio .t{ font-size:15px; font-weight:600; margin:0 0 5px; color:var(--ink); }
.dc-vacio .d{ font-size:13.5px; line-height:1.5; color:var(--dim); margin:0; }

.dc-pie{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:8px;
  padding-top:14px; border-top:1px solid var(--border); }
.dc-estado{ margin-left:auto; display:flex; gap:2px; flex-wrap:wrap; }
.dc-estado button{ background:none; border:0; padding:6px 9px; border-radius:7px; font:inherit;
  font-size:12.5px; color:var(--dim); cursor:pointer; }
.dc-estado button:hover:not(:disabled){ background:var(--surface-2); color:var(--ink); }
.dc-estado button:disabled{ opacity:.45; cursor:default; }
.dc-ficha{ font-size:13.5px; color:var(--dim); }
.dc-ficha:hover{ color:var(--ink); }
`;
