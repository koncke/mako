'use client';

// =============================================================================
// CustomersM — Customers en el teléfono (26/10/2026)
// =============================================================================
// Destila la pestaña de escritorio (app/customers/CustomersApp.tsx) con la captura elegida para el teléfono, la 15 de
// Stripe (docs/customers/referencias/otras-apps): tres números arriba, lo que entra sólo si entró algo, y debajo «Para
// mirar» y la lista. El toque abre la hoja con sus datos y UNA acción, «Entrar a su cuenta». Billing y Agents siguen en
// sus pantallas (/m/cobros, /m/agente); administrar (plan, equipo) queda en la computadora.

import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/app/_ui/Button';
import { CabeceraM, FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, VacioM, type TonoPildora } from '@/app/m/_ui';
import { RUTA_MAS } from '@/lib/movil-rutas';
import type { FilaCliente, VistaClientes } from '@/lib/clientes-plataforma';
import { ETIQUETA_PARA_MIRAR, estadoEnUnaPalabra, nombreDePlan, ultimaVezTxt, type Segmento } from '@/lib/clientes-plataforma-reglas';
import type { VistaIngresos } from '@/lib/admin-ingresos';
import { ROTULO_ESTADO_CLIENTE, diaTxt, mesTxt, usd } from '@/lib/admin-ingresos-reglas';
import { mesesVisibles } from '@/app/admin/ingresos/ingresos-vista';

type Grupo = 'todos' | Segmento;
const GRUPOS: ReadonlyArray<{ id: Grupo; rotulo: string }> = [
  { id: 'todos', rotulo: 'Todos' }, { id: 'cliente', rotulo: 'Clientes' }, { id: 'partner', rotulo: 'Partners' },
  { id: 'agency', rotulo: 'Agencies' }, { id: 'de-agencia', rotulo: 'De agencias' },
];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const usdTxt = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
const tono = (t: string): TonoPildora => (t === 'neutral' ? 'neutro' : (t as TonoPildora));
const grupoTxt = (f: FilaCliente) =>
  f.segmentos.includes('de-agencia') ? `De ${f.agencia ?? 'una agencia'}` : f.segmentos.map((s) => ({ agency: 'Agency', partner: 'Partner', cliente: 'Cliente', 'de-agencia': '' }[s])).join(' · ');

export function CustomersM({ vista, arriba, ingresos = null }: {
  vista: VistaClientes;
  arriba?: ReactNode;
  /** Admin › Revenue (lib/admin-ingresos.ts, 5/11/2026): lo que entró, de los pagos reales. `null` = no se pudo leer. */
  ingresos?: VistaIngresos | null;
}) {
  const { filas, kpis, cobrado } = vista;
  const [grupo, setGrupo] = useState<Grupo>('todos');
  const [ws, setWs] = useState<number | null>(null);
  const [abierta, setAbierta] = useState(false);
  const deMaKo = useMemo(() => filas.filter((f) => !f.segmentos.includes('de-agencia')), [filas]);
  const lista = grupo === 'todos' ? deMaKo : filas.filter((f) => f.segmentos.includes(grupo));
  const c = filas.find((f) => f.ws === ws) ?? null;
  const abrir = (id: number) => { setWs(id); setAbierta(true); };
  const conPlata = kpis.mrrUsd > 0 || cobrado != null;
  const ultimo = cobrado?.[cobrado.length - 1]?.usd ?? 0;
  const maximo = Math.max(1, ...(cobrado ?? []).map((m) => m.usd));

  return (
    <>
      <CabeceraM titulo="Admin" padre={{ href: RUTA_MAS, label: 'More' }} />
      {arriba}
      <div className="m-customers-tres">
        <div><b>{deMaKo.length}</b><span>{deMaKo.length === 1 ? 'Cliente' : 'Clientes'}</span></div>
        {vista.actividadLeida && <div><b>{deMaKo.filter((f) => f.sinEntrar != null && f.sinEntrar <= 7).length}</b><span>Esta semana</span></div>}
        <div><b>{kpis.nuevos30}</b><span>Nuevos, 30 días</span></div>
      </div>

      {ingresos && ingresos.cobradoTotal > 0 ? <IngresosM v={ingresos} /> : (
      <div className="m-customers-plata">
        {conPlata ? (
          <>
            <span className="m-customers-rot">{kpis.mrrUsd > 0 ? 'Ingreso mensual' : 'Este mes'}</span>
            <b>{usdTxt(kpis.mrrUsd > 0 ? kpis.mrrUsd : ultimo)}</b>
            {cobrado && (
              <div className="m-customers-barras">
                {cobrado.map((m) => (
                  <div key={m.mes}><i style={{ height: `${Math.max(3, Math.round((m.usd / maximo) * 100))}%` }} data-cero={m.usd === 0} /><span>{MES[Number(m.mes.slice(5, 7)) - 1]}</span></div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="m-customers-gris">Todavía no entró ningún pago: cárgalos en la ficha de cada cliente en el CRM.</p>
        )}
      </div>
      )}

      {vista.paraMirar.length > 0 && (
        <SeccionM titulo="Para mirar">
          <ListaM>
            {vista.paraMirar.slice(0, 5).map((a) => {
              const e = ETIQUETA_PARA_MIRAR[a.motivo];
              return <FilaM key={a.ws} avatar={a.nombre} titulo={a.nombre} segunda={a.texto} pill={<PildoraM tono={tono(e.tono)}>{e.rotulo}</PildoraM>} onClick={() => abrir(a.ws)} />;
            })}
          </ListaM>
        </SeccionM>
      )}

      <div className="m-customers-chips" role="tablist" aria-label="Qué clientes ver">
        {GRUPOS.filter((g) => g.id === 'todos' || kpis.porSegmento[g.id] > 0).map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={grupo === g.id} data-on={grupo === g.id} onClick={() => setGrupo(g.id)}>
            {g.rotulo} <span>{g.id === 'todos' ? deMaKo.length : kpis.porSegmento[g.id]}</span>
          </button>
        ))}
      </div>
      {lista.length === 0 ? <VacioM frase="Nadie en este grupo." /> : (
        <SeccionM titulo="Tus clientes">
          <ListaM>
            {lista.map((f) => {
              const e = estadoEnUnaPalabra(f);
              return (
                <FilaM key={f.ws} avatar={f.nombre} titulo={f.nombre}
                  segunda={`${grupoTxt(f)}${vista.actividadLeida ? ` · ${ultimaVezTxt(f)}` : ''}`}
                  pill={<PildoraM tono={tono(e.tono)}>{e.rotulo}</PildoraM>} onClick={() => abrir(f.ws)} />
              );
            })}
          </ListaM>
        </SeccionM>
      )}

      <SeccionM titulo="Más">
        <ListaM>
          <FilaM icono="tag" titulo="Billing" segunda="Lo que vendiste de MaKo" href="/m/cobros" navegacion />
          <FilaM icono="mako" titulo="Agents" segunda="En qué trabajan en su Claude Code" href="/m/agente" navegacion />
        </ListaM>
      </SeccionM>

      <SheetM abierto={abierta && c != null} onCerrar={() => setAbierta(false)} titulo={c?.nombre ?? 'Cliente'}
        // ⚠️ RECARGA ENTERA, no un Link (revisión del tren, hallazgo 3): app/m/layout.tsx no se vuelve a ejecutar al navegar,
        // y es el que dibuja el chip «Viendo a X», la barra y los avisos del cliente. Con un Link, Martín operaba la cuenta
        // del cliente dentro del cromo de la plataforma. Igual que AgencyM y PartnersApp.
        pie={c ? <PieM><Button variant="primary" size="lg" full onClick={() => { window.location.href = `/inicio?ws=${c.ws}`; }}>Entrar a su cuenta</Button></PieM> : undefined}>
        {c && (
          <ListaM>
            <FilaDatoM k="Estado" v={estadoEnUnaPalabra(c).rotulo} />
            <FilaDatoM k="Última vez" v={vista.actividadLeida ? ultimaVezTxt(c) : '—'} />
            <FilaDatoM k="Leads" v={c.leads == null ? '—' : c.leads.toLocaleString('es-AR')} />
            <FilaDatoM k="Plan" v={nombreDePlan(c.capa)} />
            <FilaDatoM k="Grupo" v={grupoTxt(c)} />
            <FilaDatoM k="Plata" v={c.mrrUsd > 0 ? `${usdTxt(c.mrrUsd)} por mes${c.primerMesUsd != null ? ` · primer mes a ${usdTxt(c.primerMesUsd)}` : ''}` : c.prueba ? 'En prueba gratis' : c.planAManoTxt ?? 'Plan a mano'} />
            {c.pagoPendiente && <FilaDatoM k="Pago" v="Tiene un pago esperando" />}
          </ListaM>
        )}
      </SheetM>
    </>
  );
}

/**
 * Lo que entra, en el teléfono (5/11/2026): destila Admin › Revenue con la 15 de Stripe: el MRR grande, lo cobrado este mes y
 * desde siempre, una barra por mes (la de escritorio, sin la tabla de saldos) y lo que pagó cada cliente.
 */
function IngresosM({ v }: { v: VistaIngresos }) {
  const meses = mesesVisibles(v.meses);
  const maximo = Math.max(1, ...meses.map((m) => m.cobrado));
  return (
    <>
      <div className="m-customers-plata">
        <span className="m-customers-rot">Ingreso mensual (MRR)</span>
        <b>{usd(v.mrr)}</b>
        <span className="m-customers-rot">Cobrado en {mesTxt(v.hoy.slice(0, 7), v.hoy)}: {usd(v.cobradoEsteMes)} · desde siempre: {usd(v.cobradoTotal)}</span>
        <div className="m-customers-barras" role="img" aria-label="Lo que entró cada mes">
          {meses.map((m) => (
            <div key={m.mes}><i style={{ height: `${m.cobrado > 0 ? Math.max(4, Math.round((m.cobrado / maximo) * 100)) : 2}%` }} data-cero={m.cobrado === 0} data-curso={m.enCurso} /><span>{mesTxt(m.mes, v.hoy)}</span></div>
          ))}
        </div>
      </div>
      <SeccionM titulo="Lo que pagó cada cliente">
        <ListaM>
          {v.clientes.map((c) => (
            <FilaDatoM key={c.clave} k={c.nombre}
              v={`${c.mrr > 0 ? `${usd(c.mrr)}/mes · ` : ''}${usd(c.total)} en total · ${ROTULO_ESTADO_CLIENTE[c.estado].rotulo}${c.proximo ? ` · ${diaTxt(c.proximo, v.hoy)}` : ''}`} />
          ))}
        </ListaM>
      </SeccionM>
    </>
  );
}
