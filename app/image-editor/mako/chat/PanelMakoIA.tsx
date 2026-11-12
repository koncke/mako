'use client';

// =============================================================================
// PanelMakoIA — el chat de MaKo del Image Editor: edita el diseño abierto
// =============================================================================
// Pedido de Martín (16/10/2026, por el Cerebro): «implementes este chat en todas las tabs… quiero que la app sea AI
// NATIVE». Es el chat del Video Editor (app/video-editor/_opencut/chat/PanelChat.tsx) en el editor de imágenes: el
// saludo con sugerencias en píldoras, el hilo y la caja de MaKo.
//   · la respuesta es un CAMBIO PROPUESTO con «Original | Modificado» que se acepta o se descarta entero; después de
//     aceptar, «Restaurar» lo vuelve atrás (./acciones.ts);
//   · el alcance en chips: «Todo el diseño» o lo elegido en el lienzo;
//   · el hilo es por diseño y queda GUARDADO por persona (./hilo.ts, mig 0303).
// DÓNDE (29/10/2026, Martín: «la barra lateral del chat de MaKo SIEMPRE abierto a la izquierda»): en la tarjeta izquierda
// de la pantalla de Create (app/_crear/PantallaCrear.tsx), siempre abierto, sin botón para abrirlo ni cerrarlo. Usa el motor
// (`useEditor`), así que lo monta el editor por adentro y se dibuja ahí por portal (../../editor/PantallaEditor.tsx). En el
// teléfono es «MaKo» del interruptor de arriba de esa misma pantalla. Antes era un panel del riel con un botón redondo.
//
// CON LAS PIEZAS DEL OPS CENTER (22/10/2026, TB3; Martín: «quiero que todos los chats de MaKo en las tabs sean el del Ops
// Center»): el hilo es `HiloMako` (con la criatura de la tab, la misma que lo nombra en el Ops Center) y la caja es
// `CajaChat` (app/_chat/). El motor sigue siendo el suyo (./acciones.ts): edita el diseño ABIERTO, en modo «editar», y la
// propuesta con «Original | Modificado» va en el hueco `enMensaje` de la respuesta de MaKo que la trajo. El alcance
// («Todo el diseño» o lo elegido) sigue en sus chips arriba de la caja; en el hilo ya no se repite en la burbuja.
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { CajaChat } from '@/app/_chat/CajaChat';
import { AperturaMako, useApertura } from '@/app/_chat/AperturaMako';
import { MEDIDA_DE, SUPERFICIE_IMAGE, type AccionImage } from '@/lib/aperturas/image';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import { useNotaEnElActo } from '@/app/_chat/useNotaEnElActo';
import { useAdjuntosDelChat } from '@/app/_chat/useAdjuntosDelChat';
import { useCitaDelChat } from '@/app/_chat/useCitaDelChat';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import Link from '@/app/_ui/Link';
import { useEditor, useEditorState, type EditorEngine } from '../../_doory/editor/extensions';
import { TOPES_CHAT_IMAGEN } from '@/lib/image-editor/chat/catalogo';
import { resumenDeCambios, type CambioImagen } from '@/lib/image-editor/chat/aplicar';
import { cambiarMensaje, cargarHilo, leerHilo, suscribir, type EstadoPropuesta, type Hilo, type MensajeMako } from './hilo';
import { aceptarPropuesta, detener, pedirEdicion, restaurarPropuesta, rotuloSeleccion, type AlcanceChat } from './acciones';
import styles from './chat.module.css';
import { ESCRIBIR_PLANTILLA } from '../../ruta';

/** Lo que pide «Usar plantilla» al abrir (queda en la charla como el pedido de la persona). */
const PEDIDO_ESCRIBIR_PLANTILLA = 'Escribe esta plantilla entera para mi negocio y mi oferta principal: cada texto de guía, con su texto final. Donde falte un dato, pon [DATO: qué va].';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { SelectorIntencion, useIntencion } from '@/app/_chat/SelectorIntencion';
import { useKitsDeMarca } from '@/app/_chat/kits-de-marca';
import { kitElegido } from '@/lib/marca/kits';
import { Dropdown } from '@/app/components/Dropdown';
import { rutaSeccion } from '@/lib/secciones-negocio';

const HILO_SERVER: Hilo = { mensajes: [], corriendo: false };
const useHilo = (disenoId: string): Hilo => useSyncExternalStore(suscribir, () => leerHilo(disenoId), () => HILO_SERVER);

/** Quien contesta en el hilo: la criatura de la tab (la misma que la nombra en el Ops Center). */
const QUIEN = { nombre: 'Image Editor' };
const nada = () => {};
const iso = (ms: number): string | null => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);

const ETIQUETA_CAMBIO: Record<CambioImagen['tipo'], string> = { cambia: 'Cambia', agrega: 'Nuevo', quita: 'Se quita' };
const MAX_FILAS = 8;

function RevisionPropuesta({ m, tocada, onAceptar, onDescartar, onRestaurar }: {
  m: MensajeMako & { cambios: CambioImagen[]; estado: EstadoPropuesta };
  tocada: boolean;
  onAceptar: () => void;
  onDescartar: () => void;
  onRestaurar: () => void;
}) {
  const [lado, setLado] = useState<'original' | 'modificado'>('modificado');
  const filas = m.cambios.slice(0, MAX_FILAS);
  return (
    <div className={styles.revision}>
      <div className={styles.revisionHead}>
        <span className={styles.revisionResumen}>{resumenDeCambios(m.cambios) || 'Sin cambios'}</span>
        <div className={styles.comparar} role="group" aria-label="Comparar">
          {(['original', 'modificado'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={lado === v} onClick={() => setLado(v)}>
              {v === 'original' ? 'Original' : 'Modificado'}
            </button>
          ))}
        </div>
      </div>
      <ul className={styles.filas}>
        {filas.map((c, i) => {
          const valor = lado === 'original' ? c.antes : c.despues;
          return (
            <li key={`${c.tipo}:${i}`} className={styles.fila}>
              <div className={styles.filaHead}>
                <span className={styles.etiqueta} data-tipo={c.tipo}>{ETIQUETA_CAMBIO[c.tipo]}</span>
                <b>{c.titulo}</b>
              </div>
              <p className={lado === 'original' && c.tipo === 'cambia' ? styles.tachado : undefined}>
                {valor || (lado === 'original' ? 'No existía' : 'Se quita')}
              </p>
            </li>
          );
        })}
      </ul>
      {m.cambios.length > MAX_FILAS && <span className={styles.mas}>y {m.cambios.length - MAX_FILAS} más</span>}
      {m.descartes && m.descartes.length > 0 && (
        <p className={styles.nota}>
          No se aplica: {m.descartes.slice(0, 3).join(' · ')}
          {m.descartes.length > 3 ? ` y ${m.descartes.length - 3} más` : ''}
        </p>
      )}
      {tocada && m.estado === 'pendiente' && <p className={styles.cuidado}>Cambiaste el diseño mientras tanto.</p>}
      {m.aviso && <p role="alert" className={styles.alerta}>{m.aviso}<ReportarASoporte /></p>}
      <div className={styles.botones}>
        {m.estado === 'pendiente' && (
          <>
            <button type="button" className={styles.secundario} onClick={onDescartar}>Descartar</button>
            <button type="button" className={styles.primario} onClick={onAceptar}>Aceptar</button>
          </>
        )}
        {m.estado === 'aplicando' && <span className={styles.girando} aria-label="Aplicando" />}
        {m.estado === 'aplicada' && (
          <>
            <span className={styles.hecho}><Check size={14} aria-hidden="true" /> Aplicado</span>
            {m.aplicada && <button type="button" className={styles.secundario} onClick={onRestaurar}>Restaurar</button>}
          </>
        )}
        {m.estado === 'descartada' && <span className={styles.apagado}>Descartado</span>}
        {m.estado === 'restaurada' && <span className={styles.apagado}>Restaurado</span>}
      </div>
    </div>
  );
}

/** Las sugerencias: el rótulo es lo que se ve; `instruccion`, lo que se pide; `rellenar` deja el texto para completar. */
type Sugerencia = { rotulo: string; instruccion?: string; rellenar?: string; necesitaSeleccion?: boolean };
const SUGERENCIAS: Sugerencia[] = [
  { rotulo: 'Cambia el título', rellenar: 'Cambia el título por: ' },
  { rotulo: 'Agrega un texto', rellenar: 'Agrega un texto que diga: ' },
  { rotulo: 'Mejora el contraste', instruccion: 'Mejora el contraste de los textos con el fondo para que se lean bien.' },
  { rotulo: 'Centra lo elegido', instruccion: 'Centra lo elegido en la página.', necesitaSeleccion: true },
  { rotulo: 'Otra paleta', instruccion: 'Cambia los colores del diseño por una paleta más llamativa, con buen contraste.' },
  { rotulo: 'Duplica la página', instruccion: 'Duplica la página abierta.' },
];
/** Con la marca del negocio cargada, la primera sugerencia es aplicarla (5/11/2026). */
const APLICAR_MARCA: Sugerencia = { rotulo: 'Aplica mi marca', instruccion: 'Aplica mi marca a todo el diseño: sus colores, sus fuentes y el logo.' };
/** En «Discutir», preguntas: MaKo contesta sin tocar nada. */
const SUGERENCIAS_DISCUTIR: Sugerencia[] = [
  { rotulo: '¿Qué mejorarías?', instruccion: '¿Qué mejorarías de este diseño?' },
  { rotulo: '¿Se lee bien?', instruccion: '¿Se lee bien todo el texto? ¿Qué cambiarías para que se lea mejor?' },
  { rotulo: '¿Va con mi marca?', instruccion: '¿Este diseño va con mi marca? ¿Qué cambiarías para que vaya?' },
];

export function PanelMakoIA() {
  const editor = useEditor();
  const disenoId = editor.designId;
  const titulo = useEditorState((s) => s.title);
  const docVersion = useEditorState((s) => s.docVersion);
  const elegidos = useEditorState((s) => s.selection.ids.length);
  /** En blanco: una sola página y sin nada adentro (lib/aperturas/image.ts). */
  const enBlanco = useEditorState((s) => s.doc.pages.length === 1 && s.doc.pages[0].objects.length === 0);
  const hilo = useHilo(disenoId);
  // MAKO TOMA LA INICIATIVA (5/11/2026, docs/mako-iniciativa/plan.md T12): con el diseño en blanco y la charla vacía pregunta
  // «¿Dónde lo vas a publicar?» y la respuesta pone el lienzo a esa medida, sin IA (el mismo resize del panel de tamaño, y anda
  // sin la app de escritorio). Mientras habla, el saludo y las píldoras se esconden: un paso por pantalla.
  const estadoApertura = useApertura({
    superficie: SUPERFICIE_IMAGE,
    hechos: { diseno: disenoId ?? null, enBlanco, charlaVacia: hilo.mensajes.length === 0 },
    libre: !hilo.corriendo,
  });
  const aLaMedida = (a: AccionImage) => () => { const m = MEDIDA_DE[a]; editor.pages.resize(m.ancho, m.alto, 'keep'); };
  const [texto, setTexto] = useState('');
  // Sin la app de escritorio no se escribe (25/10/2026, Martín: «En ningun chat, no solo en Ops Center»): app/_chat/useAppDeEscritorio.tsx.
  const appEscritorio = useAppDeEscritorio();
  const [alcance, setAlcance] = useState<AlcanceChat>('diseno');
  // «Discutir | Editar» (app/_chat/SelectorIntencion.tsx): la misma preferencia que los otros chats de MaKo.
  const [intencion, elegirIntencion] = useIntencion();
  // La marca del negocio (5/11/2026, lib/marca/kits.ts): el kit de por defecto, o el que elija la persona si tiene varios.
  const marca = useKitsDeMarca();
  const [kitId, setKitId] = useState<string | null>(null);
  const kit = marca.kits ? kitElegido(marca.kits, kitId) : null;
  // Sin marca de verdad (no «no pude leer»): ahí el saludo invita a subir el manual.
  const sinMarca = !!marca.kits && marca.kits.kits.length === 0 && !marca.error;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hiloRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorEngine>(editor);
  useEffect(() => { editorRef.current = editor; });

  // Sin nada elegido no hay alcance de selección: se CALCULA, no se dispara.
  const alcanceReal: AlcanceChat = alcance === 'seleccion' && elegidos > 0 ? 'seleccion' : 'diseno';

  // El hilo guardado de este diseño, la primera vez que se abre su chat en la pestaña (./hilo.ts).
  useEffect(() => {
    if (disenoId) void cargarHilo(disenoId, titulo);
  }, [disenoId, titulo]);

  // El chat baja solo con cada mensaje nuevo.
  useEffect(() => {
    const el = hiloRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hilo.mensajes.length, hilo.corriendo]);

  /** `dejarCaja`: lo manda una nota de voz por detrás (lo que la persona esté escribiendo mientras tanto queda en la caja). */
  // Fotos y PDF con el pedido (28/10/2026, las cajas unificadas): la ruta los lee y van aparte de la instrucción. Sólo los de la caja.
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);
  // Acá un SVG o un AVIF también es una imagen para poner (se sube a «Subidos», que los pasa a PNG). La IA lee los demás: ./acciones.ts.
  const adj = useAdjuntosDelChat({ puede: !hilo.corriendo && !!disenoId, onError: setErrorAdjunto, aceptaDeMas: 'image/svg+xml,image/avif' });
  const cita = useCitaDelChat(disenoId);
  const enviar = (instruccion: string, alc: AlcanceChat = alcanceReal, { dejarCaja = false, archivos = [] as readonly File[] } = {}) => {
    if (hilo.corriendo || (!instruccion.trim() && !archivos.length) || !disenoId || appEscritorio.bloqueada) return;
    // Una nota de voz sale por detrás: la cita queda para lo que se está escribiendo.
    if (!dejarCaja) instruccion = cita.con(instruccion.slice(0, TOPES_CHAT_IMAGEN.instruccion - cita.reserva), archivos.length > 0);
    void pedirEdicion(editorRef.current, instruccion.slice(0, TOPES_CHAT_IMAGEN.instruccion), alc, archivos, { intencion, kit });
    if (!dejarCaja) { setTexto(''); cita.soltar(); }
  };

  const sugerir = (s: Sugerencia) => {
    if (s.instruccion) {
      enviar(s.instruccion, s.necesitaSeleccion ? 'seleccion' : alcanceReal);
      return;
    }
    if (s.rellenar) setTexto(s.rellenar);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const visibles = intencion === 'discutir' ? SUGERENCIAS_DISCUTIR
    : [...(kit ? [APLICAR_MARCA] : []), ...SUGERENCIAS].filter((s) => !s.necesitaSeleccion || elegidos > 0);
  // La nota de voz sale en el acto (28/10/2026): se dibuja ya, se pasa a texto por detrás (app/_chat/useNotaEnElActo.ts) y sale por
  // `enviar`, como lo escrito.
  const nota = useNotaEnElActo({ clave: `imagen:${disenoId ?? ''}`, puede: !hilo.corriendo && !!disenoId && !appEscritorio.bloqueada, mandar: (t) => enviar(t, alcanceReal, { dejarCaja: true }) });

  // «USAR PLANTILLA» ESCRIBE LA PIEZA ENTERA (12/11/2026, memoria `replicar-deja-todo-escrito`; el Cerebro lo marcó en la prueba de
  // Image): abierta con `?escribir=1` (../../ruta.ts), MaKo escribe cada texto de guía para el negocio y su oferta principal, con
  // [DATO: …] donde falte, y como la plantilla está sin tocar no hay nada que pisar: queda escrita sin «Aceptar» (se deshace con
  // «Restaurar»). La dirección pierde el `escribir` en el acto: recargar no vuelve a escribir encima de lo que ya se cambió.
  const escribirPlantilla = useRef<'no' | 'pedido' | 'hecho'>('no');
  useEffect(() => {
    if (escribirPlantilla.current !== 'no' || !disenoId || hilo.corriendo || hilo.mensajes.length || appEscritorio.bloqueada) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(ESCRIBIR_PLANTILLA) !== '1') return;
    escribirPlantilla.current = 'pedido';
    url.searchParams.delete(ESCRIBIR_PLANTILLA);
    window.history.replaceState(window.history.state, '', url.toString());
    void pedirEdicion(editorRef.current, PEDIDO_ESCRIBIR_PLANTILLA, 'diseno', [], { kit, conNegocio: true });
  }, [disenoId, hilo.corriendo, hilo.mensajes.length, appEscritorio.bloqueada, kit]);
  useEffect(() => {
    if (escribirPlantilla.current !== 'pedido' || hilo.corriendo) return;
    const m = hilo.mensajes.find((x): x is MensajeMako => x.de === 'mako' && x.estado === 'pendiente' && !!x.propuesta);
    if (!hilo.mensajes.some((x) => x.de === 'mako')) return;
    escribirPlantilla.current = 'hecho';
    if (m) void aceptarPropuesta(editorRef.current, m);
  }, [hilo.mensajes, hilo.corriendo]);

  // El hilo del Ops Center: cada mensaje con su id y su hora; lo de MaKo que el hilo no sabe dibujar (el error, los links, la
  // propuesta con «Original | Modificado»), en su hueco.
  const items = useMemo((): ItemHilo[] => hilo.mensajes.map((m) => ({
    k: 'msg', id: m.id, role: m.de === 'yo' ? 'user' : 'assistant', at: iso(m.c),
    texto: m.de === 'mako' && m.error ? '' : m.texto,
  })), [hilo.mensajes]);
  const enMensaje = (x: Extract<ItemHilo, { k: 'msg' }>): EnMensaje | null => {
    const m = hilo.mensajes.find((y) => y.id === x.id);
    if (!m || m.de !== 'mako') return null;
    return {
      arriba: m.error ? <p className={styles.error}>{m.texto}</p> : null,
      abajo: <>
        {m.links && m.links.length > 0 && (
          <div className={styles.links}>
            {m.links.map((l) => <Link key={l.href} href={l.href} className={styles.link}>{l.texto}</Link>)}
          </div>
        )}
        {m.propuesta && m.cambios && m.estado ? (
          <RevisionPropuesta
            m={m as MensajeMako & { cambios: CambioImagen[]; estado: EstadoPropuesta }}
            tocada={m.propuesta.docVersion !== undefined && m.propuesta.docVersion !== docVersion}
            onAceptar={() => void aceptarPropuesta(editorRef.current, m)}
            onDescartar={() => cambiarMensaje(disenoId, m.id, { estado: 'descartada', aviso: undefined })}
            onRestaurar={() => restaurarPropuesta(editorRef.current, m)}
          />
        ) : m.descartes && m.descartes.length > 0 ? (
          <p className={styles.nota}>No se aplica: {m.descartes.slice(0, 3).join(' · ')}</p>
        ) : null}
      </>,
    };
  };

  return (
    <div className={styles.panel}>
      {/* Con su propio aire: el del Ops Center (24 px por lado) dejaba el hilo en 206 px en este panel. */}
      <div ref={hiloRef} className={`co-hilo ${styles.hilo}`} style={{ padding: '8px 4px' }} aria-live="polite">
        <div className="co-hilo__col">
          {hilo.mensajes.length === 0 && estadoApertura.apertura && (
            <AperturaMako estado={estadoApertura} quien={QUIEN}
              acciones={{ historia: aLaMedida('historia'), carrusel: aLaMedida('carrusel'), anuncio: aLaMedida('anuncio') }} />
          )}
          {hilo.mensajes.length === 0 && !estadoApertura.apertura && (
            <div className={styles.saludo}>
              <span className={styles.chispa} aria-hidden="true"><Sparkles size={20} /></span>
              <p className={styles.saludoTitulo}>{intencion === 'discutir' ? '¿Qué quieres pensar?' : '¿Qué cambiamos?'}</p>
              {/* Sin marca, MaKo la pide (5/11/2026): un link, nunca un paso que trabe el chat. */}
              {sinMarca && (
                <p className={styles.saludoTexto}>
                  Todavía no tengo tu marca. <Link href={rutaSeccion('marca')} className={styles.link}>Sube tu manual de marca</Link> y la uso en tus diseños.
                </p>
              )}
            </div>
          )}
          <HiloMako items={nota.conNotas(items)} quien={QUIEN} ahora={Date.now()} escribiendo={hilo.corriendo ? { segs: 0 } : null}
            tarjeta={null} onTarjeta={nada} onReintentar={nota.reintentar(nada)} onDescartar={nota.descartar} onRecargar={nada} onCitar={cita.citar} enMensaje={enMensaje} />
          {hilo.corriendo && (
            <button type="button" className={styles.secundario} onClick={() => detener(disenoId)}>Detener</button>
          )}
          {!hilo.corriendo && !estadoApertura.apertura && (
            <div className={styles.sugerencias}>
              {(hilo.mensajes.length ? visibles.slice(0, 4) : visibles).map((s) => (
                <button key={s.rotulo} type="button" className={styles.pildora} onClick={() => sugerir(s)}>{s.rotulo}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.pie}>
        <div className={styles.chips} role="group" aria-label="Alcance">
          <button type="button" className={styles.chip} aria-pressed={alcanceReal === 'diseno'} onClick={() => setAlcance('diseno')}>Todo el diseño</button>
          {elegidos > 0 && (
            <button type="button" className={styles.chip} aria-pressed={alcanceReal === 'seleccion'} onClick={() => setAlcance('seleccion')}>
              {rotuloSeleccion(elegidos)}
            </button>
          )}
          {/* Con varios kits (una agencia), se elige con cuál trabaja MaKo. Con uno, va solo. */}
          {marca.kits && marca.kits.kits.length > 1 && kit && (
            <Dropdown ariaLabel="Marca" value={kit.id} onChange={setKitId} options={marca.kits.kits.map((k) => ({ value: k.id, label: `Marca: ${k.nombre}`, ...(k.colores[0] ? { color: k.colores[0].hex } : {}) }))} />
          )}
        </div>
        <SelectorIntencion valor={intencion} onCambio={elegirIntencion} deshabilitado={hilo.corriendo} />
        {/* La caja única (app/_chat/CajaChat.tsx). Los atajos del editor no miran lo que se escribe en un campo
            (`isEditableTarget` de hooks/useKeyboardShortcuts.ts). */}
        <div className="co-caja">
          <CajaChat campo={inputRef} texto={texto} onTexto={setTexto} onMandar={() => { if (!adj.preparando) enviar(texto, alcanceReal, { archivos: adj.tomar() }); }} ocupado={hilo.corriendo || nota.pendientes}
            apagado={!disenoId} placeholder={intencion === 'discutir' ? 'Pregúntame lo que quieras…' : 'Describe el cambio…'} tituloMandar="Enviar" enterManda bloqueo={appEscritorio.bloqueo} onGrabada={nota.onGrabada}
            arriba={cita.arriba} adjuntos={adj.caja} estado={errorAdjunto} topeTexto={TOPES_CHAT_IMAGEN.instruccion - cita.reserva} />
        </div>
      </div>
    </div>
  );
}
