'use client';

// =============================================================================
// El detalle de un cliente — en tabs, como la ficha del CRM
// =============================================================================
// La card de la cartera dice de quién es la pelota y nada más. Todo lo demás
// vive acá, partido en tabs por PREGUNTA y no por longitud, que es la regla de
// la casa: «¿qué contestó?» no es lo mismo que «¿de qué hablamos?» ni que
// «¿cuánto debe?».
//
// El molde es `app/crm/LeadSheet.tsx`, que ya resolvió esto para el lead: mismas
// tabs con badge numérico, mismo criterio de qué va arriba.
//
// ⚠️ NO REPITE LA FICHA DEL CRM. Todo lo de la VENTA —origen, tracking, insights,
// historial de cambios— ya vive en `/crm/[id]` y ahí se queda: duplicarlo sería
// dos lugares donde vive un cliente y uno de los dos quedando viejo. Este panel
// es la ENTREGA, y linkea a la ficha para el resto.

import { useState } from 'react';
import { Modal, Status, Button, MONO } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import type { ClienteCartera, EstadoCliente } from '@/lib/cs-cartera';

type TabKey = 'programa' | 'contrato' | 'sesiones' | 'cobros' | 'contacto';

export function DetalleCliente({ cliente: c, totalClases, onCerrar, onDarLink, onMarcar }: {
  cliente: ClienteCartera;
  totalClases: number;
  onCerrar: () => void;
  onDarLink: () => void;
  onMarcar: (estado: EstadoCliente) => void;
}) {
  const [tab, setTab] = useState<TabKey>('programa');

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'programa', label: 'Programa', badge: c.esperandoSuOk || undefined },
    { key: 'contrato', label: 'Contrato' },
    { key: 'sesiones', label: 'Sesiones', badge: c.sesiones || undefined },
    { key: 'cobros', label: 'Cobros', badge: c.cuotasVencidas || undefined },
    { key: 'contacto', label: 'Contacto' },
  ];

  return (
    <Modal titulo={c.nombre} onCerrar={onCerrar} ancho={720}>
      <div className="dc">
        {/* Lo que hay que saber antes de abrir cualquier tab. */}
        <p className="dc-cancha">{c.razon}</p>

        <div className="dc-hi">
          <Hi k="Semana" v={c.reloj.semana === null ? '—' : `${c.reloj.semana}`}
            de={c.reloj.semanasTotales ? `de ${c.reloj.semanasTotales}` : undefined} />
          <Hi k="Bloques listos" v={`${c.aprobados}`} de={`de ${totalClases}`} />
          <Hi k="Última sesión" v={c.ultimaSesionHace === null ? 'Ninguna' : `hace ${c.ultimaSesionHace} d`} />
          <Hi k="Sesiones" v={`${c.sesiones}`} />
        </div>

        <nav className="dc-tabs" role="tablist">
          {tabs.map(t => (
            <button key={t.key} role="tab" aria-selected={tab === t.key}
              className={tab === t.key ? 'es' : ''} onClick={() => setTab(t.key)}>
              {t.label}
              {t.badge ? <span className="bg">{t.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="dc-cuerpo">
          {tab === 'programa' && <Programa c={c} total={totalClases} onDarLink={onDarLink} />}
          {tab === 'contrato' && <Contrato c={c} />}
          {tab === 'sesiones' && <Sesiones c={c} />}
          {tab === 'cobros' && <Cobros c={c} />}
          {tab === 'contacto' && <Contacto c={c} />}
        </div>

        <footer className="dc-pie">
          <Link href={`/crm/${c.leadId}`} className="dc-ficha">Abrir su ficha completa en el CRM →</Link>
          {/* Cerrar a un cliente es una DECISIÓN, no un cálculo: el contrato dice
              cuándo vence el plazo, no si el trabajo se terminó. */}
          <span className="dc-estado">
            {c.estado === 'activo' ? (
              <>
                <button onClick={() => onMarcar('graduado')}>Marcar como graduado</button>
                <button onClick={() => onMarcar('baja')}>Se dio de baja</button>
              </>
            ) : (
              <button onClick={() => onMarcar('activo')}>Volver a ponerlo activo</button>
            )}
          </span>
        </footer>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Modal>
  );
}

function Hi({ k, v, de }: { k: string; v: string; de?: string }) {
  return (
    <span className="hi">
      <span className="k">{k}</span>
      <span className="v">{v}{de && <span className="de"> {de}</span>}</span>
    </span>
  );
}

function Programa({ c, total, onDarLink }: { c: ClienteCartera; total: number; onDarLink: () => void }) {
  if (!c.links) {
    return (
      <Vacio
        titulo="Todavía no tiene su link"
        detalle="Sin link no puede contestar ninguna tarea. Es lo primero."
        accion={<Button size="sm" onClick={onDarLink}>Darle su link</Button>}
      />
    );
  }
  if (c.contestados === 0) {
    return (
      <Vacio
        titulo="Tiene su link y todavía no contestó nada"
        detalle={c.entroHace === null
          ? 'Nunca entró. Puede que el link no le haya llegado.'
          : `Entró hace ${c.entroHace} días.`}
      />
    );
  }
  return (
    <dl className="dc-dl">
      <Fila k="Va por" v={c.bloqueActual ?? 'Terminó todos los bloques'} />
      <Fila k="Contestados" v={`${c.contestados} de ${total}`} />
      <Fila k="Aprobados" v={`${c.aprobados} de ${total}`} />
      {c.esperandoSuOk > 0 && (
        <Fila k="Esperando su ok" v={`${c.esperandoSuOk}`} tono="mako"
          nota="MaKo ya reescribió esos bloques con lo hablado en la sesión." />
      )}
      {c.vistosSinContestar > 0 && (
        <Fila k="Vio y no contestó" v={`${c.vistosSinContestar}`} tono="warn" />
      )}
      {c.entroHace !== null && <Fila k="Última vez que entró" v={`hace ${c.entroHace} días`} />}
    </dl>
  );
}

/** Lo que dice el contrato firmado. Es lo que hay que tener a mano antes de una
 *  sesión, y es de donde sale el reloj de la card. */
function Contrato({ c }: { c: ClienteCartera }) {
  const r = c.reloj;
  return (
    <dl className="dc-dl">
      {c.promesa.queEs && <Fila k="Qué es" v={c.promesa.queEs} />}
      {c.promesa.resultado && <Fila k="Le prometiste" v={c.promesa.resultado} />}
      {c.promesa.garantia && (
        <Fila k="Garantía" v={c.promesa.garantia}
          nota="Cambia qué significa pasarse del plazo para ESTE cliente." />
      )}
      {c.promesa.sesiones && <Fila k="Sesiones pactadas" v={c.promesa.sesiones} />}
      <Fila
        k="Duración"
        v={r.semanasTotales ? `${r.semanasTotales} semanas` : 'No la dice el contrato'}
        tono={r.semanasTotales ? undefined : 'warn'}
        nota={r.fuente === 'ficha' ? 'Sale de la ficha, no del contrato.' : undefined}
      />
      <Fila
        k="Arrancó"
        v={r.arranque ? new Date(r.arranque).toISOString().slice(0, 10) : 'Sin fecha'}
        tono={r.arranque ? undefined : 'warn'}
        nota={r.fuenteArranque === 'cierre'
          ? 'No hay fecha de inicio cargada: se usa la del cierre de la venta.'
          : undefined}
      />
      {r.terminado && (
        <Fila k="Estado del plazo" v="Se pasó" tono="warn"
          nota="Pasarse del plazo no es haber terminado: eso lo decides tú abajo." />
      )}
    </dl>
  );
}

function Sesiones({ c }: { c: ClienteCartera }) {
  if (!c.sesiones) {
    return <Vacio titulo="Todavía no hay ninguna sesión grabada"
      detalle="Aparecen solas cuando Fathom graba una llamada con él." />;
  }
  return (
    <dl className="dc-dl">
      <Fila k="Sesiones grabadas" v={`${c.sesiones}`} />
      <Fila k="La última" v={c.ultimaSesionTitulo ?? '—'}
        nota={c.ultimaSesionHace !== null ? `hace ${c.ultimaSesionHace} días` : undefined}
        tono={c.ultimaSesionHace !== null && c.ultimaSesionHace > 21 ? 'bad' : undefined} />
    </dl>
  );
}

function Cobros({ c }: { c: ClienteCartera }) {
  if (!c.cuotasVencidas) {
    return <Vacio titulo="Al día" detalle="No tiene cuotas vencidas." />;
  }
  return (
    <dl className="dc-dl">
      <Fila k="Cuotas vencidas" v={`${c.cuotasVencidas}`} tono="bad" />
      {c.cuotaVencidaDias !== null && (
        <Fila k="La más vieja" v={`hace ${c.cuotaVencidaDias} días`} tono="bad" />
      )}
    </dl>
  );
}

function Contacto({ c }: { c: ClienteCartera }) {
  return (
    <dl className="dc-dl">
      {c.empresa && <Fila k="Empresa" v={c.empresa} />}
      {c.email && <Fila k="Email" v={c.email} />}
      {c.telefono
        ? <Fila k="Teléfono" v={c.telefono} />
        : <Fila k="Teléfono" v="Sin cargar" tono="warn" nota="Sin teléfono no se le puede mandar el link por WhatsApp." />}
      <Fila k="Links vivos" v={`${c.links}`} tono={c.links > 1 ? 'bad' : undefined}
        nota={c.links > 1 ? 'Dos links vivos son dos formas de entrar y una sola que alguien se acuerde de cortar.' : undefined} />
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

function Vacio({ titulo, detalle, accion }: { titulo: string; detalle: string; accion?: React.ReactNode }) {
  return (
    <div className="dc-vacio">
      <p className="t">{titulo}</p>
      <p className="d">{detalle}</p>
      {accion}
    </div>
  );
}

const CSS = `
.dc-cancha{ font-size:15.5px; line-height:1.45; margin:0 0 18px; }
.dc-hi{ display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:14px;
  padding:0 0 18px; border-bottom:1px solid var(--border); }
.dc-hi .hi{ display:flex; flex-direction:column; gap:3px; }
.dc-hi .k{ font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--faint); }
.dc-hi .v{ font-size:21px; font-weight:680; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
.dc-hi .de{ font-size:12.5px; font-weight:400; color:var(--faint); letter-spacing:0; }

.dc-tabs{ display:flex; gap:2px; flex-wrap:wrap; margin:16px 0 0;
  border-bottom:1px solid var(--border); }
.dc-tabs button{ background:none; border:0; border-bottom:2px solid transparent; margin-bottom:-1px;
  padding:9px 12px; font:inherit; font-size:13.5px; color:var(--dim); cursor:pointer;
  display:flex; align-items:center; gap:6px; }
.dc-tabs button:hover{ color:var(--ink); }
.dc-tabs button.es{ color:var(--ink); font-weight:600; border-bottom-color:var(--ink); }
.dc-tabs .bg{ font-family:${MONO}; font-size:10px; padding:1px 6px; border-radius:999px;
  background:var(--surface-2); color:var(--dim); }
.dc-tabs button.es .bg{ background:var(--ink); color:var(--surface); }

.dc-cuerpo{ padding:18px 0 4px; min-height:150px; }
.dc-dl{ margin:0; }
.dc-fila{ display:grid; grid-template-columns:150px 1fr; gap:14px; padding:11px 0;
  border-bottom:1px solid var(--border); }
.dc-fila:last-child{ border-bottom:0; }
.dc-fila dt{ font-size:13px; color:var(--faint); }
.dc-fila dd{ margin:0; font-size:14.5px; display:flex; flex-direction:column; gap:4px;
  align-items:flex-start; }
.dc-fila .nota{ font-size:12.5px; line-height:1.45; color:var(--faint); }

.dc-vacio{ padding:26px 0; }
.dc-vacio .t{ font-size:15px; font-weight:600; margin:0 0 5px; }
.dc-vacio .d{ font-size:13.5px; line-height:1.5; color:var(--dim); margin:0 0 14px; }

.dc-pie{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:8px;
  padding-top:14px; border-top:1px solid var(--border); }
.dc-estado{ margin-left:auto; display:flex; gap:2px; }
.dc-estado button{ background:none; border:0; padding:6px 9px; border-radius:7px; font:inherit;
  font-size:12.5px; color:var(--dim); cursor:pointer; }
.dc-estado button:hover{ background:var(--surface-2); color:var(--ink); }
.dc-ficha{ font-size:13.5px; color:var(--dim); }
.dc-ficha:hover{ color:var(--ink); }
`;
