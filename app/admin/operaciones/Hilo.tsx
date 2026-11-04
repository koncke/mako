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
import { ROTULO, type EstadoPedido, textoDelEncargo } from '@/lib/operaciones-reglas';
import { agruparAvances, chatTrabajando, completadosDelChat, estadoDelEnvio, lineasDeConversacion, primeraOracion, type CarteroP, type ChatCentro, type GrupoDeAvances, type LineaChat, type TrabajoP } from '@/lib/centro-chats';
import { YaEstaMensaje } from './Avance';
import type { TareaDelChat } from '@/lib/centro-plan-auto-reglas';
import type { Cierre, TurnoChat } from '@/lib/operaciones-reglas';
import { Markdown, conFormato } from '@/app/_components/Markdown';
import { listasEnRenglones } from '@/lib/respuesta-como-claude';
import { diaAR, horaAR, rotuloDia } from '@/lib/centro-fechas';
import { textoDeRespuesta } from '@/app/admin/runway/decisiones';
import { Muneco, type Animo } from './Muneco';
import type { Aspecto } from '@/lib/centro-munecos';
import { ROTULO_TIPO, hace, pushDelCommit, type PushP } from '@/lib/progreso-reglas';
import type { Responder } from './PreguntaChat';
import { textoDeDecision } from '@/lib/centro-preguntas-chat';
import { TEXTO_SOLO_ADJUNTOS, bloquesDeMensaje } from '@/lib/centro-caja';
import { AdjuntosDeLaApp, AdjuntosEnBurbuja } from './FotosEnviadas';
import { VozEnviada } from './VozEnviada';
import { descartarEnvio, reintentarEnvio } from './envios-en-curso';
import { MiFoto } from './MiFoto';
import { iniciales } from '@/lib/unicode-seguro';
import { ConLinks } from './ConLinks';
import { memo, useState, type ReactNode } from 'react';
import { idDeLinea, leerCita, leerReenvio, mensajeDeLinea, sinOcultos, type MarcasChat, type MensajeWA } from '@/lib/centro-mensajes';
import { CitaEnBurbuja, Deslizable, MarcasEnHora, ReaccionWA } from './MensajeWA';
import type { PasoDelTurno } from '@/lib/centro-pasos';
import { Trabajando } from './Trabajando';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

// La hora de cada mensaje y la píldora del día, con el reloj de Argentina: lib/centro-fechas.ts (las usa también el «Completado»).

/** Lo que todavía está SALIENDO (envios-en-curso.ts, 27/10/2026): el reloj de WhatsApp, y ✕ si no salió. */
function TickLocal({ local }: { local: NonNullable<TrabajoP['local']> }) {
  if (local.fase === 'fallo') return <span className="co-tick co-tick--mal" title="No salió"><Icon name="x" size={12} /></span>;
  return <span className="co-tick co-tick--saliendo" title={local.fase === 'transcribiendo' ? 'Transcribiendo y mandando' : 'Mandando'}><Icon name="reloj" size={12} /></span>;
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
/** Una nota de voz de Martín (26/10/2026, VozEnviada.tsx): la cita arriba si respondía a un mensaje, y el reproductor. */
function NotaMia({ w, lineas }: { w: TrabajoP & { voz: { segundos: number } }; lineas: readonly LineaChat[] }) {
  const conCita = leerCita(w.texto ?? '');
  return (
    <>
      {conCita && <CitaEnBurbuja de={conCita.cita.de} texto={conCita.cita.texto} lineas={lineas} />}
      <VozEnviada key={w.id} id={w.id} segundos={w.voz.segundos} creado={w.created_at} transcripcion={<TextoConListas texto={conCita?.resto ?? w.texto ?? ''} />} />
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
export type VivoDelHilo = {
  chat: Pick<ChatCentro, 'estado' | 'viejo' | 'sinRunner' | 'clave' | 'sesion' | 'titulo'>; carteros: readonly CarteroP[];
  /** El chat tiene abierta una pregunta de la app de Claude (`preguntasDeLaApp`): no lee nada hasta que se conteste ahí. */
  trabado?: boolean;
};

/** Lo del «Ya está» de un chat (17/10/2026, la C): sus tareas del Plan y responder sobre lo que dijo. */
export type ExtrasDelHilo = {
  tareas?: readonly TareaDelChat[]; onFeedback?: (t: TurnoChat) => void;
  /** El ✓ de los «Completado» (18/10/2026): hasta qué «Ya está» lo vio Martín, y cómo se marca uno. */
  yaVisto?: number | null; onYaVisto?: (instante: number) => void;
};

function Trabajo({ l, w, quien, vivo, ahora, wa }: { l: LineaChat; w: TrabajoP; quien: Quien; vivo?: VivoDelHilo; ahora: number; wa: DelHiloWA }) {
  const id = idDeLinea(l);
  const t = Date.parse(w.created_at);
  const estado = w.estado ?? 'escrito';
  const mal = estado === 'no_entregado' || estado === 'incierto' || estado === 'cancelado';
  const c = w.cierre;
  // «Enviado» → «La PC lo recibió», y por qué tarda si tarda (Martín, 17/10/2026: «no pasó nada por varios segundos»).
  // Lo que todavía está saliendo de este navegador no tiene nada de eso: su reloj alcanza (27/10/2026).
  const va = vivo && !w.local ? estadoDelEnvio(w, vivo.chat, vivo.carteros, ahora, !!vivo.trabado) : null;
  return (
    <>
      <Deslizable m={mensajeDeLinea(l, quien.titulo)} className="co-yo">
        <div className={`co-burbuja${w.adjuntos?.length ? ' co-burbuja--con-adjuntos' : ''}${w.voz ? ' co-burbuja--voz' : ''}`}>
          {/* Las fotos arriba del texto, como WhatsApp (FotosEnviadas.tsx: por qué no se veían y de dónde salen). */}
          {w.adjuntos?.length ? <AdjuntosEnBurbuja key={w.id} id={w.id} nombres={w.adjuntos} fotos={w.fotos} creado={w.created_at} /> : null}
          {w.voz ? <NotaMia w={{ ...w, voz: w.voz }} lineas={wa.lineas} />
            : !(w.adjuntos?.length && w.texto === TEXTO_SOLO_ADJUNTOS) && <TextoMio texto={w.texto ?? ''} lineas={wa.lineas} />}
          <span className="co-burbuja__pie"><MarcasEnHora id={id} marcas={wa.marcas} />{Number.isFinite(t) ? horaAR(t) : ''}{w.local ? <TickLocal local={w.local} /> : <Tick estado={estado} />}</span>
        </div>
        <MiFoto />
        <ReaccionWA id={id} marcas={wa.marcas} />
        {/* Un aviso se ve como aviso (17/10/2026: «los mensajes especiales se tienen que ver más llamativos»). */}
        {mal && <p className="co-nota co-nota--mal co-aviso" role="alert"><Icon name="x" size={12} />{`${ROTULO[estado]}${w.motivo ? ` · ${w.motivo}` : ''}`}<ReportarASoporte /></p>}
        {/* Lo que no salió de este navegador dice qué falló y se reintenta en el lugar (27/10/2026). */}
        {w.local?.fase === 'fallo' && (
          <p className="co-nota co-nota--mal co-aviso co-envio-fallo" role="alert">
            <span><Icon name="x" size={12} />{` No salió${w.local.error ? ` · ${w.local.error}` : ''}`}</span>
            <button type="button" className="co-chip" onClick={() => reintentarEnvio(w.id)}>Reintentar</button>
            <button type="button" className="co-chip co-chip--quieto" onClick={() => descartarEnvio(w.id)}>Descartar</button>
            <ReportarASoporte />
          </p>
        )}
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
            <CierreDelChat c={c} />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * UN mensaje de la persona: su globo a la derecha, con SU foto (MiFoto.tsx), lo de WhatsApp (deslizar para responder, el
 * menú del clic derecho: MensajeWA.tsx → Deslizable) y su reacción. La MISMA fila en el Ops Center de Martín y en el chat con
 * MaKo de cada cliente (app/_chat/HiloMako.tsx): 21/10/2026, Martín: «Los chats cortados a la mitad, sin la foto de perfil del
 * dueño». `children` es el globo; `despues`, lo que va debajo (un aviso, en qué está).
 */
export function FilaMia({ m, marcas, foto, children, despues }: {
  m: MensajeWA | null; marcas: MarcasChat | null | undefined; foto?: ReactNode; children: ReactNode; despues?: ReactNode;
}) {
  return (
    <Deslizable m={m} className="co-yo">
      {children}
      {foto ?? <MiFoto />}
      <ReaccionWA id={m?.id ?? null} marcas={marcas} />
      {despues}
    </Deslizable>
  );
}

/**
 * UN mensaje de OTRA persona, en un grupo (3/11/2026; Martín: «tipo grupos de WhatsApp»): su globo a la izquierda, con su inicial al lado
 * de la colita y su nombre adentro. El nombre lo pone quien la monta, porque va adentro del globo. `sigue`: otro del mismo autor,
 * sin repetir la inicial.
 */
export function FilaDeOtro({ m, nombre, sigue = false, children, despues }: {
  m: MensajeWA | null; nombre: string; sigue?: boolean; children: ReactNode; despues?: ReactNode;
}) {
  return (
    <Deslizable m={m} className={`co-otro${sigue ? ' co-otro--sigue' : ''}`}>
      {!sigue && <span className="co-mifoto co-mifoto--otro" aria-hidden>{iniciales(nombre, 1, '?')}</span>}
      {children}
      {despues}
    </Deslizable>
  );
}

/**
 * UN mensaje del chat: su criatura a la izquierda y lo que dijo en su globo (o, con `ancho`, una tarjeta especial sin globo:
 * un «Completado», una pregunta, una tarjeta de MaKo), con la hora abajo. La MISMA fila en el Ops Center y en el chat con MaKo.
 */
export function FilaDelChat({ m, quien, marcas, hora, especial = false, ancho = especial, idTurno, children }: {
  m: MensajeWA | null; quien: Quien; marcas: MarcasChat | null | undefined; hora: string | null;
  especial?: boolean; ancho?: boolean; idTurno?: string; children: ReactNode;
}) {
  return (
    <Deslizable m={m} className="co-el-wa">
      <div className={`co-el${especial ? ' co-el--especial' : ''}`} id={idTurno}>
        <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo="despierto" size={26} />
        <div className={`co-el__cuerpo${ancho ? ' co-el__cuerpo--ancho' : ''}`}>
          {children}
          {hora != null && <p className="co-el__rotulo"><MarcasEnHora id={m?.id ?? null} marcas={marcas} />{hora}</p>}
          <ReaccionWA id={m?.id ?? null} marcas={marcas} />
        </div>
      </div>
    </Deslizable>
  );
}

/** El Markdown de una respuesta, MEMORIZADO por su texto: es lo más caro de dibujar, y el refresco (cada 8 s, o 2,5 s con
 *  algo en camino) vuelve a armar la conversación aunque la respuesta sea la misma. Como una respuesta de Claude (26/10/2026):
 *  un «1) … 2) …» corrido es una lista (lib/respuesta-como-claude.ts), y con el aire de sus párrafos. */
const MarkdownDeTurno = memo(function MarkdownDeTurno({ texto }: { texto: string }) {
  return <Markdown text={listasEnRenglones(texto)} enlaces aire />;
});

/** Hasta cuánto una parte del cierre va en columna con su rótulo en la computadora (en el teléfono, nunca). */
const PARTE_CORTA = 90;

/**
 * El cierre de un chat, como una respuesta de Claude (26/10/2026; Martín, con captura del teléfono: «Mira que feo el formato
 * de las respuestas, mejora eso... Que se parezca a Claude las respuestas»). Arriba lo que hizo (o lo que decidió), en
 * Markdown; debajo cada parte con su rótulo ARRIBA de su texto, nunca en una columna angosta. En la computadora, si todas son
 * cortas, el rótulo va al lado (centro.css → `.co-cierre--corto`). La prueba, chica y gris al pie. El cierre se ve ENTERO
 * (Martín, 17/10/2026): antes, con `hecho`, lo «decidido» no se dibujaba.
 */
function CierreDelChat({ c }: { c: Cierre }) {
  const partes: Array<[string, string]> = [
    ...(c.hecho && c.decidido && c.decidido !== c.hecho ? [['Decidido', c.decidido] as [string, string]] : []),
    ...(c.comprobado ? [['Comprobado', c.comprobado] as [string, string]] : []),
    ...(c.sigue ? [['Sigue', c.sigue] as [string, string]] : []),
  ];
  const cortas = partes.every(([, t]) => t.length <= PARTE_CORTA && !t.includes('\n') && listasEnRenglones(t) === t);
  return (
    <>
      <div className="co-el__texto co-el__md"><MarkdownDeTurno texto={c.hecho || c.decidido} /></div>
      {partes.length > 0 && (
        <div className={`co-cierre${cortas ? ' co-cierre--corto' : ''}`}>
          {partes.map(([rotulo, texto]) => (
            <div key={rotulo} className="co-cierre__parte">
              <p className="co-cierre__rotulo">{rotulo}</p>
              <div className="co-cierre__texto co-el__md"><MarkdownDeTurno texto={texto} /></div>
            </div>
          ))}
        </div>
      )}
      {c.prueba && <p className="co-cierre__prueba">{conFormato(c.prueba, 'ci-p')}</p>}
    </>
  );
}

/** Un turno: lo de Martín a la derecha en su burbuja; lo de otra sesión, igual pero con su nombre; lo que contestó el chat,
 *  a la izquierda con su muñeco, en Markdown (los chats contestan con listas y negritas), como Claude y ChatGPT. */
function Turno({ l, t, quien, vivo, extras, wa }: { l: LineaChat; t: TurnoChat; quien: Quien; vivo?: VivoDelHilo; extras?: ExtrasDelHilo; wa: DelHiloWA }) {
  const hora = horaAR(Date.parse(t.at));
  const id = idDeLinea(l);
  const m = mensajeDeLinea(l, quien.titulo);
  // El «Ya está» es un mensaje aparte (17/10/2026, la C): qué cambió, dónde revisarlo, su tarea del Plan y responder.
  // Desde el 27/10/2026, el de su TRAMO (`completadosDelChat`): un «Ya está probado…» a mitad del trabajo no es la tarjeta.
  if (t.rol === 'el' && wa.completados.has(t.uuid)) {
    return (
      <FilaDelChat m={m} quien={quien} marcas={wa.marcas} hora={hora} especial idTurno={`co-turno-${t.uuid}`}>
        <YaEstaMensaje t={t} chat={vivo?.chat} tareas={extras?.tareas} onFeedback={extras?.onFeedback} yaVisto={extras?.yaVisto} onYaVisto={extras?.onYaVisto} />
      </FilaDelChat>
    );
  }
  // Lo que le escribió a OTRO chat (22/10/2026, `turnosParaOtro`): una línea, «Avance: …», que se abre al tocarla.
  if (t.rol === 'el' && l.tipo === 'turno' && l.plegado) {
    return (
      <FilaDelChat m={m} quien={quien} marcas={wa.marcas} hora={hora} idTurno={`co-turno-${t.uuid}`}>
        <Avance texto={t.texto} />
      </FilaDelChat>
    );
  }
  if (t.rol === 'el') {
    return (
      <FilaDelChat m={m} quien={quien} marcas={wa.marcas} hora={hora} idTurno={`co-turno-${t.uuid}`}>
        <div className="co-el__texto co-el__md"><MarkdownDeTurno texto={t.texto} /></div>
      </FilaDelChat>
    );
  }
  // El encargo con el que otra sesión abrió este chat (27/10/2026, Martín: «Yo NO envié ese mensaje confuso y largo»): del
  // Cerebro, con el ícono de chats y plegado. Nunca con la foto de Martín.
  if (t.encargo) {
    return (
      <FilaMia m={m} marcas={wa.marcas} foto={<span className="co-mifoto co-mifoto--otro" aria-hidden><Icon name="chats" size={14} /></span>}>
        <div className="co-burbuja co-burbuja--encargo">
          <EncargoPlegado texto={t.texto} />
          <span className="co-burbuja__pie"><MarcasEnHora id={id} marcas={wa.marcas} />{hora}</span>
        </div>
      </FilaMia>
    );
  }
  return (
    <FilaMia m={m} marcas={wa.marcas} foto={t.rol === 'yo' ? undefined : <span className="co-mifoto co-mifoto--otro" aria-hidden><Icon name="chats" size={14} /></span>}>
      <div className={`co-burbuja${t.adjuntos?.length ? ' co-burbuja--con-adjuntos' : ''}`}>
        {t.rol === 'otro' && <span className="co-burbuja__cita">{t.de ?? 'Otro chat'}</span>}
        {/* Lo que adjuntó en la app de Claude (20/10/2026): arriba del texto, como las fotos que salen por el Ops Center. */}
        {t.adjuntos?.length ? <AdjuntosDeLaApp adjuntos={t.adjuntos} /> : null}
        {t.texto && <TextoMio texto={t.texto} lineas={wa.lineas} />}
        {/* Lo que Martín escribió DIRECTO en la app de Claude (no pasó por la cola del Ops Center: sin `trabajo`) lo dice,
            chico y en gris junto a la hora (18/10/2026: «un pequeño y sutil aclaración de que ese mensaje se envió por aquí»). */}
        <span className="co-burbuja__pie"><MarcasEnHora id={id} marcas={wa.marcas} />{t.rol === 'yo' && !t.trabajo && <span className="co-burbuja__desde" title="Lo escribiste directo en la app de Claude">En la app de Claude</span>}{hora}</span>
      </div>
    </FilaMia>
  );
}

/** El encargo del Cerebro (`esEncargoDeOtraSesion`): plegado en qué se le pidió (su «Task:»), y tocarlo lo abre entero. */
function EncargoPlegado({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  const pedido = textoDelEncargo(texto);
  return (
    <>
      <span className="co-burbuja__cita">Encargo del Cerebro</span>
      <button type="button" className="co-avance co-avance--encargo" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} title={abierto ? 'Plegar' : 'Ver el encargo entero'}>
        {primeraOracion(pedido)}
      </button>
      {abierto && <div className="co-avance__abierto co-el__md"><MarkdownDeTurno texto={texto} /></div>}
    </>
  );
}

/** Un turno que el chat le escribió a otro chat: plegado en su primera oración; tocarlo lo abre entero, y otra vez lo cierra. */
function Avance({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="co-el__texto">
      <button type="button" className="co-avance" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} title={abierto ? 'Plegar' : 'Ver todo'}>
        {`Avance: ${primeraOracion(texto)}`}
      </button>
      {abierto && <div className="co-avance__abierto co-el__md"><MarkdownDeTurno texto={texto} /></div>}
    </div>
  );
}

type TurnoLinea = Extract<LineaChat, { tipo: 'turno' }>;
/** Desde cuántos caracteres el último avance de un grupo se pliega a su comienzo (y se abre tocándolo). */
const AVANCE_LARGO = 700;
/** Cuántos de los anteriores se ven sin tocar «Ver los otros»: con 30 seguidos, la burbuja no puede volver a ser la pantalla. */
const AVANCES_A_LA_VISTA = 5;

/** Uno de los anteriores de un grupo: su hora y su primera oración; tocarlo lo abre entero, y otra vez lo cierra. */
function AvanceAnterior({ t }: { t: TurnoLinea['turno'] }) {
  const [abierto, setAbierto] = useState(false);
  const hora = horaAR(Date.parse(t.at));
  return (
    <li id={`co-turno-${t.uuid}`}>
      <button type="button" className="co-avances__item" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <span className="co-avances__flecha" aria-hidden>{abierto ? '▾' : '▸'}</span>
        <span className="co-avances__hora">{hora}</span>
        <span className="co-avances__linea">{primeraOracion(t.texto)}</span>
      </button>
      {abierto && <div className="co-avances__abierto co-el__md"><MarkdownDeTurno texto={t.texto} /></div>}
    </li>
  );
}

/**
 * Los «Avance» seguidos de un chat, en UNA burbuja (25/10/2026, Martín: «agruparlos todos en 1 de ultima y que dentro tenga
 * varios desplegables»; la regla de qué va junto es `agruparAvances`, lib/centro-chats.ts). Arriba el último, entero (si es
 * muy largo, su comienzo, y se abre tocándolo); abajo los anteriores, del más nuevo al más viejo, cada uno con su flecha, su
 * hora y su primera oración. La burbuja es la del último: su hora, sus marcas y su respuesta (deslizar para responder).
 */
function AvancesSinMemo({ g, quien, wa }: { g: GrupoDeAvances; quien: Quien; wa: DelHiloWA }) {
  const ultimo = g.avances[g.avances.length - 1] as TurnoLinea;
  const t = ultimo.turno;
  const anteriores = (g.avances.slice(0, -1) as TurnoLinea[]).reverse();
  const [abierto, setAbierto] = useState(false);
  const [todos, setTodos] = useState(false);
  const plegado = t.texto.length > AVANCE_LARGO && !abierto;
  const aLaVista = todos ? anteriores : anteriores.slice(0, AVANCES_A_LA_VISTA);
  const abrir = (e: { target: EventTarget | null }) => {
    if ((e.target as HTMLElement | null)?.closest?.('a') || window.getSelection()?.toString()) return;
    setAbierto(true);
  };
  return (
    <FilaDelChat m={mensajeDeLinea(ultimo, quien.titulo)} quien={quien} marcas={wa.marcas} hora={horaAR(Date.parse(t.at))} idTurno={`co-turno-${t.uuid}`}>
      <div className="co-avances" role="group" aria-label={`${g.avances.length} avances`}>
        <p className="co-avances__rotulo">{`Avance · ${g.avances.length}`}</p>
        {plegado ? (
          <div className="co-avances__ultimo co-avances__ultimo--plegado co-el__md" role="button" tabIndex={0} aria-expanded={false}
            title="Tocar para leer todo" onClick={abrir}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setAbierto(true); } }}>
            <MarkdownDeTurno texto={t.texto} />
          </div>
        ) : <div className="co-avances__ultimo co-el__md"><MarkdownDeTurno texto={t.texto} /></div>}
        <ol className="co-avances__lista" aria-label="Los anteriores">
          {aLaVista.map((a) => <AvanceAnterior key={a.turno.uuid} t={a.turno} />)}
        </ol>
        {anteriores.length > aLaVista.length && (
          <button type="button" className="co-avances__mas" onClick={() => setTodos(true)}>
            {`Ver ${anteriores.length - aLaVista.length === 1 ? 'el otro' : `los otros ${anteriores.length - aLaVista.length}`}`}
          </button>
        )}
      </div>
    </FilaDelChat>
  );
}
/** Memorizado por sus líneas (estables, lib/centro-estable.ts): el refresco no vuelve a dibujar un grupo que no cambió. */
const Avances = memo(AvancesSinMemo, (a, b) => a.quien === b.quien && a.wa.marcas === b.wa.marcas
  && a.g.avances.length === b.g.avances.length && a.g.avances.every((x, i) => x === b.g.avances[i]));

/** Lo de WhatsApp que el hilo necesita para dibujar: las marcas de Martín y la conversación (para encontrar lo citado). */
/** `completados`: los turnos que son el «Completado» de su tramo (lib/centro-chats.ts → completadosDelChat, 27/10/2026). */
type DelHiloWA = { marcas: MarcasChat | null | undefined; lineas: readonly LineaChat[]; completados: ReadonlySet<string> };

function LineaSinMemo({ l, pushes, ahora, quien, vivo, extras, wa }: { l: LineaChat; pushes: readonly PushP[]; ahora: number; quien: Quien; vivo?: VivoDelHilo; extras?: ExtrasDelHilo; wa: DelHiloWA }) {
  if (l.tipo === 'turno') return <Turno l={l} t={l.turno} quien={quien} vivo={vivo} extras={extras} wa={wa} />;
  if (l.tipo === 'pregunta') {
    // 22/10/2026, Martín: «Las decisiones deben salir como en Claude, un bloque arriba del chat con las opciones». La pregunta
    // ABIERTA va arriba de la caja (PreguntasDelChat.tsx), no acá; la que el chat dejó atrás sin respuesta, tampoco (era la
    // tarjeta con «Ya no espera tu respuesta»). La contestada queda como un mensaje de Martín: «Decisión: …», con la pregunta
    // citada arriba; si salió y la base todavía no la marcó, «Decisión enviada».
    const r = l.pregunta.respuesta;
    if (!r && !l.trabajo) return null;
    return (
      <div className="co-yo co-yo--decision">
        <p className="co-burbuja">
          <span className="co-burbuja__cita">{l.pregunta.pregunta}</span>
          {r ? textoDeDecision(l.pregunta, r) : 'Decisión enviada'}
          <span className="co-burbuja__pie">{horaAR(r ? Date.parse(r.at) : l.instante)}</span>
        </p>
        <MiFoto />
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

type PropsLinea = Parameters<typeof LineaSinMemo>[0];
const minuto = (t: number) => Math.floor(t / 60_000);
const mismosElementos = <T,>(a: readonly T[], b: readonly T[]) => a === b || (a.length === b.length && a.every((x, i) => x === b[i]));
/**
 * ¿Se puede NO volver a dibujar esta línea? (23/10/2026: un chat trabajando trababa 0,7–3,6 s en cada refresco). Con la línea
 * estable (lib/centro-estable.ts), lo mismo de antes no se redibuja: sólo lo nuevo. Un TRABAJO en camino dice en qué está con
 * el reloj y el Runner (`estadoDelEnvio`): ése sí, cada vez. Lo demás mira el reloj al minuto, y del chat, el chat.
 */
export function mismaLinea(a: PropsLinea, b: PropsLinea): boolean {
  if (a.l !== b.l || a.quien !== b.quien || a.pushes !== b.pushes || a.wa.marcas !== b.wa.marcas || !mismosElementos(a.wa.lineas, b.wa.lineas)) return false;
  const ea = a.extras, eb = b.extras;
  if (ea?.tareas !== eb?.tareas || ea?.onFeedback !== eb?.onFeedback || ea?.yaVisto !== eb?.yaVisto || ea?.onYaVisto !== eb?.onYaVisto) return false;
  if (a.l.tipo === 'trabajo') return a.ahora === b.ahora && a.vivo === b.vivo;
  return minuto(a.ahora) === minuto(b.ahora) && a.vivo?.chat === b.vivo?.chat;
}
const Linea = memo(LineaSinMemo, mismaLinea);

/** Las líneas de un chat, la más vieja arriba, con la píldora del día cada vez que cambia (WhatsApp). Sólo la
 *  conversación (`lineasDeConversacion`): los hitos van a la barra del Plan. */
/** Cuántos mensajes se dibujan al abrir un chat (los últimos): el resto, con «Ver mensajes anteriores» (WhatsApp y Telegram
 *  cargan para atrás de a tandas). Medido el 17/10/2026: abrir un chat de 60 respuestas trababa ~0,5 s con la CPU ×4. */
export const TANDA_HILO = 25;

function HiloSinMemo({ lineas: todas, pushes, ahora, vacio, quien, vivo, tareas, onFeedback, yaVisto, onYaVisto, marcas, pasos, mostrar, onVerAnteriores }: {
  lineas: readonly LineaChat[]; pushes: readonly PushP[]; ahora: number; vacio: string;
  /** El empleado de este chat: su muñeco va al lado de lo que hizo, y grande si todavía no hay nada. */
  quien: Quien & { animo: Animo; dato?: string | null };
  /** El chat y los Runners: con ellos cada trabajo dice en qué está, y el pie dice «Trabajando…» (17/10/2026). */
  vivo?: VivoDelHilo;
  /** Ya no lo usa el hilo: las preguntas abiertas se contestan arriba de la caja (PreguntasDelChat.tsx, 22/10/2026). */
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
  const wa: DelHiloWA = { marcas, lineas, completados: new Set(completadosDelChat(todas).map((x) => x.turno.uuid)) };
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
  // Los «Avance» seguidos van en UNA burbuja (`agruparAvances`, 25/10/2026). Se agrupa lo que se ve: «Ver N mensajes
  // anteriores» sigue contando mensajes, y la clave de un grupo es la de su primera línea (crece sin perder lo abierto).
  const indice = new Map(lineas.map((l, i) => [l, i] as const));
  const items: Array<{ k: string; dia?: string; l?: LineaChat; g?: GrupoDeAvances }> = [];
  let ultimoDia: number | null = null;
  for (const p of agruparAvances(lineas.slice(ocultas))) {
    const primera = p.tipo === 'avances' ? p.avances[0] : p;
    const i = indice.get(primera) ?? items.length;
    const d = diaAR(primera.instante);
    if (d !== ultimoDia) { items.push({ k: `d${i}`, dia: rotuloDia(primera.instante, ahora) }); ultimoDia = d; }
    items.push(p.tipo === 'avances' ? { k: `g${i}`, g: p } : { k: `l${i}`, l: p });
  }
  return (
    <>
      {ocultas > 0 && <button type="button" className="co-anteriores" onClick={onVerAnteriores}>{`Ver ${ocultas} mensajes anteriores`}</button>}
      {items.map((it) => (it.dia
        ? <span key={it.k} className="co-dia">{it.dia}</span>
        : it.g ? <Avances key={it.k} g={it.g} quien={quien} wa={wa} />
          : <Linea key={it.k} l={it.l!} pushes={pushes} ahora={ahora} quien={quien} vivo={vivo} extras={{ tareas, onFeedback, yaVisto, onYaVisto }} wa={wa} />))}
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
