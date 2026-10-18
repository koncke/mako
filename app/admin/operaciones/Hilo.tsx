// =============================================================================
// El hilo de una conversación del Centro — lo dibujan la computadora (Conversacion.tsx) y el teléfono
// (app/m/operaciones/ChatsMovil.tsx), la misma pieza en los dos
// =============================================================================
// La estructura es la de Claude y ChatGPT (lo propio a la derecha en burbuja, lo del asistente a la izquierda
// como texto) con las píldoras de día y los ticks de WhatsApp, ADENTRO de la burbuja, junto a la hora.
// escrito ≠ entregado ≠ hecho (docs/diseno-centro-de-operaciones.md §3):
//   · ✓         → escrito o entregando: está en MaKo y todavía no salió de la PC;
//   · ✓✓ gris   → entregado: el chat lo recibió, nunca «lo leyó»;
//   · ✓✓ azul   → hecho o comprobado: el chat dejó su cierre (que va abajo, como respuesta);
//   · ✕         → no se pudo / no sé si llegó / cancelado, con el motivo debajo.
//
// LOS GLOBOS (17/10/2026, Martín: «Cada mensaje dentro de su globo, con la colita que apunta a la foto o a la criatura. De
// su lado va SU foto de perfil. Los mensajes especiales se tienen que ver más llamativos»): copiado de un grupo de
// WhatsApp. Lo de Martín, verde-azul a la derecha con la colita arriba hacia SU foto (MiFoto.tsx); lo del chat, en un globo
// blanco a la izquierda con la colita hacia su criatura. Lo especial (un «Completado», una pregunta, un aviso) no va en
// globo: es una tarjeta con su color (`co-el--especial`, `co-aviso`), para que se distinga de una respuesta.
// ⚠️ SIN 'use client' Y SIN HOOKS, a propósito: el teléfono la usa sin llevarse la pantalla de escritorio
// (AGENTS.md → MaKo Mobile). Las clases son las de centro.css, que importa quien la monta.
// ⚠️ Las horas son las de Argentina (el reloj de Martín), calculadas con el `ahora` que llega de afuera: el
// HTML del server y la hidratación tienen que decir lo mismo.

import { Icon } from '@/app/_components/icons';
import { ROTULO, type EstadoPedido } from '@/lib/operaciones-reglas';
import { chatTrabajando, esYaEsta, estadoDelEnvio, lineasDeConversacion, type CarteroP, type ChatCentro, type LineaChat, type TrabajoP } from '@/lib/centro-chats';
import { YaEstaMensaje } from './Avance';
import type { TareaDelChat } from '@/lib/centro-plan-auto-reglas';
import type { TurnoChat } from '@/lib/operaciones-reglas';
import { Markdown, renderInline } from '@/app/_components/Markdown';
import { textoDeRespuesta } from '@/app/admin/runway/decisiones';
import { Muneco, type Animo } from './Muneco';
import type { Aspecto } from '@/lib/centro-munecos';
import { ROTULO_TIPO, hace, pushDelCommit, type PushP } from '@/lib/progreso-reglas';
import { PreguntaChat, type Responder } from './PreguntaChat';
import { TEXTO_SOLO_ADJUNTOS, bloquesDeMensaje } from '@/lib/centro-caja';
import { AdjuntosEnBurbuja } from './FotosEnviadas';
import { MiFoto } from './MiFoto';
import { ConLinks } from './ConLinks';
import { memo } from 'react';
import { idDeLinea, leerCita, leerReenvio, mensajeDeLinea, sinOcultos, type MarcasChat } from '@/lib/centro-mensajes';
import { CitaEnBurbuja, Deslizable, MarcasEnHora, ReaccionWA } from './MensajeWA';
import type { PasoDelTurno } from '@/lib/centro-pasos';
import { Trabajando } from './Trabajando';

/** «10:52», con el reloj de Argentina. */
const horaAR = (t: number) => new Date(t).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const diaAR = (t: number) => Math.floor((t - 3 * 3_600_000) / 86_400_000);
function rotuloDia(t: number, ahora: number): string {
  const d = diaAR(ahora) - diaAR(t);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  return new Date(t).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short' });
}

/** Los ticks de WhatsApp: ✓ escrito, ✓✓ entregado, ✓✓ azul hecho, ✕ no salió. */
export function Tick({ estado }: { estado: EstadoPedido }) {
  const doble = (clase: string) => (
    <span className={`co-tick ${clase}`} title={ROTULO[estado]}>
      <Icon name="check" size={13} /><span style={{ display: 'inline-flex', marginLeft: -8 }}><Icon name="check" size={13} /></span>
    </span>
  );
  if (estado === 'escrito' || estado === 'tomado') return <span className="co-tick" title={ROTULO[estado]}><Icon name="check" size={13} /></span>;
  if (estado === 'entregado') return doble('');
  if (estado === 'hecho' || estado === 'comprobado') return doble('co-tick--hecho');
  return <span className="co-tick co-tick--mal" title={ROTULO[estado]}><Icon name="x" size={12} /></span>;
}

/** Lo que escribió Martín, con sus listas («1. », «- ») dibujadas como lista, como Claude (17/10/2026, la B). Sin listas,
 *  el texto tal cual (la burbuja respeta los renglones). Si respondió a un mensaje, la cita va arriba y se toca para ir a
 *  él; si lo reenvió, «Reenviado» arriba en gris (lo de WhatsApp, lib/centro-mensajes.ts). */
function TextoMio({ texto: crudo, lineas = [] }: { texto: string; lineas?: readonly LineaChat[] }) {
  const reenvio = leerReenvio(crudo);
  const conCita = leerCita(reenvio?.resto ?? crudo);
  const texto = conCita?.resto ?? reenvio?.resto ?? crudo;
  return (
    <>
      {reenvio && <span className="co-reenviado"><span aria-hidden>↪</span>{` Reenviado de ${reenvio.de}`}</span>}
      {conCita && <CitaEnBurbuja de={conCita.cita.de} texto={conCita.cita.texto} lineas={lineas} />}
      <TextoConListas texto={texto} />
    </>
  );
}
function TextoConListas({ texto }: { texto: string }) {
  const bloques = bloquesDeMensaje(texto);
  if (!bloques.some((b) => b.tipo === 'lista')) return <ConLinks texto={texto} />;
  return (
    <>
      {bloques.map((b, i) => (b.tipo === 'parrafo'
        ? <span key={i} className="co-burbuja__p"><ConLinks texto={b.texto} /></span>
        : b.numerada
          // Con SUS números, tal cual (WhatsApp): un <ol> solo renumera desde 1 (lib/centro-caja.ts → `marcas`).
          ? <ol key={i} className="co-burbuja__lista co-burbuja__lista--num">{b.items.map((x, j) => <li key={j}><span className="co-burbuja__num">{b.marcas[j]}</span><ConLinks texto={x} /></li>)}</ol>
          : <ul key={i} className="co-burbuja__lista">{b.items.map((x, j) => <li key={j}><ConLinks texto={x} /></li>)}</ul>))}
    </>
  );
}

/** Quién habla del otro lado: el empleado (su título decide su muñeco). */
/** El empleado del chat: su nombre y, si Martín le eligió uno, su muñeco. */
type Quien = { titulo: string; aspecto?: Aspecto | null };

/** Con qué se cuenta en qué está lo que mandó Martín (lib/centro-chats.ts → estadoDelEnvio): el chat y los Runners. */
export type VivoDelHilo = { chat: Pick<ChatCentro, 'estado' | 'viejo' | 'sinRunner' | 'clave' | 'sesion' | 'titulo'>; carteros: readonly CarteroP[] };

/** Lo del «Ya está» de un chat (17/10/2026, la C): sus tareas del Plan y responder sobre lo que dijo. */
export type ExtrasDelHilo = { tareas?: readonly TareaDelChat[]; onFeedback?: (titulo: string) => void };

function Trabajo({ l, w, quien, vivo, ahora, wa }: { l: LineaChat; w: TrabajoP; quien: Quien; vivo?: VivoDelHilo; ahora: number; wa: DelHiloWA }) {
  const id = idDeLinea(l);
  const t = Date.parse(w.created_at);
  const estado = w.estado ?? 'escrito';
  const mal = estado === 'no_entregado' || estado === 'incierto' || estado === 'cancelado';
  const c = w.cierre;
  // «Enviado» → «La PC lo recibió», y por qué tarda si tarda (Martín, 17/10/2026: «no pasó nada por varios segundos»).
  const va = vivo ? estadoDelEnvio(w, vivo.chat, vivo.carteros, ahora) : null;
  return (
    <>
      <Deslizable m={mensajeDeLinea(l, quien.titulo)} className="co-yo">
        <div className={`co-burbuja${w.adjuntos?.length ? ' co-burbuja--con-adjuntos' : ''}`}>
          {/* Las fotos arriba del texto, como WhatsApp (FotosEnviadas.tsx: por qué no se veían y de dónde salen). */}
          {w.adjuntos?.length ? <AdjuntosEnBurbuja id={w.id} nombres={w.adjuntos} /> : null}
          {!(w.adjuntos?.length && w.texto === TEXTO_SOLO_ADJUNTOS) && <TextoMio texto={w.texto ?? ''} lineas={wa.lineas} />}
          <span className="co-burbuja__pie"><MarcasEnHora id={id} marcas={wa.marcas} />{Number.isFinite(t) ? horaAR(t) : ''}<Tick estado={estado} /></span>
        </div>
        <MiFoto />
        <ReaccionWA id={id} marcas={wa.marcas} />
        {/* Un aviso se ve como aviso (17/10/2026: «los mensajes especiales se tienen que ver más llamativos»). */}
        {mal && <p className="co-nota co-nota--mal co-aviso" role="alert"><Icon name="x" size={12} />{`${ROTULO[estado]}${w.motivo ? ` · ${w.motivo}` : ''}`}</p>}
        {va && (
          <p className={`co-envio co-envio--${va.fase}${va.porQue ? ' co-envio--tarda' : ''}`} role="status">
            <span className="co-envio__paso">{va.texto}</span>
            {va.porQue && <span className="co-envio__porque">{va.porQue}</span>}
          </p>
        )}
      </Deslizable>
      {c && (
        <div className="co-el">
          <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo="despierto" size={26} />
          <div className="co-el__cuerpo">
            <p className="co-el__rotulo">{`${ROTULO[estado]}${w.cerrado_at ? ` · ${horaAR(Date.parse(w.cerrado_at))}` : ''}`}</p>
            <p className="co-el__texto">{renderInline(c.hecho || c.decidido, 'ci-h', true)}</p>
            {/* El cierre se ve ENTERO (Martín, 17/10/2026): antes, con `hecho`, lo «decidido» no se dibujaba. */}
            {((c.hecho && c.decidido && c.decidido !== c.hecho) || c.comprobado || c.sigue || c.prueba) && (
              <dl className="co-el__dl">
                {c.hecho && c.decidido && c.decidido !== c.hecho && <><dt>Decidido</dt><dd>{renderInline(c.decidido, 'ci-d', true)}</dd></>}
                {c.comprobado && <><dt>Comprobado</dt><dd>{renderInline(c.comprobado, 'ci-c', true)}</dd></>}
                {c.sigue && <><dt>Sigue</dt><dd>{renderInline(c.sigue, 'ci-s', true)}</dd></>}
                {c.prueba && <><dt>Prueba</dt><dd>{renderInline(c.prueba, 'ci-p', true)}</dd></>}
              </dl>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** El Markdown de una respuesta, MEMORIZADO por su texto: es lo más caro de dibujar, y el refresco (cada 8 s, o 2,5 s con
 *  algo en camino) vuelve a armar la conversación aunque la respuesta sea la misma. */
const MarkdownDeTurno = memo(function MarkdownDeTurno({ texto }: { texto: string }) {
  return <Markdown text={texto} enlaces />;
});

/** Un turno: lo de Martín a la derecha en su burbuja; lo de otra sesión, igual pero con su nombre; lo que contestó el chat,
 *  a la izquierda con su muñeco, en Markdown (los chats contestan con listas y negritas), como Claude y ChatGPT. */
function Turno({ l, t, quien, vivo, extras, wa }: { l: LineaChat; t: TurnoChat; quien: Quien; vivo?: VivoDelHilo; extras?: ExtrasDelHilo; wa: DelHiloWA }) {
  const hora = horaAR(Date.parse(t.at));
  const id = idDeLinea(l);
  const m = mensajeDeLinea(l, quien.titulo);
  // El «Ya está» es un mensaje aparte (17/10/2026, la C): qué cambió, dónde revisarlo, su tarea del Plan y responder.
  if (t.rol === 'el' && esYaEsta(t.texto)) {
    return (
      <Deslizable m={m} className="co-el-wa">
        <div className="co-el co-el--especial" id={`co-turno-${t.uuid}`}>
        <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo="despierto" size={26} />
        <div className="co-el__cuerpo co-el__cuerpo--ancho">
          <YaEstaMensaje t={t} chat={vivo?.chat} tareas={extras?.tareas} onFeedback={extras?.onFeedback} />
          <p className="co-el__rotulo"><MarcasEnHora id={id} marcas={wa.marcas} />{hora}</p>
          <ReaccionWA id={id} marcas={wa.marcas} />
        </div>
        </div>
      </Deslizable>
    );
  }
  if (t.rol === 'el') {
    return (
      <Deslizable m={m} className="co-el-wa">
        <div className="co-el" id={`co-turno-${t.uuid}`}>
        <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo="despierto" size={26} />
        <div className="co-el__cuerpo">
          <div className="co-el__texto co-el__md"><MarkdownDeTurno texto={t.texto} /></div>
          <p className="co-el__rotulo"><MarcasEnHora id={id} marcas={wa.marcas} />{hora}</p>
          <ReaccionWA id={id} marcas={wa.marcas} />
        </div>
        </div>
      </Deslizable>
    );
  }
  return (
    <Deslizable m={m} className="co-yo">
      <div className="co-burbuja">
        {t.rol === 'otro' && <span className="co-burbuja__cita">{t.de ?? 'Otro chat'}</span>}
        <TextoMio texto={t.texto} lineas={wa.lineas} />
        <span className="co-burbuja__pie"><MarcasEnHora id={id} marcas={wa.marcas} />{hora}</span>
      </div>
      {t.rol === 'yo' ? <MiFoto /> : <span className="co-mifoto co-mifoto--otro" aria-hidden><Icon name="chats" size={14} /></span>}
      <ReaccionWA id={id} marcas={wa.marcas} />
    </Deslizable>
  );
}

/** Lo de WhatsApp que el hilo necesita para dibujar: las marcas de Martín y la conversación (para encontrar lo citado). */
type DelHiloWA = { marcas: MarcasChat | null | undefined; lineas: readonly LineaChat[] };

function Linea({ l, pushes, ahora, quien, vivo, onResponder, extras, wa }: { l: LineaChat; pushes: readonly PushP[]; ahora: number; quien: Quien; vivo?: VivoDelHilo; onResponder?: Responder; extras?: ExtrasDelHilo; wa: DelHiloWA }) {
  if (l.tipo === 'turno') return <Turno l={l} t={l.turno} quien={quien} vivo={vivo} extras={extras} wa={wa} />;
  if (l.tipo === 'pregunta') {
    // Lo que el chat pregunta: un mensaje suyo, con el formulario de opciones adentro (PreguntaChat.tsx, 17/10/2026).
    return (
      <div className="co-el co-el--especial">
        <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo="despierto" size={26} />
        <div className="co-el__cuerpo co-el__cuerpo--ancho">
          <PreguntaChat p={l.pregunta} onResponder={onResponder} enviada={!!l.trabajo} />
          <p className="co-el__rotulo">{horaAR(l.instante)}</p>
        </div>
      </div>
    );
  }
  if (l.tipo === 'trabajo') return <Trabajo l={l} w={l.trabajo} quien={quien} vivo={vivo} ahora={ahora} wa={wa} />;
  if (l.tipo === 'respuesta') {
    // Lo que contestó a una pregunta del chat: su burbuja, con la pregunta arriba en chico (como la cita de WhatsApp).
    const id = idDeLinea(l);
    return (
      <Deslizable m={mensajeDeLinea(l, quien.titulo)} className="co-yo">
        <p className="co-burbuja">
          <span className="co-burbuja__cita">{l.decision.pregunta}</span>
          {textoDeRespuesta(l.decision)}
          <span className="co-burbuja__pie"><MarcasEnHora id={id} marcas={wa.marcas} />{horaAR(l.instante)}</span>
        </p>
        <MiFoto />
        <ReaccionWA id={id} marcas={wa.marcas} />
      </Deslizable>
    );
  }
  if (l.tipo === 'derivado') {
    return (
      <div className="co-yo">
        <p className="co-burbuja">{l.pedido.texto}<span className="co-burbuja__pie">{horaAR(l.instante)}</span></p>
        <MiFoto />
        <p className="co-nota">{l.trabajaron.length ? `Lo trabajó ${l.trabajaron.join(', ')}` : 'Nadie lo tomó todavía'}</p>
      </div>
    );
  }
  return (
    <>
      <div className="co-yo">
        <p className="co-burbuja">{l.pedido.texto}<span className="co-burbuja__pie">{horaAR(l.instante)}</span></p>
        <MiFoto />
        {l.desde && <p className="co-nota">{`Lo pediste en ${l.desde}`}</p>}
      </div>
      {l.pasos.map((s, j) => {
        const subio = s.commits.map((k) => pushDelCommit(k.sha, pushes)).find(Boolean);
        return (
          <div key={j} className="co-el">
            <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo="despierto" size={26} />
            <div className="co-el__cuerpo">
              <p className="co-el__rotulo">{`${ROTULO_TIPO[s.tipo] ?? s.tipo}${s.instante != null ? ` · ${horaAR(s.instante)}` : ''}${subio ? ` · subió ${hace(subio.creado, ahora)}` : ''}`}</p>
              <p className="co-el__texto">{s.titulo}</p>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Las líneas de un chat, la más vieja arriba, con la píldora del día cada vez que cambia (WhatsApp). Sólo la
 *  conversación (`lineasDeConversacion`): los hitos van a la barra del Plan. */
/** Cuántos mensajes se dibujan al abrir un chat (los últimos): el resto, con «Ver mensajes anteriores» (WhatsApp y Telegram
 *  cargan para atrás de a tandas). Medido el 17/10/2026: abrir un chat de 60 respuestas trababa ~0,5 s con la CPU ×4. */
export const TANDA_HILO = 25;

function HiloSinMemo({ lineas: todas, pushes, ahora, vacio, quien, vivo, onResponder, tareas, onFeedback, marcas, pasos, mostrar, onVerAnteriores }: {
  lineas: readonly LineaChat[]; pushes: readonly PushP[]; ahora: number; vacio: string;
  /** El empleado de este chat: su muñeco va al lado de lo que hizo, y grande si todavía no hay nada. */
  quien: Quien & { animo: Animo; dato?: string | null };
  /** El chat y los Runners: con ellos cada trabajo dice en qué está, y el pie dice «Trabajando…» (17/10/2026). */
  vivo?: VivoDelHilo;
  /** Contestar una pregunta del chat (useCentro.ts → contestarPregunta). Sin esto, el formulario se ve y no se toca. */
  onResponder?: Responder;
  /** Las marcas de Martín en los mensajes (reacciones, destacados, fijados, eliminados para él: lib/centro-mensajes.ts). */
  marcas?: MarcasChat | null;
  /** Los pasos en vivo del turno abierto (la E, lib/centro-pasos.ts): van en el «Trabajando…». */
  pasos?: readonly PasoDelTurno[];
  /** Cuántos de los últimos mensajes se dibujan (sin esto, todos) y cómo se piden los de antes. */
  mostrar?: number;
  onVerAnteriores?: () => void;
} & ExtrasDelHilo) {
  // Lo que Martín eliminó para él no se dibuja (WhatsApp: «Eliminar para mí»).
  const lineas = sinOcultos(lineasDeConversacion(todas), marcas);
  const wa: DelHiloWA = { marcas, lineas };
  const trabaja = vivo ? chatTrabajando(vivo.chat, todas, ahora) : false;
  if (!lineas.length) {
    return (
      <div className="co-portada">
        <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo={quien.animo} size={76} />
        <p className="co-portada__nombre">{quien.titulo}</p>
        <p className="co-portada__dato">{quien.dato ?? vacio}</p>
      </div>
    );
  }
  const ocultas = mostrar != null && onVerAnteriores ? Math.max(0, lineas.length - mostrar) : 0;
  const items: Array<{ k: string; dia?: string; l?: LineaChat }> = [];
  let ultimoDia: number | null = null;
  lineas.forEach((l, i) => {
    if (i < ocultas) return;
    const d = diaAR(l.instante);
    if (d !== ultimoDia) { items.push({ k: `d${i}`, dia: rotuloDia(l.instante, ahora) }); ultimoDia = d; }
    items.push({ k: `l${i}`, l });
  });
  return (
    <>
      {ocultas > 0 && <button type="button" className="co-anteriores" onClick={onVerAnteriores}>{`Ver ${ocultas} mensajes anteriores`}</button>}
      {items.map((it) => (it.dia
        ? <span key={it.k} className="co-dia">{it.dia}</span>
        : <Linea key={it.k} l={it.l!} pushes={pushes} ahora={ahora} quien={quien} vivo={vivo} onResponder={onResponder} extras={{ tareas, onFeedback }} wa={wa} />))}
      {/* «Trabajando…» con sus pasos desplegables, UNA pieza para todos los chats (Trabajando.tsx). Con la clave del chat: al
          cambiar de chat arranca cerrada. */}
      {trabaja && <Trabajando key={quien.titulo} titulo={quien.titulo} aspecto={quien.aspecto} pasos={pasos} />}
    </>
  );
}

/**
 * MEMORIZADO (17/10/2026, «En general en mobile no funciona rápido todo como debería»): cada tecla de la caja cambia el
 * estado del motor (el borrador) y volvía a dibujar la conversación ENTERA, con el Markdown de cada respuesta. Con `memo`
 * y props estables (las líneas del mapa de useCentro.ts, `quien` y `vivo` memorizados por quien la monta) escribir no
 * la toca. La medición, en docs/hallazgos-operaciones.md.
 */
export const Hilo = memo(HiloSinMemo);
