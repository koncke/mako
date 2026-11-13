'use client';

// =============================================================================
// Marketing CoPilot nuevo — dos pasos sobre las cinco tarjetas (12/11/2026; dos pasos desde la vuelta 20, 13/11)
// =============================================================================
// Arriba, la criatura y los pasos («1 Análisis y acción · 2 Piloto automático», del alto de un botón y con su aviso). Abajo, las
// cinco tarjetas en el mismo lugar en los dos pasos (Oferta y comunicación, Web, Anuncios, Instagram, YouTube): la elegida se
// conserva al cambiar de paso. En el primero, el análisis de la tarjeta arriba y «Lo que te toca» debajo (Martín, 13/11: «el
// análisis arriba y las tareas con el calendario debajo», simple). Lo de cada tarjeta, con los datos de verdad (./page.tsx):
//   · Oferta y comunicación: ./OfertaComunicacion.tsx. «Mejorar» abre los desplegables en un popup y se completa en el chat.
//   · Anuncios: los mejores del mes, las tareas de la semana de su funnel (lib/media-buyer/copiloto.ts) y el PILOTO del Media Buyer:
//     «Espera tu OK» (Aprobar = lanzar, «No» = descartar) y «Lo que hice» (con «Deshacer»), por /api/media-buyer, lo MISMO que la
//     pantalla del Media Buyer. Sin configurar, «Antes de prenderlo, configúralo» lleva a ./configurar; «Métricas», a la hoja de
//     Marketing del Dashboard.
//   · Web, Instagram y YouTube: lo conectado y dónde se trabaja hoy. Su análisis propio está en el relevo (lo que falta).
// El chat: el de MaKo (la estrella de abajo), con lo que se pide completar.
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { CSS_OFFER } from '@/app/offer/estilos';
import { Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { LogoRed } from '@/app/competitor-spy/LogoRed';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { CriaturaMako } from '@/app/onboarding/CriaturaMako';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import type { EstadoComunicacion } from '@/lib/copiloto/comunicacion-store';
import type { ParteOC } from '@/lib/copiloto/comunicacion';
import type { Decision, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import type { AnuncioDestacado } from '@/lib/media-buyer/productos';
import type { Tarea } from '@/lib/media-buyer/copiloto';
import { CSS_COPILOTO } from './copiloto-css';
import { Flecha, Grafico, Tuerca } from './iconos';
import { AnalisisOC, ModalCosa, ModalTodoOC, SegPartes, SelectorOferta, useComunicacion, useNotaOC } from './OfertaComunicacion';
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

const PASOS: ReadonlyArray<readonly [Paso, string]> = [['analisis', 'Análisis y acción'], ['piloto', 'Piloto automático']];
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
/* El piloto sin configurar: una tarjeta que lleva a la configuración. */
.frn .cop-primera { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 22px; padding: 28px 30px; }
.frn .cop-primera h2 { margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -.02em; color: var(--ink); }
.frn .cop-primera p { margin: 0; font-size: 16px; line-height: 1.5; color: var(--muted); max-width: 60ch; }
@container frn (max-width: 700px) { .frn .cop-primera { grid-template-columns: 1fr; justify-items: start; padding: 22px 18px; } }
/* Lo que te toca, debajo del análisis (vuelta 20): el check como el de las tareas de Web. */
.frn .mq-tetoca { margin-top: 0; }
.frn .cop-tareas > li { grid-template-columns: 26px minmax(0, 1fr) auto; }
.frn .cop-tareas > li[data-hecha="true"] b { text-decoration: line-through; color: var(--muted); }
.frn .cop-check { width: 26px; height: 26px; padding: 0; border-radius: 50%; border: 1.5px solid var(--muted); background: transparent; display: grid; place-items: center; color: var(--card); font: 700 14px/1 var(--font); cursor: pointer; }
.frn .cop-check[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); }
@container frn (max-width: 700px) { .frn .cop-tareas > li { grid-template-columns: 26px minmax(0, 1fr); } .frn .cop-tareas > li > :last-child { grid-column: 2; justify-self: start; } }
/* El popup de «Mejorar»: los desplegables adentro de un .frn propio, sin su fondo. */
.ocm.ocm--todo { width: min(640px, 100%); max-height: calc(100vh - 32px); }
.ocm__frn.frn { background: transparent; }
.ocm__frn .frn-card.oc { padding: 0; box-shadow: none; background: transparent; overflow: visible; }
.ocm__frn .oc-cuerpo { overflow: visible; margin: 0; padding: 0; }
/* El análisis más corto, ahora que lo que te toca va debajo: las notas sin estirarse y «Lo que leí» con lo principal. */
.frn .mq-vista .oc-dos { min-height: 0; }
.frn .mq-vista .frn-dos > section > .mq-notas--frn { justify-content: flex-start; }
.frn .mq-vista .mq-notas--frn .of-fila { padding: 11px 6px; }
.frn .mq-vista .frn-dos .frn-col > .frn-card:last-child .frn-datos > div:nth-child(n+4) { display: none; }
`;

function LogoTarjeta({ t }: { t: Tarjeta }) {
  if (t === 'oferta') return <span className="mq-logo" style={{ width: 22, height: 22, borderRadius: 6, background: '#121212' }}><Icon name="tag" size={14} /></span>;
  return <LogoRed red={t === 'web' ? 'sitio' : t} box={22} />;
}

export function CoPilot({ datos, pasoInicial, tarjetaInicial }: { datos: DatosCoPilot; pasoInicial: Paso; tarjetaInicial: Tarjeta }) {
  // Dos pasos desde la vuelta 20 (Martín, 13/11: «el análisis arriba y las tareas con el calendario debajo»): un link viejo con
  // `?paso=accion` abre el primero.
  const [paso, setPaso] = useState<Paso>(pasoInicial === 'accion' ? 'analisis' : pasoInicial);
  const [tarjeta, setTarjeta] = useState<Tarjeta>(tarjetaInicial);
  const [parte, setParte] = useState<ParteOC>('oferta');
  const [cosa, setCosa] = useState<{ p: ParteOC; k: string } | null>(null);
  const [todo, setTodo] = useState(false);
  const [pedido, setPedido] = useState<{ texto: string; vez: number } | null>(null);
  const [decisiones, setDecisiones] = useState<Decision[]>(datos.anuncios.decisiones);
  const [hechas, setHechas] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState(false);
  const { toast, show, clear } = useToast();
  const avisar = useCallback((m: string, tono?: 'bad' | 'good') => show(m, undefined, tono), [show]);
  const oc = useComunicacion(datos.comunicacion, avisar);
  const notaOC = useNotaOC(oc.estado);

  // La URL acompaña (paso y tarjeta) sin recargar: un link compartido abre lo mismo.
  const ir = useCallback((p: Paso, t: Tarjeta = tarjeta) => {
    setPaso(p); setTarjeta(t);
    try { const u = new URL(window.location.href); u.searchParams.set('paso', p); u.searchParams.set('tarjeta', t); window.history.replaceState(null, '', u); } catch { /* sin URL, igual cambia */ }
  }, [tarjeta]);
  // Lo que se completa en el chat va al de MaKo (la estrella de abajo, que se abre con el pedido): la oferta se construye ahí.
  const alChat = useCallback((texto: string) => { setCosa(null); setTodo(false); setPedido({ texto, vez: Date.now() }); }, []);

  const abiertas = decisiones.filter((d) => d.estado === 'abierta').length;
  const tareas = useMemo(() => tareasDeTarjetas(datos, oc.estado), [datos, oc.estado]);
  const tocan = useMemo(() => Object.fromEntries(TARJETAS.map(([k]) => [k, tareas[k].filter((t) => !hechas[t.id]).length])) as Record<Tarjeta, number>, [tareas, hechas]);
  const avisoAccion = Object.values(tocan).reduce((a, b) => a + b, 0);
  const pantalla = `Marketing CoPilot · ${paso === 'piloto' ? 'Piloto automático' : 'Análisis y acción'} · ${TARJETAS.find(([k]) => k === tarjeta)?.[1]}`;

  const numeroDe = (t: Tarjeta): { n: string; de?: string; s: string } => {
    if (paso === 'piloto') {
      if (t !== 'anuncios') return { n: '—', s: 'Sin piloto todavía' };
      // Sin configurar no hay nada esperando (medido en la maqueta 20: decía «1 espera tu OK» arriba de «configúralo»).
      if (!datos.anuncios.piloto?.encendido) return { n: '—', s: 'Sin configurar' };
      return { n: String(abiertas), s: abiertas === 1 ? 'espera tu OK' : 'esperan tu OK' };
    }
    const base = analisisDe(t);
    return tocan[t] ? { ...base, s: `${tocan[t]} te ${tocan[t] === 1 ? 'toca' : 'tocan'}` } : base;
  };
  const analisisDe = (t: Tarjeta): { n: string; de?: string; s: string } => {
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
          <nav className="frn-tresp" aria-label="Los dos pasos">
            {PASOS.map(([k, t], i) => {
              const aviso = k === 'analisis' ? avisoAccion : k === 'piloto' ? abiertas : 0;
              return (
                <button key={k} type="button" className="frn-tresp__b" aria-current={paso === k ? 'step' : undefined} onClick={() => ir(k)}>
                  <span className="frn-tresp__n">{i + 1}</span><span className="frn-tresp__t">{t}</span>
                  {aviso > 0 && <span className="frn-aviso" aria-label={`${aviso} pendientes`}>{aviso}</span>}
                </button>
              );
            })}
          </nav>
          <div className="frn-head__btns">
            {paso === 'piloto' && <Link className="frn-btn frn-btn--ghost" href="/ads-manager/copiloto/configurar"><Tuerca />Configurar piloto</Link>}
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
          {paso === 'analisis' && (
            <div className="frn-pila">
              {tarjeta === 'oferta' && (
                <>
                  <div className="frn-subtabs oc-fila"><SelectorOferta estado={oc.estado} onElegir={oc.elegirOferta} /><SegPartes parte={parte} onParte={setParte} /></div>
                  <AnalisisOC estado={oc.estado} parte={parte} leyendo={oc.leyendo} onLeer={oc.leer}
                    onMejorar={(p, c) => {
                      setParte(p);
                      if (c) alChat(`Mejoremos «${c.nombre}» de ${p === 'oferta' ? 'mi oferta' : p === 'angulos' ? 'mis ángulos' : 'mi voz'}: tiene ${c.nota} de 10. ${c.porque}`);
                      else setTodo(true);
                    }} />
                </>
              )}
              {tarjeta === 'anuncios' && <AnalisisAnuncios datos={datos} />}
              {tarjeta === 'web' && <TarjetaWeb paso="analisis" web={datos.web} />}
              {(tarjeta === 'instagram' || tarjeta === 'youtube') && <TarjetaRed red={tarjeta} paso="analisis" cuentas={datos.redes[tarjeta]} />}
              <LoQueTeToca tareas={tareas[tarjeta]} hechas={hechas} onHecha={(id, v) => setHechas((h) => ({ ...h, [id]: v }))}
                onHacer={(t) => { if (t.abre === 'oc') { setParte(t.parte ?? 'oferta'); setTodo(true); } else if (t.abre === 'leer') void oc.leer(t.parte ?? 'angulos'); }} />
            </div>
          )}
          {paso === 'piloto' && tarjeta === 'anuncios' && datos.anuncios.conectada && !datos.anuncios.piloto?.encendido && <PrimeraVezPiloto />}
          {paso === 'piloto' && tarjeta === 'anuncios' && (!datos.anuncios.conectada || datos.anuncios.piloto?.encendido) && (
            <PilotoAnuncios conectada={datos.anuncios.conectada} existeTabla={datos.anuncios.existeTabla} piloto={datos.anuncios.piloto}
              decisiones={decisiones} onDecisiones={setDecisiones} avisar={avisar} />
          )}
          {paso === 'piloto' && tarjeta !== 'anuncios' && <SinPiloto que={tarjeta === 'oferta' ? 'tu oferta' : tarjeta === 'web' ? 'tu web' : `tu ${NOMBRE_RED[tarjeta]}`} />}
        </div>
      </main>
      {todo && <ModalTodoOC estado={oc.estado} parte={parte} onParte={setParte} onCerrar={() => setTodo(false)} onMarcar={oc.marcar} onAbrir={(p, k) => setCosa({ p, k })} onChat={alChat} />}
      {cosa && <ModalCosa estado={oc.estado} p={cosa.p} k={cosa.k} onCerrar={() => setCosa(null)} onMarcar={oc.marcar} onChat={alChat} />}
      <MakoEnLaTab tab="Marketing CoPilot" pedido={pedido} pantalla={pantalla} encimaDeModales />
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// ── Lo que te toca, debajo del análisis (vuelta 20) ──────────────────────────
// Lo arma el código con lo que falta de verdad en cada tarjeta. ⚠️ Todavía NO vive en el Plan (falta la pieza del Plan, que se
// coordina con quien lo lleva): por eso no dice «En tu Plan», y lo marcado como hecho dura lo que dura la pantalla.

type TareaTarjeta = { id: string; titulo: string; detalle: string; href?: string; abre?: 'oc' | 'leer'; parte?: ParteOC };

function tareasDeTarjetas(datos: DatosCoPilot, oc: EstadoComunicacion): Record<Tarjeta, TareaTarjeta[]> {
  const faltan = (p: ParteOC) => Object.values(oc.cosas[p]).filter((c) => c.estado !== 'confirmada').length;
  const comunicacion: TareaTarjeta[] = [];
  if (oc.sesion == null) comunicacion.push({ id: 'oferta-armar', titulo: 'Arma tu oferta con MaKo', detalle: 'En Offer: con eso analizo tu oferta y armo tus ángulos.', href: '/offer' });
  else if (!oc.nota.oferta) comunicacion.push({ id: 'oferta-analizar', titulo: 'Analiza tu oferta', detalle: 'En Offer, con la conversación que ya tienes.', href: '/offer' });
  if (!oc.nota.angulos) comunicacion.push({ id: 'angulos-leer', titulo: 'Que MaKo lea tus ángulos', detalle: 'De tus anuncios, tus llamadas y tu oferta.', abre: 'leer', parte: 'angulos' });
  if (!oc.nota.voz) comunicacion.push({ id: 'voz-leer', titulo: 'Que MaKo lea tu voz', detalle: 'De tus chats de venta y lo que ya cargaste.', abre: 'leer', parte: 'voz' });
  for (const [p, t] of [['angulos', 'tus ángulos'], ['voz', 'tu voz'], ['oferta', 'tu oferta']] as const) {
    const n = faltan(p);
    if (n) comunicacion.push({ id: `completar-${p}`, titulo: `Completa ${t}`, detalle: `${n} ${n === 1 ? 'cosa' : 'cosas'} por completar o confirmar.`, abre: 'oc', parte: p });
  }
  const anuncios: TareaTarjeta[] = datos.funnel
    ? datos.tareas.map((t, i) => ({ id: `ads-${i}`, titulo: t.titulo, detalle: t.detalle, href: t.href }))
    : [{ id: 'ads-funnel', titulo: 'Elige tu funnel', detalle: 'Con eso armo lo que te toca cada semana.', href: '/ads-manager?estrategia=1' }];
  if (!datos.anuncios.conectada) anuncios.unshift({ id: 'ads-conectar', titulo: 'Conecta tu cuenta de anuncios', detalle: 'Para leer qué te trae agendas y prender el piloto.', href: '/integraciones' });
  // Audience Network (Martín, 13/11: «fíjate si Meta todavía deja sacarlo»): desde fines de agosto de 2026 Meta ya no deja sacarlo
  // campaña por campaña, pero sí bloquearlo en toda la cuenta, y eso no lo puede hacer MaKo por la API. Es una tarea de una vez.
  else anuncios.push({ id: 'ads-audience-network', titulo: 'Bloquea Audience Network en tu cuenta', detalle: 'En Meta: Configuración publicitaria → Controles de ubicación. Trae clics de apps que no agendan.' });
  const web: TareaTarjeta[] = datos.web.length
    ? datos.web.slice(0, 3).map((u, i) => ({ id: `web-${i}`, titulo: `Mejora ${u.replace(/^https?:\/\//, '')}`, detalle: 'Con los comentarios del análisis, sección por sección.', href: `/web-generator?analizar=${encodeURIComponent(u)}` }))
    : [{ id: 'web-analizar', titulo: 'Analiza tu web', detalle: 'Te digo qué cambiar para que venda más.', href: '/web-generator' }];
  const red = (r: 'instagram' | 'youtube'): TareaTarjeta[] => [
    ...(datos.redes[r].length && !datos.redes[r][0].vencida ? [] : [{ id: `${r}-conectar`, titulo: `Conecta tu ${NOMBRE_RED[r]}`, detalle: 'Desde la tarjeta de arriba.' }]),
    ...(r === 'instagram' ? [{ id: 'ig-competidores', titulo: 'Selecciona a tus competidores', detalle: 'Los que sigues me dan el número con que se publica un reel de prueba.', href: '/competitor-spy' }] : []),
  ];
  return { oferta: comunicacion, web, anuncios, instagram: red('instagram'), youtube: red('youtube') };
}

function LoQueTeToca({ tareas, hechas, onHecha, onHacer }: {
  tareas: TareaTarjeta[]; hechas: Record<string, boolean>; onHecha: (id: string, v: boolean) => void; onHacer: (t: TareaTarjeta) => void;
}) {
  if (!tareas.length) return null;
  return (
    <section className="frn-card mq-tetoca">
      <div className="frn-card__head"><h2 className="frn-card__t">Lo que te toca</h2></div>
      <ul className="cop-lista cop-tareas">
        {tareas.map((t) => {
          const lista = !!hechas[t.id];
          return (
            <li key={t.id} data-hecha={lista}>
              <button type="button" className="cop-check" aria-pressed={lista} aria-label={lista ? `Desmarcar «${t.titulo}»` : `Marcar «${t.titulo}» como hecha`} onClick={() => onHecha(t.id, !lista)}>{lista ? '✓' : ''}</button>
              <div><b>{t.titulo}</b><span>{t.detalle}</span></div>
              {lista ? <span /> : t.href
                ? <Link className="frn-btn frn-btn--ghost frn-btn--chico" href={t.href}>Hacerlo</Link>
                : t.abre ? <button type="button" className="frn-btn frn-btn--ghost frn-btn--chico" onClick={() => onHacer(t)}>Hacerlo</button> : <span />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** El piloto sin configurar (vuelta 20): nada espera tu OK todavía; una tarjeta lleva a la configuración, que es una vez. */
function PrimeraVezPiloto() {
  return (
    <section className="frn-card cop-primera">
      <span className="cop-primera__mako"><CriaturaMako size={44} /></span>
      <div><h2>Antes de prenderlo, configúralo</h2><p>Me dices cuánto puedo gastar, cuánto pagas como mucho por resultado y qué hago solo. Es una vez: después lo cambias cuando quieras.</p></div>
      <Link className="frn-btn frn-btn--primary" href="/ads-manager/copiloto/configurar">Configurar el piloto</Link>
    </section>
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
