'use client';

// =============================================================================
// Composer — escribir, dictar o adjuntar, pegado abajo
// =============================================================================
// Tres formas de contarle a MaKo de la oferta, en una sola caja:
//   · escribir (Enter manda, Shift+Enter baja de renglón);
//   · dictar con `BotonDictar` (app/plan/board/CrearTareaModal.tsx): en vivo con el
//     reconocimiento del navegador o, si no hay, graba y transcribe. El texto se PEGA
//     en el campo y la persona lo lee antes de mandarlo;
//   · adjuntar VARIOS archivos (lo que lee el Archivero: lib/formatos-archivo.ts). Se
//     suben y se leen apenas se eligen; lo leído viaja en el próximo mensaje.
//
// ⚠️ `data-esquina-ocupada` en la caja de abajo: sin la marca, el aviso flotante de
// la esquina (app/_components/EsquinaAvisos.tsx) tapa el botón de mandar y el clic
// no le llega nunca (AGENTS.md).
//
// ⚠️ El botón de mandar se APAGA mientras se lee un archivo: mandar antes dejaría el
// archivo afuera del mensaje que lo nombra.

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { Button } from '@/app/_ui';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { IconClip } from '@/app/whatsapp/_shared/composer-icons';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { ACCEPT_IMPORTAR } from '@/lib/formatos-archivo';
import type { AdjuntoVista } from '@/lib/offer-marco';
import { ChipArchivo } from './ChipArchivo';

/** Un archivo elegido en el composer: leyéndose, leído (con su doc) o rebotado (con el porqué). */
export type AdjuntoEnCurso = {
  key: string;
  nombre: string;
  estado: 'leyendo' | 'listo' | 'error';
  doc?: AdjuntoVista;
  error?: string;
};

const LECTURA = 760;
const ALTO_MAX = 200;

export function Composer({
  texto, onTexto, adjuntos, onArchivos, onQuitar, onEnviar, puedeEnviar, enviando, error, onError,
}: {
  texto: string;
  onTexto: (v: string) => void;
  adjuntos: AdjuntoEnCurso[];
  onArchivos: (archivos: File[]) => void;
  onQuitar: (key: string) => void;
  onEnviar: () => void;
  /** Hay algo que mandar y nada en curso (ni MaKo contestando ni un archivo leyéndose). */
  puedeEnviar: boolean;
  /** MaKo está contestando el mensaje anterior. */
  enviando: boolean;
  error: string | null;
  onError: (m: string) => void;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const selector = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);

  // El campo crece con lo que se escribe (o se dicta) hasta un tope, y después scrollea.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, ALTO_MAX)}px`;
  }, [texto]);

  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Con un teclado de composición (acentos, japonés) el Enter confirma la letra, no el mensaje.
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (puedeEnviar) onEnviar();
  };

  const elegidos = (e: ChangeEvent<HTMLInputElement>) => {
    const lista = Array.from(e.target.files ?? []);
    // Se vacía para que elegir el MISMO archivo otra vez vuelva a disparar el cambio.
    e.target.value = '';
    if (lista.length) onArchivos(lista);
  };

  // Soltar archivos sobre la caja hace lo mismo que el clip.
  const alSoltar = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    setEncima(false);
    onArchivos(Array.from(e.dataTransfer.files));
  };
  const alArrastrar = (e: DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
    e.preventDefault();
    if (!encima) setEncima(true);
  };

  return (
    <div data-esquina-ocupada style={{ flex: 'none', paddingTop: 8 }}>
      <div style={{ maxWidth: LECTURA, marginInline: 'auto' }}>
        <div
          className="of-composer"
          onDragOver={alArrastrar}
          onDragLeave={() => setEncima(false)}
          onDrop={alSoltar}
          data-encima={encima || undefined}
          style={{
            display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 10px 10px 14px',
            background: 'var(--surface)', borderRadius: 18,
            // El COLOR del borde y la sombra los pone la hoja (.of-composer): en línea le
            // ganarían al :focus-within y la caja no mostraría el foco.
            borderWidth: 1, borderStyle: encima ? 'dashed' : 'solid',
          }}
        >
          {adjuntos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {adjuntos.map((a) => (
                <ChipArchivo
                  key={a.key}
                  nombre={a.nombre}
                  estado={a.estado === 'error' ? 'error' : a.estado === 'leyendo' ? 'leyendo' : a.doc?.aviso ? 'aviso' : 'listo'}
                  nota={a.estado === 'error' ? a.error : a.doc?.aviso}
                  onQuitar={() => onQuitar(a.key)}
                />
              ))}
            </div>
          )}
          <textarea
            ref={campo}
            className="of-campo"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            onKeyDown={tecla}
            placeholder="Escribe, dicta o adjunta…"
            aria-label="Tu mensaje para MaKo"
            rows={1}
            maxLength={12_000}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'none', border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 'var(--fs-card)',
              lineHeight: 1.45, padding: '6px 2px', minHeight: 34, maxHeight: ALTO_MAX, overflowY: 'auto',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="of-herr" onClick={() => selector.current?.click()} aria-label="Adjuntar archivos" title="Adjuntar archivos">
              <IconClip />
            </button>
            <BotonDictar titulo="Dictar" valor={texto} onValor={onTexto} onError={onError} />
            <span style={{ flex: 1 }} />
            <Button variant="primary" onClick={onEnviar} disabled={!puedeEnviar} loading={enviando}
              aria-label="Enviar" title="Enviar" icon={<IconoMenu nombre="enviar" size={18} />} />
          </div>
        </div>
        {error && (
          <p role="alert" style={{ margin: '6px 6px 0', fontSize: 'var(--fs-sm)', lineHeight: 1.4, color: 'var(--bad)' }}>{error}</p>
        )}
      </div>
      <input ref={selector} type="file" multiple accept={ACCEPT_IMPORTAR} onChange={elegidos} hidden />
    </div>
  );
}
