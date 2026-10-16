'use client';

// =============================================================================
// PanelMakoIA — «MaKo IA»: el chat del Image Editor, con la cara del panel de Canva AI
// =============================================================================
// Pedido de Martín (16/10/2026, por el Cerebro): «implementes este chat en todas las tabs… quiero que la app sea AI
// NATIVE». Es el chat del Video Editor (app/video-editor/_opencut/chat/PanelChat.tsx) en el editor de imágenes, con la
// pantalla del panel de Canva AI: el saludo con sugerencias en píldoras, los mensajes de la persona en burbuja lila a
// la derecha y los de MaKo sueltos a la izquierda, y el cuadro de abajo con el enviar redondo en el degradado.
//   · la respuesta es un CAMBIO PROPUESTO con «Original | Modificado» que se acepta o se descarta entero; después de
//     aceptar, «Restaurar» lo vuelve atrás (./acciones.ts);
//   · el alcance en chips: «Todo el diseño» o lo elegido en el lienzo;
//   · el hilo es por diseño y queda GUARDADO por persona (./hilo.ts, mig 0303).
// Se abre con el botón redondo del pie del riel (chrome/RielCanva.tsx) y, en pantallas chicas, desde la tira de abajo.
// =============================================================================

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUp, Check, Sparkles } from 'lucide-react';
import Link from '@/app/_ui/Link';
import { useEditor, useEditorState, type EditorEngine } from '../../_doory/editor/extensions';
import { TOPES_CHAT_IMAGEN } from '@/lib/image-editor/chat/catalogo';
import { resumenDeCambios, type CambioImagen } from '@/lib/image-editor/chat/aplicar';
import { cambiarMensaje, cargarHilo, leerHilo, suscribir, type EstadoPropuesta, type Hilo, type MensajeMako } from './hilo';
import { aceptarPropuesta, detener, pedirEdicion, restaurarPropuesta, rotuloSeleccion, type AlcanceChat } from './acciones';
import styles from './chat.module.css';

const HILO_SERVER: Hilo = { mensajes: [], corriendo: false };
const useHilo = (disenoId: string): Hilo => useSyncExternalStore(suscribir, () => leerHilo(disenoId), () => HILO_SERVER);

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
      {m.aviso && <p role="alert" className={styles.alerta}>{m.aviso}</p>}
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

export function PanelMakoIA() {
  const editor = useEditor();
  const disenoId = editor.designId;
  const titulo = useEditorState((s) => s.title);
  const docVersion = useEditorState((s) => s.docVersion);
  const elegidos = useEditorState((s) => s.selection.ids.length);
  const hilo = useHilo(disenoId);
  const [texto, setTexto] = useState('');
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
    if (hilo.corriendo || !instruccion.trim() || !disenoId) return;
    void pedirEdicion(editorRef.current, instruccion, alc);
    setTexto('');
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

  const visibles = SUGERENCIAS.filter((s) => !s.necesitaSeleccion || elegidos > 0);

  return (
    <div className={styles.panel}>
      <div ref={hiloRef} className={styles.hilo} aria-live="polite">
        {hilo.mensajes.length === 0 && (
          <div className={styles.saludo}>
            <span className={styles.chispa} aria-hidden="true"><Sparkles size={20} /></span>
            <p className={styles.saludoTitulo}>¿Qué cambiamos?</p>
            <p className={styles.saludoTexto}>Pídeme lo que quieras del diseño.</p>
          </div>
        )}
        {hilo.mensajes.map((m) =>
          m.de === 'yo' ? (
            <div key={m.id} className={styles.yo}>
              {m.alcance && <span className={styles.alcanceMsg}>{m.alcance}</span>}
              {m.texto}
            </div>
          ) : (
            <div key={m.id} className={styles.mako}>
              <p className={m.error ? styles.error : styles.makoTexto}>{m.texto}</p>
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
            </div>
          ),
        )}
        {hilo.corriendo && (
          <div className={styles.pensando}><span className={styles.girando} aria-hidden="true" /> Pensando</div>
        )}
        {!hilo.corriendo && (
          <div className={styles.sugerencias}>
            {(hilo.mensajes.length ? visibles.slice(0, 4) : visibles).map((s) => (
              <button key={s.rotulo} type="button" className={styles.pildora} onClick={() => sugerir(s)}>{s.rotulo}</button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.pie}>
        <div className={styles.chips} role="group" aria-label="Alcance">
          <button type="button" className={styles.chip} aria-pressed={alcanceReal === 'diseno'} onClick={() => setAlcance('diseno')}>Todo el diseño</button>
          {elegidos > 0 && (
            <button type="button" className={styles.chip} aria-pressed={alcanceReal === 'seleccion'} onClick={() => setAlcance('seleccion')}>
              {rotuloSeleccion(elegidos)}
            </button>
          )}
        </div>
        <div className={styles.cuadro}>
          <textarea
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Los atajos del editor no miran lo que se escribe en un campo (`isEditableTarget` de hooks/useKeyboardShortcuts.ts).
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                enviar(texto);
              }
            }}
            placeholder={hilo.corriendo ? 'Espera a que MaKo termine' : 'Describe el cambio…'}
            disabled={hilo.corriendo || !disenoId}
            rows={2}
            maxLength={TOPES_CHAT_IMAGEN.instruccion}
            aria-label="Mensaje a MaKo"
          />
          <div className={styles.cuadroPie}>
            {hilo.corriendo ? (
              <button type="button" className={styles.enviar} onClick={() => detener(disenoId)} title="Detener" aria-label="Detener">
                <span className={styles.cuadradito} />
              </button>
            ) : (
              <button type="button" className={styles.enviar} onClick={() => enviar(texto)} disabled={!texto.trim() || !disenoId} title="Enviar" aria-label="Enviar">
                <ArrowUp size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
