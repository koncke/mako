'use client';

// =============================================================================
// PanelMakoIA — el chat de MaKo del Image Editor, FIJO a la izquierda como en el Web Generator
// =============================================================================
// Pedido de Martín (16/10/2026, por el Cerebro): «implementes este chat en todas las tabs… quiero que la app sea AI
// NATIVE». Y el 26/10/2026: «revisa el diseño y funcionalidades del editor e imagen, que se parezcan un poco mas a MaKo
// en el diseño, que tengan el chat de mako siempre abierto, como web generator… Que tengan la misma infraestructura, pero
// que no pierdan su funcionalidad». Desde ese día:
//   · es EL PANEL ÚNICO de los chats de MaKo (app/admin/operaciones/PanelChat.tsx → `PanelDeChat`: la cabecera con la
//     estrella de MaKo y «en línea», el arrastrar y soltar, la columna del hilo y el lugar de la caja), con `HiloMako` y
//     `CajaChat` adentro: lo mismo que monta el Web Generator (app/web-generator/editor/paneles/ChatAgente.tsx);
//   · vive fijo a la izquierda en escritorio (EditorApp → `chatLateral`, desde ../../editor/PantallaEditor.tsx) y en la
//     pantalla chica sigue siendo la hoja de la tira de abajo (mako/registro.ts, `PANEL_IA`);
//   · arriba de la caja, «Discutir | Editar» (app/_chat/SelectorIntencion.tsx, el de Automations y el Web Generator):
//     Discutir contesta y sugiere sin tocar nada; Editar arma el cambio;
//   · el saludo es la burbuja de MaKo con sus sugerencias en píldoras, como el agente del Web Generator.
// Lo que NO cambió (las reglas de «Un chat que edita lo abierto», AGENTS.md): la respuesta es un CAMBIO PROPUESTO con
// «Original | Modificado» que se acepta o se descarta entero; después de aceptar, «Restaurar» lo vuelve atrás
// (./acciones.ts); el alcance en chips (todo el diseño o lo elegido); el hilo por diseño, guardado por persona (./hilo.ts).
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Check } from 'lucide-react';
import { CajaChat } from '@/app/_chat/CajaChat';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import { SelectorIntencion, useIntencion } from '@/app/_chat/SelectorIntencion';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import Link from '@/app/_ui/Link';
import { useEditor, useEditorState, type EditorEngine } from '../../_doory/editor/extensions';
import { TOPES_CHAT_IMAGEN } from '@/lib/image-editor/chat/catalogo';
import { resumenDeCambios, type CambioImagen } from '@/lib/image-editor/chat/aplicar';
import { cambiarMensaje, cargarHilo, leerHilo, suscribir, type EstadoPropuesta, type Hilo, type MensajeMako } from './hilo';
import { aceptarPropuesta, detener, pedirEdicion, restaurarPropuesta, rotuloSeleccion, type AlcanceChat } from './acciones';
import styles from './chat.module.css';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';

const HILO_SERVER: Hilo = { mensajes: [], corriendo: false };
const useHilo = (disenoId: string): Hilo => useSyncExternalStore(suscribir, () => leerHilo(disenoId), () => HILO_SERVER);

/** Quien contesta en el hilo: la estrella de MaKo, como en el Web Generator (23/10/2026; antes, la criatura de la tab). */
const QUIEN = { nombre: 'MaKo', aspecto: ASPECTO_MAKO };
const nada = () => {};
const iso = (ms: number): string | null => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);

const ETIQUETA_CAMBIO: Record<CambioImagen['tipo'], string> = { cambia: 'Cambia', agrega: 'Nuevo', quita: 'Se quita' };
const MAX_FILAS = 8;

/** La miniatura de una imagen nueva o cambiada (la que creó la IA), si la fila la trae. */
function imagenDe(c: CambioImagen, lado: 'original' | 'modificado'): string | null {
  const x = c as CambioImagen & { imagen?: string; imagenAntes?: string };
  const url = lado === 'modificado' ? x.imagen : x.imagenAntes;
  return typeof url === 'string' && /^(https:|data:image\/|blob:|\/)/.test(url) ? url : null;
}

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
          const img = imagenDe(c, lado);
          return (
            <li key={`${c.tipo}:${i}`} className={styles.fila}>
              <div className={styles.filaHead}>
                <span className={styles.etiqueta} data-tipo={c.tipo}>{ETIQUETA_CAMBIO[c.tipo]}</span>
                <b>{c.titulo}</b>
              </div>
              {img ? <img className={styles.miniatura} src={img} alt={valor || c.titulo} loading="lazy" /> : null}
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
  { rotulo: 'Crea una imagen', rellenar: 'Crea una imagen de ' },
  { rotulo: 'Cambia el título', rellenar: 'Cambia el título por: ' },
  { rotulo: 'Agrega un texto', rellenar: 'Agrega un texto que diga: ' },
  { rotulo: 'Edita la imagen elegida', rellenar: 'Cambia la imagen elegida para que ', necesitaSeleccion: true },
  { rotulo: 'Mejora el contraste', instruccion: 'Mejora el contraste de los textos con el fondo para que se lean bien.' },
  { rotulo: 'Centra lo elegido', instruccion: 'Centra lo elegido en la página.', necesitaSeleccion: true },
  { rotulo: 'Otra paleta', instruccion: 'Cambia los colores del diseño por una paleta más llamativa, con buen contraste.' },
  { rotulo: 'Duplica la página', instruccion: 'Duplica la página abierta.' },
];
const SUGERENCIAS_DISCUTIR: Sugerencia[] = [
  { rotulo: '¿Qué mejorarías?', instruccion: '¿Qué mejorarías de este diseño para que venda más?' },
  { rotulo: '¿Se lee bien?', instruccion: '¿Los textos se leen bien en el teléfono?' },
  { rotulo: 'Ideas de título', instruccion: 'Dame tres ideas de título para este diseño.' },
];

export function PanelMakoIA() {
  const editor = useEditor();
  const disenoId = editor.designId;
  const titulo = useEditorState((s) => s.title);
  const docVersion = useEditorState((s) => s.docVersion);
  const elegidos = useEditorState((s) => s.selection.ids.length);
  const hilo = useHilo(disenoId);
  const [texto, setTexto] = useState('');
  // «Discutir | Editar», la preferencia compartida con los otros chats de MaKo (app/_chat/SelectorIntencion.tsx).
  const [intencion, elegirIntencion] = useIntencion();
  // Sin la app de escritorio no se escribe (25/10/2026, Martín: «En ningun chat, no solo en Ops Center»): app/_chat/useAppDeEscritorio.tsx.
  const appEscritorio = useAppDeEscritorio();
  const [alcance, setAlcance] = useState<AlcanceChat>('diseno');
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

  const enviar = (instruccion: string, alc: AlcanceChat = alcanceReal) => {
    if (hilo.corriendo || !instruccion.trim() || !disenoId || appEscritorio.bloqueada) return;
    void pedirEdicion(editorRef.current, instruccion.slice(0, TOPES_CHAT_IMAGEN.instruccion), alc, intencion);
    setTexto('');
  };

  const sugerir = (s: Sugerencia) => {
    if (s.instruccion) {
      enviar(s.instruccion, s.necesitaSeleccion ? 'seleccion' : alcanceReal);
      return;
    }
    if (s.rellenar) setTexto(s.rellenar);
    if (s.necesitaSeleccion) setAlcance('seleccion');
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const visibles = (intencion === 'discutir' ? SUGERENCIAS_DISCUTIR : SUGERENCIAS).filter((s) => !s.necesitaSeleccion || elegidos > 0);

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

  const pildoras = (lista: Sugerencia[]) => (
    <div className={styles.sugerencias}>
      {lista.map((s) => (
        <button key={s.rotulo} type="button" className={styles.pildora} onClick={() => sugerir(s)} disabled={hilo.corriendo || !disenoId}>{s.rotulo}</button>
      ))}
    </div>
  );

  return (
    <div className={styles.columna} data-testid="ie-chat-mako">
      <PanelDeChat
        hilo={hiloRef}
        estado=""
        cabecera={{
          clave: `imagen:${disenoId}`, titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO,
          animo: hilo.corriendo ? 'trabajando' : 'despierto',
          acciones: <span className={styles.enLinea}>{hilo.corriendo ? 'escribiendo…' : 'en línea'}</span>,
        }}
        caja={
          <div className={styles.pie}>
            {/* «Discutir | Editar», como en el Web Generator y en Automations. */}
            <SelectorIntencion valor={intencion} onCambio={elegirIntencion} deshabilitado={hilo.corriendo} />
            {intencion === 'editar' && (
              <div className={styles.chips} role="group" aria-label="Alcance">
                <button type="button" className={styles.chip} aria-pressed={alcanceReal === 'diseno'} onClick={() => setAlcance('diseno')}>Todo el diseño</button>
                {elegidos > 0 && (
                  <button type="button" className={styles.chip} aria-pressed={alcanceReal === 'seleccion'} onClick={() => setAlcance('seleccion')}>
                    {rotuloSeleccion(elegidos)}
                  </button>
                )}
              </div>
            )}
            {/* La caja única (app/_chat/CajaChat.tsx). Los atajos del editor no miran lo que se escribe en un campo
                (`isEditableTarget` de hooks/useKeyboardShortcuts.ts). */}
            <div className="co-caja">
              <CajaChat campo={inputRef} texto={texto} onTexto={setTexto} onMandar={() => enviar(texto)} ocupado={hilo.corriendo}
                apagado={!disenoId} placeholder="Escribe a MaKo" tituloMandar="Enviar" enterManda bloqueo={appEscritorio.bloqueo} />
            </div>
          </div>
        }
      >
        {hilo.mensajes.length === 0 && (
          <>
            <div className={styles.burbuja}>
              {intencion === 'discutir'
                ? 'Pregúntame lo que quieras de tu diseño: te digo qué cambiaría, sin tocar nada.'
                : 'Pídeme que edite el diseño o que cree una imagen nueva.'}
            </div>
            {pildoras(visibles)}
          </>
        )}
        <HiloMako items={items} quien={QUIEN} ahora={Date.now()} escribiendo={hilo.corriendo ? { segs: 0 } : null}
          tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} enMensaje={enMensaje} />
        {hilo.corriendo && (
          <button type="button" className={styles.secundario} onClick={() => detener(disenoId)}>Detener</button>
        )}
        {hilo.mensajes.length > 0 && !hilo.corriendo && pildoras(visibles.slice(0, 4))}
      </PanelDeChat>
    </div>
  );
}
