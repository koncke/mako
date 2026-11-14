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

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CSS_OFFER } from '@/app/offer/estilos';
import { Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { LogoRed } from '@/app/competitor-spy/LogoRed';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { BotonIntegracion, CON_SU_CLASE } from '@/app/_components/ConectarIntegracion';
import { CriaturaMako } from '@/app/onboarding/CriaturaMako';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import type { EstadoComunicacion } from '@/lib/copiloto/comunicacion-store';
import type { ParteOC } from '@/lib/copiloto/comunicacion';
import { tareasDelCoPilot, type ResumenParaTareas, type TareaCoPilot } from '@/lib/copiloto/tareas';
import type { Decision, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import type { AnuncioDestacado } from '@/lib/media-buyer/productos';
import type { Tarea } from '@/lib/media-buyer/copiloto';
import type { NumeroDelReel } from '@/lib/copiloto/piloto';
import type { VistaRT } from '@/lib/retargeting-motor';
import type { PaginaAnalizada } from '@/lib/copiloto/web';
import type { Nevera } from '@/lib/copiloto/nevera';
import type { PuntoRed } from '@/lib/copiloto/redes-propias-reglas';
import type { PilotoInstagram, PilotoYoutube } from '@/lib/copiloto/piloto-redes';
import type { ResumenVsl } from '@/lib/copiloto/vsl';
import { diaCorto, lunesDe, nombreFormato, type FormatoNevera } from '@/lib/copiloto/nevera-reglas';
import { CSS_RETARGETING, Retargeting } from './Retargeting';
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
  /** Con cuántas vistas se publica un reel de prueba (lib/copiloto/piloto.ts); null si no se pudo leer. */
  reel: NumeroDelReel | null;
  /** El retargeting sin VSL (lib/retargeting.ts): lo que marcó MaKo; null si no se pudo leer. */
  retargeting: VistaRT | null;
  web: string[];
  /** Lo último que analizó el Landing Analyst de cada página (lib/copiloto/web.ts). */
  paginas: PaginaAnalizada[];
  /** La nevera de contenido (lib/copiloto/nevera.ts): lo listo, lo publicado y hasta cuándo alcanza; null si no se pudo leer. */
  nevera: Nevera | null;
  redes: Record<'instagram' | 'youtube', Array<{ usuario: string; vencida: boolean }>>;
  /** Lo que leyó de su cuenta PROPIA (lib/copiloto/redes-propias.ts): un renglón «bien / a tocar» por punto. Ausente = no se pudo leer. */
  propias?: Partial<Record<'instagram' | 'youtube', PuntoRed[]>>;
  /** Lo que propone el piloto de las redes esta semana (lib/copiloto/piloto-redes.ts), ya como tareas. */
  propuestas?: TareaCoPilot[];
  /** El piloto de Instagram y YouTube (lib/copiloto/piloto-redes.ts) y si el aviso de la nevera está prendido. null = no se pudo leer. */
  pilotoRedes?: { instagram: PilotoInstagram; youtube: PilotoYoutube; avisoNevera: boolean } | null;
  /** Su VSL (lib/copiloto/vsl.ts), si su campaña lleva uno: la curva del Pixel, o null sin eventos (la tarjeta pide conectar). */
  vsl?: { landing: string | null; resumen: ResumenVsl | null };
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
/* La web, como análisis: la nota, el veredicto y lo más grave con su arreglo. */
.frn .cop-web__cab { display: flex; align-items: center; gap: 18px; margin: 10px 0 6px; }
.frn .cop-web__n { margin: 0; font-size: 40px; font-weight: 700; letter-spacing: -.03em; color: var(--ink); }
.frn .cop-web__n span { font-size: 18px; color: var(--muted); }
.frn .cop-web__v { margin: 0; font-size: 16px; line-height: 1.5; color: var(--ink); max-width: 70ch; }
.frn .cop-web__lista { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; }
.frn .cop-web__lista li { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 14px; align-items: start; padding: 14px 2px; }
.frn .cop-web__lista li + li { border-top: 1px solid var(--hair); }
.frn .cop-web__lista b { display: block; font-size: 15.5px; font-weight: 600; color: var(--ink); }
.frn .cop-web__lista p { margin: 4px 0 0; font-size: 15px; line-height: 1.5; color: var(--ink); }
.frn .cop-web__sev { justify-self: start; display: inline-flex; align-items: center; height: 26px; padding: 0 11px; border-radius: 999px; font-size: 13.5px; font-weight: 700; }
.frn .cop-web__lista li[data-sev="alta"] .cop-web__sev { color: var(--bad); background: var(--bad-bg); }
.frn .cop-web__lista li[data-sev="media"] .cop-web__sev { color: var(--warn); background: var(--warn-bg); }
.frn .cop-web__lista li[data-sev="baja"] .cop-web__sev { color: var(--muted); background: var(--panel); }
@container frn (max-width: 700px) { .frn .cop-web__lista li { grid-template-columns: 1fr; gap: 6px; } }
/* La nevera de contenido: un bloque por formato, en rojo el que se queda corto. */
.frn .cop-nevera__lista { list-style: none; margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.frn .cop-nevera__lista li { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; border-radius: 16px; background: var(--panel); }
.frn .cop-nevera__lista li[data-falta="true"] { background: color-mix(in srgb, var(--bad) 7%, var(--card)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bad) 30%, transparent); }
.frn .cop-nevera__lista b { font-size: 34px; font-weight: 700; color: var(--ink); line-height: 1.1; }
.frn .cop-nevera__que { font-size: 16px; font-weight: 600; color: var(--ink); }
.frn .cop-nevera__hasta, .frn .cop-nevera__pub { font-size: 15px; color: var(--ink); }
.frn .cop-nevera__lista li[data-falta="true"] .cop-nevera__hasta { color: var(--bad); font-weight: 600; }
/* Con cuántas vistas se publica un reel de prueba: el número grande y de dónde sale. */
.frn .cop-reel { display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
.frn .cop-reel__n { margin: 6px 0 4px; font-size: 44px; font-weight: 700; letter-spacing: -.03em; color: var(--ink); }
.frn .cop-reel__n span { margin-left: 8px; font-size: 18px; font-weight: 600; color: var(--muted); letter-spacing: 0; }
.frn .cop-reel__x { margin: 0; font-size: 15.5px; line-height: 1.5; color: var(--muted); max-width: 60ch; }
/* El piloto sin configurar: una tarjeta que lleva a la configuración. */
.frn .cop-primera { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 22px; padding: 28px 30px; }
.frn .cop-primera h2 { margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -.02em; color: var(--ink); }
.frn .cop-primera p { margin: 0; font-size: 16px; line-height: 1.5; color: var(--muted); max-width: 60ch; }
@container frn (max-width: 700px) { .frn .cop-primera { grid-template-columns: 1fr; justify-items: start; padding: 22px 18px; } }
/* Lo que te toca, debajo del análisis (vuelta 20): el check como el de las tareas de Web. */
.frn .mq-tetoca { margin-top: 0; }
/* «Lo que hice»: el renglón a lo ancho del tablero medía 1100 px (más de 140 letras): se corta a un largo que se lee. */
.frn .frn-ev p { max-width: 60ch; }
/* Tu VSL (14/11): cinco columnas, cuánto sigue mirando en cada cuarto del video. */
.frn .cop-vsl { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; align-items: end; margin: 16px 0 12px; }
.frn .cop-vsl__col { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.frn .cop-vsl__col b { font-size: 18px; font-weight: 700; color: var(--ink); }
.frn .cop-vsl__barra { position: relative; width: 100%; max-width: 72px; height: 140px; border-radius: 12px; background: var(--panel); overflow: hidden; }
.frn .cop-vsl__barra i { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 12px; background: var(--ink); }
.frn .cop-vsl__corte { font-size: 15px; color: var(--muted); }
/* Lo que leyó de su cuenta propia (14/11): un renglón por punto, con su marca. */
.frn .cop-puntos { list-style: none; margin: 14px 0 18px; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.frn .cop-puntos li { display: flex; align-items: flex-start; gap: 12px; font-size: 16px; line-height: 1.45; color: var(--ink); max-width: 70ch; }
.frn .cop-puntos__m { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 700; background: var(--g-100); color: var(--g-700); }
.frn .cop-puntos li[data-bien="false"] .cop-puntos__m { background: var(--rose-bg); color: var(--rose); }
/* «Espera tu OK» entre 700 y 1000 px (una notebook con la barra de la app): el antes → después (250 px) y Aprobar/No (350 px) dejaban
   al porqué una columna de 190 px, en diez renglones. Ahí el porqué va arriba a lo ancho y lo demás debajo (banco de la portada, 14/11). */
@container frn (min-width: 701px) and (max-width: 1000px) {
  .frn .frn-dec2 { grid-template-columns: auto minmax(0, 1fr) auto; row-gap: 12px; }
  .frn .frn-dec2__img { grid-row: 1 / span 2; align-self: start; }
  .frn .frn-dec2__txt { grid-column: 2 / -1; }
  .frn .frn-dec2:not(:has(.frn-dec2__img)) { grid-template-columns: minmax(0, 1fr) auto; }
  .frn .frn-dec2:not(:has(.frn-dec2__img)) .frn-dec2__txt { grid-column: 1 / -1; }
}
.frn .cop-tareas > li { grid-template-columns: 26px minmax(0, 1fr) auto; }
.frn .cop-tareas > li[data-hecha="true"] b { text-decoration: line-through; color: var(--muted); }
.frn .cop-check { width: 26px; height: 26px; padding: 0; border-radius: 50%; border: 1.5px solid var(--muted); background: transparent; display: grid; place-items: center; color: var(--card); font: 700 14px/1 var(--font); cursor: pointer; }
.frn .cop-check[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); }
.frn .cop-check:disabled { cursor: default; opacity: .5; }
/* Con .cop-lista adelante: «.frn .cop-lista span» (display: block) les ganaba y apilaba el chip encima de «Hacerlo» (banco de la portada, 14/11). */
.frn .cop-lista .cop-tarea__der { display: inline-flex; align-items: center; gap: 12px; }
.frn .cop-lista .cop-plan { display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair); font-size: 13.5px; font-weight: 600; color: var(--muted); white-space: nowrap; }
@container frn (max-width: 700px) { .frn .cop-lista .cop-plan { display: none; } }
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

/** `enTelefono`: dentro de /m (app/m/ads/page.tsx) no va la estrella de la computadora: tapaba el «CRM» de la barra de abajo (10/11). */
export function CoPilot({ datos, pasoInicial, tarjetaInicial, enTelefono = false }: { datos: DatosCoPilot; pasoInicial: Paso; tarjetaInicial: Tarjeta; enTelefono?: boolean }) {
  // Dos pasos desde la vuelta 20 (Martín, 13/11: «el análisis arriba y las tareas con el calendario debajo»): un link viejo con
  // `?paso=accion` abre el primero.
  const [paso, setPaso] = useState<Paso>(pasoInicial === 'accion' ? 'analisis' : pasoInicial);
  const [tarjeta, setTarjeta] = useState<Tarjeta>(tarjetaInicial);
  const [parte, setParte] = useState<ParteOC>('oferta');
  const [cosa, setCosa] = useState<{ p: ParteOC; k: string } | null>(null);
  const [todo, setTodo] = useState(false);
  const [pedido, setPedido] = useState<{ texto: string; vez: number } | null>(null);
  const [decisiones, setDecisiones] = useState<Decision[]>(datos.anuncios.decisiones);
  // Cómo está cada tarea en el Plan (clave → hecha). null = todavía no se leyó.
  const [enPlan, setEnPlan] = useState<Record<string, boolean> | null>(null);
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
  const { tareas: hoy, resueltas } = useMemo(() => tareasDelCoPilot(resumenParaTareas(datos, oc.estado)), [datos, oc.estado]);
  const tareas = useMemo(() => Object.fromEntries(TARJETAS.map(([k]) => [k, hoy.filter((t) => t.tarjeta === k)])) as Record<Tarjeta, TareaCoPilot[]>, [hoy]);
  const tocan = useMemo(() => Object.fromEntries(TARJETAS.map(([k]) => [k, tareas[k].filter((t) => !enPlan?.[t.clave]).length])) as Record<Tarjeta, number>, [tareas, enPlan]);
  // Las tareas viven en el Plan (Martín, 13/11): al abrir, y cada vez que cambian, se crean allá las que faltan y se cierran las resueltas.
  const firma = hoy.map((t) => t.clave).join('|') + '#' + resueltas.join('|');
  useEffect(() => {
    let vivo = true;
    void llamarTareas({ op: 'sincronizar', tareas: hoy, resueltas }).then((r) => {
      if (vivo && r.ok && r.enPlan) setEnPlan(Object.fromEntries(r.enPlan.map((t) => [t.clave, t.hecha])));
    });
    return () => { vivo = false; };
  }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  const marcarTarea = useCallback(async (clave: string, hecha: boolean) => {
    setEnPlan((e) => ({ ...(e ?? {}), [clave]: hecha }));
    const r = await llamarTareas({ op: 'marcar', clave, hecha });
    if (!r.ok) { setEnPlan((e) => ({ ...(e ?? {}), [clave]: !hecha })); avisar(r.error || 'No pude marcarla en tu Plan.', 'bad'); }
  }, [avisar]);
  const avisoAccion = Object.values(tocan).reduce((a, b) => a + b, 0);
  const pantalla = `Marketing CoPilot · ${paso === 'piloto' ? 'Piloto automático' : 'Análisis y acción'} · ${TARJETAS.find(([k]) => k === tarjeta)?.[1]}`;

  const numeroDe = (t: Tarjeta): { n: string; de?: string; s: string } => {
    if (paso === 'piloto') {
      // Instagram y YouTube (14/11): lo que hace el piloto de verdad ahí (publicar, avisar, proponer), contado.
      if ((t === 'instagram' || t === 'youtube') && datos.pilotoRedes) {
        const k = cosasDelPiloto(t, datos.pilotoRedes).length;
        return { n: String(k), s: k === 1 ? 'cosa en marcha' : 'cosas en marcha' };
      }
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
      case 'web': {
        const p = datos.paginas[0];
        if (p?.score != null) return { n: p.score.toLocaleString('es', { maximumFractionDigits: 1 }), de: '/10', s: 'Tu página' };
        return datos.web.length ? { n: String(datos.web.length), s: datos.web.length === 1 ? 'página' : 'páginas' } : { n: '—', s: 'Sin tu web' };
      }
      case 'anuncios': return datos.anuncios.conectada ? { n: String(datos.anuncios.mejores.length), s: `con ${KPI[datos.anuncios.kpi]} este mes` } : { n: '—', s: 'Sin conectar' };
      default: { const r = datos.redes[t]; return r.length ? { n: '1', s: `@${r[0].usuario.replace(/^@/, '')}` } : { n: '—', s: 'Sin conectar' }; }
    }
  };

  return (
    <div className="frn frn--mono cop">
      <style>{CSS_COPILOTO}</style>
      <style>{CSS_OFFER}</style>
      <style>{CSS_EXTRA}</style>
      <style>{CSS_RETARGETING}</style>
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
              {tarjeta === 'anuncios' && datos.vsl && <TuVsl vsl={datos.vsl} />}
              {tarjeta === 'web' && (datos.paginas.length ? <AnalisisWeb paginas={datos.paginas} /> : <TarjetaWeb paso="analisis" web={datos.web} />)}
              {(tarjeta === 'instagram' || tarjeta === 'youtube') && <TarjetaRed red={tarjeta} paso="analisis" cuentas={datos.redes[tarjeta]} puntos={datos.propias?.[tarjeta]} />}
              {tarjeta === 'instagram' && <NumeroDelReelCard reel={datos.reel} />}
              {(tarjeta === 'instagram' || tarjeta === 'youtube') && <NeveraCard nevera={datos.nevera} formatos={tarjeta === 'youtube' ? ['video'] : ['reel', 'story', 'post']} />}
              <LoQueTeToca tareas={tareas[tarjeta]} enPlan={enPlan} onHecha={marcarTarea}
                onHacer={(t) => { if (t.abre === 'oc') { setParte(t.parte ?? 'oferta'); setTodo(true); } else if (t.abre === 'leer') void oc.leer(t.parte ?? 'angulos'); }} />
            </div>
          )}
          {paso === 'piloto' && tarjeta === 'anuncios' && datos.anuncios.conectada && !datos.anuncios.piloto?.encendido && <PrimeraVezPiloto />}
          {paso === 'piloto' && tarjeta === 'anuncios' && (!datos.anuncios.conectada || datos.anuncios.piloto?.encendido) && (
            <PilotoAnuncios conectada={datos.anuncios.conectada} existeTabla={datos.anuncios.existeTabla} piloto={datos.anuncios.piloto}
              decisiones={decisiones} onDecisiones={setDecisiones} avisar={avisar} />
          )}
          {paso === 'piloto' && tarjeta === 'anuncios' && <Retargeting vista={datos.retargeting} avisar={avisar} />}
          {paso === 'piloto' && (tarjeta === 'instagram' || tarjeta === 'youtube') && datos.pilotoRedes && <PilotoRed red={tarjeta} piloto={datos.pilotoRedes} />}
          {paso === 'piloto' && tarjeta !== 'anuncios' && !((tarjeta === 'instagram' || tarjeta === 'youtube') && datos.pilotoRedes) && <SinPiloto que={tarjeta === 'oferta' ? 'tu oferta' : tarjeta === 'web' ? 'tu web' : `tu ${NOMBRE_RED[tarjeta]}`} />}
        </div>
      </main>
      {todo && <ModalTodoOC estado={oc.estado} parte={parte} onParte={setParte} onCerrar={() => setTodo(false)} onMarcar={oc.marcar} onAbrir={(p, k) => setCosa({ p, k })} onChat={alChat} />}
      {cosa && <ModalCosa estado={oc.estado} p={cosa.p} k={cosa.k} onCerrar={() => setCosa(null)} onMarcar={oc.marcar} onChat={alChat} />}
      {!enTelefono && <MakoEnLaTab tab="Marketing CoPilot" pedido={pedido} pantalla={pantalla} encimaDeModales />}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// ── Lo que te toca, debajo del análisis (vuelta 20) ──────────────────────────
// Las arma lib/copiloto/tareas.ts con lo que falta de verdad en cada tarjeta, y viven en el Plan (lib/copiloto/tareas-plan.ts):
// marcar acá las completa allá, y al revés. Sin renglón gris debajo del título (Martín: «no pongas subtítulos abajo en ningún lugar»).

async function llamarTareas(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; enPlan?: Array<{ clave: string; hecha: boolean }> }> {
  try {
    return await (await fetch('/api/copiloto/tareas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'No pude conectarme.' }; }
}

function resumenParaTareas(datos: DatosCoPilot, oc: EstadoComunicacion): ResumenParaTareas {
  const faltan = (p: ParteOC) => Object.values(oc.cosas[p]).filter((c) => c.estado !== 'confirmada').length;
  const conectada = (r: 'instagram' | 'youtube') => datos.redes[r].some((c) => !c.vencida);
  return {
    oferta: { sesion: oc.sesion, notaOferta: !!oc.nota.oferta, notaAngulos: !!oc.nota.angulos, notaVoz: !!oc.nota.voz, faltan: { oferta: faltan('oferta'), angulos: faltan('angulos'), voz: faltan('voz') } },
    anuncios: { conectada: datos.anuncios.conectada, funnel: datos.funnel, semana: datos.tareas.map((t) => ({ titulo: t.titulo, href: t.href })) },
    web: datos.web,
    webArreglos: datos.paginas.flatMap((p) => p.hallazgos.filter((h) => h.severidad === 'alta').map((h) => ({ url: p.url, titulo: h.titulo }))),
    redes: { instagram: { conectada: conectada('instagram') }, youtube: { conectada: conectada('youtube') } },
    seguidos: datos.reel ? datos.reel.seguidos : null,
    propias: datos.propias,
    propuestas: datos.propuestas,
    nevera: datos.nevera ? { lunes: lunesDe(datos.nevera.hoy), avisos: datos.nevera.avisos } : undefined,
  };
}

function LoQueTeToca({ tareas, enPlan, onHecha, onHacer }: {
  tareas: TareaCoPilot[]; enPlan: Record<string, boolean> | null; onHecha: (clave: string, v: boolean) => void; onHacer: (t: TareaCoPilot) => void;
}) {
  if (!tareas.length) return null;
  return (
    <section className="frn-card mq-tetoca">
      <div className="frn-card__head"><h2 className="frn-card__t">Lo que te toca</h2>{enPlan && <Link className="frn-chip" href="/plan">Abrir mi Plan</Link>}</div>
      <ul className="cop-lista cop-tareas">
        {tareas.map((t) => {
          const lista = !!enPlan?.[t.clave];
          const enElPlan = enPlan != null && t.clave in enPlan;
          return (
            <li key={t.clave} data-hecha={lista}>
              <button type="button" className="cop-check" aria-pressed={lista} disabled={!enElPlan} aria-label={lista ? `Desmarcar «${t.titulo}»` : `Marcar «${t.titulo}» como hecha`} onClick={() => onHecha(t.clave, !lista)}>{lista ? '✓' : ''}</button>
              <div><b>{t.titulo}</b></div>
              <span className="cop-tarea__der">
                {enElPlan && <span className="cop-plan" title="Está en tu Plan: completarla aquí la completa allá">En tu Plan</span>}
                {lista ? null : t.abre === 'conectar' && t.red
                  ? <ConectarViaZernio red={t.red} volver={`/ads-manager/copiloto?tarjeta=${t.tarjeta}`} variant="secondary" size="sm">Hacerlo</ConectarViaZernio>
                  : t.href
                    ? <Link className="frn-btn frn-btn--ghost frn-btn--chico" href={t.href}>Hacerlo</Link>
                    : t.abre ? <button type="button" className="frn-btn frn-btn--ghost frn-btn--chico" onClick={() => onHacer(t)}>Hacerlo</button> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Con cuántas vistas se publica un reel de prueba (Martín, 13/11: nunca «graduar el reel de prueba»). MaKo propone el promedio de
 * las cuentas que sigues en Competitor Spy y la persona lo cambia en la configuración del piloto.
 */
function NumeroDelReelCard({ reel }: { reel: NumeroDelReel | null }) {
  if (!reel) return null;
  return (
    <section className="frn-card cop-reel">
      <div className="cop-reel__txt">
        <h2 className="frn-card__t">Un reel de prueba se publica con</h2>
        <p className="cop-reel__n frn-num">{reel.numero != null ? reel.numero.toLocaleString('es') : '—'}<span>vistas</span></p>
        <p className="cop-reel__x">{reel.elegido ? 'Lo elegiste tú.' : reel.explicacion}</p>
      </div>
      <div className="cop-acciones">
        {reel.seguidos > 0 && <Link className="frn-btn frn-btn--ghost" href="/ads-manager/copiloto/configurar?red=instagram">Cambiarlo</Link>}
        <Link className="frn-btn frn-btn--ghost" href="/competitor-spy?ver=seguidos">{reel.seguidos ? 'Ver los que sigues' : 'Elegir a quién sigues'}</Link>
      </div>
    </section>
  );
}

/**
 * La nevera de contenido (Martín, 13/11): cuánto hay listo para publicar, cuánto salió en 30 días y hasta cuándo alcanza. Lo listo es
 * lo que está en el Calendario con su archivo; lo que se grabó y no se programó no se ve.
 */
function NeveraCard({ nevera, formatos }: { nevera: Nevera | null; formatos: readonly FormatoNevera[] }) {
  if (!nevera) return null;
  const filas = nevera.filas.filter((f) => formatos.includes(f.formato));
  return (
    <section className="frn-card cop-nevera">
      <div className="frn-card__head"><h2 className="frn-card__t">Tu nevera de contenido</h2><Link className="frn-chip" href="/calendario">Abrir el Calendario</Link></div>
      <ul className="cop-nevera__lista">
        {filas.map((f) => (
          <li key={f.formato} data-falta={f.faltan > 0}>
            <b className="frn-num">{f.listas}</b>
            <span className="cop-nevera__que">{nombreFormato(f.formato, f.listas)} {f.formato === 'story' ? (f.listas === 1 ? 'lista' : 'listas') : (f.listas === 1 ? 'listo' : 'listos')}</span>
            <span className="cop-nevera__hasta">{f.hasta ? `Te alcanzan hasta ${diaCorto(f.hasta)}` : 'Nada listo para publicar'}</span>
            <span className="cop-nevera__pub">{f.publicadas30} {f.formato === 'story' ? 'publicadas' : 'publicados'} en 30 días</span>
          </li>
        ))}
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

// ── Tu VSL (14/11, lo prometido a Julio) ─────────────────────────────────────
// La curva del Pixel de MaKo en la landing del VSL (lib/copiloto/vsl.ts): cuánto sigue mirando en cada cuarto y UNA frase con dónde se
// va la gente. Sin eventos, «¿Dónde está tu VSL?»: pegar el Pixel y conectar Wistia, que es lo que hace falta para medirlo.
function TuVsl({ vsl }: { vsl: NonNullable<DatosCoPilot['vsl']> }) {
  const r = vsl.resumen;
  if (!r) {
    const host = vsl.landing ? vsl.landing.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'tu landing';
    return (
      <section className="frn-card cop-vacio">
        <h2 className="frn-card__t">¿Dónde está tu VSL?</h2>
        <p>Pega el Pixel de MaKo en {host} y te digo cuánto ven tu video y dónde se van.</p>
        <div className="cop-acciones">
          {/* El modal de cada integración, sin salir del CoPilot (tests/integracion-sin-salir.test.ts). */}
          <BotonIntegracion servicio="landing" className="frn-btn frn-btn--primary" style={CON_SU_CLASE}>Pegar el Pixel</BotonIntegracion>
          <BotonIntegracion servicio="wistia" className="frn-btn frn-btn--ghost" style={CON_SU_CLASE}>Conectar Wistia</BotonIntegracion>
        </div>
      </section>
    );
  }
  return (
    <section className="frn-card">
      <div className="frn-card__head"><h2 className="frn-card__t">Tu VSL{r.titulo ? `: ${r.titulo}` : ''}</h2></div>
      <div className="cop-vsl" role="img" aria-label={r.cuartos.map((c) => `${c.corte} % del video: ${c.porcentaje} % mirando`).join(', ')}>
        {r.cuartos.map((c) => (
          <div key={c.corte} className="cop-vsl__col">
            <b className="frn-num">{c.porcentaje} %</b>
            <span className="cop-vsl__barra"><i style={{ height: `${Math.max(2, Math.min(100, c.porcentaje))}%` }} /></span>
            <span className="cop-vsl__corte">{c.corte === 0 ? 'Inicio' : c.corte === 100 ? 'Final' : `${c.corte} %`}</span>
          </div>
        ))}
      </div>
      <p className="cop-reel__x">{r.frase}</p>
    </section>
  );
}

// ── La Web, como análisis (Martín, 13/11: «Oferta y Web se quedan en CoPilot como análisis») ───────────
// Lo último que analizó el Landing Analyst de cada página: la nota, el veredicto y lo más grave, con su arreglo. Se trabaja en
// Web Generator, con la página y sus comentarios (`?analizar=`).

const ETIQUETA_SEVERIDAD: Record<PaginaAnalizada['hallazgos'][number]['severidad'], string> = { alta: 'Arreglar', media: 'Mejorar', baja: 'Detalle' };

function AnalisisWeb({ paginas }: { paginas: PaginaAnalizada[] }) {
  return (
    <>
      {paginas.map((p) => (
        <section key={p.url} className="frn-card cop-web">
          <div className="frn-card__head">
            <h2 className="frn-card__t">{p.titulo || p.url.replace(/^https?:\/\//, '')}</h2>
            <Link className="frn-chip" href={`/web-generator?analizar=${encodeURIComponent(p.url)}`}>Ver la página con sus comentarios</Link>
          </div>
          <div className="cop-web__cab">
            {p.score != null && <p className="cop-web__n frn-num">{p.score.toLocaleString('es', { maximumFractionDigits: 1 })}<span>/10</span></p>}
            {p.veredicto && <p className="cop-web__v">{p.veredicto}</p>}
          </div>
          {p.hallazgos.length > 0 && (
            <ul className="cop-web__lista">
              {p.hallazgos.map((h, i) => (
                <li key={i} data-sev={h.severidad}>
                  <span className="cop-web__sev">{ETIQUETA_SEVERIDAD[h.severidad]}</span>
                  <div><b>{h.titulo}</b>{h.arreglo && <p>{h.arreglo}</p>}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
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
function TarjetaRed({ red, paso, cuentas, puntos }: { red: 'instagram' | 'youtube'; paso: Paso; cuentas: Array<{ usuario: string; vencida: boolean }>; puntos?: PuntoRed[] }) {
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
      {/* Lo que leyó de su cuenta (14/11, lib/copiloto/redes-propias-reglas.ts): una frase por punto, lo que está a tocar también en «Lo que te toca». */}
      {paso === 'analisis' && puntos && puntos.length > 0 ? (
        <ul className="cop-puntos">
          {puntos.map((p) => <li key={p.clave} data-bien={p.bien}><span className="cop-puntos__m" aria-label={p.bien ? 'Bien' : 'A tocar'}>{p.bien ? '✓' : '!'}</span>{p.texto}</li>)}
        </ul>
      ) : <p>{paso === 'analisis'
        ? `Tu ${NOMBRE_RED[red]} está conectado. Para leer tus publicaciones una por una, ábrelo en Competitor Spy con tu propia cuenta.`
        : red === 'instagram' ? 'Lo que publicas se arma en Carruseles y en Copywriting, y se programa en el Calendario.' : 'Tus videos se arman en Copywriting y se programan en el Calendario.'}</p>}
      <div className="cop-acciones">
        {paso === 'analisis'
          ? <Link className="frn-btn frn-btn--primary" href="/competitor-spy">Leer mi {NOMBRE_RED[red]}</Link>
          : <><Link className="frn-btn frn-btn--primary" href="/calendario">Abrir el Calendario</Link><Link className="frn-btn frn-btn--ghost" href="/copywriter">Abrir Copywriting</Link></>}
      </div>
    </section>
  );
}

// ── El piloto de Instagram y YouTube (14/11) ─────────────────────────────────
// Lo que MaKo hace de verdad en cada red, en frases cortas: publicar lo programado, avisar si se acaba el contenido y proponer (como
// tarea del Plan) lo que todavía no puede hacer solo. Se configura en ./configurar (pestañas Instagram y YouTube).
type PilotoRedesVista = NonNullable<DatosCoPilot['pilotoRedes']>;
function cosasDelPiloto(red: 'instagram' | 'youtube', p: PilotoRedesVista): string[] {
  const out = ['Publico lo que programas en el Calendario.'];
  if (p.avisoNevera) out.push('Te aviso por WhatsApp y email si se acaba el contenido.');
  if (red === 'instagram') {
    if (p.instagram.proponerHook) out.push(`Cada semana te propongo ${p.instagram.variaciones} variaciones del hook de tu reel más visto.`);
    if (p.instagram.proponerCarrusel) out.push('Te propongo pasar a carrusel el reel que supera tu número.');
    if (p.instagram.reelDePrueba === 'solo') out.push('Tus reels salen primero como reel de prueba, y los paso al feed si les va bien.');
    if (p.instagram.reelDePrueba === 'pregunta') out.push('Tus reels salen primero como reel de prueba: tú decides cuándo pasan al feed.');
  } else if (p.youtube.proponerShorts && p.youtube.shortsPorVideo > 0) {
    out.push(`Te propongo sacar ${p.youtube.shortsPorVideo} shorts de cada video largo.`);
  }
  return out;
}
function PilotoRed({ red, piloto }: { red: 'instagram' | 'youtube'; piloto: PilotoRedesVista }) {
  const ig = piloto.instagram, yt = piloto.youtube;
  const ritmo = red === 'instagram'
    ? `Tu ritmo: ${ig.reelsSemana} reels, ${ig.carruselesSemana} ${ig.carruselesSemana === 1 ? 'carrusel' : 'carruseles'} y ${ig.historiasSemana} historias por semana.`
    : `Tu ritmo: ${yt.largosMes} ${yt.largosMes === 1 ? 'video largo' : 'videos largos'} por mes.`;
  return (
    <section className="frn-card">
      <div className="frn-card__head">
        <h2 className="frn-card__t">Qué hago en tu {NOMBRE_RED[red]}</h2>
        <Link className="frn-btn frn-btn--ghost frn-btn--chico" href={`/ads-manager/copiloto/configurar?red=${red}`}>Configurar</Link>
      </div>
      <ul className="cop-puntos">
        {cosasDelPiloto(red, piloto).map((t) => <li key={t} data-bien="true"><span className="cop-puntos__m" aria-hidden="true">✓</span>{t}</li>)}
        <li data-bien="true"><span className="cop-puntos__m" aria-hidden="true">✓</span>{ritmo}</li>
      </ul>
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
