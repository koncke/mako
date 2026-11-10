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

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Field, Input, Modal } from '@/app/_ui';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { Icon } from '@/app/_components/icons';
import {
  SECCION_CEREBRO, esPrioritario, esperaDe, nombreCuenta, partesDelNombre, seccionesDeChats, tabDeChat, vaEnLaLista,
  type ChatCentro, type TabDelChat,
} from '@/lib/centro-chats';
import { GruposPorJefe, type PlegadoDeGrupos } from './GruposPorJefe';
export { buscarChats } from '@/lib/centro-chats';
import { elegidoPara, esCriaturaDeMako } from '@/lib/centro-munecos';
import { ignoradasDelChat, preguntasDelChat, respuestasDelChat } from '@/lib/centro-preguntas';
import { edadCorta } from '@/lib/chat-mako-reglas';
import {
  AUTOMATICO, ESFUERZOS, MODELOS, NOMBRE_ESFUERZO, NOMBRE_MODELO, aceptaModelo, type Esfuerzo, type Modelo,
} from '@/lib/centro-cuentas';
import { TEXTO_SEGUNDO_RENGLON, segundoRenglon } from '@/lib/centro-chats';
import { ElegirMuneco } from './ElegirMuneco';
import { Conversacion } from './Conversacion';
import { BotonUso } from './Uso';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { cuentasDeUso } from '@/lib/centro-uso';
import { Muneco, animoDe, type Animo } from './Muneco';
import type { Aspecto } from '@/lib/centro-munecos';
import type { Centro } from './useCentro';

/** Cuántos chats se ven antes de «Mostrar más» (como los proyectos de Codex). */
const VISIBLES = 14;

/** El segundo renglón de la fila: «Trabajando…», «Espera tu respuesta» o nada (20/10/2026, Martín: «Jamás debe decir el
 *  subtitulo las cosas que ponen»). Lo decide `segundoRenglon` (lib/centro-chats.ts), el mismo del teléfono; el paso en
 *  curso sigue adentro del chat. Sin nada que contar, la fila es de un renglón. */
function Previa({ c, espera, sinVer }: { c: ChatCentro; espera: number; sinVer: boolean }) {
  const r = segundoRenglon(c, espera, sinVer);
  if (!r) return null;
  // «Completado» en verde, como «Trabajando…»: sólo una pregunta abierta va en el color que pide algo (22/10/2026).
  return <span className={`co-fila__l2 ${r === 'vivo' ? 'co-fila__l2--vivo' : r === 'revisar' ? 'co-fila__l2--ok' : 'co-fila__l2--espera'}`}>{TEXTO_SEGUNDO_RENGLON[r]}</span>;
}

/** El sello de un «Ya está» en la lista (17/10/2026: en pantalla «Ya está» se dice «Completado»). */
export function SelloCompletado() {
  return <span className="co-sello-ok"><Icon name="check" size={11} />Completado</span>;
}

/**
 * UNA fila de la barra, la de todos los Ops Center (21/10/2026): la del super admin (`FilaCentro`, un chat de Claude Code) y la de
 * cada cliente (app/second-brain/ChatSecondBrain.tsx, sus chats con MaKo y de Offer). La criatura con su ánimo y su globito, el
 * título, la hora a la derecha y, si hay algo que contar, el segundo renglón. Con `onMenu`, el «⋯» y el clic derecho.
 */
export function FilaDeChat({ titulo, texto = titulo, criatura = titulo, aspecto, animo, espera = 0, sub = false, actual, apagada = false, dormida = false,
  hace, chip, previa, onElegir, onMenu }: {
  /** El nombre entero (el `title` de la fila y su criatura, si no se dice otra). */
  titulo: string;
  /** Lo que se lee en la fila (en un sub-chat, lo de después de «›»). */
  texto?: string;
  /** De qué nombre sale la criatura. */
  criatura?: string;
  aspecto?: Aspecto | null;
  animo: Animo;
  espera?: number;
  sub?: boolean;
  actual: boolean;
  /** Sin a dónde mandarle (un chat de Claude Code sin sesión). */
  apagada?: boolean;
  dormida?: boolean;
  hace: string;
  chip?: ReactNode;
  previa?: ReactNode;
  onElegir: () => void;
  onMenu?: (x: number, y: number) => void;
}) {
  return (
    <div className={`co-fila-wrap${sub ? ' co-fila-wrap--sub' : ''}`}>
      <button
        type="button" title={titulo}
        className={`co-fila${apagada ? ' co-fila--sin-dir' : ''}${dormida ? ' co-fila--dormida' : ''}`}
        aria-current={actual ? 'true' : undefined}
        onClick={onElegir}
        onContextMenu={onMenu ? (e) => { e.preventDefault(); onMenu(e.clientX, e.clientY); } : undefined}
      >
        <Muneco titulo={criatura} aspecto={aspecto} animo={animo} size={sub ? 30 : 38} espera={espera} />
        <span className="co-fila__cuerpo">
          <span className="co-fila__l1">
            <span className="co-fila__titulo">{texto}</span>
            {chip}
            <span className="co-fila__hace">{hace}</span>
          </span>
          {previa}
        </span>
      </button>
      {onMenu && (
        <button type="button" className="co-fila__mas" aria-label={`Opciones de ${titulo}`} title="Opciones"
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onMenu(r.left, r.bottom + 4); }}>
          <Icon name="mas" size={16} />
        </button>
      )}
    </div>
  );
}

/** El segundo renglón de una fila: «Trabajando…» (latiendo) o «Espera tu respuesta». */
export const RenglonDeFila = ({ vivo }: { vivo: boolean }) => (
  <span className={`co-fila__l2 ${vivo ? 'co-fila__l2--vivo' : 'co-fila__l2--espera'}`}>{TEXTO_SEGUNDO_RENGLON[vivo ? 'vivo' : 'espera']}</span>
);

/** Una fila de la lista: un chat, o un sub-chat (corrido a la derecha, sólo con lo que va después de «›»). */
export function FilaCentro({ centro: k, c, sub, actual, onElegir }: {
  centro: Centro; c: ChatCentro; sub: boolean; actual: boolean; onElegir: (clave: string) => void;
}) {
  const espera = esperaDe(c, k.esperas);
  // Un «Completado» sin ver avisa IGUAL que una pregunta que espera (el globito de la criatura y el renglón de abajo).
  const sinVer = k.yaSinVer.has(c.clave);
  // Dormido (ojos cerrados y la fila apagada) si no trabaja y no tiene nada para Martín: despierto sólo con un trabajo o un aviso.
  const animo = animoDe(c, k.avisos(c));
  return (
    <FilaDeChat titulo={c.titulo} texto={sub ? partesDelNombre(c.titulo).sub ?? c.titulo : c.titulo} aspecto={elegidoPara(k.munecos, c.titulo)}
      animo={animo} espera={k.avisos(c)} sub={sub} actual={actual} apagada={!c.sesion} dormida={animo === 'dormido'}
      hace={edadCorta(c.actividad, k.ahora)}
      // Un chat de la nube (lo anota el Runner de la app): se ve, con su marca, y no se le escribe desde acá.
      chip={c.nube && <span className="co-chip-cuenta">Nube</span>}
      previa={<Previa c={c} espera={espera} sinVer={sinVer} />}
      onElegir={() => onElegir(c.clave)} onMenu={(x, y) => k.abrirMenu(c.clave, x, y)} />
  );
}

const alternar = (set: Set<string>, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; };

/** La lista de la barra: el Cerebro arriba y, en una sola lista, primero lo que trabaja, después lo que espera a Martín y
 *  después el resto, cada jefe con sus sub-chats (lib/centro-chats.ts → seccionesDeChats). `visibles` ya viene filtrada
 *  por lo buscado. */
export function ListaCentro({ centro: k, visibles, actual, buscando, onElegir }: {
  centro: Centro;
  visibles: readonly ChatCentro[];
  /** La clave del chat abierto (null con otra cosa en el panel). */
  actual: string | null;
  buscando: boolean;
  onElegir: (clave: string) => void;
}) {
  // Sin «Sin asignar» desde el 17/10/2026 (Martín: «No entiendo el desplegable de "Sin asignar", no tiene sentido,
  // elimínalo»): una sola lista, y lo que trabaja o espera una respuesta arriba.
  const [plegadas, setPlegadas] = useState<Set<string>>(() => new Set());
  const [enteras, setEnteras] = useState<Set<string>>(new Set());
  // Los grupos de una tab que Martín abrió (10/11/2026): sus chats de tarea van plegados hasta que los pida.
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(() => new Set());
  // Lo que espera a Martín arriba: una pregunta, o un «Completado» sin ver (el mismo aviso: `k.avisos`). Y PRIMERO lo que espera
  // su respuesta, antes de lo que trabaja (24/10/2026: `prioridadEnLista`): las preguntas solas, las del renglón de la fila.
  const { avisos } = k;
  const esperanRespuesta = useMemo(() => (c: ChatCentro) => esperaDe(c, k.esperas), [k.esperas]);
  // Sin los dormidos (10/11/2026, `vaEnLaLista`): un chat sin actividad hace días no ocupa una fila; buscándolo, sí aparece.
  const enLista = useMemo(() => visibles.filter((c) => vaEnLaLista(c, k.ahora, actual, buscando)), [visibles, k.ahora, actual, buscando]);
  const secciones = useMemo(() => seccionesDeChats(enLista, avisos, esperanRespuesta), [enLista, avisos, esperanRespuesta]);
  const fila = (c: ChatCentro, sub: boolean) => <FilaCentro key={c.clave} centro={k} c={c} sub={sub} actual={actual === c.clave} onElegir={onElegir} />;
  // Un grupo por TAB (10/11/2026): la fila es la tab y sus chats de tarea van adentro, plegados. Lo que espera a Martín, trabaja o se
  // está mirando se ve siempre; buscando, todo abierto.
  const indice = k.indiceTabs;
  const tabDe = useMemo(() => (indice ? (c: ChatCentro) => tabDeChat(c, indice) : undefined), [indice]);
  const plegado = useMemo<PlegadoDeGrupos<ChatCentro>>(() => ({
    abiertos: gruposAbiertos,
    alternar: (clave) => setGruposAbiertos((s) => alternar(s, clave)),
    siempre: (c) => buscando || c.clave === actual || esPrioritario(c, avisos, esperanRespuesta),
  }), [gruposAbiertos, buscando, actual, avisos, esperanRespuesta]);
  return (
    <>
      {secciones.map(({ clave, titulo, chats: lista }) => {
        const plegada = plegadas.has(clave) && !buscando;
        const todas = enteras.has(clave) || buscando;
        // El elegido se ve siempre, aunque esté más abajo del corte; lo que trabaja o espera a Martín, también.
        const corte = todas ? lista : lista.filter((c, i) => i < VISIBLES || c.clave === actual || esPrioritario(c, avisos));
        return (
          <div key={clave} className={`co-cuenta${clave === SECCION_CEREBRO ? ' co-cuenta--cerebro' : ''}`}>
            {/* La lista no lleva título; sólo lo anotado antes del 16/10 va aparte, plegado. */}
            {titulo && (
              <button type="button" className="co-cuenta__cab" aria-expanded={!plegada} onClick={() => setPlegadas((s) => alternar(s, clave))}>
                {titulo}
                <span className={`co-chev${plegada ? ' co-chev--cerrado' : ''}`} aria-hidden><Icon name="chevron" size={14} /></span>
              </button>
            )}
            {/* Los sub-chats con su jefe, en las dos secciones (los del Cerebro, debajo de él); un grupo cuyo jefe no está en la
                lista lleva su nombre arriba. */}
            {!plegada && <GruposPorJefe chats={corte} fila={fila} tabDe={tabDe} plegado={plegado} />}
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

// Los chats agrupados por su jefe o su tab viven en GruposPorJefe.tsx (10/11/2026: así los dibuja un test sin el servidor).
export { GruposPorJefe, type PlegadoDeGrupos };

/** La conversación de un chat con su caja: Conversacion.tsx, enchufada al motor. */
export function ChatDelCentro({ centro: k, chat, onVolver }: { centro: Centro; chat: ChatCentro; onVolver: () => void }) {
  // Lo que se dijo en ESTE chat se pide mientras se lo mira (y se refresca con el resto).
  const { mirar } = k;
  useEffect(() => { mirar(chat); return () => mirar(null); }, [chat.clave, mirar]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Conversacion
      turnos={k.turnosDe(chat)} carteros={k.carteros}
      preguntasChat={k.preguntasDe(chat)} onResponder={(p, elegidas, otra) => k.contestarPregunta(chat, p, elegidas, otra)} avisoCerrado={(p) => k.avisoDePregunta(chat, p)}
      chat={chat} pedidos={k.porId} trabajos={k.trabajos} pushes={k.pushes?.ok ? k.pushes.pushes : null} ahora={k.ahora}
      tareas={k.tareasDe(chat)}
      // De qué tab es cada nombre (10/11/2026): el «Completado» dice «Tab · Función».
      indiceTabs={k.indiceTabs}
      // El ✓ de sus «Completado» (18/10/2026): guardado en MaKo, vale en el teléfono.
      yaVisto={k.yaVistos?.[chat.clave] ?? null} onYaVisto={(i) => void k.marcarYaVisto(chat.clave, i)}
      aspecto={elegidoPara(k.munecos, chat.titulo)}
      // El Cerebro es siempre la estrella de MaKo: tocarla no abre el selector.
      onMuneco={esCriaturaDeMako(chat.titulo) ? undefined : () => k.abrirMuneco(chat)}
      // El título se renombra en el lugar (sólo si el chat tiene una sesión a la que pedírselo).
      onRenombrar={chat.sesiones.length ? (nombre) => k.renombrarChat(chat, nombre) : undefined}
      lineas={k.lineasDe.get(chat.clave)}
      pasos={k.pasosDe(chat)}
      // Lo de WhatsApp (17/10/2026): las marcas y la cita de este chat, reenviar a otros y copiar (MensajeWA.tsx).
      wa={{
        marcas: k.marcasDe(chat), onMarcar: (c) => void k.marcar(chat, c),
        cita: k.citaDe(chat.clave), onCitar: (c) => k.citar(chat.clave, c),
        chats: k.chats, onReenviar: (texto, claves) => k.reenviar(chat, texto, k.chats.filter((c) => claves.includes(c.clave))),
        onCopiar: (t) => void k.copiarConAviso(t, 'Copiado'),
      }}
      // El MISMO número que su fila (`k.avisos`: lo que espera a Martín y su «Completado» sin ✓). Con `esperaDe` la criatura de
      // la cabecera dormía mientras la fila decía «Completado» (Martín, 22/10/2026: «No se entiende»).
      espera={k.avisos(chat)}
      preguntas={preguntasDelChat(chat, k.decisiones, k.carteros)}
      respuestas={respuestasDelChat(chat, k.decisiones, k.carteros)}
      responder={k.responderAca}
      // «Ignorar» lo que espera y «Ignoradas» (5/11/2026): no le manda nada al chat (useCentro.ts).
      ignorar={{ pregunta: (p, si) => k.ignorarPregunta(chat, p, si), decision: (d, si) => k.ignorarDecision(d, si), decisiones: ignoradasDelChat(chat, k.decisiones, k.carteros) }}
      envio={k.envioDe(chat)} texto={k.borradorDe(chat.clave)} onTexto={(t) => k.ponerBorrador(chat.clave, t)}
      adjuntos={{
        items: k.adjuntosDe(chat.clave), puede: k.puedeAdjuntar(chat),
        onSumar: (fs) => void k.sumarAdjuntos(chat.clave, fs), onQuitar: (id) => k.quitarAdjunto(chat.clave, id), onNoPuede: k.sinAdjuntos, onSinImagen: k.sinImagen,
      }}
      enviando={k.enviando} resumenEnvio={resumenDeEnvio(k, chat)}
      onMandar={() => k.mandar(chat)} onGrabada={(g) => k.mandarNota(chat, g.audio, g.segundos)} onCrearClave={() => void k.crearClave()} onCopiarClave={k.copiarClave}
      onVolver={onVolver}
      selectores={<SelectoresDeEnvio centro={k} chat={chat} />}
    />
  );
}

/** Lo elegido que no es «Automático» (la cuenta, el modelo, el esfuerzo), para verlo al lado del «+» sin abrirlo. */
export function resumenDeEnvio(k: Centro, chat: ChatCentro): string | null {
  const partes: string[] = [];
  const cuenta = k.cuentaElegida(chat.clave);
  if (cuenta !== AUTOMATICO) partes.push(nombreCuenta(cuenta) ?? cuenta);
  if (aceptaModelo(k.destinoDeChat(chat).sesion)) {
    if (k.modelo) partes.push(NOMBRE_MODELO[k.modelo]);
    if (k.esfuerzo) partes.push(NOMBRE_ESFUERZO[k.esfuerzo]);
  }
  return partes.length ? partes.join(' · ') : null;
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
  // Un renglón por cosa, con su nombre a la izquierda: viven adentro del «+» de la caja (AdjuntosCaja.tsx → MasCaja).
  return (
    <>
      {opciones.length > 0 && (
        <label className="co-envio-fila">
          <span>Cuenta</span>
          <select className="co-chip co-envio-sel" title="A qué cuenta va" value={k.cuentaElegida(chat.clave)}
            onChange={(e) => k.elegirCuenta(chat.clave, e.target.value)} disabled={k.enviando}>
            <option value={AUTOMATICO}>{automatica ? `Automático · ${nombreCuenta(automatica)}` : 'Automático'}</option>
            {opciones.map((o) => <option key={o.cuenta} value={o.cuenta}>{`${nombreCuenta(o.cuenta)}${libre(o.libre)}`}</option>)}
          </select>
        </label>
      )}
      <label className="co-envio-fila">
        <span>Modelo</span>
        <select className="co-chip co-envio-sel" value={conModelo ? k.modelo ?? AUTOMATICO : AUTOMATICO} disabled={!conModelo || k.enviando}
          title={conModelo ? 'Con qué modelo corre' : 'El modelo se elige sólo en los chats de la app'}
          onChange={(e) => k.setModelo(e.target.value === AUTOMATICO ? null : e.target.value as Modelo)}>
          <option value={AUTOMATICO}>Automático</option>
          {MODELOS.map((m) => <option key={m} value={m}>{NOMBRE_MODELO[m]}</option>)}
        </select>
      </label>
      <label className="co-envio-fila">
        <span>Esfuerzo</span>
        <select className="co-chip co-envio-sel" value={conModelo ? k.esfuerzo ?? AUTOMATICO : AUTOMATICO} disabled={!conModelo || k.enviando}
          title={conModelo ? 'Cuánto piensa' : 'El esfuerzo se elige sólo en los chats de la app'}
          onChange={(e) => k.setEsfuerzo(e.target.value === AUTOMATICO ? null : e.target.value as Esfuerzo)}>
          <option value={AUTOMATICO}>Automático</option>
          {ESFUERZOS.map((x) => <option key={x} value={x}>{NOMBRE_ESFUERZO[x]}</option>)}
        </select>
      </label>
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
            // El Cerebro es siempre la estrella de MaKo (lib/centro-munecos.ts → ASPECTO_MAKO): su criatura no se cambia.
            ...(esCriaturaDeMako(delMenu.titulo) ? [] : [{ id: 'muneco', label: 'Cambiar su criatura', icono: 'emoji' as const }]),
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
        <Modal titulo="Su criatura" onCerrar={() => k.setEligiendo(null)} ancho={760} alto="min(560px, 90dvh)"
          pie={<>
            {elegidoPara(munecos, deMuneco.titulo) && <Button variant="tertiary" disabled={eligiendo.guardando} onClick={() => void k.guardarElegido(null)}>Volver al de siempre</Button>}
            <Button loading={eligiendo.guardando} onClick={() => void k.guardarElegido(eligiendo.aspecto)}>Guardar criatura</Button>
          </>}>
          <ElegirMuneco titulo={deMuneco.titulo} animo={animoDe(deMuneco)} aspecto={eligiendo.aspecto} onCambio={(a) => k.setEligiendo({ ...eligiendo, aspecto: a })} />
        </Modal>
      )}
    </>
  );
}

/** Las cuentas del Uso con su nombre y su email (la G, 17/10/2026): las cuatro siempre, tengan o no Runner. */
export const cuentasConTitular = (k: Centro) => cuentasDeUso(k.carteros).map((c) => ({ ...c, titular: k.nombresCuentas[c.cuenta] ?? null }));

/** Abajo de la barra: el Uso de las cuentas, en un desplegable siempre a la vista (Uso.tsx). Sin los botones «Runners» y
 *  «Nuevo Runner» desde el 17/10/2026 (la G): el Runner se arma solo, y el Token se crea y se copia desde la caja. */
export function PieCentro({ centro: k }: { centro: Centro }) {
  return (
    <div className="co-barra__abajo">
      {/* Las CUATRO cuentas siempre, tengan o no Runner (Martín: «no sale el uso de las otras 2 cuentas»). */}
      {/* El mismo «Tus cuentas de IA» del cliente, y debajo lo suyo (23/10/2026: «IGUAL que en los clientes»). */}
      <BotonUso cuentas={cuentasConTitular(k)} ahora={k.ahora} onRenombrar={k.renombrarCuenta} onLeerCredito={k.leerCreditoApi} onCambiarCredito={k.cambiarCreditoDelNegocio} pc={k.estadoPc}
        tusCuentas={<TusCuentasIA sinCabecera />} />
    </div>
  );
}

/**
 * «Nuevo chat» de Claude Code, arriba de sus chats, con su círculo verde (NuevoChat.tsx). NO abre un modal (Martín, 17/10/2026:
 * «jamás debe abrir un modal, eso es lo más contraintuitivo y contra IA que existe»): abre un chat vacío con la caja lista
 * (ChatNuevo.tsx) y MaKo decide dónde va y cómo se llama con el primer mensaje.
 */
export function NuevoChatCentro({ onNuevo, actual }: { onNuevo: () => void; actual: boolean }) {
  return (
    // Con el diseño de «＋ Nueva automatización» (feedback 4, 22/10/2026): la fila punteada con el ＋ que gira (`.co-nueva`).
    <button type="button" className="co-fila co-fila--nuevo co-nueva" aria-current={actual ? 'true' : undefined} data-recorrido="sb-nuevo" onClick={onNuevo}>
      <span aria-hidden className="co-nueva__mas">＋</span>
      <span className="co-fila__cuerpo"><span className="co-fila__l1"><span className="co-fila__titulo">Nuevo chat</span></span></span>
    </button>
  );
}
