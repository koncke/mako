'use client';
// =============================================================================
// ChatMako — el chat con MaKo de UNA automatización (la galería y el lienzo)
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.5, §2.6 y §3.4). Martín, textual: «tiene que tener
// un chat donde guarda el registro... como hoy lo hace Claude que te saltan una pregunta con tres opciones» y «que se
// guarde un registro tipo chat de las cosas que vos le fuiste pidiendo desde el primer pedido hasta el último».
//
// UN componente, dos lugares. Reemplaza a la caja «Pídeselo a MaKo» del modal «Nueva automatización» y a la barra
// «Pídele un cambio» del lienzo (las dos eran app/automations/CrearConIA.tsx):
//   · `modo: 'galeria'` — adentro del modal, SIN `secuenciaId`: la fila nace AL GUARDAR (lib/flujo-ia-crear.ts). El
//     hilo vive en el estado de acá y viaja ENTERO en cada turno (`historial`): al nacer la fila, el server lo vuelca
//     a su chat. Al `listo`, `onListo` trae el id NUEVO y quien monta cierra el modal y la abre (con el chat abierto).
//     ⚠️ LAS FASES SE DIBUJAN ADENTRO DEL MODAL, en el hilo: una capa portaleada es `zIndex: 125` y un Modal de la pila
//     arranca en 130 (`Z_BASE`, app/_components/pila-modales.ts): quedaba DEBAJO del modal, sin un error.
//   · `modo: 'editar'` — en la franja de abajo del lienzo, con el hilo encima del composer. Al montar lee el chat
//     guardado (GET ?secuenciaId=); si falla, arranca vacío, sin bloquear. Mientras trabaja, una CAPA fija sobre toda la
//     pantalla (portal a `document.body`) con las fases, que se traga los clics y el teclado (tercera tanda, punto 6:
//     «no dejar editar el flujo mientras la IA lo crea… con un botón de cancelar»).
//
// CADA TURNO VUELVE A MANDAR EL PEDIDO ORIGINAL con las respuestas acumuladas (§3.4): una pregunta termina el stream,
// y la respuesta (un botón, «Elige tú» o «Otra cosa» con su texto) es OTRO POST. Lo que manda cada botón es puro y con
// test (`respuestaMako`, lib/flujo-ia-cliente.ts); qué ronda quedó abierta en un chat guardado, también
// (`rondaAbierta`). El lector del stream es ./stream-ia.ts.
//
// NO decide qué hacer con el resultado: crear ya lo GUARDÓ pausado; editar es un borrador local que el padre aplica con
// UNA foto de deshacer, y el CRON que eligió la persona lo guarda el padre por `action: 'disparadores'`.
//
// ⚠️ NADA INVENTADO: los botones de una pregunta son los rótulos del catálogo TAL CUAL (los arma el server), y el
// valor que viaja es el del catálogo. Acá no se escribe ninguna opción.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { avisarCambioEtiquetas } from '@/app/_components/etiquetas-cliente';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { sanearChat, type MensajeChatMako, type PreguntaMako, type RespuestaMako } from '@/lib/automatizacion-chat';
import { ordenarAvisos, rondaAbierta, respuestaMako, ELIGE_TU, OTRA_COSA, type EleccionMako, type RondaMako } from '@/lib/flujo-ia-cliente';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import { useStreamIA, RUTA_IA, TOPE_CLIENTE_MS, TEXTO_FASE, ORDEN_FASES, type EstadoIA, type ListoStreamIA } from './stream-ia';
import { TITULO_GALERIA_IA, PLACEHOLDER_QUIETO, useEjemploQueSeEscribe, type ListoCrearIA } from './CrearConIA';

export type ChatMakoProps = {
  /**
   * `false` = no lo aplicó (editar sobre un lienzo que cambió): el pedido vuelve a la caja. En la galería trae el id de
   * la automatización que NACIÓ (`secuenciaId`), ya guardada y pausada.
   */
  onListo: (r: ListoCrearIA) => boolean | void;
  /** Mientras trabaja (galería): quien monta no deja cerrar ni elegir otra cosa. */
  onOcupado?: (ocupado: boolean) => void;
  /** El ✕ del chat (lienzo). */
  onCerrar?: () => void;
  deshabilitado?: boolean;
  /** El hilo con el que arranca (en el lienzo lo trae el GET; lo usan las pruebas). */
  inicial?: readonly MensajeChatMako[];
} & (
  | { modo: 'galeria'; secuenciaId?: undefined; pasos?: undefined }
  /** `pasos`: el borrador LOCAL del lienzo (puede tener cambios sin publicar). */
  | { modo: 'editar'; secuenciaId: number; pasos: readonly PasoGrafo[] }
);

/** Lo que dice el campo en el lienzo, y con una pregunta abierta (la respuesta escrita es «Otra cosa»). */
export const PLACEHOLDER_EDITAR = 'Pídele un cambio';
export const PLACEHOLDER_OTRA = 'Escribe tu respuesta';
/** El lienzo cambió mientras MaKo trabajaba: el resultado no se aplica (`edicionVigente`). */
export const NO_APLICADO = 'Cambiaste el flujo: pídelo de nuevo';

let cuenta = 0;
/** Un id de mensaje (≤ 80, `sanearMensaje`): único en la pestaña y entre pestañas. */
const nuevoId = (de: 'yo' | 'mako') => `${de}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${(cuenta++).toString(36)}`;

/**
 * LO QUE DICE MaKo AL TERMINAR UNA EDICIÓN: el resumen del server («Cambié 3 · saqué 1 · agregué 2», armado por
 * código) y, si no vino (un server de antes), uno por código con lo que se sabe. Corto.
 */
export function textoDeListo(l: Pick<ListoStreamIA, 'resumen' | 'disparadores' | 'orden'>): string {
  const r = l.resumen?.trim();
  if (r) return r;
  if (l.disparadores?.length) return 'Cambié qué la dispara';
  const n = l.orden.length;
  if (n) return n === 1 ? 'Agregué 1 tarjeta' : `Agregué ${n} tarjetas`;
  return 'Listo';
}

/** El hilo guardado y lo de esta pantalla, sin repetir ids (gana lo guardado, en su orden). */
export function juntarHilo(guardados: readonly MensajeChatMako[], locales: readonly MensajeChatMako[]): MensajeChatMako[] {
  const ids = new Set(guardados.map((m) => m.id));
  return [...guardados, ...locales.filter((m) => !ids.has(m.id))];
}

export function ChatMako(p: ChatMakoProps) {
  const enModal = p.modo === 'galeria';
  const [mensajes, setMensajes] = useState<MensajeChatMako[]>(() => [...(p.inicial ?? [])]);
  /** La ronda que espera respuesta (la pregunta de ahora, el pedido original y lo ya contestado). */
  const [ronda, setRonda] = useState<RondaMako | null>(() => rondaAbierta(p.inicial ?? []));
  const [texto, setTexto] = useState('');
  /** El placeholder ya no se mueve: alguien tocó la caja. No vuelve. */
  const [tocada, setTocada] = useState(false);
  const [error, setError] = useState<{ texto: string; link?: string } | null>(null);
  const ejemplo = useEjemploQueSeEscribe(p.modo !== 'editar' && !tocada && !texto);
  const { estado, trabajando, enviar, cancelar } = useStreamIA();
  const [ahora, setAhora] = useState(() => Date.now());
  const campoRef = useRef<HTMLTextAreaElement | null>(null);
  const hiloRef = useRef<HTMLDivElement | null>(null);
  const capaRef = useRef<HTMLDivElement | null>(null);
  /** Turnos hechos en esta pantalla: si ya hubo uno, el GET no pisa la ronda de acá. */
  const turnos = useRef(0);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  /**
   * ⚠️ EL `onListo` DE AHORA, NO EL DEL CLIC (revisión, 09/10/2026). El turno cierra sobre las props del render en que
   * se hizo clic: llamar a `p.onListo` al terminar llamaba al del padre de hace un minuto, con SU `pasos` de entonces,
   * y la comparación con el lienzo de ahora daba siempre igual. El ref se actualiza en cada render.
   */
  const onListoRef = useRef(p.onListo);
  useEffect(() => { onListoRef.current = p.onListo; });

  // El campo crece con lo que tiene (hasta 5 renglones), también cuando lo llena el dictado, que no dispara `onInput`.
  useEffect(() => {
    const t = campoRef.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 132)}px`;
  }, [texto]);

  // El reloj de lo que lleva (progreso real, no decorativo). Corre sólo mientras trabaja.
  useEffect(() => {
    if (!trabajando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [trabajando]);
  // La galería no deja cerrar el modal ni elegir una plantilla mientras MaKo trabaja (`onOcupado`).
  const onOcupadoRef = useRef(p.onOcupado);
  useEffect(() => { onOcupadoRef.current = p.onOcupado; });
  useEffect(() => { onOcupadoRef.current?.(trabajando); }, [trabajando]);

  // EL CHAT GUARDADO (lienzo): GET ?secuenciaId=. Si falla, el hilo arranca vacío y nada se bloquea.
  const secId = p.modo === 'editar' ? p.secuenciaId : null;
  useEffect(() => {
    if (secId == null) return;
    let sigue = true;
    void (async () => {
      try {
        const r = await fetch(`${RUTA_IA}?secuenciaId=${secId}`, { cache: 'no-store' });
        const j = await r.json().catch(() => null) as { ok?: boolean; mensajes?: unknown } | null;
        if (!sigue || !r.ok || !j?.ok) return;
        const guardados = sanearChat({ v: 1, mensajes: j.mensajes }).mensajes;
        if (!guardados.length) return;
        setMensajes((locales) => juntarHilo(guardados, locales));
        if (!turnos.current) setRonda(rondaAbierta(guardados));
      } catch { /* sin chat guardado: arranca vacío */ }
    })();
    return () => { sigue = false; };
  }, [secId]);

  const preguntaViva = !trabajando && ronda ? ronda.pregunta : null;
  // AL ÚLTIMO MENSAJE: al abrir (y cuando llega el chat guardado) y con cada turno.
  useEffect(() => {
    const el = hiloRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes.length, trabajando, preguntaViva?.id, error]);

  /**
   * ⚠️ MIENTRAS TRABAJA EN EL LIENZO, EL TECLADO TAMPOCO LLEGA AL LIENZO (tercera tanda, punto 6). La capa se traga los
   * clics, pero un atajo vive en `document` (el deshacer del lienzo, Suprimir sobre una tarjeta): se corta en CAPTURA
   * todo lo que no nace adentro de la capa. Escape cancela, igual que el botón, y sólo cuando el botón está (en
   * «Revisando el flujo» el server ya no mira la señal).
   */
  const fase = estado.t === 'trabajando' ? estado.fase : null;
  useEffect(() => {
    // En la galería, el modal ya tapa la pantalla y tiene su propio teclado (la pila de modales).
    if (!trabajando || enModal) return;
    capaRef.current?.focus();
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fase !== 'revision') { e.preventDefault(); e.stopImmediatePropagation(); cancelar(); return; }
      // Tab no saca el foco de la capa (lo de abajo no se puede tocar). Lo demás que nace en la capa
      // (Enter o espacio sobre «Cancelar») sigue su camino.
      if (e.key === 'Tab') { e.preventDefault(); return; }
      if (capaRef.current && e.target instanceof Node && capaRef.current.contains(e.target)) return;
      // Sin `preventDefault`: los atajos del NAVEGADOR (recargar, cambiar de pestaña) siguen andando;
      // lo que se corta es que lleguen a los de la app.
      e.stopImmediatePropagation();
    };
    document.addEventListener('keydown', alTeclado, true);
    return () => document.removeEventListener('keydown', alTeclado, true);
  }, [trabajando, fase, enModal, cancelar]);

  /**
   * UN TURNO: lo que dijo la persona entra al hilo YA y sale el POST con el pedido ORIGINAL de la ronda y las
   * respuestas acumuladas. Cancelar o un error lo sacan del hilo y devuelven lo escrito a la caja (`restaurar`): el
   * próximo ➤ es reintentar.
   */
  const turno = async (dicho: string, respuesta: RespuestaMako | null, restaurar: string | null) => {
    if (trabajando || p.deshabilitado) return;
    setTocada(true);
    const yo: MensajeChatMako = {
      id: nuevoId('yo'), de: 'yo', texto: dicho, at: new Date().toISOString(), via: 'app', ...(respuesta ? { respuesta } : {}),
    };
    const enCurso = respuesta && ronda
      ? { pedido: ronda.pedido, respuestas: [...ronda.respuestas, respuesta] }
      : { pedido: dicho, respuestas: [] as RespuestaMako[] };
    const hilo = [...mensajes, yo];
    turnos.current += 1;
    setMensajes(hilo); setTexto(''); setError(null); setAhora(Date.now());
    // La foto que se manda (editar): vuelve en `onListo` como `base`.
    const base = p.modo === 'editar' ? p.pasos : undefined;
    const fin = await enviar({
      pedido: enCurso.pedido, modo: p.modo === 'galeria' ? 'crear' : 'editar', respuestas: enCurso.respuestas,
      // Galería: el hilo entero CON el turno (todavía no hay fila donde guardarlo; al nacer, el server lo vuelca).
      ...(p.modo === 'editar' ? { secuenciaId: p.secuenciaId, pasos: base } : { historial: hilo }),
      // Lienzo: el hilo de ANTES del turno. La ruta guarda el turno y busca ahí la pregunta que se contesta: el rótulo
      // del «yo» y el «Elige tú» del CRON (`respuestaDelCron`). Sin el hilo, «Elige tú» quedaba en «Lo dejé así»; con
      // el turno al final, `turnoDelUsuario` creía que ya estaba y no lo guardaba.
      ...(p.modo === 'editar' ? { historial: mensajes } : {}),
    });
    if (!vivo.current) return;
    const deshacer = (e: { texto: string; link?: string } | null) => {
      setMensajes((ms) => ms.filter((m) => m.id !== yo.id));
      if (restaurar != null) setTexto((t) => t || restaurar);
      setError(e);
    };
    // Cancelar no es un error: la caja vuelve con el pedido escrito.
    if (fin.t === 'cancelado') { deshacer(null); return; }
    if (fin.t === 'error') { deshacer({ texto: fin.error, ...(fin.link ? { link: fin.link } : {}) }); return; }
    if (fin.t === 'pregunta') {
      setMensajes((ms) => [...ms, fin.mensaje]);
      setRonda({ ...enCurso, pregunta: fin.pregunta });
      return;
    }
    const l = fin.listo;
    // ⚠️ LAS ETIQUETAS QUE CREÓ EL SERVER (revisión, 09/10/2026): `crearEtiqueta` corre en la ruta, no pasa por
    // `crearEtiquetaCliente`, y las listas de la pestaña ya estaban pedidas. Va ANTES de `onListo`: las tarjetas nuevas
    // se dibujan con la lista nueva.
    if (l.etiquetasNuevas.length) avisarCambioEtiquetas();
    const aplicado = onListoRef.current({
      modo: l.modo, secuenciaId: l.secuenciaId, pasos: l.pasos, nombre: l.nombre, orden: l.orden,
      avisos: l.avisos, etiquetasNuevas: l.etiquetasNuevas, disparador: l.disparador ?? null, base,
      ...(l.resumen !== undefined ? { resumen: l.resumen } : {}),
      ...(l.cambiadas ? { cambiadas: l.cambiadas } : {}),
      ...(l.quitadas ? { quitadas: l.quitadas } : {}),
      ...(l.disparadores !== undefined ? { disparadores: l.disparadores } : {}),
      ...(l.pregunta ? { pregunta: l.pregunta } : {}),
    });
    if (!vivo.current) return;
    // Si el padre no lo aplicó (el lienzo cambió en el medio), el pedido vuelve a la caja.
    if (aplicado === false) { deshacer({ texto: NO_APLICADO }); return; }
    // «¿Cambio qué la dispara?» (§2.6): una ronda NUEVA sobre el mismo pedido (su respuesta no vuelve a editar).
    setRonda(l.pregunta ? { pedido: enCurso.pedido, respuestas: [], pregunta: l.pregunta } : null);
    if (p.modo === 'editar') {
      const avisos = ordenarAvisos(l.avisos ?? []);
      setMensajes((ms) => [...ms, {
        id: nuevoId('mako'), de: 'mako', texto: textoDeListo(l), at: new Date().toISOString(), via: 'app',
        ...(avisos.length ? { avisos } : {}), ...(l.pregunta ? { pregunta: l.pregunta } : {}),
      }]);
    }
  };

  /** ➤ (o Enter): con una pregunta abierta, lo escrito ES «Otra cosa»; si no, un pedido nuevo. */
  const enviarTexto = () => {
    const t = texto.trim();
    if (!t || trabajando || p.deshabilitado) return;
    if (ronda) { const r = respuestaMako(ronda.pregunta, { texto: t }); void turno(r.texto, r.respuesta, t); return; }
    void turno(t, null, t);
  };
  const elegir = (e: EleccionMako) => {
    if (!ronda) return;
    const r = respuestaMako(ronda.pregunta, e);
    void turno(r.texto, r.respuesta, null);
  };
  /** «Otra cosa»: abre el texto (el campo, con el foco). */
  const otraCosa = () => { setTocada(true); campoRef.current?.focus(); };

  const segundos = estado.t === 'trabajando' ? Math.max(0, Math.round((ahora - estado.desde) / 1000)) : 0;
  const fases = estado.t === 'trabajando'
    ? <FasesIA estado={estado} segundos={segundos} onCancelar={cancelar} cajaRef={capaRef} enModal={enModal} />
    : null;
  // En el lienzo, la capa que oscurece todo, con las fases encima. Va al `body`: adentro del lienzo, un ancestro con
  // `transform`, `overflow` o z-index la dejaría recortada o debajo de la lista y de «Publicar» (AGENTS.md, el sticky
  // que clampea el z).
  const tarjeta = !enModal && fases ? <div data-crear-ia-capa="" style={S.capa}>{fases}</div> : null;
  const capa = tarjeta && (typeof document !== 'undefined' ? createPortal(tarjeta, document.body) : tarjeta);

  const parar = () => { if (!tocada) setTocada(true); };
  const idCampo = `chat-mako-${p.secuenciaId ?? 'galeria'}`;
  const placeholder = ronda ? PLACEHOLDER_OTRA : p.modo === 'editar' ? PLACEHOLDER_EDITAR : (tocada ? PLACEHOLDER_QUIETO : ejemplo);
  const ultimoMako = mensajes.reduce((k, m, i) => (m.de === 'mako' ? i : k), -1);
  const hayHilo = mensajes.length > 0 || (enModal && !!fases);

  return (
    <div
      data-chat-mako={p.modo} data-crear-ia-caja={enModal ? 'galeria' : undefined}
      style={enModal ? S.cajaModal : S.cajaLienzo}
      onPointerDownCapture={parar}
      onFocusCapture={parar}
    >
      <style>{CSS}</style>
      <div style={S.encabezado}>
        <span aria-hidden style={S.chispa}>✦</span>
        <label htmlFor={idCampo} style={S.titulo}>{enModal ? TITULO_GALERIA_IA : 'MaKo'}</label>
        {enModal && <span style={{ ...S.dim, marginLeft: 'auto' }}>Nace pausada</span>}
        {p.onCerrar && (
          <button type="button" className="chm-x" onClick={p.onCerrar} aria-label="Cerrar el chat" title="Cerrar" style={{ marginLeft: 'auto' }}>✕</button>
        )}
      </div>
      {hayHilo && (
        <div ref={hiloRef} data-hilo-mako="" style={enModal ? S.hiloModal : S.hilo} aria-live="polite">
          {mensajes.map((m, i) => (
            <Mensaje key={m.id} m={m} viva={i === mensajes.length - 1 && preguntaViva && m.pregunta?.id === preguntaViva.id ? preguntaViva : null}
              ultimo={i === ultimoMako} onElegir={elegir} onOtraCosa={otraCosa} deshabilitado={trabajando || !!p.deshabilitado} />
          ))}
          {enModal && fases}
        </div>
      )}
      {error && (
        <p style={S.error} role="alert"><TextoConLink texto={error.texto} link={error.link} /></p>
      )}
      <form data-composer-mako="" style={S.composer} onSubmit={(e) => { e.preventDefault(); enviarTexto(); }}>
        <textarea
          ref={campoRef}
          id={idCampo}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); parar(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTexto(); } }}
          placeholder={placeholder}
          aria-label={p.modo === 'editar' ? 'Pídele un cambio a MaKo' : 'Qué tiene que hacer la automatización'}
          rows={enModal && !mensajes.length ? 2 : 1}
          maxLength={2000}
          disabled={p.deshabilitado}
          className="chm-campo"
        />
        <BotonDictar titulo={p.modo === 'editar' ? 'Dictar el cambio' : 'Dictar el pedido'} valor={texto}
          onValor={(v) => { setTexto(v); parar(); }} onError={(m) => setError({ texto: m })} />
        <button type="submit" className="chm-enviar" aria-label="Enviar" title="Enviar"
          disabled={!texto.trim() || trabajando || p.deshabilitado}>➤</button>
      </form>
      {capa}
    </div>
  );
}

/** Un mensaje del hilo. La pregunta VIVA (la última, sin contestar) lleva sus botones; las de antes, sólo el texto. */
function Mensaje({ m, viva, ultimo, onElegir, onOtraCosa, deshabilitado }: {
  m: MensajeChatMako; viva: PreguntaMako | null; ultimo: boolean;
  onElegir: (e: EleccionMako) => void; onOtraCosa: () => void; deshabilitado: boolean;
}) {
  if (m.de === 'yo') {
    return <div data-mensaje="yo" style={S.filaYo}><div style={S.yo}>{m.texto}</div></div>;
  }
  const preguntaAparte = m.pregunta && m.pregunta.texto.trim() !== m.texto.trim() ? m.pregunta.texto : null;
  return (
    <div data-mensaje="mako" style={S.filaMako}>
      <span aria-hidden style={S.chispaMensaje}>✦</span>
      <div style={S.mako}>
        {m.texto && <div>{m.texto}</div>}
        {preguntaAparte && <div style={{ fontWeight: 600 }}>{preguntaAparte}</div>}
        {m.avisos?.length ? (
          <ul data-avisos-mako="" style={{ ...S.avisos, ...(ultimo ? null : { opacity: 0.75 }) }}>
            {m.avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        ) : null}
        {viva && <TarjetaPregunta pregunta={viva} onElegir={onElegir} onOtraCosa={onOtraCosa} deshabilitado={deshabilitado} />}
      </div>
    </div>
  );
}

/**
 * LA PREGUNTA COMO TARJETA (§2.4, el molde de Claude): de 2 a 4 botones con los rótulos del catálogo TAL CUAL, más
 * «Otra cosa» (abre el texto) y «Elige tú» (`valor: null`: MaKo elige sola). Exportada: la dibuja el test.
 */
export function TarjetaPregunta({ pregunta, onElegir, onOtraCosa, deshabilitado }: {
  pregunta: PreguntaMako; onElegir: (e: EleccionMako) => void; onOtraCosa: () => void; deshabilitado?: boolean;
}) {
  return (
    <div data-pregunta-mako={pregunta.sobre} style={S.opciones} role="group" aria-label={pregunta.texto}>
      {pregunta.opciones.map((o) => (
        <button key={o.valor} type="button" className="chm-op" data-opcion={o.valor} title={o.detalle}
          disabled={deshabilitado} onClick={() => onElegir({ valor: o.valor })}>{o.label}</button>
      ))}
      <button type="button" className="chm-op chm-op--suave" data-otra-cosa="" disabled={deshabilitado} onClick={onOtraCosa}>{OTRA_COSA}</button>
      <button type="button" className="chm-op chm-op--suave" data-elige-tu="" disabled={deshabilitado} onClick={() => onElegir({ eligeTu: true })}>{ELIGE_TU}</button>
    </div>
  );
}

/** Las fases REALES del server, lo que lleva y Cancelar (menos en «Revisando el flujo»). */
function FasesIA({ estado, segundos, onCancelar, cajaRef, enModal }: {
  estado: Extract<EstadoIA, { t: 'trabajando' }>; segundos: number; onCancelar: () => void;
  cajaRef: RefObject<HTMLDivElement | null>; enModal: boolean;
}) {
  const actual = estado.fase ? ORDEN_FASES.indexOf(estado.fase) : -1;
  return (
    <div ref={cajaRef} tabIndex={-1} style={enModal ? S.trabajandoEnHilo : S.trabajando} role="status" aria-live="polite" data-crear-ia-fases="">
      <div style={S.cabeza}>
        <span style={S.rotulo}>✦ {GRAMATICA.analizando.rotulo}</span>
        {estado.leido && <span style={S.leido}>· {estado.leido}</span>}
      </div>
      <ol style={S.fases}>
        {ORDEN_FASES.map((f, i) => (
          <li key={f} style={{ ...S.fase, color: i <= actual ? 'var(--ink)' : 'var(--faint)' }}>
            <span aria-hidden style={{ ...S.punto, background: i < actual ? 'var(--good)' : i === actual ? 'var(--mako)' : 'var(--border)' }} />
            {TEXTO_FASE[f]}
            {f === 'revision' && estado.reparadas ? <span style={S.dim}> · {estado.reparadas} {estado.reparadas === 1 ? 'arreglo' : 'arreglos'}</span> : null}
          </li>
        ))}
      </ol>
      <div style={S.pie}>
        {/* ⚠️ EL TOPE SALE DEL TOPE REAL (revisión, 09/10/2026): «75 s · hasta 1 min» se lee como colgado y la persona
            cancela un pedido que iba a terminar. */}
        <span style={S.dim}>{segundos} s · hasta {Math.round(TOPE_CLIENTE_MS / 60_000)} min</span>
        {/* ⚠️ SIN «Cancelar» EN «Revisando el flujo» (revisión, 09/10/2026): el server mira la señal una sola vez, antes
            de esa fase, y después crea las etiquetas y guarda igual. */}
        {estado.fase !== 'revision' && <Button variant="tertiary" size="sm" onClick={onCancelar}>Cancelar</Button>}
      </div>
    </div>
  );
}

/** El error, con la palabra «Integraciones» convertida en el link a donde se arregla (si lo hay). */
function TextoConLink({ texto, link }: { texto: string; link?: string }) {
  if (!link) return <>{texto}</>;
  const i = texto.indexOf('Integraciones');
  if (i < 0) return <>{texto} <Link href={link} style={S.link}>Abrir</Link></>;
  return <>{texto.slice(0, i)}<Link href={link} style={S.link}>Integraciones</Link>{texto.slice(i + 'Integraciones'.length)}</>;
}

// ⚠️ EL HOVER VA EN LA CLASE, NUNCA EN EL `style` (docs/hallazgos-chatbot.md, parte «horario»: un `border` en línea
// anula el `:hover` de la clase). Sólo tokens que existen en claro y en oscuro (app/globals.css).
const CSS = `
.chm-op{font:inherit;font-size:13.5px;font-weight:600;line-height:1.3;text-align:left;padding:8px 12px;border-radius:10px;border:1.5px solid var(--mako-border);background:var(--surface);color:var(--ink);cursor:pointer;transition:border-color .14s ease,background .14s ease}
.chm-op:hover:not(:disabled),.chm-op:focus-visible{border-color:var(--mako);background:var(--mako-bg);outline:none}
.chm-op:disabled{cursor:default;opacity:.55}
.chm-op--suave{font-weight:500;color:var(--dim);border-color:var(--border)}
.chm-campo{flex:1;min-width:0;box-sizing:border-box;resize:none;padding:9px 0;border:none;border-bottom:2px solid var(--border);background:transparent;color:var(--ink);font:inherit;font-size:15px;line-height:1.4;outline:none;overflow-y:auto}
.chm-campo:focus{border-bottom-color:var(--mako)}
.chm-enviar{flex:none;width:42px;height:42px;border-radius:11px;border:none;background:var(--mako);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.chm-enviar:disabled{opacity:.4;cursor:default}
.chm-x{border:none;background:none;color:var(--dim);font-size:14px;cursor:pointer;padding:2px 4px;border-radius:6px}
.chm-x:hover{color:var(--ink);background:var(--surface-2)}
@media (prefers-reduced-motion: reduce){.chm-op{transition:none}}
`;

const S: Record<string, CSSProperties> = {
  // La galería: a lo ancho del modal y sin sombra (ya está adentro de una caja).
  cajaModal: {
    width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10,
    padding: '14px 18px 16px', borderRadius: 16, background: 'var(--surface)', border: '1.5px solid var(--mako-border)',
  },
  // El lienzo: flota en la franja de abajo; el alto lo topa quien monta (~45% del lienzo) y el hilo scrollea.
  cajaLienzo: {
    width: '100%', minHeight: 0, maxHeight: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8,
    padding: '10px 12px 12px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--mako-border)',
    boxShadow: '0 10px 30px rgba(18,21,27,.14)',
  },
  encabezado: { display: 'flex', alignItems: 'center', gap: 8, flex: 'none' },
  titulo: { fontSize: 14, fontWeight: 700, color: 'var(--ink)' },
  chispa: { color: 'var(--mako-ink)', fontSize: 14, flex: 'none' },
  hilo: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 2px 4px' },
  hiloModal: { maxHeight: 'min(320px, 40vh)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 2px 4px' },
  filaYo: { display: 'flex', justifyContent: 'flex-end' },
  yo: {
    maxWidth: '85%', padding: '8px 12px', borderRadius: '14px 14px 4px 14px', background: 'var(--primary-bg)', color: 'var(--ink)',
    fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
  },
  filaMako: { display: 'flex', alignItems: 'flex-start', gap: 6 },
  chispaMensaje: { color: 'var(--mako-ink)', fontSize: 13, lineHeight: '22px', flex: 'none' },
  mako: {
    maxWidth: '92%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px', borderRadius: '14px 14px 14px 4px',
    background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
  },
  avisos: { margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5, color: 'var(--warn)', whiteSpace: 'normal' },
  opciones: { display: 'flex', flexWrap: 'wrap', gap: 6, whiteSpace: 'normal' },
  composer: { display: 'flex', alignItems: 'flex-end', gap: 8, flex: 'none' },
  pie: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dim: { fontSize: 12.5, color: 'var(--faint)' },
  error: { margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--bad)', flex: 'none' },
  link: { color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' },
  capa: {
    position: 'fixed', inset: 0, zIndex: 125, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, background: 'rgba(18,21,27,.45)', backdropFilter: 'blur(2px)',
  },
  trabajandoEnHilo: {
    boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10,
    padding: '10px 12px', borderRadius: 14, background: 'var(--surface-2)', outline: 'none',
  },
  trabajando: {
    width: 'min(440px, 100%)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12,
    padding: 18, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)',
    boxShadow: '0 30px 70px rgba(18,21,27,.35)', outline: 'none',
  },
  cabeza: { display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', minWidth: 0 },
  rotulo: { fontSize: 14, fontWeight: 600, color: 'var(--mako-ink)' },
  leido: { fontSize: 13, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' },
  fases: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  fase: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 },
  punto: { width: 8, height: 8, borderRadius: 999, flex: 'none' },
};
