'use client';

// =============================================================================
// CustomersApp — la pestaña Customers: lo que entra, quién pide atención y la lista de los clientes de MaKo (26/10/2026)
// =============================================================================
// Martín, 26/10/2026: «quiero que mejores muchísimo el diseño de ese dashboard de super admin, investiga a fondo como lo
// tienen otras apps, porque no me gusta para nada como esta ahora». Las 16 capturas y qué se copia de cada una, en
// docs/customers/referencias/otras-apps/LEEME.md. Se copian CUATRO capturas, no las apps (la lección del Media Buyer):
//   · la 02 de ProfitWell para arriba: a la izquierda lo que entra por mes; a la derecha, «Para mirar», un renglón por
//     cliente con una etiqueta de color, el más grave primero (`paraMirar`, lib/clientes-plataforma-reglas.ts);
//   · la 04 de Baremetrics para los grupos: chips con el número adentro, y la tabla con el estado en una palabra de color;
//   · la 14 de Polar para la ficha: un panel a la derecha que no saca de la lista, con una sola acción («Entrar»);
//   · la 13 de Intercom para cuando no hay plata: el dato que manda es la actividad (cuándo entró cada uno).
//
// ⚠️ SIN TARJETAS EN CERO (Martín, y la 12 de HighLevel como lo que no hay que hacer). Medido el 26/10: la plataforma no
//    tiene ni un cobro, así que «lo que entra» es una línea que lo dice, con un link a vender un plan, y nunca un «US$ 0».
//    Un dato que no se pudo leer tampoco se dibuja en cero: no se dibuja, y arriba se dice qué faltó.
// La grilla de administración de siempre (alta, plan, equipo, borrar) vive en la pestaña Accounts.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Banner } from '@/app/_ui';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { useMenuContextual } from '@/app/_ui/useMenuContextual';
import { Marca } from '@/app/_components/Marca';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import type { FilaCliente, VistaClientes } from '@/lib/clientes-plataforma';
import {
  ETIQUETA_PARA_MIRAR, comparacionCerrada, estadoEnUnaPalabra, haceTxt, nombreDePlan, ultimaVezTxt, type Segmento,
} from '@/lib/clientes-plataforma-reglas';
import { destinoCliente, itemsCliente } from './menu-contextual-customers';

type Grupo = 'todos' | Segmento;

const GRUPOS: ReadonlyArray<{ id: Grupo; rotulo: string }> = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'cliente', rotulo: 'Clientes' },
  { id: 'partner', rotulo: 'Partners' },
  { id: 'agency', rotulo: 'Agencies' },
  { id: 'de-agencia', rotulo: 'Clientes de agencias' },
];

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const usdTxt = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;
const fechaLarga = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`;
};
/** El grupo de un cliente, dicho como en su fila: «Agency», «Partner», «Cliente», o «De <su agencia>». */
const grupoTxt = (f: FilaCliente) =>
  f.segmentos.includes('de-agencia') ? `De ${f.agencia ?? 'una agencia'}` : f.segmentos.map((s) => ({ agency: 'Agency', partner: 'Partner', cliente: 'Cliente', 'de-agencia': '' }[s])).join(' · ');

export function CustomersApp({ vista, abiertoInicial = null }: {
  vista: VistaClientes;
  /** La ficha que abre al cargar (`?cliente=<ws>`: un link a un cliente, o la captura de la ficha). */
  abiertoInicial?: number | null;
}) {
  const { filas, kpis } = vista;
  const [grupo, setGrupo] = useState<Grupo>('todos');
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<number | null>(abiertoInicial);
  const [todosLosAvisos, setTodosLosAvisos] = useState(false);

  const deMaKo = useMemo(() => filas.filter((f) => !f.segmentos.includes('de-agencia')), [filas]);
  const conteo = (g: Grupo) => (g === 'todos' ? deMaKo.length : kpis.porSegmento[g]);
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = grupo === 'todos' ? deMaKo : filas.filter((f) => f.segmentos.includes(grupo));
    // Los que piden atención primero; después, los que entraron más hace poco.
    const orden = (f: FilaCliente) => (f.riesgo ? 0 : f.onboardingHecho === false ? 1 : 2);
    return base.filter((f) => !t || f.nombre.toLowerCase().includes(t))
      .sort((a, b) => orden(a) - orden(b) || (a.sinEntrar ?? 1e9) - (b.sinEntrar ?? 1e9) || a.nombre.localeCompare(b.nombre, 'es'));
  }, [filas, deMaKo, grupo, q]);
  const conMrr = filas.some((f) => f.mrrUsd > 0 || f.sinDolares > 0);
  const ficha = filas.find((f) => f.ws === abierto) ?? null;
  const avisos = todosLosAvisos ? vista.paraMirar : vista.paraMirar.slice(0, 6);
  // El clic derecho de un cliente (en «Para mirar» y en la lista): lo de su ficha sin abrirla (menu-contextual-customers.ts).
  const menu = useMenuContextual<{ ws: number; nombre: string }>();
  const router = useRouter();
  const wsDelMenu = menu.abierto?.de.ws ?? null;

  useEffect(() => {
    if (abierto == null) return;
    const cerrar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(null); };
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);

  return (
    <div className="cu">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {vista.avisos.length > 0 && (
        <Banner tono="warn" alcance="local">Falta un dato: no pude leer {vista.avisos.map((a) => a.split(':')[0]).join(', ')}. Lo demás es real.</Banner>
      )}

      <div className="cu-arriba">
        <section className="cu-caja cu-plata" aria-label="Lo que entra por mes">
          <Plata vista={vista} />
          <div className="cu-tres">
            <Numero valor={deMaKo.length} rotulo={deMaKo.length === 1 ? 'Cliente' : 'Clientes'} />
            {vista.actividadLeida && <Numero valor={deMaKo.filter((f) => f.sinEntrar != null && f.sinEntrar <= 7).length} rotulo="Entraron esta semana" />}
            <Numero valor={kpis.nuevos30} rotulo="Nuevos en 30 días" />
          </div>
        </section>

        <section className="cu-caja cu-mirar" aria-label="Para mirar">
          <h2>Para mirar{vista.paraMirar.length > 0 && <span>{vista.paraMirar.length}</span>}</h2>
          {vista.paraMirar.length === 0 ? (
            <p className="cu-gris">Nada pide tu atención hoy.</p>
          ) : (
            <ul>
              {avisos.map((a) => {
                const e = ETIQUETA_PARA_MIRAR[a.motivo];
                return (
                  <li key={a.ws}>
                    <button type="button" onClick={() => setAbierto(a.ws)} {...menu.propsDe({ ws: a.ws, nombre: a.nombre })}>
                      <span className="cu-etq" data-tono={e.tono}>{e.rotulo}</span>
                      <span className="cu-mirar-txt"><b>{a.nombre}</b><span>{a.texto}</span></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {vista.paraMirar.length > 6 && (
            <button type="button" className="cu-mas" onClick={() => setTodosLosAvisos((v) => !v)}>
              {todosLosAvisos ? 'Ver menos' : `Ver los ${vista.paraMirar.length}`}
            </button>
          )}
        </section>
      </div>

      <div className="cu-barra">
        <div className="cu-chips" role="tablist" aria-label="Qué clientes ver">
          {GRUPOS.filter((g) => g.id === 'todos' || conteo(g.id) > 0).map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={grupo === g.id} className="cu-chip" data-on={grupo === g.id} onClick={() => setGrupo(g.id)}>
              {g.rotulo} <span>{conteo(g.id)}</span>
            </button>
          ))}
        </div>
        <input className="cu-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un cliente" aria-label="Buscar un cliente" />
      </div>

      <div className="cu-tabla" role="table" aria-label="Tus clientes">
        <div className="cu-fila cu-cab" role="row" data-mrr={conMrr}>
          <span role="columnheader">Cliente</span><span role="columnheader">Grupo</span><span role="columnheader">Última vez</span>
          <span role="columnheader" className="cu-num">Leads</span>{conMrr && <span role="columnheader" className="cu-num">MRR</span>}<span role="columnheader">Estado</span>
        </div>
        {visibles.map((f) => {
          const e = estadoEnUnaPalabra(f);
          return (
            <button key={f.ws} type="button" role="row" className="cu-fila" data-mrr={conMrr} data-abierta={abierto === f.ws} onClick={() => setAbierto(f.ws)}
              {...menu.propsDe({ ws: f.ws, nombre: f.nombre })}>
              <span className="cu-quien" role="cell">
                <Marca icono={null} foto={null} nombre={f.nombre} tam={30} color={colorDe(f.nombre)} />
                <span><b>{f.nombre}</b><small>{nombreDePlan(f.capa)}</small></span>
              </span>
              <span role="cell" className="cu-grupo">{grupoTxt(f)}</span>
              <span role="cell" className="cu-vez" data-tono={vez(f.sinEntrar)}>{vista.actividadLeida ? <><i />{ultimaVezTxt(f)}</> : '—'}</span>
              <span role="cell" className="cu-num">{f.leads == null ? '—' : f.leads.toLocaleString('es-AR')}</span>
              {conMrr && <span role="cell" className="cu-num">{f.mrrUsd > 0 ? usdTxt(f.mrrUsd) : '—'}</span>}
              <span role="cell"><span className="cu-estado" data-tono={e.tono}>{e.rotulo}</span></span>
            </button>
          );
        })}
        {visibles.length === 0 && <p className="cu-gris cu-vacio">{q.trim() ? 'Ningún cliente se llama así.' : 'Nadie en este grupo.'}</p>}
      </div>

      {ficha && <Ficha f={ficha} actividadLeida={vista.actividadLeida} onCerrar={() => setAbierto(null)} />}

      {menu.abierto && (
        <MenuContextual key={menu.abierto.n} punto={{ x: menu.abierto.x, y: menu.abierto.y }} porDedo={menu.abierto.porDedo}
          items={itemsCliente()} etiqueta={`Acciones de ${menu.abierto.de.nombre}`} onCerrar={menu.cerrar}
          onElegir={(id) => {
            const ws = wsDelMenu;
            if (ws == null) return;
            if (id === 'ficha') setAbierto(ws);
            else if (id === 'entrar') window.location.href = destinoCliente('entrar', ws);
            else if (id === 'administrar') router.push(destinoCliente('administrar', ws));
          }} />
      )}
    </div>
  );
}

/** El tono del punto de «Última vez»: esta semana, hace poco, o se está yendo. */
const vez = (d: number | null): 'good' | 'neutral' | 'warn' => (d == null || d >= 14 ? 'warn' : d <= 7 ? 'good' : 'neutral');

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return <div className="cu-n"><b>{valor.toLocaleString('es-AR')}</b><span>{rotulo}</span></div>;
}

/**
 * Lo que entra por mes. Con plata: el número grande, su comparación pegada y una barra por mes (la 16 de ChartMogul). Sin
 * plata: una línea que lo dice y el link a vender un plan (nunca «US$ 0»).
 */
function Plata({ vista }: { vista: VistaClientes }) {
  const { kpis, cobrado, vencido } = vista;
  const ultimo = cobrado?.[cobrado.length - 1]?.usd ?? 0;
  const numero = kpis.mrrUsd > 0 ? kpis.mrrUsd : ultimo;
  // ⚠️ La flecha compara sólo meses CERRADOS y nunca va pegada al MRR (revisión del tren, hallazgo 6): el mes en curso está
  // a medias, y «US$ 500 ↓ 80%» al lado del MRR se leía como que el MRR se cayó.
  const cambio = comparacionCerrada(cobrado);
  const maximo = Math.max(1, ...(cobrado ?? []).map((m) => m.usd));
  const vencidas = vencido && vencido.cuotas > 0
    ? <p className="cu-vencido">{vencido.cuotas} {vencido.cuotas === 1 ? 'cuota vencida' : 'cuotas vencidas'} · {usdTxt(vencido.usd)}</p> : null;

  if (numero <= 0 && !cobrado) {
    return (
      <div className="cu-plata-vacia">
        <h2>Lo que entra por mes</h2>
        <p className="cu-plata-linea">Todavía no entró plata por MaKo.</p>
        <p className="cu-gris">Cuando cargues un pago en el CRM o alguien pague por la pasarela, aparece aquí con su tendencia.</p>
        <Link className="cu-link" href="/admin?tab=billing">Vender un plan →</Link>
        {vencidas}
      </div>
    );
  }
  return (
    <div>
      <h2>{kpis.mrrUsd > 0 ? 'Ingreso mensual (MRR)' : 'Lo que entró este mes'}</h2>
      <p className="cu-plata-num">{usdTxt(numero)}</p>
      {cambio && (
        <p className="cu-cambio" data-tono={cambio.pct >= 0 ? 'good' : 'bad'}>
          Cobrado en {MES[Number(cambio.mes.slice(5, 7)) - 1]}: {cambio.pct >= 0 ? '↑' : '↓'} {Math.abs(cambio.pct)}% contra {MES[Number(cambio.contra.slice(5, 7)) - 1]}
        </p>
      )}
      {kpis.mrrUsd > 0 && <p className="cu-gris">{kpis.pagan} {kpis.pagan === 1 ? 'negocio paga' : 'negocios pagan'} su mensualidad{kpis.sinDolares ? ` · ${kpis.sinDolares} sin su valor en dólares` : ''}</p>}
      <Link className="cu-link" href="/admin">Ver los ingresos →</Link>
      {cobrado && (
        <div className="cu-barras" aria-label="Lo que entró cada mes">
          {cobrado.map((m) => (
            <div key={m.mes} className="cu-barra-mes" title={`${usdTxt(m.usd)} en ${MES[Number(m.mes.slice(5, 7)) - 1]}`}>
              <i style={{ height: `${Math.max(3, Math.round((m.usd / maximo) * 100))}%` }} data-cero={m.usd === 0} />
              <span>{MES[Number(m.mes.slice(5, 7)) - 1]}</span>
            </div>
          ))}
        </div>
      )}
      {vencidas}
    </div>
  );
}

/** La ficha en un panel a la derecha (la 14 de Polar): tres datos en una fila, el resto en renglones, y UNA acción. */
function Ficha({ f, actividadLeida, onCerrar }: { f: FilaCliente; actividadLeida: boolean; onCerrar: () => void }) {
  const e = estadoEnUnaPalabra(f);
  const filas: Array<[string, ReactNode]> = [
    ['Plan', nombreDePlan(f.capa)],
    ['Grupo', grupoTxt(f)],
    ['Configuración', f.onboardingHecho == null ? '—' : f.onboardingHecho ? 'Terminada' : 'Sin terminar'],
    ['Plata', f.mrrUsd > 0 ? `${usdTxt(f.mrrUsd)} por mes${f.primerMesUsd != null ? ` · primer mes a ${usdTxt(f.primerMesUsd)}` : ''}` : f.prueba ? 'En prueba gratis' : f.planAManoTxt ?? 'Plan a mano'],
  ];
  if (f.pagoPendiente) filas.push(['Pago', 'Tiene un pago esperando']);
  if (f.sinLeads != null) filas.push(['Último lead', haceTxt(f.sinLeads)]);
  if (f.sesionesAgente > 0) filas.push(['Agente', `${f.sesionesAgente} ${f.sesionesAgente === 1 ? 'sesión' : 'sesiones'} en 30 días`]);
  return (
    <>
      <div className="cu-velo" onClick={onCerrar} aria-hidden />
      <aside className="cu-ficha" role="dialog" aria-modal="true" aria-label={`Ficha de ${f.nombre}`}>
        <button type="button" className="cu-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        <div className="cu-ficha-cab">
          <Marca icono={null} foto={null} nombre={f.nombre} tam={44} color={colorDe(f.nombre)} />
          <div><h2>{f.nombre}</h2><span className="cu-estado" data-tono={e.tono}>{e.rotulo}</span></div>
        </div>
        <div className="cu-ficha-tres">
          <div><span>Cliente desde</span><b>{fechaLarga(f.creado)}</b></div>
          <div><span>Última vez</span><b>{actividadLeida ? ultimaVezTxt(f) : '—'}</b></div>
          <div><span>Leads</span><b>{f.leads == null ? '—' : f.leads.toLocaleString('es-AR')}</b></div>
        </div>
        <dl className="cu-ficha-datos">
          {filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <a className="cu-entrar" href={`/inicio?ws=${f.ws}`}>Entrar a su cuenta</a>
        <Link className="cu-link cu-admin" href={`/admin?tab=accounts&cuenta=${f.ws}`}>Administrar: plan, equipo y acceso</Link>
      </aside>
    </>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.cu{ display:flex; flex-direction:column; gap:18px; }
.cu h2{ margin:0; font-size:14px; font-weight:650; color:var(--dim); letter-spacing:0; display:flex; align-items:center; gap:8px; }
.cu-gris{ margin:0; font-size:13.5px; color:var(--faint); line-height:1.5; }
.cu-arriba{ display:grid; grid-template-columns:minmax(0, 1.35fr) minmax(300px, 1fr); gap:16px; align-items:start; }
.cu-caja{ background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:20px 22px; min-width:0; display:flex; flex-direction:column; gap:14px; }
.cu-plata-vacia{ display:flex; flex-direction:column; gap:6px; align-items:flex-start; }
.cu-plata-linea{ margin:6px 0 0; font-size:22px; font-weight:750; letter-spacing:-.02em; color:var(--ink); }
.cu-plata-num{ margin:4px 0 0; font-size:38px; font-weight:800; letter-spacing:-.03em; color:var(--ink); display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; font-variant-numeric:tabular-nums; }
.cu-plata-num span{ font-size:14px; font-weight:650; letter-spacing:0; }
.cu-plata-num span[data-tono="good"]{ color:var(--good); }
.cu-plata-num span[data-tono="bad"]{ color:var(--bad); }
.cu-barras{ display:flex; align-items:flex-end; gap:10px; height:96px; margin-top:12px; }
.cu-barra-mes{ flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px; min-width:0; }
.cu-barra-mes i{ display:block; width:100%; max-width:42px; background:var(--primary); border-radius:6px 6px 2px 2px; }
.cu-barra-mes i[data-cero="true"]{ background:var(--border); }
.cu-barra-mes span{ font-size:11.5px; color:var(--faint); }
.cu-cambio{ margin:2px 0 0; font-size:13.5px; font-weight:650; }
.cu-cambio[data-tono="good"]{ color:var(--good); }
.cu-cambio[data-tono="bad"]{ color:var(--bad); }
.cu-vencido{ margin:8px 0 0; font-size:13px; font-weight:650; color:var(--bad); }
.cu-link{ font-size:13.5px; font-weight:650; color:var(--primary); text-decoration:none; }
.cu-link:hover{ text-decoration:underline; }
.cu-tres{ display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; border-top:1px solid var(--border); padding-top:14px; }
.cu-n{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.cu-n b{ font-size:24px; font-weight:800; letter-spacing:-.02em; color:var(--ink); font-variant-numeric:tabular-nums; }
.cu-n span{ font-size:12.5px; color:var(--dim); }
.cu-mirar h2 span{ font-size:12px; font-weight:700; color:var(--ink); background:var(--surface-2); padding:1px 8px; border-radius:999px; }
.cu-mirar ul{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; }
.cu-mirar li button{ width:100%; display:flex; align-items:center; gap:12px; padding:9px 4px; border:0; border-bottom:1px solid var(--border);
  background:none; font:inherit; color:inherit; text-align:left; cursor:pointer; border-radius:0; }
.cu-mirar li:last-child button{ border-bottom:0; }
.cu-mirar li button:hover{ background:var(--surface-2); }
.cu-etq{ flex:none; width:112px; font-size:10.5px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; padding:4px 0; border-radius:6px; text-align:center; }
.cu-etq[data-tono="bad"]{ background:var(--bad-bg); color:var(--bad); }
.cu-etq[data-tono="warn"]{ background:var(--warn-bg); color:var(--warn); }
.cu-etq[data-tono="info"]{ background:var(--primary-bg); color:var(--primary); }
.cu-etq[data-tono="good"]{ background:var(--good-bg); color:var(--good); }
.cu-mirar-txt{ min-width:0; display:flex; flex-direction:column; }
.cu-mirar-txt b{ font-size:14px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cu-mirar-txt span{ font-size:12.5px; color:var(--dim); }
.cu-mas{ align-self:flex-start; border:0; background:none; padding:0; font:inherit; font-size:13px; font-weight:650; color:var(--primary); cursor:pointer; }
.cu-barra{ display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
.cu-chips{ display:flex; gap:8px; flex-wrap:wrap; }
.cu-chip{ border:1px solid var(--border); background:var(--surface); border-radius:999px; padding:7px 14px; font:inherit; font-size:13.5px; font-weight:600; color:var(--dim); cursor:pointer; }
.cu-chip span{ font-weight:700; color:var(--faint); margin-left:2px; }
.cu-chip[data-on="true"]{ background:var(--ink); border-color:var(--ink); color:var(--surface); }
.cu-chip[data-on="true"] span{ color:var(--surface); opacity:.75; }
.cu-buscar{ width:240px; max-width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:10px; padding:8px 12px; font:inherit; font-size:14px; background:var(--surface); color:var(--ink); }
.cu-tabla{ background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden; }
.cu-fila{ width:100%; display:grid; grid-template-columns:minmax(220px, 2.2fr) minmax(130px, 1.3fr) 130px 80px 120px; gap:14px; align-items:center;
  padding:10px 18px; border:0; border-bottom:1px solid var(--border); background:none; font:inherit; color:inherit; text-align:left; cursor:pointer; }
.cu-fila[data-mrr="true"]{ grid-template-columns:minmax(220px, 2.2fr) minmax(130px, 1.3fr) 130px 80px 100px 120px; }
.cu-fila:last-of-type{ border-bottom:0; }
.cu-fila:hover, .cu-fila[data-abierta="true"]{ background:var(--surface-2); }
.cu-cab .cu-num{ font-size:inherit; }
.cu-cab{ cursor:default; background:var(--surface-2); font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); font-weight:700; padding-block:9px; }
.cu-quien{ display:flex; align-items:center; gap:11px; min-width:0; }
.cu-quien > span{ display:flex; flex-direction:column; min-width:0; }
.cu-quien b{ font-size:14.5px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cu-quien small{ font-size:12px; color:var(--faint); }
.cu-grupo{ font-size:13.5px; color:var(--dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cu-vez{ font-size:13.5px; color:var(--dim); display:inline-flex; align-items:center; gap:7px; }
.cu-vez i{ width:7px; height:7px; border-radius:50%; background:var(--faint); flex:none; }
.cu-vez[data-tono="good"] i{ background:var(--good); }
.cu-vez[data-tono="warn"] i{ background:var(--warn); }
.cu-num{ text-align:right; font-variant-numeric:tabular-nums; font-size:14px; }
.cu-estado{ display:inline-block; font-size:12px; font-weight:650; padding:3px 10px; border-radius:999px; white-space:nowrap; }
.cu-estado[data-tono="good"]{ background:var(--good-bg); color:var(--good); }
.cu-estado[data-tono="warn"]{ background:var(--warn-bg); color:var(--warn); }
.cu-estado[data-tono="bad"]{ background:var(--bad-bg); color:var(--bad); }
.cu-estado[data-tono="info"]{ background:var(--primary-bg); color:var(--primary); }
.cu-estado[data-tono="neutral"]{ background:var(--surface-2); color:var(--dim); }
.cu-vacio{ padding:18px; }
.cu-velo{ position:fixed; inset:0; background:color-mix(in srgb, #0b0d12 30%, transparent); z-index:60; }
.cu-ficha{ position:fixed; top:12px; right:12px; bottom:12px; width:min(420px, calc(100vw - 24px)); z-index:61; background:var(--surface);
  border:1px solid var(--border); border-radius:20px; box-shadow:0 30px 80px rgba(10,12,18,.28); padding:26px 24px; display:flex; flex-direction:column; gap:18px; overflow:auto; }
.cu-cerrar{ position:absolute; top:12px; right:14px; border:0; background:none; font-size:24px; line-height:1; color:var(--dim); cursor:pointer; padding:4px 8px; border-radius:8px; }
.cu-cerrar:hover{ background:var(--surface-2); }
.cu-ficha-cab{ display:flex; gap:14px; align-items:center; padding-right:28px; }
.cu-ficha-cab h2{ font-size:20px; font-weight:750; color:var(--ink); letter-spacing:-.01em; margin-bottom:4px; }
.cu-ficha-tres{ display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
.cu-ficha-tres > div{ background:var(--surface-2); border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:2px; min-width:0; }
.cu-ficha-tres span{ font-size:11.5px; color:var(--dim); }
.cu-ficha-tres b{ font-size:14.5px; color:var(--ink); }
.cu-ficha-datos{ margin:0; display:flex; flex-direction:column; border-top:1px solid var(--border); }
.cu-ficha-datos > div{ display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); font-size:14px; }
.cu-ficha-datos dt{ color:var(--dim); }
.cu-ficha-datos dd{ margin:0; font-weight:600; color:var(--ink); text-align:right; }
.cu-entrar{ display:flex; justify-content:center; padding:12px 16px; border-radius:12px; background:var(--primary); color:var(--on-primary, #fff); font-weight:700; font-size:15px; text-decoration:none; }
.cu-entrar:hover{ filter:brightness(1.05); }
.cu-admin{ align-self:center; }
@media (max-width: 1080px){
  .cu-arriba{ grid-template-columns:1fr; }
}
@media (max-width: 760px){
  .cu-cab{ display:none; }
  .cu-fila, .cu-fila[data-mrr="true"]{ grid-template-columns:1fr auto; row-gap:4px; padding:12px 14px; }
  .cu-grupo, .cu-num{ display:none; }
  .cu-quien{ grid-column:1; grid-row:1; }
  .cu-fila > span:last-child{ grid-column:2; grid-row:1; }
  .cu-vez{ grid-column:1; grid-row:2; padding-left:41px; }
  .cu-buscar{ width:100%; }
  .cu-tres{ grid-template-columns:repeat(3, minmax(0, 1fr)); }
  .cu-etq{ width:96px; }
}
`;
