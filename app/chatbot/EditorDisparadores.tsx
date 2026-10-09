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

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import Link from '@/app/_ui/Link';
import { botonGrande } from '@/app/_components/Lienzo';
import { EditorRecurrente } from './EditorRecurrente';
import { IconoDisparador, IconoEvento, IconoBorrar } from './IconosDisparador';
import { CRON_DEFAULT } from '@/app/_components/EditorCron';
import {
  CLASES_DISPARADOR, claseDeDisparador, eventosDe, triggerDeCanal, borradorDeClase, conDisparo, disparoActualDe,
  disparadoresDe, sanearDisparadores, firmaLista, nuevoIdDisparador, problemaDeDisparador, textoDeDisparador,
  valoresQuien, quienTrasTocar, valorEtiqueta, conValorEtiqueta, alternarIgnorar, textoQuien, VALOR_GRUPO,
  VALOR_ETIQUETA_AGREGADA, VALOR_ETIQUETA_QUITADA, TEXTO_ETIQUETA_AGREGADA, TEXTO_ETIQUETA_QUITADA, TEXTO_GRUPO,
  TRIGGER_ETIQUETA_AGREGADA, TRIGGER_ETIQUETA_QUITADA,
  type ClaseDisparador, type Disparador, type EstadoCanales,
} from '@/lib/disparadores';
import {
  pasosDisparo, valorDisparo, valoresDisparo, valoresTrasTocar, valorDeVarios, disparoDeValor, rotuloDisparo,
  detalleDisparador, nombreEtiqueta, PASO_PRODUCTOS, type DisparoActual, type SeccionDisparo,
} from '@/lib/flujo-conversacion';
import { etapasDe } from '@/lib/nutricion-etapa';
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

/** «＋ Nuevo CRON», tipo placeholder (CONDITION punto 4: «un diseño grande, tipo placeholder, centrado»). */
function NuevoCron({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mk-placeholder-cron"
      style={{ width: '100%', minHeight: 40, borderRadius: 11, border: '1.5px dashed var(--border-strong)', background: 'transparent', color: 'var(--faint)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', transition: 'color .12s, border-color .12s, background .12s' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}>
      ＋ Nuevo CRON
    </button>
  );
}

/**
 * LA PRIMERA PANTALLA: seis botones gigantes con su ícono (CRON puntos 1 y 2). En una grilla de tres,
 * sin rótulos ni frases: el ícono y el nombre dicen qué es cada uno.
 */
function ElegirClase({ onElegir, disabled }: { onElegir: (c: ClaseDisparador) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Qué dispara esta automatización" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
      {CLASES_DISPARADOR.map((c) => (
        <button key={c.clase} type="button" onClick={() => onElegir(c.clase)} disabled={disabled} data-clase-cron={c.clase}
          style={{
            minHeight: 92, padding: '14px 8px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer',
            fontFamily: SANS, fontSize: 15, fontWeight: 700, color: 'var(--ink)', transition: 'border-color .12s, box-shadow .12s, transform .12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,.07)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <IconoDisparador tipo={c.clase} tam={38} />
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** ¿Están conectados los canales? Se pregunta UNA vez por visita y sólo al abrir uno (le pregunta a Meta). */
let canalesDeLaVisita: Promise<EstadoCanales | null> | null = null;
function useEstadoCanales(activo: boolean): EstadoCanales | null | undefined {
  const [estado, setEstado] = useState<EstadoCanales | null | undefined>(undefined);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    canalesDeLaVisita ??= fetch('/api/chat-agent/secuencias?canales=1', { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      .then((r) => r.json()).then((j: { ok?: boolean; canales?: EstadoCanales }) => (j?.ok && j.canales ? j.canales : null))
      .catch(() => null);
    void canalesDeLaVisita.then((c) => { if (vivo) setEstado(c); if (!c) canalesDeLaVisita = null; });
    return () => { vivo = false; };
  }, [activo]);
  return estado;
}

/**
 * LOS EVENTOS DE UN CANAL (Instagram, Messenger, Email: CRON puntos 6, 7 y 8), en una grilla de dos
 * columnas: el ícono del evento y la frase de ManyChat. Los que ManyChat apaga (los de anuncios) van
 * apagados con su motivo; con el canal SIN conectar, todos, con el motivo arriba y el link a donde se
 * conecta. «No pude comprobarlo» (`conectado: null`) también los apaga: un evento que no puede llegar
 * es una automatización que no arranca nunca.
 */
export function EventosDeCanal({ clase, d, estado, onElegir, disabled }: {
  clase: 'instagram' | 'messenger' | 'email'; d: Disparador; estado: EstadoCanales | null | undefined;
  onElegir: (subtipo: string) => void; disabled?: boolean;
}) {
  const canal = estado?.[clase];
  const cargando = estado === undefined;
  const conectado = canal?.conectado === true;
  const motivo = cargando ? null : estado === null ? 'No pude comprobarlo' : (!conectado ? (canal?.motivo ?? 'Sin conectar') : null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {motivo && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--warn)', fontFamily: SANS }}>
          <span>{motivo}</span>
          {canal?.conectado === false && (clase === 'email'
            // El Link de la casa: se lleva el `?ws=` (sin él, el super admin que mira un cliente
            // terminaba en SUS integraciones — AGENTS.md, las cinco formas de navegar).
            ? <Link href="/email" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conectar</Link>
            : <Link href="/integraciones" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conectar</Link>)}
        </div>
      )}
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
  const [borrador, setBorrador] = useState<{ d: Disparador; clase: ClaseDisparador } | null>(null);
  /** Volver a la primera pantalla sin tocar lo guardado. */
  const [eligiendo, setEligiendo] = useState(false);
  // Cambiar de CRON (otra pastilla, la tarjeta) descarta lo que se estaba armando en el otro.
  const [editandoVisto, setEditandoVisto] = useState(editando);
  if (editandoVisto !== editando) { setEditandoVisto(editando); setBorrador(null); setEligiendo(false); }

  const abierto: Disparador | null = editando === 'nuevo' ? null : (lista.find((d) => d.id === editando) ?? lista[0] ?? null);
  const actual = borrador?.d ?? abierto;
  const clase = borrador?.clase ?? (actual ? claseDeDisparador(actual) : null);
  const unico = lista.length <= 1 && editando !== 'nuevo';
  const elegirTipo = eligiendo || !actual || clase === null;
  const estadoCanales = useEstadoCanales(clase === 'instagram' || clase === 'messenger' || clase === 'email');

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {(lista.length > 1 || editando === 'nuevo') && (
        <div role="tablist" aria-label="Los CRON de esta automatización" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {lista.map((d, i) => {
            const on = editando !== 'nuevo' && actual?.id === d.id;
            return (
              <button key={d.id} type="button" role="tab" aria-selected={on} onClick={() => onEditar(d.id)} title={textos.texto(d)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px 0 6px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 700,
                  border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--dim)' }}>
                <IconoDisparador tipo={claseDeDisparador(d) ?? 'otro'} tam={20} />CRON {i + 1}
              </button>
            );
          })}
          {editando === 'nuevo' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 10px', borderRadius: 999, border: '1.5px solid var(--primary)', background: 'var(--primary-bg)', color: 'var(--primary)', fontFamily: SANS, fontSize: 12.5, fontWeight: 700 }}>Nuevo</span>
          )}
          {/* El tacho del abierto, ROJO (general punto 9). Con uno solo no hay tacho: un CRON menos que uno no dispara nada. */}
          {lista.length > 1 && editando !== 'nuevo' && actual && lista.some((x) => x.id === actual.id) && (
            <button type="button" onClick={() => quitar(actual.id)} disabled={busy} title="Eliminar este CRON" aria-label="Eliminar este CRON"
              style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconoBorrar />
            </button>
          )}
          {editando === 'nuevo' && (
            <button type="button" onClick={() => onEditar(null)} title="Descartar el CRON nuevo" aria-label="Descartar el CRON nuevo"
              style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconoBorrar />
            </button>
          )}
        </div>
      )}

      {elegirTipo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {eligiendo && abierto && claseDeDisparador(abierto) !== null && (
            <div><Volver onClick={() => setEligiendo(false)} /></div>
          )}
          <ElegirClase onElegir={elegirClase} disabled={busy} />
        </div>
      ) : actual && (
        <EditorDeClase
          d={actual} clase={clase} textos={textos} estadoCanales={estadoCanales}
          productos={p.productos} etiquetas={p.etiquetas} disparadores={p.disparadores} tz={p.tz} busy={busy}
          onCambiar={aplicar} onVolver={() => { setBorrador(null); setEligiendo(true); }}
        />
      )}

      {!elegirTipo && editando !== 'nuevo' && !borrador && <NuevoCron onClick={() => onEditar('nuevo')} />}
      {p.pie}
    </div>
  );
}

/** El editor de UN CRON, según su clase. */
function EditorDeClase({ d, clase, textos, estadoCanales, productos, etiquetas, disparadores, tz, busy, onCambiar, onVolver }: {
  d: Disparador; clase: ClaseDisparador | 'otro' | null; textos: ReturnType<typeof useTextoDisparador>;
  estadoCanales: EstadoCanales | null | undefined;
  productos: readonly ProductoOpcion[]; etiquetas: readonly EtiquetaLienzo[]; disparadores: readonly Opcion[]; tz: string | null; busy?: boolean;
  onCambiar: (d: Disparador) => void; onVolver: () => void;
}) {
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
    const valor = d.trigger_tipo === 'etapa_actual' || d.trigger_tipo === 'entrega_actual' ? valorDisparo(actual) : '';
    return cabeza(hay ? (
      <Dropdown
        value={valor} secciones={deProductos} search width="100%"
        varios={valor ? valoresDisparo(actual) : []} minimo={1} buttonStyle={BOTON_CAMPO_CRON}
        botonLabel={valor ? rotuloDisparo(conRaiz, valor, textos.deSiempre(d)) : 'Elige la etapa'}
        onChange={tocarEtapa} ariaLabel="Qué etapa dispara esta automatización" disabled={busy}
      />
    ) : <div style={{ fontSize: 13, color: 'var(--dim)', fontFamily: SANS }}>Todavía no tienes productos con etapas.</div>);
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

  if (clase === 'instagram' || clase === 'messenger' || clase === 'email') {
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

  // Un disparador de ANTES (un evento del catálogo, ya no se ofrece): se dice como es, y la ← lo cambia.
  return cabeza(<div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: SANS, lineHeight: 1.4 }}>{textos.texto(d)}</div>);
}
