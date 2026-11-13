'use client';

// =============================================================================
// Marketing CoPilot nuevo — los tres pasos sobre las cinco tarjetas (12/11/2026, la vuelta 19 de la maqueta)
// =============================================================================
// Arriba, la criatura y los pasos («1 El análisis · 2 La acción · 3 Piloto automático», del alto de un botón y con su aviso). Abajo,
// las cinco tarjetas en el mismo lugar en los tres pasos (Oferta y comunicación, Web, Anuncios, Instagram, YouTube): la elegida se
// conserva al cambiar de paso. Lo de cada tarjeta, con los datos de verdad (./page.tsx):
//   · Oferta y comunicación: ./OfertaComunicacion.tsx.
//   · Anuncios: los mejores del mes, las tareas de la semana de su funnel (lib/media-buyer/copiloto.ts) y el PILOTO del Media Buyer:
//     «Espera tu OK» (Aprobar = lanzar, «No» = descartar) y «Lo que hice» (con «Deshacer»), por /api/media-buyer, lo MISMO que la
//     pantalla del Media Buyer. «Configurar piloto» va a sus Ajustes; «Métricas», a la hoja de Marketing del Dashboard.
//   · Web, Instagram y YouTube: lo conectado y dónde se trabaja hoy. Su análisis propio está en el relevo (lo que falta).
// El chat: el de MaKo de toda la app (la estrella), y en la acción de Oferta y comunicación, adentro, a la izquierda.
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { CSS_OFFER } from '@/app/offer/estilos';
import { Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { LogoRed } from '@/app/competitor-spy/LogoRed';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { CriaturaMako } from '@/app/onboarding/CriaturaMako';
import type { EstadoComunicacion } from '@/lib/copiloto/comunicacion-store';
import type { ParteOC } from '@/lib/copiloto/comunicacion';
import type { Decision, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import type { AnuncioDestacado } from '@/lib/media-buyer/productos';
import type { Tarea } from '@/lib/media-buyer/copiloto';
import { CSS_COPILOTO } from './copiloto-css';
import { Flecha, Grafico, Tuerca } from './iconos';
import { AccionOC, AnalisisOC, ModalCosa, SegPartes, SelectorOferta, teTocanOC, useComunicacion, useNotaOC } from './OfertaComunicacion';
import { PilotoAnuncios } from './PilotoAnuncios';

export type Paso = 'analisis' | 'accion' | 'piloto';
export type Tarjeta = 'oferta' | 'web' | 'anuncios' | 'instagram' | 'youtube';
export type DatosCoPilot = {
  comunicacion: EstadoComunicacion;
  anuncios: {
    conectada: boolean; kpi: KpiMediaBuyer; mejores: AnuncioDestacado[];
    piloto: { encendido: boolean; modo: 'propone' | 'piloto' } | null;
    decisiones: Decision[]; existeTabla: boolean;
  };
  tareas: Tarea[];
  funnel: string | null;
  web: string[];
  redes: Record<'instagram' | 'youtube', Array<{ usuario: string; vencida: boolean }>>;
};

const PASOS: ReadonlyArray<readonly [Paso, string]> = [['analisis', 'El análisis'], ['accion', 'La acción'], ['piloto', 'Piloto automático']];
const TARJETAS: ReadonlyArray<readonly [Tarjeta, string]> = [['oferta', 'Oferta y comunicación'], ['web', 'Web'], ['anuncios', 'Anuncios'], ['instagram', 'Instagram'], ['youtube', 'YouTube']];
const KPI: Record<KpiMediaBuyer, string> = { lead: 'leads', agenda: 'agendas', venta: 'ventas' };

/** Lo que el CoPilot nuevo suma al CSS de la maqueta: el chat de MaKo adentro de la tarjeta y el fondo del popup encima de todo. */
const CSS_EXTRA = `
.frn .frn-embebido .cp-chat { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.frn .frn-embebido .cp-chat-cerebro { border-radius: 16px; }
.cop-fondo { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.42); }
.frn .cop-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.frn .cop-lista > li { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 12px 2px; }
.frn .cop-lista > li + li { border-top: 1px solid var(--hair); }
.frn .cop-mini { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; background: var(--panel); }
.frn .cop-lista b { display: block; font-size: 15px; font-weight: 600; color: var(--ink); }
.frn .cop-lista span { display: block; font-size: 14px; color: var(--muted); }
.frn .cop-num { text-align: right; }
.frn .cop-num b { font-size: 18px; }
.frn .cop-vacio { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
.frn .cop-vacio p { margin: 0; font-size: 15.5px; line-height: 1.5; color: var(--muted); max-width: 60ch; }
.frn .cop-acciones { display: flex; flex-wrap: wrap; gap: 10px; }
.frn .frn-stat { cursor: pointer; }
.frn .frn-stat .mq-logo { display: inline-grid; place-items: center; flex: none; color: #fff; }
@container frn (max-width: 700px) { .frn .cop-lista > li { grid-template-columns: 44px minmax(0, 1fr); } .frn .cop-mini { width: 44px; height: 44px; } .frn .cop-num { grid-column: 2; text-align: left; } }
`;

function LogoTarjeta({ t }: { t: Tarjeta }) {
  if (t === 'oferta') return <span className="mq-logo" style={{ width: 22, height: 22, borderRadius: 6, background: '#121212' }}><Icon name="tag" size={14} /></span>;
  return <LogoRed red={t === 'web' ? 'sitio' : t} box={22} />;
}

export function CoPilot({ datos, pasoInicial, tarjetaInicial }: { datos: DatosCoPilot; pasoInicial: Paso; tarjetaInicial: Tarjeta }) {
  const [paso, setPaso] = useState<Paso>(pasoInicial);
  const [tarjeta, setTarjeta] = useState<Tarjeta>(tarjetaInicial);
  const [parte, setParte] = useState<ParteOC>('oferta');
  const [cosa, setCosa] = useState<{ p: ParteOC; k: string } | null>(null);
  const [pedido, setPedido] = useState<{ texto: string; vez: number } | null>(null);
  const [decisiones, setDecisiones] = useState<Decision[]>(datos.anuncios.decisiones);
  const [menu, setMenu] = useState(false);
  const { toast, show, clear } = useToast();
  const avisar = useCallback((m: string, tono?: 'bad' | 'good') => show(m, undefined, tono), [show]);
  const oc = useComunicacion(datos.comunicacion, avisar);
  const notaOC = useNotaOC(oc.estado);

  // La URL acompaña (paso, tarjeta y oferta) sin recargar: un link compartido abre lo mismo.
  const ir = useCallback((p: Paso, t: Tarjeta = tarjeta) => {
    setPaso(p); setTarjeta(t);
    try { const u = new URL(window.location.href); u.searchParams.set('paso', p); u.searchParams.set('tarjeta', t); window.history.replaceState(null, '', u); } catch { /* sin URL, igual cambia */ }
  }, [tarjeta]);
  const alChat = useCallback((texto: string) => { setCosa(null); setPedido({ texto, vez: Date.now() }); ir('accion', 'oferta'); }, [ir]);

  const abiertas = decisiones.filter((d) => d.estado === 'abierta').length;
  const tocan = useMemo(() => ({
    oferta: teTocanOC(oc.estado),
    web: datos.web.length ? 0 : 1,
    anuncios: datos.tareas.length,
    instagram: datos.redes.instagram.length ? 0 : 1,
    youtube: datos.redes.youtube.length ? 0 : 1,
  }), [oc.estado, datos]);
  const avisoAccion = Object.values(tocan).reduce((a, b) => a + b, 0);

  const numeroDe = (t: Tarjeta): { n: string; de?: string; s: string } => {
    if (paso === 'accion') return { n: String(tocan[t]), s: 'te tocan' };
    if (paso === 'piloto') return t === 'anuncios' ? { n: String(abiertas), s: abiertas === 1 ? 'espera tu OK' : 'esperan tu OK' } : { n: '—', s: 'Sin piloto todavía' };
    switch (t) {
      case 'oferta': return notaOC != null ? { n: String(notaOC), de: '/100', s: 'Tu nota' } : { n: '—', s: 'Sin analizar' };
      case 'web': return datos.web.length ? { n: String(datos.web.length), s: datos.web.length === 1 ? 'página' : 'páginas' } : { n: '—', s: 'Sin tu web' };
      case 'anuncios': return datos.anuncios.conectada ? { n: String(datos.anuncios.mejores.length), s: `con ${KPI[datos.anuncios.kpi]} este mes` } : { n: '—', s: 'Sin conectar' };
      default: { const r = datos.redes[t]; return r.length ? { n: '1', s: `@${r[0].usuario.replace(/^@/, '')}` } : { n: '—', s: 'Sin conectar' }; }
    }
  };

  return (
    <div className="frn frn--mono cop">
      <style>{CSS_COPILOTO}</style>
      <style>{CSS_OFFER}</style>
      <style>{CSS_EXTRA}</style>
      <main className="frn-board">
        <div className="frn-head frn-head--fija frn-head2">
          <span className="frn-marca frn-marca--sola" aria-label="Marketing CoPilot"><CriaturaMako size={34} /></span>
          <nav className="frn-tresp" aria-label="Los tres pasos">
            {PASOS.map(([k, t], i) => {
              const aviso = k === 'accion' ? avisoAccion : k === 'piloto' ? abiertas : 0;
              return (
                <button key={k} type="button" className="frn-tresp__b" aria-current={paso === k ? 'step' : undefined} onClick={() => ir(k)}>
                  <span className="frn-tresp__n">{i + 1}</span><span className="frn-tresp__t">{t}</span>
                  {aviso > 0 && <span className="frn-aviso" aria-label={`${aviso} pendientes`}>{aviso}</span>}
                </button>
              );
            })}
          </nav>
          <div className="frn-head__btns">
            {paso === 'piloto' && <Link className="frn-btn frn-btn--ghost" href="/ads-manager/ajustes"><Tuerca />Configurar piloto</Link>}
            <div className="frn-mas">
              <button type="button" className="frn-mas__btn" aria-label="Más opciones" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
              </button>
              {menu && (
                <div className="frn-mas__menu" role="menu">
                  <Link role="menuitem" href="/conocimientos" onClick={() => setMenu(false)}>Clases</Link>
                  <Link role="menuitem" href="/ads-manager" onClick={() => setMenu(false)}>El Media Buyer de siempre</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="frn-stats frn-stats--n" style={{ ['--n' as string]: 5 }}>
          {TARJETAS.map(([k, t]) => {
            const { n, de, s } = numeroDe(k);
            return (
              <article key={k} className={`frn-card frn-stat${tarjeta === k ? ' frn-stat--hero' : ''}`} role="button" tabIndex={0} aria-pressed={tarjeta === k}
                onClick={() => ir(paso, k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(paso, k); } }}>
                <h2 className="frn-stat__t"><LogoTarjeta t={k} /> {t}</h2>
                <span className="frn-arrow"><Flecha /></span>
                <p className="frn-stat__n frn-num">{n}{de && <span className="frn-de">{de}</span>}</p>
                <p className="frn-stat__s">{s}</p>
              </article>
            );
          })}
        </div>

        <div className="mq-vista" data-vista={`${paso}-${tarjeta}`}>
          {tarjeta === 'oferta' && paso === 'analisis' && (
            <div className="frn-pila">
              <div className="frn-subtabs oc-fila"><SelectorOferta estado={oc.estado} onElegir={oc.elegirOferta} /><SegPartes parte={parte} onParte={setParte} /></div>
              <AnalisisOC estado={oc.estado} parte={parte} leyendo={oc.leyendo} onLeer={oc.leer}
                onMejorar={(p, c) => { setParte(p); if (c) setPedido({ texto: `Mejoremos «${c.nombre}» de ${p === 'oferta' ? 'mi oferta' : p === 'angulos' ? 'mis ángulos' : 'mi voz'}: tiene ${c.nota} de 10. ${c.porque}`, vez: Date.now() }); ir('accion', 'oferta'); }} />
            </div>
          )}
          {tarjeta === 'oferta' && paso === 'accion' && (
            <AccionOC estado={oc.estado} parte={parte} onParte={setParte} onMarcar={oc.marcar} onAbrir={(p, k) => setCosa({ p, k })}
              onElegirOferta={oc.elegirOferta} pedido={pedido} onMandado={() => { setPedido(null); void oc.recargar(); }} />
          )}
          {tarjeta === 'oferta' && paso === 'piloto' && (
            <section className="frn-card frn-rem frn-rem--ancho">
              <p className="frn-rem__h">Tu oferta todavía no tiene piloto: la trabajas en la acción, conmigo en el chat.</p>
              <button type="button" className="frn-btn" onClick={() => ir('accion', 'oferta')}>Ir a la acción</button>
            </section>
          )}

          {tarjeta === 'anuncios' && paso === 'analisis' && <AnalisisAnuncios datos={datos} />}
          {tarjeta === 'anuncios' && paso === 'accion' && <ListaTareas tareas={datos.tareas} funnel={datos.funnel} />}
          {tarjeta === 'anuncios' && paso === 'piloto' && (
            <PilotoAnuncios conectada={datos.anuncios.conectada} existeTabla={datos.anuncios.existeTabla} piloto={datos.anuncios.piloto}
              decisiones={decisiones} onDecisiones={setDecisiones} avisar={avisar} />
          )}

          {tarjeta === 'web' && <TarjetaWeb paso={paso} web={datos.web} />}
          {(tarjeta === 'instagram' || tarjeta === 'youtube') && <TarjetaRed red={tarjeta} paso={paso} cuentas={datos.redes[tarjeta]} />}
        </div>
      </main>
      {cosa && <ModalCosa estado={oc.estado} p={cosa.p} k={cosa.k} onCerrar={() => setCosa(null)} onMarcar={oc.marcar} onChat={alChat} />}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// ── Anuncios ─────────────────────────────────────────────────────────────────

const usd = (n: number) => `US$ ${n.toLocaleString('es', { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

function AnalisisAnuncios({ datos }: { datos: DatosCoPilot }) {
  const a = datos.anuncios;
  if (!a.conectada) {
    return (
      <section className="frn-card cop-vacio">
        <h2 className="frn-card__t">Tus anuncios</h2>
        <p>Conecta tu cuenta de anuncios de Meta y leo cuáles te traen {KPI[a.kpi]} y cuánto te cuesta cada uno.</p>
        <ConectarViaZernio red="metaads" volver="/ads-manager/copiloto">Conectar anuncios</ConectarViaZernio>
      </section>
    );
  }
  return (
    <section className="frn-card">
      <div className="frn-card__head"><h2 className="frn-card__t">Los que más {KPI[a.kpi]} trajeron este mes</h2><Link className="frn-chip" href="/ads-manager?vista=biblioteca">Ver la Biblioteca</Link></div>
      {a.mejores.length ? (
        <ul className="cop-lista">
          {a.mejores.map((m) => (
            <li key={m.adId}>
              {m.miniatura ? <img className="cop-mini" src={m.miniatura} alt="" loading="lazy" /> : <span className="cop-mini" />}
              <div><b>{m.nombre}</b>{m.campana && <span>{m.campana}</span>}</div>
              <div className="cop-num"><b>{m.resultados} {KPI[a.kpi]}</b><span>{m.costo != null ? `${usd(m.costo)} cada una · ` : ''}gastaste {usd(m.gasto)}</span></div>
            </li>
          ))}
        </ul>
      ) : <p className="frn-rem__h">Este mes ningún anuncio trajo {KPI[a.kpi]} todavía.</p>}
    </section>
  );
}

function ListaTareas({ tareas, funnel }: { tareas: Tarea[]; funnel: string | null }) {
  if (!funnel) {
    return (
      <section className="frn-card frn-rem frn-rem--ancho">
        <p className="frn-rem__h">Primero elegimos tu funnel: con eso armo lo que te toca cada semana.</p>
        <Link className="frn-btn" href="/ads-manager?estrategia=1">Elegir mi funnel</Link>
      </section>
    );
  }
  return (
    <section className="frn-card">
      <div className="frn-card__head"><h2 className="frn-card__t">Esta semana · {funnel}</h2></div>
      <ul className="cop-lista">
        {tareas.map((t, i) => (
          <li key={i} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
            <div><b>{t.titulo}</b><span>{t.detalle}</span></div>
            <Link className="frn-btn frn-btn--ghost frn-btn--chico" href={t.href}>Hacerlo</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Web, Instagram y YouTube ─────────────────────────────────────────────────

function TarjetaWeb({ paso, web }: { paso: Paso; web: string[] }) {
  if (paso === 'piloto') return <SinPiloto que="tu web" />;
  if (!web.length) {
    return (
      <section className="frn-card cop-vacio">
        <h2 className="frn-card__t">Tu web</h2>
        <p>Pásame tu web y te digo, sección por sección, qué le cambiaría para que venda más.</p>
        <div className="cop-acciones"><Link className="frn-btn frn-btn--primary" href="/web-generator">Analizar mi web</Link></div>
      </section>
    );
  }
  return (
    <section className="frn-card">
      <div className="frn-card__head"><h2 className="frn-card__t">{paso === 'analisis' ? 'Tus páginas' : 'Mejorar tus páginas'}</h2><Link className="frn-chip" href="/web-generator">Abrir Web Generator</Link></div>
      <ul className="cop-lista">
        {web.map((u) => (
          <li key={u} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
            <div><b>{u.replace(/^https?:\/\//, '')}</b></div>
            <Link className="frn-btn frn-btn--ghost frn-btn--chico" href={`/web-generator?analizar=${encodeURIComponent(u)}`}>{paso === 'analisis' ? 'Ver el análisis' : 'Hacerlo'}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const NOMBRE_RED = { instagram: 'Instagram', youtube: 'YouTube' } as const;
function TarjetaRed({ red, paso, cuentas }: { red: 'instagram' | 'youtube'; paso: Paso; cuentas: Array<{ usuario: string; vencida: boolean }> }) {
  if (paso === 'piloto') return <SinPiloto que={`tu ${NOMBRE_RED[red]}`} />;
  const c = cuentas[0];
  if (!c || c.vencida) {
    return (
      <section className="frn-card cop-vacio">
        <h2 className="frn-card__t">Tu {NOMBRE_RED[red]}</h2>
        <p>{c?.vencida ? `La conexión con tu ${NOMBRE_RED[red]} venció: vuelve a conectarla.` : `Conecta tu ${NOMBRE_RED[red]} y leo lo que publicas: qué le habla a tu cliente y qué solo trae vistas.`}</p>
        <ConectarViaZernio red={red} volver="/ads-manager/copiloto">{c?.vencida ? 'Volver a conectar' : `Conectar ${NOMBRE_RED[red]}`}</ConectarViaZernio>
      </section>
    );
  }
  return (
    <section className="frn-card cop-vacio">
      <h2 className="frn-card__t">@{c.usuario.replace(/^@/, '')}</h2>
      <p>{paso === 'analisis'
        ? `Tu ${NOMBRE_RED[red]} está conectado. Para leer tus publicaciones una por una, ábrelo en Competitor Spy con tu propia cuenta.`
        : red === 'instagram' ? 'Lo que publicas se arma en Carruseles y en Copywriting, y se programa en el Calendario.' : 'Tus videos se arman en Copywriting y se programan en el Calendario.'}</p>
      <div className="cop-acciones">
        {paso === 'analisis'
          ? <Link className="frn-btn frn-btn--primary" href="/competitor-spy">Leer mi {NOMBRE_RED[red]}</Link>
          : <><Link className="frn-btn frn-btn--primary" href="/calendario">Abrir el Calendario</Link><Link className="frn-btn frn-btn--ghost" href="/copywriter">Abrir Copywriting</Link></>}
      </div>
    </section>
  );
}

function SinPiloto({ que }: { que: string }) {
  return (
    <section className="frn-card frn-rem frn-rem--ancho">
      <p className="frn-rem__h">Todavía no hago nada solo con {que}.</p>
      <Link className="frn-btn" href="/dashboard?hoja=marketing"><Grafico />Ver las métricas</Link>
    </section>
  );
}
