'use client';

// =============================================================================
// El hilo de un chat con MaKo, con la cara del Centro de Operaciones (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md: la conversación de la pieza única. Dibuja el `ItemHilo` del teléfono
// (app/m/mako/chat-ui.ts: lo que el turno guardó, lo que espera confirmación, los avisos) con las formas del Centro
// (app/admin/operaciones/Hilo.tsx): lo de la persona en una burbuja a la derecha, lo de MaKo suelto a la izquierda
// con su muñeco (Grok Bot), la píldora del día cuando cambia (WhatsApp). El texto de MaKo va por <Markdown>.
//
// ⚠️ LA HORA ES LA DEL NAVEGADOR DE QUIEN MIRA, no la de Argentina: el Centro es de Martín y fija su reloj; este chat
//    es de cualquier negocio (AGENTS.md, la zona horaria por ubicación).
//
// LAS FILAS SON LAS DEL OPS CENTER (21/10/2026, Martín: «Los chats cortados a la mitad, sin la foto de perfil del dueño»): lo de
// la persona y lo de MaKo se dibujan con `FilaMia` y `FilaDelChat` de app/admin/operaciones/Hilo.tsx, las MISMAS del super
// admin (el globo con su colita, la foto de quien escribe, la hora, lo de WhatsApp). Medido ese día en el ws1: el hilo iba
// suelto en `.co-hilo` (display: block) y `.co-yo { align-self: flex-end }` no hacía nada: lo de la persona quedaba a la
// izquierda, con 760 px de ancho, cortado a la mitad. Quien lo monta lo pone en `.co-hilo__col` (PanelChat.tsx).
//
// EL CLIC DERECHO EN LOS CHATS EMBEBIDOS (24/10/2026, Martín: «en Automations o Web Generator, si le doy click derecho, no
// hace nada»; plan en docs/diseno-editor-web-como-automations.md §5). El menú de un mensaje vive en MensajeWA (`Deslizable`)
// y se prende con `ContextoWA`, que sólo daban el Ops Center, el teléfono y el Second Brain: ningún chat embebido lo tenía.
// Ahora, si quien monta el hilo NO trae su ContextoWA, el hilo pone uno MÍNIMO (`MenuDelMensaje`): Copiar siempre, y
// Responder cuando la pantalla sabe poner la cita en su caja (`onCitar`). Reenviar, Fijar, Destacar y las reacciones
// necesitan dónde guardarse: quedan para los chats con conversación guardada, que traen el suyo. Una vez acá, los once.

import { useContext, useMemo, useState, type ReactNode } from 'react';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { Markdown } from '@/app/_components/Markdown';
import { partirPegados } from '@/lib/chat-pegado';
import { PegadosHilo, TextoPlegable } from './PegadoHilo';
import Link from '@/app/_ui/Link';
import type { Muneco } from '@/app/admin/operaciones/Muneco';
import { FilaDelChat, FilaDeOtro, FilaMia } from '@/app/admin/operaciones/Hilo';
import { Trabajando } from '@/app/admin/operaciones/Trabajando';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import { leerCita, renglonDeCita, type IdMensaje, type MarcasChat, type MensajeWA } from '@/lib/centro-mensajes';
export { idWA, mensajeWADe } from '@/app/m/mako/chat-ui';
import { CitaEnBurbuja, ContextoWA, MarcasEnHora, type AccionesWA } from '@/app/admin/operaciones/MensajeWA';
import { ERROR_INCIERTO, conRespuestas, idWA, mensajeWADe, textoConArchivos, type ItemHilo } from '@/app/m/mako/chat-ui';
import { TarjetaAccion, type ItemPropuesta } from './TarjetaAccion';
import { ArchivosHilo } from './ArchivosHilo';
import { ConectarDelAviso } from './ConectarDelAviso';
import { BloqueHilo } from './BloqueHilo';
import { FormularioEnChat } from './FormularioEnChat';
import { ACCIONES_FORMULARIO } from './acciones-formulario';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useReportarRespuesta } from './ReportarRespuesta';

const hora = (iso: string | null): string => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
};
const diaDe = (iso: string | null): string | null => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t).toDateString() : null;
};
function rotuloDia(iso: string, ahora: number): string {
  const t = Date.parse(iso);
  const dia = (x: number) => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const d = Math.round((dia(ahora) - dia(t)) / 86_400_000);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  return new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export type Quien = { nombre: string; aspecto?: Parameters<typeof Muneco>[0]['aspecto'] };

type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;
/** El mensaje que una cita respondió: el último que empieza con el renglón citado (como `buscarCitado` del Centro). */
function citadoEn(items: readonly ItemHilo[], texto: string): IdMensaje | null {
  const buscado = texto.replace(/…$/, '').trim();
  if (!buscado) return null;
  for (let i = items.length - 1; i >= 0; i--) {
    const x = items[i];
    if (x.k === 'msg' && renglonDeCita(x.texto, 100_000).startsWith(buscado)) return idWA(x);
  }
  return null;
}

/** Lo de MaKo: su criatura y lo que dijo en su globo, a la izquierda (`ancho`: una tarjeta, sin globo). La fila del Ops Center. */
function DeMako({ quien, children, hora = null, ancho = false, m = null, marcas }: {
  quien: Quien; children: ReactNode; hora?: string | null; ancho?: boolean; m?: MensajeWA | null; marcas?: MarcasChat | null;
}) {
  return <FilaDelChat m={m} quien={{ titulo: quien.nombre, aspecto: quien.aspecto }} marcas={marcas} hora={hora} ancho={ancho}>{children}</FilaDelChat>;
}

/** Lo de una pantalla adentro de un mensaje de MaKo (22/10/2026, OF4: Offer y el onboarding con el hilo del Ops Center). */
export type EnMensaje = { arriba?: ReactNode; abajo?: ReactNode };

/** ¿Es una respuesta de MaKo? En un chat con MaKo, todo lo que no escribió la persona (`MenuMensajeWA reportable`). */
export const esRespuestaDeMaKo = (m: MensajeWA): boolean => !m.propio;

/**
 * El hilo. `onCitar`: la pantalla pone la cita de un mensaje en su caja (Responder); sin él, el menú del clic derecho trae
 * sólo Copiar. Si quien lo monta ya trae su ContextoWA (el Ops Center, el teléfono), se usa el suyo.
 */
export function HiloMako({ onCitar, ...p }: Parameters<typeof CuerpoHilo>[0] & { onCitar?: (m: MensajeWA) => void }) {
  const deAfuera = useContext(ContextoWA);
  if (deAfuera) return <CuerpoHilo {...p} />;
  return <MenuDelMensaje onCitar={onCitar}><CuerpoHilo {...p} /></MenuDelMensaje>;
}

/** El menú MÍNIMO de un mensaje para un chat embebido: Copiar, si la pantalla puede, Responder, y en lo de MaKo, Reportar. */
function MenuDelMensaje({ onCitar, children }: { onCitar?: (m: MensajeWA) => void; children: ReactNode }) {
  const [abierto, setAbierto] = useState<{ m: MensajeWA; x: number; y: number } | null>(null);
  // Lo que no es de la persona, en un chat embebido, lo escribió MaKo: se reporta desde acá (ticket #57, ./ReportarRespuesta.tsx).
  const rep = useReportarRespuesta();
  const acciones = useMemo<AccionesWA>(() => ({
    // Con el dedo (mantener apretado) no se abre: en Android el `contextmenu` que llega después cerraría el menú de la casa
    // en el mismo gesto (MensajeWA.tsx, «POR QUÉ SE CERRABA SOLO»). Los chats embebidos son de la computadora.
    abrirMenu: (m, x, y, tactil) => { if (!tactil) setAbierto({ m, x, y }); },
    responder: (m) => onCitar?.(m),
    reaccionar: () => {},
  }), [onCitar]);
  const copiar = (m: MensajeWA) => {
    const t = leerCita(m.texto)?.resto ?? m.texto;
    void navigator.clipboard?.writeText(t).catch(() => {});
  };
  return (
    <ContextoWA.Provider value={acciones}>
      {children}
      {abierto && (
        <MenuContextual punto={{ x: abierto.x, y: abierto.y }} titulo={renglonDeCita(abierto.m.texto, 60)} etiqueta="Opciones del mensaje"
          onCerrar={() => setAbierto(null)}
          onElegir={(id) => {
            const m = abierto.m; setAbierto(null);
            if (id === 'copiar') copiar(m); else if (id === 'responder') onCitar?.(m); else if (id === 'reportar') void rep.reportar(m.texto);
          }}
          items={[
            ...(onCitar ? [{ id: 'responder', label: 'Responder', icono: 'cita' as const }] : []),
            { id: 'copiar', label: 'Copiar', icono: 'copiar' as const },
            ...(esRespuestaDeMaKo(abierto.m) ? [{ id: 'reportar', label: 'Reportar', icono: 'bandera' as const }] : []),
          ]} />
      )}
      {rep.aviso}
    </ContextoWA.Provider>
  );
}

function CuerpoHilo({ items, quien, ahora, escribiendo, tarjeta, onTarjeta, onReintentar, onDescartar, onRecargar, onResponder, sinMandar = null, onTrabajo, marcas, enMensaje }: {
  items: readonly ItemHilo[];
  /** El chat: su muñeco va al lado de lo que dice MaKo. */
  quien: Quien;
  ahora: number;
  /** MaKo está contestando (los segundos que lleva), o null. */
  escribiendo: { segs: number } | null;
  /** La tarjeta que está corriendo (sólo una por vez). */
  tarjeta: { id: number; accion: 'confirmar' | 'cancelar' } | null;
  onTarjeta: (x: ItemPropuesta, accion: 'confirmar' | 'cancelar') => void;
  /** Mandar otra vez lo que NO llegó (un 4xx). */
  onReintentar: (id: string) => void;
  /** Sacar del hilo una nota de voz que no se entendió (`descartable`): la nota en el acto, app/_chat/useNotaEnElActo.ts. */
  onDescartar?: (id: string) => void;
  /** Lo que no se sabe si llegó: se recarga y se mira, nunca se reintenta a ciegas. */
  onRecargar: () => void;
  /** Contestar una pregunta con opciones (un bloque G1): sale como un mensaje de la persona. `false` = no salió. */
  onResponder?: (texto: string) => boolean;
  /** Por qué las respuestas rápidas no pueden salir ahora (sin la app de escritorio): se dice y no se tocan. null = salen. */
  sinMandar?: string | null;
  /** El trabajo largo de una tarjeta terminó (1.11): la tarjeta pasa a «Hecho» o «Falló» (`trasTrabajo`). */
  onTrabajo?: (pendienteId: number, ok: boolean | null) => void;
  /** Las marcas de WhatsApp de este chat (reacciones, destacados): con el menú del clic derecho de quien lo monta. */
  marcas?: MarcasChat | null;
  /** Lo que la pantalla suma adentro de un mensaje de MaKo: arriba del texto (el PDF de una versión de la oferta, su nota de
   *  voz) y debajo (los documentos que leyó, las tarjetas del onboarding). null = nada. */
  enMensaje?: (x: ItemMsg) => EnMensaje | null;
}) {
  const wa = (x: ItemMsg) => mensajeWADe(x, quien.nombre);
  const filas: ReactNode[] = [];
  let ultimoDia: string | null = null;
  conRespuestas(items).forEach((x) => {
    // Lo que la persona eliminó para ella no se dibuja (WhatsApp: «Eliminar para mí»).
    if (x.k === 'msg' && marcas?.ocultos.includes(idWA(x))) return;
    if (x.k === 'msg' && x.at) {
      const d = diaDe(x.at);
      if (d && d !== ultimoDia) { filas.push(<span key={`d-${x.id}`} className="co-dia">{rotuloDia(x.at, ahora)}</span>); ultimoDia = d; }
    }
    if (x.k === 'msg' && x.grupo?.sinLeer) filas.push(<span key={`sin-leer-${x.id}`} className="co-dia co-dia--sin-leer" data-sin-leer="">Sin leer</span>);
    if (x.k === 'msg' && x.role === 'user') {
      const archivos = x.archivos ?? [];
      // Lo pegado de más de 1.000 caracteres viaja marcado y se dibuja como documento; lo escrito largo se pliega
      // (#848 y #864, lib/chat-pegado.ts): una transcripción ya no hace una burbuja de 24.000 px.
      // La cita se lee ANTES de partir: `partirPegados` recorta el renglón en blanco que la cita necesita para reconocerse.
      const crudo = archivos.length ? textoConArchivos(x.texto) : x.texto;
      const conCita = leerCita(crudo);
      const { texto: conTodo, pegados } = partirPegados(conCita?.resto ?? crudo);
      const texto = conTodo;
      // Si respondió a un mensaje, la cita va arriba, en su globo, y se toca para ir a él (lo de WhatsApp del Centro). En un grupo la
      // cita viene como dato (`grupo.cita`): nadie la escribió adentro del texto.
      const g = x.grupo;
      const citado = g?.cita ? <CitaEnBurbuja de={g.cita.de} texto={g.cita.texto} lineas={[]} citado={g.cita.id} />
        : conCita ? <CitaEnBurbuja de={conCita.cita.de} texto={conCita.cita.texto} lineas={[]} citado={citadoEn(items, conCita.cita.texto)} /> : null;
      const pie = <span className="co-burbuja__pie"><MarcasEnHora id={idWA(x)} marcas={marcas} />{x.estado === 'enviando' ? 'Enviando…' : hora(x.at)}</span>;
      // Lo de otra persona, en un grupo: a la izquierda y con su nombre adentro del globo (si hay archivos, arriba de ellos).
      const otro = g?.autor ?? null;
      const cabeza = otro && !g?.sigue
        ? <span className="co-autor" data-color={g?.color ?? 0}>{otro}{g?.chip && <span className="co-autor__chip">{g.chip}</span>}</span> : null;
      const enGlobo = archivos.length ? null : cabeza;
      const cita = enGlobo ? <>{enGlobo}{citado}</> : citado;
      const notas = <>
        {x.estado === 'error' && (
          <p className="co-nota co-nota--mal" role="alert">{x.error}{' '}
            <button type="button" className="ch-enlace" onClick={() => onReintentar(x.id)}>Reintentar</button>
            {x.descartable && onDescartar && <>{' · '}<button type="button" className="ch-enlace" onClick={() => onDescartar(x.id)}>Descartar</button></>}
            <ReportarASoporte /></p>
        )}
        {x.estado === 'incierto' && (
          <p className="co-nota co-nota--mal" role="alert">{x.error ?? ERROR_INCIERTO}{' '}
            <button type="button" className="ch-enlace" onClick={onRecargar}>Recargar el chat</button><ReportarASoporte /></p>
        )}
      </>;
      const cuerpo = <>
        {/* Desde dónde lo escribió (la estrella de una tab, OC6): un chip arriba de la burbuja. */}
        {x.desde && <span className="ch-desde">desde {x.desde}</span>}
        {archivos.length > 0 && cabeza}
        {archivos.length > 0 && <ArchivosHilo archivos={archivos} />}
        <PegadosHilo pegados={pegados} />
        {/* Una nota de voz se ESCUCHA (21/10/2026): el audio en su globo y, debajo, lo que se entendió, chico (Offer la
            guarda así: el texto del mensaje es la transcripción). */}
        {x.voz ? (
          <div className="co-burbuja ch-voz">
            {enGlobo}
            <AudioPlay src={x.voz.url} duracion={x.voz.secs} color="var(--primary)" style={{ width: 240 }} />
            {texto && <span className="ch-voz__texto">{texto}</span>}
            {pie}
          </div>
        ) : texto ? <TextoPlegable texto={texto} className="co-burbuja" pie={pie} arriba={cita} /> : <p className="ch-pie-suelto">{pie}</p>}
        {/* La de MaKo: se ve y no se toca. No es de la persona, y `ReaccionWA` le ofrecería quitarla. */}
        {g?.reaccion && <span className="co-wa__reaccion co-wa__reaccion--de-mako" role="img" aria-label={`MaKo reaccionó ${g.reaccion}`}>{g.reaccion}</span>}
      </>;
      filas.push(otro
        ? <FilaDeOtro key={x.id} m={wa(x)} nombre={otro} sigue={g?.sigue} despues={notas}>{cuerpo}</FilaDeOtro>
        : <FilaMia key={x.id} m={wa(x)} marcas={marcas} despues={notas}>{cuerpo}</FilaMia>);
      return;
    }
    if (x.k === 'msg') {
      const suyo = enMensaje?.(x) ?? null;
      filas.push(
        <DeMako key={x.id} quien={quien} hora={hora(x.at) || null} m={wa(x)} marcas={marcas}>
          {suyo?.arriba}
          {/* `iconos` (27/10/2026, ticket 874749710-12): el botón o la tab que MaKo nombra entre «» sale con su ícono de verdad. */}
          {x.texto.trim() && <div className="ch-md"><Markdown text={x.texto} iconos enlaces={!!x.grupo} /></div>}
          {/* Lo pedido que se hace en otra pantalla: el link para ir, como el «Ir a …» de los otros chats (tanda 10). */}
          {!!x.irA?.length && (
            <div className="ch-ira">{x.irA.map((l) => <Link key={l.link} className="co-chip" href={l.link}>{`Ir a ${l.titulo}`}</Link>)}</div>
          )}
          {suyo?.abajo}
          {/* Play: lo que genera la IA se denuncia desde el mismo mensaje, sin salir de la app: con «Reportar» en el menú del
              mensaje (clic derecho o mantener apretado), nunca un botón debajo de cada respuesta (ticket #57, ./ReportarRespuesta.tsx). */}
        </DeMako>,
      );
      return;
    }
    if (x.k === 'aviso' && x.tono === 'sistema') {
      // Lo que pasó en un grupo: «Joan entró al grupo». No lo dijo nadie.
      filas.push(<span key={x.id} className="co-dia co-dia--sistema" role="status">{x.texto}</span>);
      return;
    }
    if (x.k === 'aviso') {
      // Un mensaje que quedó sin respuesta (`conSinRespuesta`): se dice, y se puede mandar de nuevo.
      filas.push(x.tono === 'plataforma'
        ? <p key={x.id} className="co-nota co-nota--mal" role="status">{x.texto}
          {x.reintentar && onResponder && <> <button type="button" className="ch-enlace" onClick={() => onResponder(x.reintentar!)}>Reintentar</button></>}</p>
        : <DeMako key={x.id} quien={quien}><div className="ch-md"><Markdown text={x.texto} /></div>{x.conectar && <ConectarDelAviso servicio={x.conectar} />}</DeMako>);
      return;
    }
    if (x.k === 'bloque') {
      const de = x.deTarjeta;
      filas.push(<DeMako key={x.id} quien={quien} ancho><BloqueHilo b={x.b} onResponder={onResponder} respondida={x.respondida} ocupado={escribiendo != null} sinMandar={sinMandar}
        onTermina={de != null && onTrabajo ? (ok) => onTrabajo(de, ok) : undefined} /></DeMako>);
      return;
    }
    if (x.k === 'pantalla') {
      filas.push(
        <DeMako key={x.id} quien={quien} ancho>
          <div className="ch-tarjeta">
            <p className="ch-tarjeta__resumen"><strong>{x.p.titulo}</strong></p>
            {/* 1.10: la genérica se confirma ACÁ, con el mismo formulario de su pantalla, que queda como salida secundaria. */}
            {x.p.form ? (
              <FormularioEnChat f={x.p.form} acciones={ACCIONES_FORMULARIO} abrirEnApp={{ titulo: 'Abrir en la app', href: x.p.escritorio }} />
            ) : (<>
              <p className="ch-tarjeta__nota">{x.p.nota}</p>
              <div className="ch-tarjeta__botones"><Link className="ch-abrir" href={x.p.escritorio}>{x.p.boton}</Link></div>
            </>)}
          </div>
        </DeMako>,
      );
      return;
    }
    filas.push(
      <DeMako key={x.id} quien={quien} ancho>
        <TarjetaAccion x={x} enCurso={tarjeta?.id === x.t.pendienteId ? tarjeta.accion : null}
          bloqueada={!!tarjeta && tarjeta.id !== x.t.pendienteId} onCorrer={(a) => onTarjeta(x, a)} />
      </DeMako>,
    );
  });
  if (escribiendo) {
    // «Trabajando…» con sus tres puntos, la MISMA pieza del Ops Center (Trabajando.tsx). MaKo no manda sus pasos: pasado un
    // rato, el único «paso» es avisar que puede tardar.
    filas.push(
      <Trabajando key="escribiendo" titulo={quien.nombre} aspecto={quien.aspecto}
        pasos={escribiendo.segs >= 20 ? [{ at: '', texto: 'Puede tardar un par de minutos' }] : []} />,
    );
  }
  return <>{filas}</>;
}
