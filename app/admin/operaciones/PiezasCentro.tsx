'use client';

// =============================================================================
// Las piezas del Centro que se montan en otra barra (17/10/2026)
// =============================================================================
// La tanda 5 de docs/diseno-mako-ai-native.md: el Centro es un ADAPTADOR. Lo que dibuja una fila de la barra, la lista
// con el Cerebro y los jefes, la conversación con su caja y el «⋯» de cada chat se sacaron de CentroApp.tsx (sin
// cambiarles nada) para que /second-brain monte los MISMOS, sobre el mismo motor (useCentro.ts).
//
// DESDE EL 17/10 HAY UNA SOLA PANTALLA, «OPS CENTER» (Martín: «El Second Brain y el Centro deberían ser exactamente lo
// mismo en SuperAdmin»): app/second-brain/ChatSecondBrain.tsx monta estas piezas en /second-brain y en
// /admin/operaciones, y CentroApp.tsx se borró. Lo que se copió de dónde (capturas miradas el 15/10; la lista entera, en
// docs/hallazgos-operaciones.md):
//   · Grok Bot (xAI) — cada chat es un «empleado» con su muñeco, y el que espera algo lo muestra con su globito;
//   · Claude Code web y Claude web — la barra: accesos con ícono arriba, filas de una línea, lo de la cuenta abajo;
//   · Codex (escritorio) — «Mostrar más» y la hora a la derecha;
//   · los hilos de Discord — el sub-chat «CRM › Lead Detail» debajo de su jefe, corrido a la derecha;
//   · ChatGPT y Claude — el «⋯» de cada fila con Renombrar y Cambiar su muñeco;
//   · claude.ai → Configuración → Uso — el desplegable «Uso» (Uso.tsx).

import { useEffect, useMemo, useState } from 'react';
import { Button, Field, Input, Modal } from '@/app/_ui';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { Icon } from '@/app/_components/icons';
import {
  SECCION_CEREBRO, SECCION_CHATS, esperaDe, nombreCuenta, partesDelNombre, porJefe, seccionesDeChats, sinNoticiasDesde,
  type ChatCentro, type VistaPrevia,
} from '@/lib/centro-chats';
export { buscarChats } from '@/lib/centro-chats';
import { elegidoPara } from '@/lib/centro-munecos';
import { preguntasDelChat, respuestasDelChat } from '@/lib/centro-preguntas';
import { edadCorta } from '@/lib/chat-mako-reglas';
import { comandoNuevoChat, tieneTerminal } from '@/lib/runner';
import {
  AUTOMATICO, ESFUERZOS, MODELOS, NOMBRE_ESFUERZO, NOMBRE_MODELO, aceptaModelo, type Esfuerzo, type Modelo,
} from '@/lib/centro-cuentas';
import { nombreValido } from '@/lib/centro-chats';
import { ElegirMuneco } from './ElegirMuneco';
import { Conversacion } from './Conversacion';
import { PanelRunner, TituloRunner, type VistaRunner } from './PanelRunner';
import { BotonUso } from './Uso';
import { cuentasDeUso } from '@/lib/centro-uso';
import { MunecoNuevo, NuevoChat, type BorradorNuevoChat } from './NuevoChat';
import { Tick } from './Hilo';
import { Muneco, animoDe } from './Muneco';
import type { Centro } from './useCentro';

/** «10:52», con el reloj de Argentina (el de Martín). */
const horaAR = (t: number) => new Date(t).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Cuántos chats se ven antes de «Mostrar más» (como los proyectos de Codex). */
const VISIBLES = 14;

/** El segundo renglón de la fila: mientras trabaja, EN QUÉ (Martín, 16/10/2026: «Cuando un chat dice "Trabajando..." debo
 *  saber en qué está trabajando»: el título de lo que tiene en curso, `enQueTrabaja`; «trabajando…» si no se sabe), si no
 *  lo último que pasó, con el tick si es un trabajo propio. */
function Previa({ c, p, espera, enCurso }: { c: ChatCentro; p: VistaPrevia | null; espera: number; enCurso: string | null }) {
  if (c.estado === 'trabajando' && !c.viejo) return <span className="co-fila__l2 co-fila__l2--vivo" title={enCurso ?? undefined}>{enCurso ?? 'trabajando…'}</span>;
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

/** Una fila de la lista: un chat, o un sub-chat (corrido a la derecha, sólo con lo que va después de «›»). */
export function FilaCentro({ centro: k, c, sub, actual, onElegir }: {
  centro: Centro; c: ChatCentro; sub: boolean; actual: boolean; onElegir: (clave: string) => void;
}) {
  const espera = esperaDe(c, k.esperas);
  return (
    <div className={`co-fila-wrap${sub ? ' co-fila-wrap--sub' : ''}`}>
      <button
        type="button" title={c.titulo}
        className={`co-fila${c.sesion ? '' : ' co-fila--sin-dir'}`}
        aria-current={actual ? 'true' : undefined}
        onClick={() => onElegir(c.clave)}
        onContextMenu={(e) => { e.preventDefault(); k.abrirMenu(c.clave, e.clientX, e.clientY); }}
      >
        <Muneco titulo={c.titulo} aspecto={elegidoPara(k.munecos, c.titulo)} animo={animoDe(c)} size={sub ? 30 : 38} espera={espera} />
        <span className="co-fila__cuerpo">
          <span className="co-fila__l1">
            <span className="co-fila__titulo">{sub ? partesDelNombre(c.titulo).sub : c.titulo}</span>
            <span className="co-fila__hace">{edadCorta(c.actividad, k.ahora)}</span>
          </span>
          <Previa c={c} p={k.previas.get(c.clave) ?? null} espera={espera} enCurso={k.enCursos.get(c.clave) ?? null} />
        </span>
      </button>
      <button type="button" className="co-fila__mas" aria-label={`Opciones de ${c.titulo}`} title="Opciones"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); k.abrirMenu(c.clave, r.left, r.bottom + 4); }}>
        <Icon name="mas" size={16} />
      </button>
    </div>
  );
}

const alternar = (set: Set<string>, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; };

/** La lista de la barra: el Cerebro arriba, los jefes con sus sub-chats, y aparte, plegado, lo que no tiene jefe
 *  (lib/centro-chats.ts → seccionesDeChats). `visibles` ya viene filtrada por lo buscado. */
export function ListaCentro({ centro: k, visibles, actual, buscando, onElegir }: {
  centro: Centro;
  visibles: readonly ChatCentro[];
  /** La clave del chat abierto (null con otra cosa en el panel). */
  actual: string | null;
  buscando: boolean;
  onElegir: (clave: string) => void;
}) {
  // «Sin asignar» va ABIERTA desde el 17/10/2026 (Martín: «Hay chats que están corriendo acá que no se reflejan... ni
  // como jefes ni como trabajadores»: «Pagos» y «MaKo en WhatsApp» estaban ahí, plegados). Todo chat abierto se ve.
  const [plegadas, setPlegadas] = useState<Set<string>>(() => new Set());
  const [enteras, setEnteras] = useState<Set<string>>(new Set());
  const secciones = useMemo(() => seccionesDeChats(visibles, k.tabs), [visibles, k.tabs]);
  const fila = (c: ChatCentro, sub: boolean) => <FilaCentro key={c.clave} centro={k} c={c} sub={sub} actual={actual === c.clave} onElegir={onElegir} />;
  // Sin ningún Runner dando vueltas, lo de abajo es una foto: se dice desde cuándo, en vez de mostrarlos «quietos».
  const sinNoticias = sinNoticiasDesde(k.carteros, k.ahora);
  return (
    <>
      {sinNoticias != null && (
        <p className="co-lista__vacio" role="status">{`Sin noticias del Runner desde las ${horaAR(sinNoticias)}`}</p>
      )}
      {secciones.map(({ clave, titulo, chats: lista }) => {
        const plegada = plegadas.has(clave) && !buscando;
        const todas = enteras.has(clave) || buscando;
        // El elegido se ve siempre, aunque esté más abajo del corte.
        const corte = todas ? lista : lista.filter((c, i) => i < VISIBLES || c.clave === actual);
        return (
          <div key={clave} className={`co-cuenta${clave === SECCION_CEREBRO ? ' co-cuenta--cerebro' : ''}`}>
            {/* La lista no lleva título; sólo lo anotado antes del 16/10 va aparte, plegado. */}
            {titulo && (
              <button type="button" className="co-cuenta__cab" aria-expanded={!plegada} onClick={() => setPlegadas((s) => alternar(s, clave))}>
                {titulo}
                <span className={`co-chev${plegada ? ' co-chev--cerrado' : ''}`} aria-hidden><Icon name="chevron" size={14} /></span>
              </button>
            )}
            {!plegada && (clave === SECCION_CHATS
              // Los sub-chats con su jefe; un grupo cuyo jefe no está en la lista lleva su nombre arriba.
              ? porJefe(corte).map((g) => (
                <div key={g.clave} className="co-jefe">
                  {g.chat ? fila(g.chat, false) : <p className="co-jefe__nombre">{g.jefe}</p>}
                  {g.subs.length > 0 && <div className="co-jefe__subs">{g.subs.map((s) => fila(s, true))}</div>}
                </div>
              ))
              : corte.map((c) => fila(c, false)))}
            {!plegada && !todas && lista.length > corte.length && (
              <button type="button" className="co-mas" onClick={() => setEnteras((s) => alternar(s, clave))}>{`Mostrar ${lista.length - corte.length} más`}</button>
            )}
            {!plegada && enteras.has(clave) && !buscando && lista.length > VISIBLES && (
              <button type="button" className="co-mas" onClick={() => setEnteras((s) => alternar(s, clave))}>Mostrar menos</button>
            )}
          </div>
        );
      })}
    </>
  );
}

/** La conversación de un chat con su caja: Conversacion.tsx, enchufada al motor. */
export function ChatDelCentro({ centro: k, chat, onVolver }: { centro: Centro; chat: ChatCentro; onVolver: () => void }) {
  // Lo que se dijo en ESTE chat se pide mientras se lo mira (y se refresca con el resto).
  const { mirar } = k;
  useEffect(() => { mirar(chat); return () => mirar(null); }, [chat.clave, mirar]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Conversacion
      turnos={k.turnosDe(chat)}
      chat={chat} pedidos={k.porId} trabajos={k.trabajos} pushes={k.pushes?.ok ? k.pushes.pushes : null} ahora={k.ahora}
      avance={k.avance} onAvance={k.cambiarAvance}
      aspecto={elegidoPara(k.munecos, chat.titulo)}
      onMenu={(x, y) => k.abrirMenu(chat.clave, x, y)}
      onMuneco={() => k.abrirMuneco(chat)}
      espera={esperaDe(chat, k.esperas)}
      preguntas={preguntasDelChat(chat, k.decisiones, k.carteros)}
      respuestas={respuestasDelChat(chat, k.decisiones, k.carteros)}
      responder={k.responderAca}
      envio={k.envioDe(chat)} texto={k.borradorDe(chat.clave)} onTexto={(t) => k.ponerBorrador(chat.clave, t)}
      adjuntos={{
        items: k.adjuntosDe(chat.clave), puede: k.puedeAdjuntar(chat),
        onSumar: (fs) => void k.sumarAdjuntos(chat.clave, fs), onQuitar: (id) => k.quitarAdjunto(chat.clave, id),
      }}
      alcance={k.alcance} onAlcance={k.setAlcance} enviando={k.enviando}
      onMandar={() => void k.mandar(chat)} onCrearClave={() => void k.crearClave()} onCopiarClave={k.copiarClave}
      onVolver={onVolver}
      selectores={<SelectoresDeEnvio centro={k} chat={chat} />}
    />
  );
}

/**
 * A qué cuenta va lo que se escribe, y con qué modelo y esfuerzo corre (Martín, 17/10/2026: «debería poder seleccionar»
 * la cuenta, con «Automático» si no elige, y «eligiendo qué modelo de IA debe correr»). Copiado del selector de modelo de
 * Claude y ChatGPT, al lado de la caja: un desplegable chico por cosa, con «Automático» primero. La cuenta automática dice
 * cuál sería; el modelo y el esfuerzo sólo se ofrecen en un chat de la app (los de terminal no se pueden cambiar desde
 * afuera) y vuelven a «Automático» después de mandar. Las reglas: lib/centro-cuentas.ts.
 */
export function SelectoresDeEnvio({ centro: k, chat }: { centro: Centro; chat: ChatCentro }) {
  const { opciones, automatica } = k.cuentasDe(chat);
  const destino = k.destinoDeChat(chat);
  const conModelo = aceptaModelo(destino.sesion);
  const libre = (n: number | null) => (n == null ? '' : ` · ${n}% libre`);
  return (
    <>
      {opciones.length > 0 && (
        <select className="co-chip co-elegir" aria-label="Cuenta" title="A qué cuenta va" value={k.cuentaElegida(chat.clave)}
          onChange={(e) => k.elegirCuenta(chat.clave, e.target.value)} disabled={k.enviando}>
          <option value={AUTOMATICO}>{automatica ? `Automático · ${nombreCuenta(automatica)}` : 'Automático'}</option>
          {opciones.map((o) => <option key={o.cuenta} value={o.cuenta}>{`${nombreCuenta(o.cuenta)}${libre(o.libre)}`}</option>)}
        </select>
      )}
      <select className="co-chip co-elegir" aria-label="Modelo" value={conModelo ? k.modelo ?? AUTOMATICO : AUTOMATICO} disabled={!conModelo || k.enviando}
        title={conModelo ? 'Con qué modelo corre' : 'El modelo se elige sólo en los chats de la app'}
        onChange={(e) => k.setModelo(e.target.value === AUTOMATICO ? null : e.target.value as Modelo)}>
        <option value={AUTOMATICO}>Modelo automático</option>
        {MODELOS.map((m) => <option key={m} value={m}>{NOMBRE_MODELO[m]}</option>)}
      </select>
      <select className="co-chip co-elegir" aria-label="Esfuerzo" value={conModelo ? k.esfuerzo ?? AUTOMATICO : AUTOMATICO} disabled={!conModelo || k.enviando}
        title={conModelo ? 'Cuánto piensa' : 'El esfuerzo se elige sólo en los chats de la app'}
        onChange={(e) => k.setEsfuerzo(e.target.value === AUTOMATICO ? null : e.target.value as Esfuerzo)}>
        <option value={AUTOMATICO}>Esfuerzo automático</option>
        {ESFUERZOS.map((x) => <option key={x} value={x}>{NOMBRE_ESFUERZO[x]}</option>)}
      </select>
    </>
  );
}

/** El «⋯» de un chat (y el clic derecho) con Renombrar y Cambiar su muñeco, como las filas de ChatGPT y Claude. */
export function MenusCentro({ centro: k }: { centro: Centro }) {
  const { menu, delMenu, renombrando, deRenombre, eligiendo, deMuneco, munecos } = k;
  return (
    <>
      {menu && delMenu && (
        <MenuContextual punto={{ x: menu.x, y: menu.y }} titulo={delMenu.titulo} onCerrar={k.cerrarMenu} onElegir={k.elegirEnMenu}
          items={[
            ...(delMenu.sesiones.length ? [{ id: 'renombrar', label: 'Renombrar', icono: 'renombrar' as const }] : []),
            { id: 'muneco', label: 'Cambiar su muñeco', icono: 'emoji' as const },
          ]} />
      )}
      {renombrando && deRenombre && (
        <Modal titulo="Renombrar" onCerrar={() => k.setRenombrando(null)} ancho={480}
          pie={<Button loading={renombrando.mandando} onClick={() => void k.renombrar()}>Renombrar</Button>}>
          <form onSubmit={(e) => { e.preventDefault(); void k.renombrar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Nombre" hint="Para ponerlo dentro de su jefe: CRM › Lead Detail" error={renombrando.error ?? undefined}>
              <Input data-autofocus value={renombrando.texto} maxLength={120} disabled={renombrando.mandando}
                onChange={(e) => k.setRenombrando({ ...renombrando, texto: e.target.value, error: null })} />
            </Field>
            <p className="co-nota">{new Set(deRenombre.sesiones.map((s) => s.cuenta)).size > 1 ? `Se renombra en sus ${new Set(deRenombre.sesiones.map((s) => s.cuenta)).size} cuentas.` : 'Se renombra en su chat.'}</p>
          </form>
        </Modal>
      )}
      {eligiendo && deMuneco && (
        <Modal titulo="Su muñeco" onCerrar={() => k.setEligiendo(null)} ancho={760} alto="min(560px, 90dvh)"
          pie={<>
            {elegidoPara(munecos, deMuneco.titulo) && <Button variant="tertiary" disabled={eligiendo.guardando} onClick={() => void k.guardarElegido(null)}>Volver al de siempre</Button>}
            <Button loading={eligiendo.guardando} onClick={() => void k.guardarElegido(eligiendo.aspecto)}>Guardar muñeco</Button>
          </>}>
          <ElegirMuneco titulo={deMuneco.titulo} animo={animoDe(deMuneco)} aspecto={eligiendo.aspecto} onCambio={(a) => k.setEligiendo({ ...eligiendo, aspecto: a })} />
        </Modal>
      )}
    </>
  );
}

/** Abajo de la barra: el Uso de las cuentas y sus Runners, en un desplegable siempre a la vista (Uso.tsx), con la lista
 *  y el alta de Runners en un modal de alto fijo (AGENTS.md → «Una caja cuyo alto es un TOPE»). */
export function PieCentro({ centro: k }: { centro: Centro }) {
  const [runner, setRunner] = useState<VistaRunner | null>(null);
  return (
    <>
      <div className="co-barra__abajo">
        {/* Las CUATRO cuentas siempre, tengan o no Runner (Martín: «no sale el uso de las otras 2 cuentas»). */}
        <BotonUso cuentas={cuentasDeUso(k.carteros)} ahora={k.ahora} onRunners={() => setRunner('lista')} onNuevo={() => setRunner('nuevo')} />
      </div>
      {runner && (
        <Modal titulo={<TituloRunner vista={runner} onVista={setRunner} />} onCerrar={() => setRunner(null)} ancho={640} alto="min(600px, 90dvh)">
          <PanelRunner vista={runner} onVista={setRunner} estado={k.estado} clave={k.firma.clave} ahora={k.ahora} onCrearClave={() => void k.crearClave()} onCopiar={k.copiarConAviso} />
        </Modal>
      )}
    </>
  );
}

/** «Nuevo chat» de Claude Code, arriba de sus chats, con un muñeco gris de lugar vacío (NuevoChat.tsx). Arranca en la
 *  cuenta del chat abierto si tiene terminal; si no, en la 1. */
export function NuevoChatCentro({ centro: k, cuentaDelAbierto }: { centro: Centro; cuentaDelAbierto: string | null }) {
  const [nuevo, setNuevo] = useState<BorradorNuevoChat | null>(null);
  return (
    <>
      <button type="button" className="co-fila co-fila--nuevo"
        onClick={() => setNuevo({ nombre: '', cuenta: cuentaDelAbierto && tieneTerminal(cuentaDelAbierto) ? cuentaDelAbierto : 'claude1' })}>
        <MunecoNuevo />
        <span className="co-fila__cuerpo"><span className="co-fila__l1"><span className="co-fila__titulo">Nuevo chat</span></span></span>
      </button>
      {nuevo && (
        <Modal titulo="Nuevo chat" onCerrar={() => setNuevo(null)} ancho={520}
          pie={<Button disabled={!nombreValido(nuevo.nombre.trim()).ok} onClick={() => { void k.copiarConAviso(comandoNuevoChat(nuevo.cuenta, nuevo.nombre), 'Copiado: pégalo en PowerShell'); setNuevo(null); }}>Copiar comando</Button>}>
          <NuevoChat borrador={nuevo} onCambio={setNuevo} onCopiar={k.copiarConAviso} />
        </Modal>
      )}
    </>
  );
}
