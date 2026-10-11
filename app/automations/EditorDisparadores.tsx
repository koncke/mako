'use client';

// =============================================================================
// EditorDisparadores — el panel del CRON: varios CRON, y cada uno de su tipo
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026), FEEDBACK DE CRON, literal:
//   1. «El editor del CRON como muchos otros siguen teniendo mucho espacio en blanco. Haz los botones
//      gigantes, y reduce el espacio de ser necesario.»
//   2. «En la tab principal de CRON que hoy comienza con "Por tiempo" y "Por una acción", reemplaza eso
//      por lo que ya tenemos "Producto", "Recurrente", "Etiqueta" y agrega una nueva "Instagram".»
//   3. «"Etiqueta" sale del desplegable de producto, es un CRON aparte... agrega las opciones "Se
//      agrega etiqueta a un lead" y "Se elimina etiqueta a un lead"... pon la opción de "Ignorar"».
//   6, 7, 8. Los eventos de Instagram y de Messenger que ofrece ManyChat, y el Email.
//   9. El Recurrente como el diálogo del Plan (EditorRecurrente.tsx) y «A quién» de selección
//      múltiple con «El grupo de MaKo».
//   10. «agrega la opción de tener más de un CRON».
//
// LO QUE VIVE ACÁ: la primera pantalla (seis botones gigantes), el editor de cada tipo, el estado de
// la LISTA (`useDisparadores`: optimista, guardada UNA vez con respiro, con la vuelta si el server dice
// que no) y lo que dice cada fila de la tarjeta (`useTextoDisparador`). La tarjeta CRON del lienzo la
// dibuja FlujoLienzo con las props `disparadores` / `onNuevoDisparador` / `onAbrirDisparador`, que
// llena SecuenciaPerfil. El modelo y sus reglas, en lib/disparadores.ts (puro, con test).
//
// ⚠️ UN CRON NUEVO NO SE GUARDA HASTA QUE ESTÁ COMPLETO (`problemaDeDisparador`): un «Producto» sin
// etapa, un «Recurrente» sin a quién o un «Instagram» sin evento no disparan nunca, y guardarlos
// dejaría en la tarjeta una fila que no hace nada. Mientras tanto vive en el editor (`borrador`). Lo
// mismo al cambiarle el TIPO a uno que ya existe: el de antes sigue guardado hasta que el nuevo
// tenga lo suyo — «elegir otra cosa» no apaga nada por sí solo.
//
// ⚠️ UN CRON DEL EMISOR VA SOLO Y NO SE CAMBIA (11/10/2026, docs/diseno-mako-en-whatsapp-unificado.md): el
// recordatorio de la reunión y el «Evento de MaKo» (`esDelEmisor`, lib/disparadores.ts) los manda su emisor,
// no el motor. Con uno de ésos el panel no ofrece «＋ Nuevo CRON» (un segundo CRON lo inscribiría el motor
// ADEMÁS) ni la «←» (cambiarle la clase dejaba la fila sin lo que su emisor lee): dice lo que lo dispara y
// nada más. El server lo frena igual (`problemaDeDisparadores` / `problemaDeCambio`): esto es para no ofrecer
// un control que va a contestar que no.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
// «Conectar» AHÍ MISMO (décima tanda, GENERAL 6): el email en el modal de la tab; y conectar algo vacía la
// lectura de los canales de la visita (`canalesDeLaVisita`), o el CRON seguiría diciendo «Conecta tu…».
import { ConectarMedio, avisarMedioConectado, useAlConectarMedio } from './ConectarMedio';
import { botonGrande } from '@/app/_components/Lienzo';
import { EditorRecurrente } from './EditorRecurrente';
import { IconoDisparador, IconoEvento } from './IconosDisparador';
// La papelera de la casa, roja siempre (sexta tanda, general 9): UNA definición para toda la app.
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { NuevoPlaceholder } from './NuevoPlaceholder';
import { CRON_DEFAULT } from '@/app/_components/EditorCron';
import {
  CLASES_DISPARADOR, claseDeDisparador, eventosDe, triggerDeCanal, esClaseDeEventos, borradorDeClase, conDisparo, disparoActualDe, esDelEmisor, esEventoDeAntes,
  disparadoresDe, sanearDisparadores, firmaLista, nuevoIdDisparador, problemaDeDisparador, textoDeDisparador,
  valoresQuien, quienTrasTocar, valorEtiqueta, conValorEtiqueta, alternarIgnorar, textoQuien, VALOR_GRUPO,
  VALOR_ETIQUETA_AGREGADA, VALOR_ETIQUETA_QUITADA, TEXTO_ETIQUETA_AGREGADA, TEXTO_ETIQUETA_QUITADA, TEXTO_GRUPO,
  TRIGGER_ETIQUETA_AGREGADA, TRIGGER_ETIQUETA_QUITADA,
  type ClaseDisparador, type ClaseDeEventos, type Disparador, type EstadoCanales,
} from '@/lib/disparadores';
import {
  pasosDisparo, valorDisparo, valoresDisparo, valoresTrasTocar, valorDeVarios, disparoDeValor, rotuloDisparo,
  detalleDisparador, nombreEtiqueta, PASO_PRODUCTOS, type DisparoActual, type SeccionDisparo,
} from '@/lib/flujo-conversacion';
import { etapasDe } from '@/lib/nutricion-etapa';
import { scrollParaVer } from '@/lib/lienzo-grafo';
import type { CronAviso } from '@/lib/cron-aviso';
import type { Opcion, ProductoOpcion, SecuenciaDto } from './ChatAgentApp';
import type { EtiquetaLienzo } from './FlujoLienzo';

const SANS = "'Geist', sans-serif";

/** La fila del GET, con lo que la 0241 le suma (el server la arma con `disparadoresDe`). */
export type SecuenciaConDisparadores = SecuenciaDto & { disparadores?: unknown; cron_proxima_at?: string | null };

/** La lista de CRON de una automatización tal como llega: la del server o, con un server de antes, la de sus columnas. */
export function disparadoresDeSecuencia(s: SecuenciaConDisparadores): Disparador[] {
  const delServer = sanearDisparadores(s.disparadores);
  if (delServer.length) return delServer;
  return disparadoresDe({
    trigger_tipo: s.trigger_tipo, etapa: s.etapa, etapas: s.etapas ?? null, funnel_id: s.funnel_id ?? null,
    producto_id: s.producto_id ?? null, etiqueta_id: s.etiqueta_id ?? null, cron: s.cron ?? null, cron_proxima_at: s.cron_proxima_at ?? null,
  });
}

/**
 * ⚠️ `disparoDeSecuencia` y `firmaDisparo` (las del CRON ÚNICO, que vivían en SecuenciaPerfil) se
 * fueron: la pantalla se vuelve a sembrar comparando la firma de la LISTA (`firmaLista`,
 * lib/disparadores.ts), que mira las etapas que DISPARAN igual que lo hacían esas dos — la relectura trae
 * `[]` y lo pintado al elegir una sola trae `null`, y son el mismo CRON.
 */

/**
 * Cuánto espera el CRON antes de guardar (cuarta tanda, punto 14). Con varias etapas cada toque cambia
 * el conjunto: guardar cada uno eran N pedidos, y la relectura del primero volvía a sembrar el
 * desplegable con un conjunto viejo mientras la persona seguía tocando. Con el respiro sale UN pedido
 * con la lista final.
 */
export const RESPIRO_DISPARO_MS = 500;

async function api(body: unknown): Promise<{ ok: boolean; error?: string; disparadores?: unknown }> {
  try { return await (await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false, error: 'sin conexión' }; }
}

/**
 * LA LISTA DE CRON DE UNA AUTOMATIZACIÓN, COMO LA VE LA PANTALLA: optimista y guardada UNA vez por
 * respiro (POST `action: 'disparadores'`, lib/disparadores-guardar.ts).
 *
 * ⚠️ SE VUELVE A SEMBRAR CUANDO EL SERVER LA CAMBIA (revisión de la segunda tanda: «Crear con IA»
 * guarda el disparador en el server sin remontar el lienzo), comparando la firma EN EL RENDER (un
 * efecto pintaría primero lo viejo) — y mientras haya un guardado en camino NO se siembra: la
 * relectura traería la lista de antes del último toque y le borraría a la persona lo que acaba de
 * elegir (cuarta tanda, punto 14).
 */
export function useDisparadores(secuencia: SecuenciaConDisparadores, o: { onCambio: () => void; onError: (m: string | null) => void }) {
  const firmaProp = firmaLista(disparadoresDeSecuencia(secuencia));
  const [lista, setLista] = useState<Disparador[]>(() => disparadoresDeSecuencia(secuencia));
  const [firmaVista, setFirmaVista] = useState(firmaProp);
  const [guardando, setGuardando] = useState(false);
  if (firmaProp !== firmaVista) {
    setFirmaVista(firmaProp);
    if (!guardando) setLista(disparadoresDeSecuencia(secuencia));
  }
  /** Lo último que el server confirmó: a esto vuelve la pantalla si el guardado falla. */
  const confirmada = useRef<Disparador[]>(lista);
  /** El guardado que espera su respiro, con lo que va a mandar. */
  const pendiente = useRef<{ t: ReturnType<typeof setTimeout>; body: Record<string, unknown> } | null>(null);
  const cb = useRef(o);
  useEffect(() => { cb.current = o; });
  useEffect(() => {
    if (!pendiente.current) confirmada.current = disparadoresDeSecuencia(secuencia);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaProp]);
  // Al irse (cambió de automatización) lo que esperaba su respiro se manda igual: la persona ya lo eligió.
  useEffect(() => () => {
    const p = pendiente.current;
    if (p) { clearTimeout(p.t); pendiente.current = null; void api(p.body); }
  }, []);
  const mandar = async (body: Record<string, unknown>) => {
    const j = await api(body);
    // Si la persona tocó algo más mientras volvía este, decide el que viene.
    if (pendiente.current) return;
    setGuardando(false);
    if (!j.ok) { setLista(confirmada.current); cb.current.onError(j.error ?? 'No se pudo guardar el CRON'); return; }
    const vuelta = sanearDisparadores(j.disparadores);
    confirmada.current = vuelta.length ? vuelta : (body.disparadores as Disparador[]);
    if (vuelta.length) setLista(vuelta);
    cb.current.onError(null);
    cb.current.onCambio();
  };
  /** Pinta la lista nueva en el acto y la guarda una vez, después del respiro. */
  const guardar = (nueva: Disparador[]) => {
    setLista(nueva);
    setGuardando(true);
    if (pendiente.current) clearTimeout(pendiente.current.t);
    const body = { action: 'disparadores', secuenciaId: secuencia.id, disparadores: nueva };
    const t = setTimeout(() => { pendiente.current = null; void mandar(body); }, RESPIRO_DISPARO_MS);
    pendiente.current = { t, body };
  };
  /** Lo que eligió «Crear con IA» para el primero (ya guardado en el server): sólo se pinta. */
  const sembrarPrimero = (a: DisparoActual) => setLista((l) => (l.length ? [conDisparo(l[0], a), ...l.slice(1)] : l));
  return { lista, guardar, sembrarPrimero, primero: lista[0] ?? disparadoresDeSecuencia(secuencia)[0] };
}

/**
 * LO QUE DICE CADA CRON (la fila de la tarjeta y el botón del desplegable), con los nombres de las
 * etapas y las etiquetas. Las etapas se buscan en el kanban de SU ámbito (el embudo o el producto) y no
 * en la bolsa de todas: dos productos pueden tener una etapa con la misma clave y otro nombre.
 */
export function useTextoDisparador(p: {
  productos: readonly ProductoOpcion[]; etiquetas: readonly EtiquetaLienzo[]; disparadores: readonly Opcion[];
  etiquetaEtapa: (key: string) => string; tz: string | null;
}): { texto: (d: Disparador) => string; deSiempre: (d: Disparador) => string } {
  const todas = useMemo(() => p.productos.flatMap((pr) => [...pr.etapas, ...pr.etapasEntrega]), [p.productos]);
  const deSiempre = (d: Disparador): string => {
    const kanban = d.trigger_tipo === 'etapa_actual'
      ? p.productos.find((pr) => pr.funnelId != null && pr.funnelId === d.funnel_id)?.etapas ?? null
      : d.trigger_tipo === 'entrega_actual'
        ? p.productos.find((pr) => pr.productoId != null && pr.productoId === d.producto_id)?.etapasEntrega ?? null
        : null;
    const nombreDe = (k: string) => (kanban ?? todas).find((e) => e.value === k)?.label ?? p.etiquetaEtapa(k);
    const puestas = etapasDe({ etapa: d.etapa ?? null, etapas: d.etapas ?? null });
    return detalleDisparador({
      trigger_tipo: d.trigger_tipo, etapa: d.etapa ?? null, cron: null,
      etiquetaTrigger: p.disparadores.find((x) => x.value === d.trigger_tipo)?.label ?? null,
      nombreEtapa: d.etapa ? nombreDe(d.etapa) : null,
      nombreEtiqueta: nombreEtiqueta(p.etiquetas, d.etiqueta_id ?? null),
      nombresEtapas: puestas.map(nombreDe),
      todas: !!kanban && puestas.length >= 3 && kanban.every((e) => puestas.includes(e.value)),
    });
  };
  return { deSiempre, texto: (d) => textoDeDisparador(d, { deSiempre, tz: p.tz }) };
}

// ── Las piezas de la pantalla ───────────────────────────────────────────────────────────────────

/** EL CAMPO GRANDE de un desplegable del CRON (cuarta tanda, punto 1): el protagonista del panel. */
export const BOTON_CAMPO_CRON: CSSProperties = { ...botonGrande };

/** Un ícono de línea para un renglón de un desplegable (`DropdownOption.icono` acepta un `data:`). */
const iconoData = (path: string, color = '#64748B') =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`)}`;
const ICONO_TAG = '<path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0Z"/><circle cx="8.3" cy="8.3" r="1.5"/>';
const ICONO_TAG_MAS = `${ICONO_TAG}<path d="M17 3v5M14.5 5.5h5"/>`;
const ICONO_TAG_MENOS = `${ICONO_TAG}<path d="M14.5 5.5h5"/>`;
const ICONO_GRUPO = '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.5 14.4a4.6 4.6 0 0 1 6 4.6"/>';

/** La flecha para volver a elegir el tipo (el de antes sigue guardado hasta que el nuevo esté completo). */
function Volver({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title="Elegir otro tipo" aria-label="Elegir otro tipo"
      style={{ flex: 'none', width: 34, height: 34, borderRadius: 9, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
  );
}

/**
 * «＋ Nuevo CRON», tipo placeholder (CONDITION punto 4) y con la animación de «＋ Nueva automatización»
 * (10/10/2026, CRON 1). Desde el 10/10 es un RECUADRO más de la lista de CRON (CRON 3): llena lo que le
 * toca del panel, como el del CRON de arriba.
 */
function NuevoCron({ onClick }: { onClick: () => void }) {
  return <NuevoPlaceholder texto="Nuevo CRON" onClick={onClick} style={{ flex: 1, minHeight: ALTO_RECUADRO_CRON }} />;
}

/** El alto mínimo de cada recuadro de CRON: con más de dos, la lista scrollea (CRON 3). */
const ALTO_RECUADRO_CRON = 150;
/** El alto de cada uno de los seis botones de la primera pantalla (décima tanda, CRON 1: eran 92). */
export const ALTO_BOTON_CLASE = 76;

/**
 * LA PRIMERA PANTALLA: seis botones gigantes con su ícono (CRON puntos 1 y 2). En una grilla de tres,
 * sin rótulos ni frases: el ícono y el nombre dicen qué es cada uno.
 */
/**
 * ⚠️ SIN FLECHA PARA VOLVER (10/10/2026, CRON 2: «la flecha para ir hacia atrás es infinita... Si llego al
 * primer paso sigue estando... No debería»). Ésta ES la primera pantalla. La clase que el CRON ya tiene va
 * MARCADA (CRON 4: «si le pongo a la flecha de atrás, que esté marcado la opción que había elegido») y
 * tocarla vuelve a su editor tal cual (lo decide quien monta), sin empezar de cero.
 */
/**
 * ⚠️ ADENTRO DE SU RECUADRO, SIEMPRE (décima tanda, CRON 1, 11/10/2026: «al editar el CRON en el primer paso,
 * se sobre sale del recuadro, eso no debe pasar»). Los seis botones medían 92 de alto (dos filas: 194 con el
 * aire) y el recuadro del CRON, con «＋ Nuevo CRON» al lado, llenaba la MITAD del panel con un piso de 150 que
 * le ganaba al alto de su contenido: los botones salían por abajo. Ahora la grilla es más baja (76) y el
 * recuadro nunca mide menos que lo que tiene adentro (`flex: 1 0 auto`, ver `recuadro`): si no entra, la lista
 * scrollea. Y el texto no empuja el ancho (`minWidth: 0`, se parte la palabra antes que desbordar).
 *
 * ⚠️ SIETE BOTONES EN 4+3 (11/10/2026): «Pagos» es un botón propio (decisión de Martín). En la grilla de 3
 * quedaba 3+3+1 —un botón solo en una tercera fila, que se ve roto—, así que son CUATRO columnas: dos filas,
 * el mismo alto que antes, y la letra un punto más chica para que «Recurrente» entre en la columna angosta.
 */
export function ElegirClase({ onElegir, disabled, actual }: { onElegir: (c: ClaseDisparador) => void; disabled?: boolean; actual?: ClaseDisparador | 'otro' | null }) {
  return (
    <div role="group" aria-label="Qué dispara esta automatización" data-cron-clases style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, minWidth: 0 }}>
      {CLASES_DISPARADOR.map((c) => {
        const on = actual === c.clase;
        return (
          <button key={c.clase} type="button" onClick={() => onElegir(c.clase)} disabled={disabled} data-clase-cron={c.clase} aria-pressed={on}
            style={{
              minHeight: ALTO_BOTON_CLASE, minWidth: 0, padding: '10px 6px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
              background: on ? 'var(--primary-bg)' : 'var(--surface)', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer',
              fontFamily: SANS, fontSize: 13, fontWeight: 700, lineHeight: 1.2, textAlign: 'center', overflowWrap: 'anywhere',
              color: on ? 'var(--primary)' : 'var(--ink)', transition: 'border-color .12s, box-shadow .12s, transform .12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,.07)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = on ? 'var(--primary)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <IconoDisparador tipo={c.clase} tam={32} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** ¿Están conectados los canales? Se pregunta UNA vez por visita y sólo al abrir uno (le pregunta a Meta). */
let canalesDeLaVisita: Promise<EstadoCanales | null> | null = null;
function useEstadoCanales(activo: boolean): EstadoCanales | null | undefined {
  const [estado, setEstado] = useState<EstadoCanales | null | undefined>(undefined);
  // Algo se conectó (acá o en otra pantalla de la tab): la lectura de la visita ya no vale.
  const [vuelta, setVuelta] = useState(0);
  useAlConectarMedio(() => { canalesDeLaVisita = null; setVuelta((v) => v + 1); });
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    canalesDeLaVisita ??= fetch('/api/chat-agent/secuencias?canales=1', { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      .then((r) => r.json()).then((j: { ok?: boolean; canales?: EstadoCanales }) => (j?.ok && j.canales ? j.canales : null))
      .catch(() => null);
    void canalesDeLaVisita.then((c) => { if (vivo) setEstado(c); if (!c) canalesDeLaVisita = null; });
    return () => { vivo = false; };
  }, [activo, vuelta]);
  return estado;
}

/**
 * La página de Facebook (lo que ESCUCHA un CRON de Instagram o Messenger) se conecta con Meta en
 * /integraciones, que no cabe en un modal: se abre en una VENTANA EMERGENTE —la pestaña de Automations sigue
 * ahí— y al cerrarla se vuelve a preguntar. Con el `?ws=` (AGENTS.md: un `window.open` también navega).
 */
function abrirIntegraciones(ws: number | null) {
  const v = window.open(conWs('/integraciones', ws), 'mako-integraciones', 'width=1100,height=820');
  if (!v) { window.open(conWs('/integraciones', ws), '_blank'); return; }
  const t = window.setInterval(() => { if (v.closed) { window.clearInterval(t); avisarMedioConectado(); } }, 1000);
}

/**
 * LOS EVENTOS DE UN CANAL (Instagram, Messenger, Email: CRON puntos 6, 7 y 8; y Pagos), en una grilla de dos
 * columnas: el ícono del evento y la frase de ManyChat. Los que ManyChat apaga (los de anuncios) van
 * apagados con su motivo; con el canal SIN conectar, todos, con el motivo arriba y el link a donde se
 * conecta. «No pude comprobarlo» (`conectado: null`) también los apaga: un evento que no puede llegar
 * es una automatización que no arranca nunca.
 */
export function EventosDeCanal({ clase, d, estado, onElegir, disabled }: {
  clase: ClaseDeEventos; d: Disparador; estado: EstadoCanales | null | undefined;
  onElegir: (subtipo: string) => void; disabled?: boolean;
}) {
  const canal = estado?.[clase];
  const cargando = estado === undefined;
  const conectado = canal?.conectado === true;
  const motivo = cargando ? null : estado === null ? 'No pude comprobarlo' : (!conectado ? (canal?.motivo ?? 'Sin conectar') : null);
  const ws = useWs();
  /** El modal del email abierto (ConectarMedio). */
  const [conectarEmail, setConectarEmail] = useState(false);
  const boton: CSSProperties = { border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {motivo && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--warn)', fontFamily: SANS }}>
          <span>{motivo}</span>
          {/* «CONECTAR» SIN SALIR DE LA PESTAÑA (décima tanda, GENERAL 6): eran dos links a /email y a
              /integraciones. El email, en el modal de la tab; la página de Facebook, en una ventana emergente
              (el `href` queda para el clic del medio, con el `?ws=`). */}
          {canal?.conectado === false && (clase === 'email'
            ? <button type="button" data-conectar-canal="email" aria-haspopup="dialog" onClick={() => setConectarEmail(true)} style={boton}>Conectar</button>
            : <a href={conWs('/integraciones', ws)} data-conectar-canal={clase} target="_blank" rel="noopener"
              onClick={(e) => { e.preventDefault(); abrirIntegraciones(ws); }} style={{ color: 'var(--primary)', fontWeight: 600 }}>Conectar</a>)}
        </div>
      )}
      {conectarEmail && <ConectarMedio medio="email" onCerrar={() => setConectarEmail(false)} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {eventosDe(clase).map((ev) => {
          const elegido = d.subtipo === ev.subtipo;
          const apagado = !!ev.apagado || !conectado;
          return (
            <button key={ev.subtipo} type="button" disabled={disabled || (apagado && !elegido)} onClick={() => onElegir(ev.subtipo)} aria-pressed={elegido}
              title={ev.apagado ?? (motivo ?? undefined)}
              style={{
                minHeight: 50, padding: '8px 10px', borderRadius: 11, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9,
                border: `1.5px solid ${elegido ? 'var(--primary)' : 'var(--border)'}`, background: elegido ? 'var(--primary-bg)' : 'var(--surface)',
                color: apagado ? 'var(--faint)' : 'var(--ink)', cursor: apagado && !elegido ? 'default' : 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                opacity: apagado && !elegido ? 0.6 : 1,
              }}>
              <span style={{ flex: 'none', color: elegido ? 'var(--primary)' : 'var(--dim)', display: 'inline-flex' }}><IconoEvento subtipo={ev.subtipo} /></span>
              <span style={{ minWidth: 0 }}>
                {ev.label}
                {ev.apagado && <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--faint)' }}>{ev.apagado}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type PropsEditorDisparadores = {
  lista: readonly Disparador[];
  /** El CRON abierto: su id, 'nuevo' (el «＋ Nuevo CRON»), o null (el primero). */
  editando: string | 'nuevo' | null;
  onEditar: (id: string | 'nuevo' | null) => void;
  /** Guarda la lista entera (optimista, con respiro: `useDisparadores`). */
  onGuardar: (lista: Disparador[]) => void;
  productos: readonly ProductoOpcion[];
  etiquetas: readonly EtiquetaLienzo[];
  /** El catálogo de los disparadores de siempre (`TRIGGERS`): con eso se dice uno de antes. */
  disparadores: readonly Opcion[];
  etiquetaEtapa: (key: string) => string;
  /** La zona del negocio. */
  tz: string | null;
  busy?: boolean;
  rolAdmin: boolean;
  /** Lo que va debajo de todo (lo que es de la automatización y no de un CRON). */
  pie?: ReactNode;
  /** El tipo ya elegido en el modal de «＋ Nueva automatización»: el panel abre en su editor. */
  claseInicial?: ClaseDisparador | null;
  onClaseInicialUsada?: () => void;
};

/**
 * EL PANEL DEL CRON. Arriba, con DOS o más, una pastilla por CRON (y su papelera, roja); abajo, el
 * editor del que está abierto, y «＋ Nuevo CRON».
 */
export function EditorDisparadores(p: PropsEditorDisparadores) {
  const { lista, editando, onEditar, onGuardar, rolAdmin, busy } = p;
  const textos = useTextoDisparador(p);
  /**
   * El CRON que se está armando (uno nuevo, o el tipo nuevo de uno que ya existe) hasta que esté
   * completo, y su CLASE: un «Producto» o una «Etiqueta» recién elegidos todavía no tienen tipo de
   * disparo (son `manual`), así que la clase no se puede deducir del dato.
   */
  const [borrador, setBorrador] = useState<{ d: Disparador; clase: ClaseDisparador } | null>(() => {
    if (!p.claseInicial) return null;
    // Sobre el CRON a elegir de la recién creada (el `manual` de «＋ Nueva»), no uno más.
    const id = p.lista[0]?.id ?? nuevoIdDisparador([]);
    return { d: borradorDeClase(p.claseInicial, id, CRON_DEFAULT), clase: p.claseInicial };
  });
  useEffect(() => { if (p.claseInicial) p.onClaseInicialUsada?.(); /* una vez, al abrir */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Volver a la primera pantalla sin tocar lo guardado. */
  const [eligiendo, setEligiendo] = useState(false);
  // Cambiar de CRON (otra pastilla, la tarjeta) descarta lo que se estaba armando en el otro.
  const [editandoVisto, setEditandoVisto] = useState(editando);
  if (editandoVisto !== editando) { setEditandoVisto(editando); setBorrador(null); setEligiendo(false); }

  const abierto: Disparador | null = editando === 'nuevo' ? null : (lista.find((d) => d.id === editando) ?? lista[0] ?? null);
  const actual = borrador?.d ?? abierto;
  const clase = borrador?.clase ?? (actual ? claseDeDisparador(actual) : null);
  const unico = lista.length <= 1 && editando !== 'nuevo';
  /** El CRON es del EMISOR (el recordatorio, un evento de MaKo): va solo y no se cambia (ver la cabecera). */
  const fijo = esDelEmisor(lista[0]);
  const elegirTipo = eligiendo || !actual || clase === null;
  const estadoCanales = useEstadoCanales(esClaseDeEventos(clase ?? null));
  /**
   * AL ABRIR UN CRON, LA LISTA VA HASTA ÉL (décima tanda, CRON 3: «Si le doy a "Nuevo CRON" me debe desplazar
   * con el scroll hacia allí para editarlo. Lo mismo que si estoy editando un CRON y selecciono el de arriba o
   * de abajo, siempre me debe desplazar hacia donde esté parado»). Cuando cambia el abierto —«＋ Nuevo CRON»,
   * tocar otro recuadro o su cajita en la tarjeta del lienzo— se scrollea ESTA lista (`scrollParaVer`,
   * lib/lienzo-grafo.ts, con test) y nunca con `scrollIntoView`, que movería también la caja del lienzo.
   *
   * ⚠️ ANTES DEL `return` de quien sólo mira (AGENTS.md: un hook detrás de un return temprano).
   */
  const listaRef = useRef<HTMLDivElement | null>(null);
  const claveAbierta = editando === 'nuevo' ? 'nuevo' : (editando ?? lista[0]?.id ?? null);
  useEffect(() => {
    const cont = listaRef.current;
    if (!cont || claveAbierta == null) return;
    const el = [...cont.querySelectorAll<HTMLElement>('[data-cron-recuadro]')].find((x) => x.getAttribute('data-cron-recuadro') === claveAbierta);
    if (!el) return;
    const rc = cont.getBoundingClientRect();
    const re = el.getBoundingClientRect();
    const nuevo = scrollParaVer({ top: re.top - rc.top + cont.scrollTop, alto: re.height }, { scrollTop: cont.scrollTop, alto: cont.clientHeight });
    if (nuevo != null) cont.scrollTo({ top: nuevo, behavior: 'smooth' });
  }, [claveAbierta]);

  /** Aplica un cambio: completo, se guarda (reemplaza o se suma); incompleto, queda en el editor. */
  const aplicar = (d: Disparador, claseDe: ClaseDisparador | null = clase === 'otro' ? null : clase) => {
    // ⚠️ «A mano» (`manual`) es completo SÓLO si es el único y nadie eligió nada: un Producto o una
    // Etiqueta recién elegidos también son `manual` y no se guardan hasta tener lo suyo.
    if (problemaDeDisparador(d, { unico }) || (d.trigger_tipo === 'manual' && !d.cron)) {
      if (claseDe) setBorrador({ d, clase: claseDe });
      return;
    }
    const existe = lista.some((x) => x.id === d.id);
    const nueva = existe ? lista.map((x) => (x.id === d.id ? d : x)) : [...lista, d];
    setBorrador(null);
    setEligiendo(false);
    onGuardar(nueva);
    if (!existe) onEditar(d.id);
  };
  const elegirClase = (c: ClaseDisparador) => {
    const id = editando === 'nuevo' || !abierto ? nuevoIdDisparador(lista.map((x) => x.id)) : abierto.id;
    setEligiendo(false);
    // ⚠️ El email tiene UN solo evento y aun así se ELIGE tocándolo: elegirlo solo se saltearía la
    // pregunta de si el canal está conectado, y guardaría una automatización que no arranca nunca.
    setBorrador({ d: borradorDeClase(c, id, CRON_DEFAULT), clase: c });
  };
  const quitar = (id: string) => {
    if (lista.length <= 1) return;
    onGuardar(lista.filter((x) => x.id !== id));
    onEditar(null);
  };

  if (!rolAdmin) {
    // Un setter mira: una fila por CRON, con su ícono.
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--ink)', fontFamily: SANS }}>
            <IconoDisparador tipo={claseDeDisparador(d) ?? 'otro'} tam={26} />{textos.texto(d)}
          </div>
        ))}
        {p.pie}
      </div>
    );
  }

  /**
   * ⚠️ CADA CRON EN SU RECUADRO, y el «＋ Nuevo CRON» es otro (10/10/2026, CRON 3: «Un cron debería tener
   * un contenedor y ser más alto, no solo el desplegable... siempre habrán "2 recuadros de CRON" uno del
   * actual y otro del placeholder de nuevo... Que entre esos 2 ocupen toda la tarjeta. Y que si creo más
   * de 2, tenga scroll»). Hasta acá eran pastillas «CRON 1 / CRON 2» arriba y UN editor: el desplegable
   * suelto se confundía con el resto del panel. El abierto muestra su editor; los otros, lo que disparan
   * (tocarlos los abre). Con dos recuadros los dos llenan el alto; con más, cada uno su mínimo y scroll.
   */
  const llenan = lista.length + 1 <= 2;
  // ⚠️ `flex: 1 0 auto` Y NO `flex: 1` (décima tanda, CRON 1): con `flex: 1` el recuadro podía ACHICARSE hasta
  // su piso de 150 aunque lo de adentro midiera más —el `minHeight` explícito le gana al mínimo automático de
  // un hijo flex—, y los seis botones salían por abajo. Ahora llena lo que le toca pero nunca menos que su
  // contenido, y lo que no entra lo scrollea la lista (`overflowY: auto` siempre).
  const recuadro = (esteAbierto: boolean): CSSProperties => ({
    position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 14, boxSizing: 'border-box', minWidth: 0,
    border: `1.5px solid ${esteAbierto ? 'var(--primary)' : 'var(--border)'}`, background: esteAbierto ? 'var(--surface)' : 'var(--surface-2)',
    flex: llenan ? '1 0 auto' : 'none', minHeight: ALTO_RECUADRO_CRON,
  });
  const rotulo = (texto: string) => (
    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>{texto}</span>
  );
  const esquina: CSSProperties = { position: 'absolute', top: -9, right: -9, zIndex: 1, boxShadow: '0 1px 3px rgba(0,0,0,.12)' };
  const editorAbierto = elegirTipo ? (
    // Otra clase con la de antes MARCADA; tocar la misma vuelve a su editor sin tocar nada (CRON 2 y 4).
    <ElegirClase disabled={busy} actual={eligiendo && abierto ? claseDeDisparador(abierto) : null}
      onElegir={(c) => { if (eligiendo && abierto && claseDeDisparador(abierto) === c) { setEligiendo(false); return; } elegirClase(c); }} />
  ) : actual ? (
    <EditorDeClase
      d={actual} clase={clase} textos={textos} estadoCanales={estadoCanales}
      productos={p.productos} etiquetas={p.etiquetas} disparadores={p.disparadores} tz={p.tz} busy={busy}
      onCambiar={aplicar} onVolver={() => { setBorrador(null); setEligiendo(true); }}
    />
  ) : null;

  /**
   * «＋ NUEVO CRON» (o el recuadro del nuevo, abierto). ARRIBA DE TODO CON DOS O MÁS CRON (décima tanda, CRON 4:
   * «Si ya hay 2 CRON, el botón de "Nuevo CRON" siempre arriba del todo, primero»); con uno, abajo, como el
   * placeholder de siempre. Lo decide `nuevoArriba` (pura, con test).
   */
  const nuevo = fijo ? null : editando === 'nuevo' ? (
    <div key="nuevo" data-cron-recuadro="nuevo" style={recuadro(true)}>
      <BotonBorrar talla="xs" title="Descartar el CRON nuevo" onClick={() => onEditar(null)} style={esquina} />
      {rotulo('Nuevo CRON')}
      {editorAbierto}
    </div>
  ) : !borrador ? <NuevoCron key="nuevo" onClick={() => onEditar('nuevo')} /> : null;
  const arriba = nuevoArriba(lista.length);

  return (
    <div data-cron-recuadros style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div ref={listaRef} data-cron-lista className="mk-scroll-oscuro" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', overflowX: 'hidden', padding: '9px 9px 2px 0' }}>
        {arriba && nuevo}
        {lista.map((d, i) => {
          const esteAbierto = editando !== 'nuevo' && abierto?.id === d.id;
          return (
            <div key={d.id} data-cron-recuadro={d.id} style={recuadro(esteAbierto)}>
              {lista.length > 1 && <BotonBorrar talla="xs" title="Eliminar este CRON" disabled={busy} onClick={() => quitar(d.id)} style={esquina} />}
              {lista.length > 1 && rotulo(`CRON ${i + 1}`)}
              {esteAbierto ? editorAbierto : (
                <button type="button" onClick={() => onEditar(d.id)} title="Editar este CRON"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
                  <IconoDisparador tipo={claseDeDisparador(d) ?? 'otro'} tam={30} />
                  <span style={{ minWidth: 0, flex: 1, lineHeight: 1.35 }}>{textos.texto(d)}</span>
                </button>
              )}
            </div>
          );
        })}
        {!arriba && nuevo}
      </div>
      {p.pie}
    </div>
  );
}

/** ¿«＋ Nuevo CRON» va ARRIBA de la lista? Con dos o más CRON (décima tanda, CRON 4). */
export const nuevoArriba = (cuantos: number): boolean => cuantos >= 2;

/** El editor de UN CRON, según su clase. */
function EditorDeClase({ d, clase, textos, estadoCanales, productos, etiquetas, disparadores, tz, busy, onCambiar, onVolver }: {
  d: Disparador; clase: ClaseDisparador | 'otro' | null; textos: ReturnType<typeof useTextoDisparador>;
  estadoCanales: EstadoCanales | null | undefined;
  productos: readonly ProductoOpcion[]; etiquetas: readonly EtiquetaLienzo[]; disparadores: readonly Opcion[]; tz: string | null; busy?: boolean;
  onCambiar: (d: Disparador) => void; onVolver: () => void;
}) {
  // UN CRON DEL EMISOR (el recordatorio, un evento de MaKo) se dice como es y SIN la «←»: no se cambia.
  if (esDelEmisor(d)) {
    return <div data-cron-fijo style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: SANS, lineHeight: 1.4 }}>{textos.texto(d)}</div>;
  }
  const actual = disparoActualDe(d);
  /** El desplegable de producto: producto → «Adquisición» / «Entrega» → la etapa, SIN «Etiquetas» (CRON punto 3). */
  const pasos = pasosDisparo({ disparadores, productos, etiquetas: [], actual, textoActual: textos.deSiempre({ ...d, cron: null }) });
  const deProductos: SeccionDisparo[] = pasos.find((s) => s.title === PASO_PRODUCTOS)?.grupos ?? [];
  const conRaiz: SeccionDisparo[] = [{ title: PASO_PRODUCTOS, options: [], grupos: deProductos }];

  /** TOCAR UNA ETAPA (cuarta tanda, punto 14): del mismo kanban se suma o se saca; de otro, reemplaza. */
  const tocarEtapa = (tocado: string) => {
    const valor = valorDeVarios(valoresTrasTocar(d.trigger_tipo === 'etapa_actual' || d.trigger_tipo === 'entrega_actual' ? valoresDisparo(actual) : [], tocado));
    onCambiar(conDisparo(d, disparoDeValor(valor, actual)));
  };
  const cabeza = (hijo: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <Volver onClick={onVolver} disabled={busy} />
      <div style={{ flex: 1, minWidth: 0 }}>{hijo}</div>
    </div>
  );

  if (clase === 'producto') {
    const hay = deProductos.length > 0;
    // ⚠️ UN EVENTO DE ANTES TAMBIÉN TIENE VALOR (décima tanda, CRON 2): abre ESTE desplegable con lo puesto en
    // el botón, «(de antes)» (`textos.texto`, que lo marca), y elegir una etapa lo reemplaza (`tocarEtapa`
    // arranca de cero con otro tipo). No entra a las opciones: «La que tiene puesta» salió en la cuarta tanda
    // (punto 2), y el desplegable de la casa no es un `<select>` (nada lo pisa hasta que se elija otra cosa).
    const valor = d.trigger_tipo === 'etapa_actual' || d.trigger_tipo === 'entrega_actual' || esEventoDeAntes(d) ? valorDisparo(actual) : '';
    return cabeza(hay ? (
      <Dropdown
        value={valor} secciones={deProductos} search width="100%"
        varios={valor ? valoresDisparo(actual) : []} minimo={1} buttonStyle={BOTON_CAMPO_CRON}
        botonLabel={valor ? rotuloDisparo(conRaiz, valor, textos.texto(d)) : 'Elige la etapa'}
        onChange={tocarEtapa} ariaLabel="Qué etapa dispara esta automatización" disabled={busy}
      />
    ) : <div style={{ fontSize: 13, color: 'var(--dim)', fontFamily: SANS }}>{esEventoDeAntes(d) ? textos.texto(d) : 'Todavía no tienes productos con etapas.'}</div>);
  }

  if (clase === 'etiqueta') {
    const vivas = etiquetas.filter((t) => !t.archivada_at);
    // ⚠️ LA PUESTA ENTRA A LAS OPCIONES AUNQUE SE HAYA ARCHIVADO: un `value` que no está entre sus
    // opciones se dibuja como la primera y el primer clic la pisa (AGENTS.md, el `<select>` que borra
    // datos). Se nombra «(archivada)» con lo mismo que la tarjeta (`nombreEtiqueta`), y no se ofrece a otros.
    const puestaFuera = d.trigger_tipo === 'etiqueta_puesta' && d.etiqueta_id != null && !vivas.some((t) => t.id === d.etiqueta_id)
      ? [{ value: `etiqueta:${d.etiqueta_id}`, label: `Se le puso «${nombreEtiqueta(etiquetas, d.etiqueta_id) ?? 'una etiqueta borrada'}»`, icono: iconoData(ICONO_TAG, '#94A3B8') }]
      : [];
    const opciones: DropdownOption[] = [
      { value: VALOR_ETIQUETA_AGREGADA, label: TEXTO_ETIQUETA_AGREGADA, icono: iconoData(ICONO_TAG_MAS, '#16A34A') },
      { value: VALOR_ETIQUETA_QUITADA, label: TEXTO_ETIQUETA_QUITADA, icono: iconoData(ICONO_TAG_MENOS, '#DC2626') },
      ...[...puestaFuera, ...vivas.map((t) => ({ value: `etiqueta:${t.id}`, label: `Se le puso «${t.nombre}»`, icono: iconoData(ICONO_TAG, t.color || '#D97706') }))]
        .map((o, i) => ({ ...o, lineaArriba: i === 0 })),
    ];
    const valor = valorEtiqueta(d);
    const generica = d.trigger_tipo === TRIGGER_ETIQUETA_AGREGADA || d.trigger_tipo === TRIGGER_ETIQUETA_QUITADA;
    const ignoradas = (d.ignorar ?? []).map(String);
    const nombresIgn = (d.ignorar ?? []).map((id) => nombreEtiqueta(etiquetas, id)).filter(Boolean) as string[];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cabeza(
          <Dropdown value={valor} options={opciones} search width="100%" buttonStyle={BOTON_CAMPO_CRON}
            botonLabel={valor ? undefined : 'Elige la etiqueta'}
            onChange={(v) => onCambiar(conValorEtiqueta(d, v))} ariaLabel="Qué etiqueta dispara esta automatización" disabled={busy} />,
        )}
        {generica && (
          <div style={{ display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr)', alignItems: 'center', gap: 10, paddingLeft: 42 }}>
            <span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' }}>Ignorar</span>
            <Dropdown value="" varios={ignoradas} minimo={0} search width="100%" disabled={busy || !vivas.length}
              botonLabel={nombresIgn.length ? nombresIgn.map((n) => `«${n}»`).join(', ') : 'Ninguna'}
              options={vivas.map((t) => ({ value: String(t.id), label: t.nombre, icono: iconoData(ICONO_TAG, t.color || '#D97706') }))}
              onChange={(v) => onCambiar(alternarIgnorar(d, Number(v)))} ariaLabel="Etiquetas que no disparan" />
          </div>
        )}
      </div>
    );
  }

  if (esClaseDeEventos(clase)) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Volver onClick={onVolver} disabled={busy} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <EventosDeCanal clase={clase} d={d} estado={estadoCanales} disabled={busy}
            onElegir={(subtipo) => onCambiar({ id: d.id, trigger_tipo: triggerDeCanal(clase), subtipo })} />
        </div>
      </div>
    );
  }

  if (clase === 'recurrente' && d.cron) {
    // «A QUIÉN», selección múltiple (CRON punto 9): «El grupo de MaKo» y los clientes de una etapa o
    // una etiqueta, a la vez. Con el grupo marcado la última etapa se puede sacar; sin él, no.
    const quien = valoresQuien(d);
    const secQuien: SeccionDisparo[] = [
      { title: 'MaKo', options: [{ value: VALOR_GRUPO, label: TEXTO_GRUPO }] },
      ...deProductos.length ? [{ title: PASO_PRODUCTOS, options: [], grupos: deProductos }] : [],
      ...(etiquetas.some((t) => !t.archivada_at) ? [{ title: 'Etiquetas', options: etiquetas.filter((t) => !t.archivada_at).map((t) => ({ value: `etiqueta:${t.id}`, label: `Tienen «${t.nombre}»` })) }] : []),
    ];
    const opcionesConIcono = secQuien.map((s) => s.title === 'MaKo' ? { ...s, options: s.options.map((o) => ({ ...o, icono: iconoData(ICONO_GRUPO, '#16A34A') })) } : s);
    const botonQuien = quien.length ? textoQuien(d, textos) : 'Elige a quién';
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Volver onClick={onVolver} disabled={busy} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditorRecurrente cron={d.cron} tzNegocio={tz} disabled={busy}
            onCron={(c) => onCambiar({ ...d, cron: c })}
            aQuien={(
              <div style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', alignItems: 'center', gap: 10, minHeight: 36 }}>
                <span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' }}>A quién</span>
                <Dropdown value="" secciones={opcionesConIcono as SeccionDisparo[]} search width="100%" varios={quien} minimo={1}
                  botonLabel={botonQuien} onChange={(v) => onCambiar(quienTrasTocar(d, v))} ariaLabel="A quién le llega" disabled={busy} />
              </div>
            )} />
        </div>
      </div>
    );
  }

  // Lo que no tiene editor propio (un «grupo de MaKo» sin horario, que el server no guarda): se dice como es, y
  // la ← lo cambia. Un evento de ANTES ya no llega acá: es «Producto» (`claseDeDisparador`, décima tanda, CRON 2).
  return cabeza(<div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: SANS, lineHeight: 1.4 }}>{textos.texto(d)}</div>);
}
