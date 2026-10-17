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
// ⚠️ DESDE EL 17/10 ESTO ES UN ADAPTADOR (tanda 5 de docs/diseno-mako-ai-native.md): el motor —refresco, cola, firma,
// caja, «⋯»— vive en useCentro.ts, y la fila, la lista, la conversación y los menús en PiezasCentro.tsx, porque
// /second-brain monta los MISMOS para el super admin. Acá queda lo que es sólo de esta página: la Ticketera entera,
// los Runners, «Nuevo chat» (el comando de PowerShell) y la URL.

import './centro.css';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Modal, Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { chatDeClave, nombreValido, type ChatCentro, type DecisionEspera } from '@/lib/centro-chats';
import type { PedidoP } from '@/lib/progreso-reglas';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import type { MunecosElegidos } from '@/lib/centro-munecos';
import { PanelRunner, TituloRunner, type VistaRunner } from './PanelRunner';
import { TicketeraCentro } from './TicketeraCentro';
import { comandoNuevoChat } from '@/lib/runner';
import { BotonUso } from './Uso';
import { MunecoNuevo, NuevoChat, type BorradorNuevoChat } from './NuevoChat';
import type { AccionDeshacer, AccionResponder } from '@/app/admin/runway/decisiones';
import type { VistaTicketera } from '@/app/tickets/decisiones/CambioVista';
import { useCentro } from './useCentro';
import { ChatDelCentro, ListaCentro, MenusCentro, buscarChats } from './PiezasCentro';

/** La URL dice qué se está mirando (se puede copiar y volver), sin ir al server en cada clic: se reescribe con
 *  la historia del navegador, conservando lo demás de la query (el `?ws=` incluido). */
function anotarEnUrl(cambios: Record<string, string | null>) {
  try {
    const u = new URL(window.location.href);
    for (const [k, v] of Object.entries(cambios)) { if (v == null) u.searchParams.delete(k); else u.searchParams.set(k, v); }
    // Con `null` y no con el estado de Next: así el router se entera (copia su estado y despacha un RESTORE) y
    // `useSearchParams` sigue a la URL. Con el estado de Next, el router se queda con la URL vieja y un link a la misma
    // vista no hace nada (revisión adversarial, 16/10/2026).
    window.history.replaceState(null, '', `${u.pathname}${u.search}`);
  } catch { /* la URL es una comodidad: si falla, la pantalla sigue igual */ }
}

export function CentroApp({
  base, colaInicial, carterosIniciales, decisionesIniciales, munecosIniciales, pedidos, ahora: ahoraServer, sub, chatInicial,
  responder, deshacer, ticketeraInicial, tabs,
}: {
  base: ChatCentro[];
  colaInicial: Pedido[] | null;
  carterosIniciales: EstadoCarteros | null;
  /** Las tarjetas de la Ticketera, enteras; null si no se pudieron leer. */
  decisionesIniciales: DecisionEspera[] | null;
  /** Las acciones de la Ticketera (app/admin/runway/acciones.ts): contestar acá es contestar allá. */
  responder: AccionResponder;
  deshacer: AccionDeshacer;
  /** `?ticketera=`: las rutas viejas de la Ticketera traen acá, con la vista que eran. */
  ticketeraInicial: VistaTicketera | null;
  /** Los nombres de las tabs: el jefe de un chat se llama como una; los demás van a «Sin asignar» (tabs.ts). */
  tabs: readonly string[];
  /** Los muñecos que Martín eligió, por nombre (lib/centro-munecos-db.ts). */
  munecosIniciales: MunecosElegidos;
  pedidos: PedidoP[];
  ahora: number;
  sub: string;
  chatInicial: string | null;
}) {
  const { toast, show, clear } = useToast();
  const centro = useCentro(
    { base, colaInicial, carterosIniciales, decisionesIniciales, munecosIniciales, pedidos, ahora: ahoraServer, sub, tabs, responder, deshacer },
    (t, tono) => show(t, undefined, tono),
  );
  const { chats, carteros, ahora, estado, firma } = centro;
  const [ticketera, setTicketera] = useState<VistaTicketera | null>(ticketeraInicial);
  const [busca, setBusca] = useState('');
  const [runner, setRunner] = useState<VistaRunner | null>(null);
  const [nuevo, setNuevo] = useState<BorradorNuevoChat | null>(null);

  // El chat de entrada: el que pide la URL; si no, el primero que puede recibir (con sesión) de la lista.
  const [elegido, setElegido] = useState<string | null>(() => {
    const pedido = chatDeClave(chats, chatInicial);
    if (pedido) return pedido.clave;
    return (chats.find((c) => c.sesion) ?? chats[0])?.clave ?? null;
  });
  // En una ventana angosta se ve la lista o la conversación (como WhatsApp en el teléfono).
  const [conChat, setConChat] = useState(chatInicial != null || ticketeraInicial != null);
  // ⚠️ LA VISTA SIGUE A LA URL, no a la prop: un link a esta misma página con otro `?ticketera=` (el ítem «Ticketera» de
  // la barra de admin) no la vuelve a montar, y la prop puede no cambiar aunque la URL sí (la prop es la de la última
  // vez que dibujó el server). `useSearchParams` sí cambia, también con lo que anota `anotarEnUrl`.
  const qTicketera = useSearchParams().get('ticketera');
  useEffect(() => {
    const v: VistaTicketera | null = qTicketera === 'lista' || qTicketera === 'tarjetas' ? qTicketera : null;
    setTicketera(v);
    if (v) setConChat(true);
  }, [qTicketera]);
  const actual = chats.find((c) => c.clave === elegido) ?? null;

  const elegir = (clave: string) => { setElegido(clave); setTicketera(null); setConChat(true); anotarEnUrl({ tab: null, todos: null, ticketera: null, chat: clave }); };
  const abrirTicketera = (v: VistaTicketera) => { setTicketera(v); setConChat(true); anotarEnUrl({ ticketera: v }); };
  const cerrarTicketera = () => { setTicketera(null); anotarEnUrl({ ticketera: null }); };

  // ── La barra: una lista, lo que trabaja primero ────────────────────────────────────────────────
  const visibles = useMemo(() => buscarChats(chats, busca), [chats, busca]);

  return (
    <div className="co" data-con-chat={conChat && actual ? 'true' : 'false'}>
      <aside className="co-barra" aria-label="Chats">
        <div className="co-barra__arriba">
          <label className="co-buscar">
            <Icon name="search" size={16} />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar un chat" />
          </label>
          {/* La Ticketera entera, arriba de los chats: como «Buscar» y «Biblioteca» en la barra de ChatGPT. */}
          <button type="button" className="co-acceso co-acceso--ticketera" aria-pressed={ticketera != null}
            onClick={() => (ticketera ? cerrarTicketera() : abrirTicketera('tarjetas'))}>
            <Icon name="soporte" size={17} />Ticketera
            {centro.pendientesTicketera > 0 && <span className="co-acceso__n">{centro.pendientesTicketera}</span>}
          </button>
        </div>

        <nav className="co-lista" aria-label="Chats">
          {/* «Nuevo chat» arriba de todos, como el de ChatGPT y Claude, con un muñeco gris de lugar vacío (NuevoChat.tsx). */}
          <button type="button" className="co-fila co-fila--nuevo" onClick={() => setNuevo({ nombre: '', cuenta: actual?.cuenta ?? 'claude1' })}>
            <MunecoNuevo />
            <span className="co-fila__cuerpo"><span className="co-fila__l1"><span className="co-fila__titulo">Nuevo chat</span></span></span>
          </button>
          {chats.length > 0 && !visibles.length && <p className="co-lista__vacio">Ningún chat con ese nombre.</p>}
          <ListaCentro centro={centro} visibles={visibles} actual={ticketera ? null : actual?.clave ?? null} buscando={!!busca.trim()} onElegir={elegir} />
        </nav>

        <div className="co-barra__abajo">
          {/* El Uso de las tres cuentas y sus Runners, en un desplegable siempre a la vista (Uso.tsx). */}
          <BotonUso cuentas={carteros.map((k) => ({ cuenta: k.cuenta, vistoAt: k.vistoAt, cuota: k.cuota ?? null }))} ahora={ahora}
            onRunners={() => setRunner('lista')} onNuevo={() => setRunner('nuevo')} onCopiar={centro.copiarConAviso} />
        </div>
      </aside>

      {ticketera ? (
          <TicketeraCentro
            decisiones={centro.decisionesOk ? centro.decisiones : null} vista={ticketera} onVista={abrirTicketera}
            responder={centro.responderAca} deshacer={centro.deshacerAca}
            onVolver={() => { cerrarTicketera(); setConChat(false); }}
          />
        ) : actual ? (
          <ChatDelCentro centro={centro} chat={actual} onVolver={() => setConChat(false)} />
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
          <PanelRunner vista={runner} onVista={setRunner} estado={estado} clave={firma.clave} ahora={ahora} onCrearClave={() => void centro.crearClave()} onCopiar={centro.copiarConAviso} />
        </Modal>
      )}
      <MenusCentro centro={centro} />
      {nuevo && (
        <Modal titulo="Nuevo chat" onCerrar={() => setNuevo(null)} ancho={520}
          pie={<Button disabled={!nombreValido(nuevo.nombre.trim()).ok} onClick={() => { void centro.copiarConAviso(comandoNuevoChat(nuevo.cuenta, nuevo.nombre), 'Copiado: pégalo en PowerShell'); setNuevo(null); }}>Copiar comando</Button>}>
          <NuevoChat borrador={nuevo} onCambio={setNuevo} onCopiar={centro.copiarConAviso} />
        </Modal>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}
