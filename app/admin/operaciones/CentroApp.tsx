'use client';

// =============================================================================
// El Centro de Operaciones, de punta a punta como una app de chat (16/10/2026)
// =============================================================================
// Martín, al ver la versión anterior en producción (15/10/2026, 19:01): «Toda la vista de chat está horrible la
// verdad... Quiero que la rediseñe completamente, de punta a punta siguiendo los ejemplos e inspiraciones.
// Eliminando las tabs innecesarias, los textos innecesarios, títulos, subtitulos, avisos, etc... No solamente
// eso, NO es funcional, no puedo mandar un prompt por allí a mis otras cuentas.»
//
// Copiado de (capturas miradas el 15/10; la lista, en docs/hallazgos-operaciones.md):
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
// ⚠️ LA LISTA SE REHACE EN LA PANTALLA con la misma función que en el server (`completarChats`): las bitácoras
// llegan una vez (`base`) y lo que cambia —el estado que sube el cartero y la cola— se vuelve a pedir.
// ⚠️ Los pushes de Vercel llegan DESPUÉS de dibujar (`pushesCentroAction`): la página no los espera.

import './centro.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Modal, Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { carteroVivo, type Alcance } from '@/lib/operaciones-reglas';
import {
  SECCION_ANTES, comoSale, completarChats, historialDelChat, seccionesDeChats, vistaPrevia, type ChatCentro, type TrabajoP, type VistaPrevia,
} from '@/lib/centro-chats';
import type { NovedadP, PedidoP } from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import { Conversacion } from './Conversacion';
import { PuntoChat, Tick } from './Hilo';
import { PanelCartero } from './PanelCartero';
import { Progreso } from './Progreso';
import { fotoCentroAction, pushesCentroAction } from './acciones';
import { copiar, useFirma } from './mandar';

export type VistaCentro = 'chats' | 'avance' | 'pushes';
const REFRESCO_MS = 8000;
/** Cuántos chats se ven por cuenta antes de «Mostrar más» (como los proyectos de Codex). */
const VISIBLES = 8;

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
function Previa({ c, p }: { c: ChatCentro; p: VistaPrevia | null }) {
  if (c.estado === 'trabajando' && !c.viejo) return <span className="co-fila__l2 co-fila__l2--vivo">trabajando…</span>;
  // Sin nada que contar, la fila es de un renglón: «Sin nada anotado» repetido en 40 filas no distingue a ninguna.
  if (!p) return null;
  return (
    <span className="co-fila__l2">
      {p.tick ? <Tick estado={p.tick} /> : p.propio ? 'Tú: ' : ''}
      <span className="co-fila__l2-texto">{p.texto}</span>
    </span>
  );
}

export function CentroApp({ base, colaInicial, carterosIniciales, pedidos, novedades, todos, ahora: ahoraServer, sub, vistaInicial, chatInicial }: {
  base: ChatCentro[];
  colaInicial: Pedido[] | null;
  carterosIniciales: EstadoCarteros | null;
  pedidos: PedidoP[];
  novedades: NovedadP[];
  todos: boolean;
  ahora: number;
  sub: string;
  vistaInicial: VistaCentro;
  chatInicial: string | null;
}) {
  const router = useRouter();
  const [cola, setCola] = useState<Pedido[]>(colaInicial ?? []);
  const [estado, setEstado] = useState<EstadoCarteros | null>(carterosIniciales);
  const [ahora, setAhora] = useState(ahoraServer);
  const [pushes, setPushes] = useState<LecturaPushes | null>(null);
  const [vista, setVista] = useState<VistaCentro>(vistaInicial);
  const [busca, setBusca] = useState('');
  const [plegadas, setPlegadas] = useState<Set<string>>(() => new Set([SECCION_ANTES]));
  const [enteras, setEnteras] = useState<Set<string>>(new Set());
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [alcance, setAlcance] = useState<Alcance>('solo_esto');
  const [enviando, setEnviando] = useState(false);
  const [cartero, setCartero] = useState(false);
  const { toast, show, clear } = useToast();
  const firma = useFirma(sub);

  const trabajos = useMemo(() => cola.map(trabajoDe), [cola]);
  const carteros = useMemo(() => estado?.carteros ?? [], [estado]);
  const chats = useMemo(() => completarChats(base, { carteros, trabajos, ahora }), [base, carteros, trabajos, ahora]);
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);

  // El chat de entrada: el que pide la URL; si no, el primero que puede recibir (con sesión) de la lista.
  const [elegido, setElegido] = useState<string | null>(() => {
    if (chatInicial && chats.some((c) => c.clave === chatInicial)) return chatInicial;
    return (chats.find((c) => c.sesion) ?? chats[0])?.clave ?? null;
  });
  // En una ventana angosta se ve la lista o la conversación (como WhatsApp en el teléfono).
  const [conChat, setConChat] = useState(chatInicial != null || vistaInicial !== 'chats');
  const actual = chats.find((c) => c.clave === elegido) ?? null;

  const refrescar = useCallback(async () => {
    const f = await fotoCentroAction();
    if (f.ok) { setCola(f.pedidos); setEstado(f.carteros); }
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

  const irA = (v: VistaCentro, chat?: string | null) => {
    setVista(v);
    anotarEnUrl(v === 'chats' ? { tab: null, todos: null, chat: chat ?? null } : { tab: v, chat: null });
  };
  const elegir = (clave: string) => { setElegido(clave); setConChat(true); irA('chats', clave); };

  // ── La barra: por cuenta, la que está corriendo primero ────────────────────────────────────────
  const filtro = normal(busca.trim());
  const visibles = filtro ? chats.filter((c) => normal(c.titulo).includes(filtro)) : chats;
  const secciones = useMemo(() => seccionesDeChats(visibles), [visibles]);
  const abiertosAvance = pedidos.filter((p) => p.estado !== 'hecho').length;
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

  const copiarConAviso = async (t: string, aviso: string) => {
    show(await copiar(t) ? aviso : 'No pude copiar', undefined, 'good');
  };
  const crearClave = async () => {
    const c = await firma.crear();
    if (!c) { show('No pude crear la clave', undefined, 'bad'); return; }
    show('Clave creada: cópiala y pégala en el chat Cartero', undefined, 'good');
  };

  const vivos = carteros.filter((k) => carteroVivo(k, ahora)).length;

  return (
    <div className="co" data-con-chat={conChat && (vista !== 'chats' || actual) ? 'true' : 'false'}>
      <aside className="co-barra" aria-label="Chats">
        <div className="co-barra__arriba">
          <label className="co-buscar">
            <Icon name="search" size={16} />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar un chat" />
          </label>
          <button type="button" className="co-acceso" aria-current={vista === 'avance' ? 'page' : undefined} onClick={() => { irA('avance'); setConChat(true); }}>
            <Icon name="todo" size={17} />Avance{abiertosAvance > 0 && <span className="co-acceso__n">{abiertosAvance}</span>}
          </button>
          <button type="button" className="co-acceso" aria-current={vista === 'pushes' ? 'page' : undefined} onClick={() => { irA('pushes'); setConChat(true); }}>
            <Icon name="rayo" size={17} />Pushes
          </button>
        </div>

        <nav className="co-lista" aria-label="Chats por cuenta">
          {chats.length > 0 && !visibles.length && <p className="co-lista__vacio">Ningún chat con ese nombre.</p>}
          {secciones.map(({ clave: k, titulo, chats: lista }) => {
            const plegada = plegadas.has(k) && !filtro;
            const todas = enteras.has(k) || !!filtro;
            // El elegido se ve siempre, aunque esté más abajo del corte.
            const corte = todas ? lista : lista.filter((c, i) => i < VISIBLES || c.clave === actual?.clave);
            return (
              <div key={k} className="co-cuenta">
                <button type="button" className="co-cuenta__cab" aria-expanded={!plegada} onClick={() => setPlegadas((s) => alternar(s, k))}>
                  {titulo}
                  <span className={`co-chev${plegada ? ' co-chev--cerrado' : ''}`} aria-hidden><Icon name="chevron" size={14} /></span>
                </button>
                {!plegada && corte.map((c) => (
                  <button
                    key={c.clave} type="button" title={c.titulo}
                    className={`co-fila${c.sesion ? '' : ' co-fila--sin-dir'}`}
                    aria-current={vista === 'chats' && actual?.clave === c.clave ? 'true' : undefined}
                    onClick={() => elegir(c.clave)}
                  >
                    <PuntoChat c={c} />
                    <span className="co-fila__cuerpo">
                      <span className="co-fila__l1">
                        <span className="co-fila__titulo">{c.titulo}</span>
                        <span className="co-fila__hace">{edad(c.actividad, ahora)}</span>
                      </span>
                      <Previa c={c} p={previas.get(c.clave) ?? null} />
                    </span>
                  </button>
                ))}
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
          <button type="button" className="co-acceso" onClick={() => setCartero(true)} title={`${vivos} de ${carteros.length} carteros dando vueltas`}>
            <Icon name="config" size={17} />Cartero
            <span className="co-carteros" aria-hidden>
              {carteros.map((k) => <span key={k.cuenta} className={`co-punto co-punto--${carteroVivo(k, ahora) ? 'trabajando' : 'viejo'}`} />)}
            </span>
          </button>
        </div>
      </aside>

      {vista === 'chats' ? (
        actual && envio ? (
          <Conversacion
            chat={actual} pedidos={porId} trabajos={trabajos} pushes={pushes?.ok ? pushes.pushes : []} ahora={ahora}
            envio={envio} texto={texto} onTexto={setTexto} alcance={alcance} onAlcance={setAlcance} enviando={enviando}
            onMandar={mandar} onCrearClave={crearClave}
            onCopiarClave={() => firma.clave && copiarConAviso(firma.clave.spki, 'Clave copiada: pégala en el chat Cartero')}
            onVolver={() => setConChat(false)}
          />
        ) : (
          <section className="co-panel">
            {chats.length
              ? <p className="co-vacio">Elige un chat.</p>
              : (
                <div className="co-vacio">
                  <p style={{ margin: '0 0 12px' }}>Ningún chat todavía: aparecen cuando el cartero da su vuelta.</p>
                  <button type="button" className="co-chip" onClick={() => setCartero(true)}>Ver el cartero</button>
                </div>
              )}
          </section>
        )
      ) : (
        <section className="co-panel" aria-label={vista === 'avance' ? 'Avance' : 'Pushes'}>
          <header className="co-cab">
            <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={() => setConChat(false)} aria-label="Volver a los chats">
              <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
            </button>
            <h1 className="co-cab__titulo" style={{ fontSize: 'var(--fs-md)' }}>{vista === 'avance' ? 'Avance' : 'Pushes'}</h1>
            {vista === 'avance' && (
              <button type="button" className="co-chip" style={{ marginLeft: 'auto' }} aria-pressed={todos}
                onClick={() => router.replace(todos ? '/admin/operaciones?tab=avance' : '/admin/operaciones?tab=avance&todos=1', { scroll: false })}>
                {todos ? 'Últimos 14 días' : 'Ver todos'}
              </button>
            )}
          </header>
          <div className="co-vista">
            <Progreso vista={vista} pedidos={pedidos} pushes={pushes} novedades={novedades} ahora={ahora} />
          </div>
        </section>
      )}

      {cartero && (
        <Modal titulo="Cartero" onCerrar={() => setCartero(false)} ancho={560}>
          <PanelCartero estado={estado} clave={firma.clave} ahora={ahora} onCrearClave={crearClave} onCopiar={copiarConAviso} />
        </Modal>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}
