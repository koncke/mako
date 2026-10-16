'use client';

// =============================================================================
// El Centro de Operaciones, de punta a punta como una app de chat (16/10/2026)
// =============================================================================
// Martín, al ver la versión anterior en producción (15/10/2026, 19:01): «Toda la vista de chat está horrible la
// verdad... Quiero que la rediseñe completamente, de punta a punta siguiendo los ejemplos e inspiraciones.
// Eliminando las tabs innecesarias, los textos innecesarios, títulos, subtitulos, avisos, etc... No solamente
// eso, NO es funcional, no puedo mandar un prompt por allí a mis otras cuentas.»
//
// LA REFERENCIA PRINCIPAL ES GROK BOT (xAI, 11/08/2026; Martín: «Quiero que copie a Grok... sobre todo me gusta el
// concepto de los muñequitos de IA o "empleados"»). De su video de lanzamiento, mirado cuadro por cuadro: cada
// Bot es una fila con su muñeco de forma y color propios, su nombre, lo último que dijo y la hora; y un Bot
// vuelve a pedir lo que necesita (acá, las tarjetas de la Ticketera, con su globito). Los muñecos son nuestros
// (Muneco.tsx). Lo que Grok Bot no resuelve —tres cuentas, la entrega firmada— viene de las de abajo.
//
// Copiado también de (capturas miradas el 15/10; la lista, en docs/hallazgos-operaciones.md):
//   · Claude Code web y Claude web — la barra: accesos con ícono arriba, filas de una línea con su punto de
//     estado, y abajo de todo lo de la cuenta;
//   · Codex (escritorio) — las sesiones agrupadas con «Mostrar más» y la hora a la derecha. El grupo acá es la
//     CUENTA: con tres cuentas hay tres «CRM», y la cuenta es lo que los separa;
//   · Grok y Claude — Avance y Pushes son accesos de la barra que abren su vista con el nombre como único
//     título, en vez de pestañas arriba de la conversación;
//   · Claude / ChatGPT / WhatsApp — la conversación y la caja (Conversacion.tsx).
//
// LA PODA: se fueron el título, el subtítulo, la frase de dónde sale el estado, las cuatro pestañas, la hora de
// «Al día» y el botón Actualizar (la pantalla se refresca sola cada pocos segundos con la pestaña a la vista).
// «Áreas» se fue entera: lo que decía (qué hizo último cada chat) es la lista misma. «Trabajos» ya no existe
// aparte: cada trabajo está en su chat.
//
// ⚠️ SIN «AVANCE» NI «PUSHES» EN LA BARRA, Y SIN GRUPOS POR CUENTA (Martín, 15/10/2026, mirándolo en producción):
// «Elimina lo de "Avances y pushes", quiero que cada chat tenga arriba, en su topbar un botón para ver los avances» y
// «No quiero que exista "cuenta 1, cuenta 2, 3" en la sidebar de chats». El avance es la barra derecha de cada
// conversación (Avance.tsx) y la cuenta, un chip en su cabecera. La lista es una sola, como la de Grok Bot.
//
// ⚠️ UN CHAT ES SU NOMBRE, Y LOS SUB-CHATS VAN CON SU JEFE (Martín, 15/10/2026: «todos los chats de todas las cuentas se
// llamen igual» y «quiero que cada chat esté englobado en su chat "jefe"»). La lista une por nombre las sesiones de las
// tres cuentas (lib/centro-chats.ts → unirPorNombre) y pone «CRM › Lead Detail» adentro de «CRM» (porJefe), copiado de
// los hilos de Discord en la barra de canales: el hilo va debajo de su canal, corrido a la derecha y unido con una
// línea. Cada fila tiene su «⋯» (y el clic derecho) con Renombrar y Cambiar su muñeco, como las de ChatGPT y Claude.
//
// ⚠️ LA LISTA SE REHACE EN LA PANTALLA con la misma función que en el server (`completarChats`): las bitácoras
// llegan una vez (`base`) y lo que cambia —el estado que sube el cartero y la cola— se vuelve a pedir.
// ⚠️ Los pushes de Vercel llegan DESPUÉS de dibujar (`pushesCentroAction`): la página no los espera.

import './centro.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Field, Input, Modal, Toast, useToast } from '@/app/_ui';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { Icon } from '@/app/_components/icons';
import { carteroVivo, type Alcance } from '@/lib/operaciones-reglas';
import {
  SECCION_ANTES, SECCION_CHATS, chatDeClave, comoSale, completarChats, esperaDe, esperasPorChat, historialDelChat, nombreValido, partesDelNombre,
  porJefe, seccionesDeChats, textoDeEnvio, textoDeRenombre, vistaPrevia,
  type DecisionEspera, type ChatCentro, type TrabajoP, type VistaPrevia,
} from '@/lib/centro-chats';
import type { PedidoP } from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import { aspectoDe, elegidoPara, type Aspecto, type MunecosElegidos } from '@/lib/centro-munecos';
import { ElegirMuneco } from './ElegirMuneco';
import { Conversacion } from './Conversacion';
import { Tick } from './Hilo';
import { Muneco, animoDe } from './Muneco';
import { PanelRunner, TituloRunner, type VistaRunner } from './PanelRunner';
import { fotoCentroAction, guardarMunecoAction, pushesCentroAction } from './acciones';
import { copiar, useFirma } from './mandar';

const REFRESCO_MS = 8000;
/** Cuántos chats se ven antes de «Mostrar más» (como los proyectos de Codex). */
const VISIBLES = 14;
/** La barra del avance se recuerda abierta o cerrada entre chats y visitas: es una preferencia (AGENTS.md). */
const CLAVE_AVANCE = 'centro.avance';
const leerAvance = () => { try { return window.localStorage.getItem(CLAVE_AVANCE) === '1'; } catch { return false; } };

const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** La edad de una fila, corta como en Codex: «ahora», «12 min», «3 h», «2 d». */
const edad = (t: number | null, ahora: number): string => {
  if (t == null || !Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} d`;
};

/** La URL dice qué se está mirando (se puede copiar y volver), sin ir al server en cada clic: se reescribe con
 *  la historia del navegador, conservando lo demás de la query (el `?ws=` incluido). */
function anotarEnUrl(cambios: Record<string, string | null>) {
  try {
    const u = new URL(window.location.href);
    for (const [k, v] of Object.entries(cambios)) { if (v == null) u.searchParams.delete(k); else u.searchParams.set(k, v); }
    window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}`);
  } catch { /* la URL es una comodidad: si falla, la pantalla sigue igual */ }
}

/** Lo de la cola que dibuja un chat. */
const trabajoDe = (p: Pedido): TrabajoP => ({
  id: p.id, destino: p.destino, destino_titulo: p.destino_titulo, destino_cuenta: p.destino_cuenta, created_at: p.created_at,
  texto: p.texto, estado: p.estado, motivo: p.motivo, entregado_at: p.entregado_at, cerrado_at: p.cerrado_at, cierre: p.cierre,
});

/** El segundo renglón de la fila: «trabajando…» mientras trabaja (el «escribiendo…» de WhatsApp), si no lo
 *  último que pasó, con el tick si es un trabajo propio. */
function Previa({ c, p, espera }: { c: ChatCentro; p: VistaPrevia | null; espera: number }) {
  if (c.estado === 'trabajando' && !c.viejo) return <span className="co-fila__l2 co-fila__l2--vivo">trabajando…</span>;
  // Lo que espera una respuesta de Martín le gana a lo último que pasó: es lo que lo frena.
  if (espera > 0) return <span className="co-fila__l2 co-fila__l2--espera">Espera tu respuesta</span>;
  // Sin nada que contar, la fila es de un renglón: «Sin nada anotado» repetido en 40 filas no distingue a ninguna.
  if (!p) return null;
  return (
    <span className="co-fila__l2">
      {p.tick ? <Tick estado={p.tick} /> : p.propio ? 'Tú: ' : ''}
      <span className="co-fila__l2-texto">{p.texto}</span>
    </span>
  );
}

export function CentroApp({ base, colaInicial, carterosIniciales, decisionesIniciales, munecosIniciales, pedidos, ahora: ahoraServer, sub, chatInicial }: {
  base: ChatCentro[];
  colaInicial: Pedido[] | null;
  carterosIniciales: EstadoCarteros | null;
  /** Las tarjetas de la Ticketera (lo mínimo); null si no se pudieron leer. */
  decisionesIniciales: DecisionEspera[] | null;
  /** Los muñecos que Martín eligió, por nombre (lib/centro-munecos-db.ts). */
  munecosIniciales: MunecosElegidos;
  pedidos: PedidoP[];
  ahora: number;
  sub: string;
  chatInicial: string | null;
}) {
  const [cola, setCola] = useState<Pedido[]>(colaInicial ?? []);
  const [estado, setEstado] = useState<EstadoCarteros | null>(carterosIniciales);
  const [decisiones, setDecisiones] = useState<DecisionEspera[]>(decisionesIniciales ?? []);
  const [ahora, setAhora] = useState(ahoraServer);
  const [pushes, setPushes] = useState<LecturaPushes | null>(null);
  const [busca, setBusca] = useState('');
  const [plegadas, setPlegadas] = useState<Set<string>>(() => new Set([SECCION_ANTES]));
  const [enteras, setEnteras] = useState<Set<string>>(new Set());
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [alcance, setAlcance] = useState<Alcance>('solo_esto');
  const [enviando, setEnviando] = useState(false);
  const [runner, setRunner] = useState<VistaRunner | null>(null);
  const [munecos, setMunecos] = useState<MunecosElegidos>(munecosIniciales);
  // El «⋯» de una fila (o el clic derecho): dónde abre y de qué chat es.
  const [menu, setMenu] = useState<{ x: number; y: number; clave: string } | null>(null);
  const [renombrando, setRenombrando] = useState<{ clave: string; texto: string; error: string | null; mandando: boolean } | null>(null);
  const [eligiendo, setEligiendo] = useState<{ clave: string; aspecto: Aspecto; guardando: boolean } | null>(null);
  const [avance, setAvance] = useState(false);
  // Se lee después de montar: el server no sabe lo del navegador, y el primer dibujo tiene que coincidir.
  useEffect(() => { setAvance(leerAvance()); }, []);
  const cambiarAvance = (v: boolean) => { setAvance(v); try { window.localStorage.setItem(CLAVE_AVANCE, v ? '1' : '0'); } catch { /* es una comodidad */ } };
  const { toast, show, clear } = useToast();
  const firma = useFirma(sub);

  const trabajos = useMemo(() => cola.map(trabajoDe), [cola]);
  const carteros = useMemo(() => estado?.carteros ?? [], [estado]);
  const esperas = useMemo(() => esperasPorChat(decisiones, carteros), [decisiones, carteros]);
  const chats = useMemo(() => completarChats(base, { carteros, trabajos, ahora }), [base, carteros, trabajos, ahora]);
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);

  // El chat de entrada: el que pide la URL; si no, el primero que puede recibir (con sesión) de la lista.
  const [elegido, setElegido] = useState<string | null>(() => {
    const pedido = chatDeClave(chats, chatInicial);
    if (pedido) return pedido.clave;
    return (chats.find((c) => c.sesion) ?? chats[0])?.clave ?? null;
  });
  // En una ventana angosta se ve la lista o la conversación (como WhatsApp en el teléfono).
  const [conChat, setConChat] = useState(chatInicial != null);
  const actual = chats.find((c) => c.clave === elegido) ?? null;

  const refrescar = useCallback(async () => {
    const f = await fotoCentroAction();
    if (f.ok) { setCola(f.pedidos); setEstado(f.carteros); if (f.decisiones) setDecisiones(f.decisiones); }
    setAhora(Date.now());
  }, []);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') refrescar(); }, REFRESCO_MS);
    const volver = () => { if (document.visibilityState === 'visible') refrescar(); };
    document.addEventListener('visibilitychange', volver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', volver); };
  }, [refrescar]);
  // Vercel, después de dibujar.
  useEffect(() => { let vivo = true; pushesCentroAction().then((p) => { if (vivo) setPushes(p); }).catch(() => {}); return () => { vivo = false; }; }, []);

  const elegir = (clave: string) => { setElegido(clave); setConChat(true); anotarEnUrl({ tab: null, todos: null, chat: clave }); };

  // ── La barra: una lista, lo que trabaja primero ────────────────────────────────────────────────
  const filtro = normal(busca.trim());
  const visibles = filtro ? chats.filter((c) => normal(c.titulo).includes(filtro)) : chats;
  const secciones = useMemo(() => seccionesDeChats(visibles), [visibles]);
  const previas = useMemo(() => new Map(chats.map((c) => [c.clave, vistaPrevia(historialDelChat(c, porId, trabajos))])), [chats, porId, trabajos]);

  const alternar = (set: Set<string>, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; };

  // ── Mandar ─────────────────────────────────────────────────────────────────────────────────────
  const envio = actual ? comoSale(actual, carteros, firma.clave === undefined ? undefined : firma.clave?.id ?? null, ahora) : null;
  const texto = actual ? borradores[actual.clave] ?? '' : '';
  const setTexto = (t: string) => { if (actual) setBorradores((b) => ({ ...b, [actual.clave]: t })); };

  async function mandar() {
    if (!actual?.sesion || !envio?.puede || enviando || !texto.trim()) return;
    setEnviando(true);
    const r = await firma.mandar({ sesion: actual.sesion, cuenta: actual.cuenta, titulo: actual.titulo }, texto, alcance);
    setEnviando(false);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    // Se ve enseguida en la conversación (con su reloj); el refresco trae el estado de verdad.
    setCola((q) => (q.some((p) => p.id === r.id) ? q : [{
      id: r.id, created_at: r.creado, autor: '', destino: actual.sesion!, destino_cuenta: actual.cuenta, destino_titulo: actual.titulo,
      texto: texto.trim(), clave_id: firma.clave?.id ?? '', estado: 'escrito', motivo: null, tomado_at: null, entregado_at: null, cerrado_at: null, cierre: null,
    }, ...q]));
    setBorradores((b) => ({ ...b, [actual.clave]: '' }));
    setAlcance('solo_esto');
    refrescar();
  }

  // Los toasts dicen qué hacer, cortos (Martín, 15/10/2026: «Jamás pongas mensajes no claros»). Después de crear
  // el Token, el paso siguiente (pegárselo al Runner) ya lo dice la caja.
  const copiarConAviso = async (t: string, aviso: string) => {
    if (await copiar(t)) show(aviso, undefined, 'good'); else show('No pude copiar', undefined, 'bad');
  };
  const crearClave = async () => {
    const c = await firma.crear();
    if (!c) { show('No pude crear tu Token', undefined, 'bad'); return; }
    show('Token creado', undefined, 'good');
  };

  const vivos = carteros.filter((k) => carteroVivo(k, ahora)).length;

  // ── El «⋯» de cada chat: Renombrar y Cambiar su muñeco ─────────────────────────────────────────
  const abrirMenu = (clave: string, x: number, y: number) => setMenu({ x, y, clave });
  const delMenu = menu ? chats.find((c) => c.clave === menu.clave) ?? null : null;
  const deRenombre = renombrando ? chats.find((c) => c.clave === renombrando.clave) ?? null : null;
  const deMuneco = eligiendo ? chats.find((c) => c.clave === eligiendo.clave) ?? null : null;
  const elegirEnMenu = (id: string) => {
    const c = delMenu;
    setMenu(null);
    if (!c) return;
    if (id === 'renombrar') setRenombrando({ clave: c.clave, texto: c.titulo, error: null, mandando: false });
    if (id === 'muneco') setEligiendo({ clave: c.clave, aspecto: aspectoDe(c.titulo, elegidoPara(munecos, c.titulo)), guardando: false });
  };
  // El nombre lo cambia cada sesión del chat (en las tres cuentas): se le manda a cada una un trabajo firmado que se lo
  // pide (lib/centro-chats.ts → textoDeRenombre). La que está cerrada lo recibe cuando se abre.
  async function renombrar() {
    if (!renombrando || !deRenombre) return;
    const v = nombreValido(renombrando.texto);
    if (!v.ok) { setRenombrando({ ...renombrando, error: v.error }); return; }
    if (v.nombre === deRenombre.titulo) { setRenombrando(null); return; }
    const sale = comoSale(deRenombre, carteros, firma.clave === undefined ? undefined : firma.clave?.id ?? null, ahora);
    if (!sale.puede) { setRenombrando({ ...renombrando, error: textoDeEnvio(sale) }); return; }
    setRenombrando({ ...renombrando, mandando: true, error: null });
    let mal: string | null = null;
    for (const s of deRenombre.sesiones) {
      const r = await firma.mandar({ sesion: s.sesion, cuenta: s.cuenta, titulo: deRenombre.titulo }, textoDeRenombre(v.nombre), 'solo_esto');
      if (!r.ok) mal = r.error;
    }
    if (mal) { setRenombrando({ ...renombrando, mandando: false, error: mal }); return; }
    // El muñeco elegido se guarda por nombre: viaja con el nombre nuevo, o el chat renombrado lo perdería.
    const suyo = elegidoPara(munecos, deRenombre.titulo);
    if (suyo) { const g = await guardarMunecoAction(v.nombre, suyo); if (g.ok) setMunecos(g.munecos); }
    setRenombrando(null);
    show('Renombre enviado', undefined, 'good');
    refrescar();
  }
  async function guardarElegido(aspecto: Aspecto | null) {
    if (!eligiendo || !deMuneco) return;
    setEligiendo({ ...eligiendo, guardando: true });
    const r = await guardarMunecoAction(deMuneco.titulo, aspecto);
    if (!r.ok) { setEligiendo({ ...eligiendo, guardando: false }); show(r.error, undefined, 'bad'); return; }
    setMunecos(r.munecos);
    setEligiendo(null);
    show('Muñeco guardado', undefined, 'good');
  }

  /** Una fila de la lista: un chat, o un sub-chat (corrido a la derecha, sólo con lo que va después de «›»). */
  const fila = (c: ChatCentro, sub: boolean) => {
    const espera = esperaDe(c, esperas);
    return (
      <div key={c.clave} className={`co-fila-wrap${sub ? ' co-fila-wrap--sub' : ''}`}>
        <button
          type="button" title={c.titulo}
          className={`co-fila${c.sesion ? '' : ' co-fila--sin-dir'}`}
          aria-current={actual?.clave === c.clave ? 'true' : undefined}
          onClick={() => elegir(c.clave)}
          onContextMenu={(e) => { e.preventDefault(); abrirMenu(c.clave, e.clientX, e.clientY); }}
        >
          <Muneco titulo={c.titulo} aspecto={elegidoPara(munecos, c.titulo)} animo={animoDe(c)} size={sub ? 30 : 38} espera={espera} />
          <span className="co-fila__cuerpo">
            <span className="co-fila__l1">
              <span className="co-fila__titulo">{sub ? partesDelNombre(c.titulo).sub : c.titulo}</span>
              <span className="co-fila__hace">{edad(c.actividad, ahora)}</span>
            </span>
            <Previa c={c} p={previas.get(c.clave) ?? null} espera={espera} />
          </span>
        </button>
        <button type="button" className="co-fila__mas" aria-label={`Opciones de ${c.titulo}`} title="Opciones"
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); abrirMenu(c.clave, r.left, r.bottom + 4); }}>
          <Icon name="mas" size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="co" data-con-chat={conChat && actual ? 'true' : 'false'}>
      <aside className="co-barra" aria-label="Chats">
        <div className="co-barra__arriba">
          <label className="co-buscar">
            <Icon name="search" size={16} />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar un chat" />
          </label>
        </div>

        <nav className="co-lista" aria-label="Chats">
          {chats.length > 0 && !visibles.length && <p className="co-lista__vacio">Ningún chat con ese nombre.</p>}
          {secciones.map(({ clave: k, titulo, chats: lista }) => {
            const plegada = plegadas.has(k) && !filtro;
            const todas = enteras.has(k) || !!filtro;
            // El elegido se ve siempre, aunque esté más abajo del corte.
            const corte = todas ? lista : lista.filter((c, i) => i < VISIBLES || c.clave === actual?.clave);
            return (
              <div key={k} className="co-cuenta">
                {/* La lista no lleva título; sólo lo anotado antes del 16/10 va aparte, plegado. */}
                {titulo && (
                  <button type="button" className="co-cuenta__cab" aria-expanded={!plegada} onClick={() => setPlegadas((s) => alternar(s, k))}>
                    {titulo}
                    <span className={`co-chev${plegada ? ' co-chev--cerrado' : ''}`} aria-hidden><Icon name="chevron" size={14} /></span>
                  </button>
                )}
                {!plegada && (k === SECCION_CHATS
                  // Los sub-chats con su jefe; un grupo cuyo jefe no está en la lista lleva su nombre arriba.
                  ? porJefe(corte).map((g) => (
                    <div key={g.clave} className="co-jefe">
                      {g.chat ? fila(g.chat, false) : <p className="co-jefe__nombre">{g.jefe}</p>}
                      {g.subs.length > 0 && <div className="co-jefe__subs">{g.subs.map((s) => fila(s, true))}</div>}
                    </div>
                  ))
                  : corte.map((c) => fila(c, false)))}
                {!plegada && !todas && lista.length > corte.length && (
                  <button type="button" className="co-mas" onClick={() => setEnteras((s) => alternar(s, k))}>{`Mostrar ${lista.length - corte.length} más`}</button>
                )}
                {!plegada && enteras.has(k) && !filtro && lista.length > VISIBLES && (
                  <button type="button" className="co-mas" onClick={() => setEnteras((s) => alternar(s, k))}>Mostrar menos</button>
                )}
              </div>
            );
          })}
        </nav>

        <div className="co-barra__abajo">
          <button type="button" className="co-acceso" onClick={() => setRunner('lista')} title={`${vivos} de ${carteros.length} Runners activos`}>
            <Icon name="config" size={17} />Runners
            <span className="co-carteros" aria-hidden>
              {carteros.map((k) => <span key={k.cuenta} className={`co-punto co-punto--${carteroVivo(k, ahora) ? 'trabajando' : 'viejo'}`} />)}
            </span>
          </button>
        </div>
      </aside>

      {actual && envio ? (
          <Conversacion
            chat={actual} pedidos={porId} trabajos={trabajos} pushes={pushes?.ok ? pushes.pushes : null} ahora={ahora}
            avance={avance} onAvance={cambiarAvance}
            aspecto={elegidoPara(munecos, actual.titulo)}
            onMenu={(x, y) => abrirMenu(actual.clave, x, y)}
            onMuneco={() => setEligiendo({ clave: actual.clave, aspecto: aspectoDe(actual.titulo, elegidoPara(munecos, actual.titulo)), guardando: false })}
            espera={esperaDe(actual, esperas)}
            envio={envio} texto={texto} onTexto={setTexto} alcance={alcance} onAlcance={setAlcance} enviando={enviando}
            onMandar={mandar} onCrearClave={crearClave}
            onCopiarClave={() => firma.clave && copiarConAviso(firma.clave.spki, 'Copiado: pégalo en el Runner')}
            onVolver={() => setConChat(false)}
          />
        ) : (
          <section className="co-panel">
            {chats.length
              ? <p className="co-vacio">Elige un chat para escribirle.</p>
              : (
                <div className="co-vacio">
                  <p style={{ margin: '0 0 12px' }}>Conecta un Runner para ver tus chats aquí.</p>
                  <button type="button" className="co-chip" onClick={() => setRunner('nuevo')}>Nuevo Runner</button>
                </div>
              )}
          </section>
      )}

      {runner && (
        // Alto fijo: pasar de la lista al alta no cambia el tamaño de la caja (AGENTS.md → «Una caja cuyo alto es un TOPE»).
        <Modal titulo={<TituloRunner vista={runner} onVista={setRunner} />} onCerrar={() => setRunner(null)} ancho={640} alto="min(600px, 90dvh)">
          <PanelRunner vista={runner} onVista={setRunner} estado={estado} clave={firma.clave} ahora={ahora} onCrearClave={crearClave} onCopiar={copiarConAviso} />
        </Modal>
      )}
      {menu && delMenu && (
        <MenuContextual punto={{ x: menu.x, y: menu.y }} titulo={delMenu.titulo} onCerrar={() => setMenu(null)} onElegir={elegirEnMenu}
          items={[
            ...(delMenu.sesiones.length ? [{ id: 'renombrar', label: 'Renombrar', icono: 'renombrar' as const }] : []),
            { id: 'muneco', label: 'Cambiar su muñeco', icono: 'emoji' as const },
          ]} />
      )}
      {renombrando && deRenombre && (
        <Modal titulo="Renombrar" onCerrar={() => setRenombrando(null)} ancho={480}
          pie={<Button loading={renombrando.mandando} onClick={renombrar}>Renombrar</Button>}>
          <form onSubmit={(e) => { e.preventDefault(); renombrar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Nombre" hint="Para ponerlo dentro de su jefe: CRM › Lead Detail" error={renombrando.error ?? undefined}>
              <Input data-autofocus value={renombrando.texto} maxLength={120} disabled={renombrando.mandando}
                onChange={(e) => setRenombrando({ ...renombrando, texto: e.target.value, error: null })} />
            </Field>
            <p className="co-nota">{new Set(deRenombre.sesiones.map((s) => s.cuenta)).size > 1 ? `Se renombra en sus ${new Set(deRenombre.sesiones.map((s) => s.cuenta)).size} cuentas.` : 'Se renombra en la app de Claude.'}</p>
          </form>
        </Modal>
      )}
      {eligiendo && deMuneco && (
        <Modal titulo="Su muñeco" onCerrar={() => setEligiendo(null)} ancho={760} alto="min(560px, 90dvh)"
          pie={<>
            {elegidoPara(munecos, deMuneco.titulo) && <Button variant="tertiary" disabled={eligiendo.guardando} onClick={() => guardarElegido(null)}>Volver al de siempre</Button>}
            <Button loading={eligiendo.guardando} onClick={() => guardarElegido(eligiendo.aspecto)}>Guardar muñeco</Button>
          </>}>
          <ElegirMuneco titulo={deMuneco.titulo} animo={animoDe(deMuneco)} aspecto={eligiendo.aspecto} onCambio={(a) => setEligiendo({ ...eligiendo, aspecto: a })} />
        </Modal>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}
