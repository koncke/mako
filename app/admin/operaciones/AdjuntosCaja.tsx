'use client';

// =============================================================================
// La caja del Ops Center: el «+», las miniaturas de lo adjuntado y el visor (17/10/2026)
// =============================================================================
// Martín (feedback del 17/10, la B): «abajo, un solo "+" con un desplegable bien diseñado», con «Importar archivo» e
// «Imagen» como dos botones, la cuenta, el modelo y el esfuerzo; y «la preview de un adjunto va como en Claude: sólo la
// miniatura, sin el nombre, con aire respecto del placeholder... Al clickearla se amplía ANTES de mandar, también un
// PDF». Copiado de la caja de Claude: el «+» abajo a la izquierda abre un menú hacia arriba, y lo adjuntado son cuadritos
// arriba del texto.
// El estado y la subida viven en useCentro.ts (`sumarAdjuntos`, `mandar`): esto sólo dibuja. Lo usan la computadora
// (Conversacion.tsx) y el teléfono (ChatsMovil.tsx): en el teléfono el menú se abre adentro de la caja, porque una hoja
// sobre otra REEMPLAZA (SheetM.tsx).

import '@/app/_chat/chat.css';
import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { IconoChat } from '@/app/m/mako/iconos';
import { ACCEPT_ADJUNTOS_CHAT } from '@/lib/mako-adjuntos';
import type { AdjuntoCaja } from './useCentro';
import { Visor } from './Visor';

/** Lo que la caja necesita para adjuntar. `puede` = false: el Runner todavía no baja adjuntos (no se ofrece). */
export type AdjuntosDeCaja = {
  items: readonly AdjuntoCaja[];
  puede: boolean;
  onSumar: (archivos: File[]) => void;
  onQuitar: (id: string) => void;
};

/** Pegar: una captura entra como adjunto. Una celda de Excel o un párrafo de Word viajan como texto Y como imagen: si hay
 *  texto, se pega el texto (la misma regla que el Second Brain). */
export function alPegar(e: ClipboardEvent<HTMLTextAreaElement>, a: AdjuntosDeCaja | undefined) {
  if (!a?.puede) return;
  const fs = Array.from(e.clipboardData.files);
  if (fs.length && !Array.from(e.clipboardData.types).includes('text/plain')) { e.preventDefault(); a.onSumar(fs); }
}

/** Lo adjuntado, arriba del texto: sólo la miniatura (sin el nombre, como Claude). Tocarla la amplía. */
export function ListaAdjuntos({ a }: { a: AdjuntosDeCaja | undefined }) {
  const [viendo, setViendo] = useState<AdjuntoCaja | null>(null);
  if (!a?.items.length) return null;
  return (
    <>
      <ul className="co-miniaturas" aria-label="Archivos para mandar">
        {a.items.map((x) => (
          <li key={x.id} className="co-miniatura">
            <button type="button" className="co-miniatura__ver" onClick={() => setViendo(x)} aria-label={`Ver ${x.file.name}`} title={x.file.name}>
              {/* eslint-disable-next-line @next/next/no-img-element -- la vista previa local (blob:) */}
              {x.tipo === 'image' ? <img src={x.url} alt="" /> : <span className="co-miniatura__doc"><IconoChat nombre="archivo" size={18} /><span>PDF</span></span>}
            </button>
            <button type="button" className="co-miniatura__quitar" onClick={() => a.onQuitar(x.id)} aria-label={`Quitar ${x.file.name}`}>
              <Icon name="x" size={12} />
            </button>
          </li>
        ))}
      </ul>
      {viendo && <VerAdjunto x={viendo} onCerrar={() => setViendo(null)} />}
    </>
  );
}

/** El adjunto ampliado, antes de mandar: la foto entera, o el PDF en su visor. Escape o tocar afuera lo cierra. */
function VerAdjunto({ x, onCerrar }: { x: AdjuntoCaja; onCerrar: () => void }) {
  return <Visor url={x.url} nombre={x.file.name} tipo={x.tipo} onCerrar={onCerrar} />;
}

/**
 * El «+» de la caja, abajo a la izquierda: arriba los dos botones para adjuntar («Importar archivo» y «Imagen») y, debajo,
 * lo que se elige al mandar (`children`: la cuenta, el modelo y el esfuerzo, PiezasCentro.tsx → SelectoresDeEnvio).
 * `resumen`: lo elegido que no es «Automático», en chico al lado del «+» para que se vea sin abrirlo.
 */
export function MasCaja({ a, apagado, resumen, children }: {
  a: AdjuntosDeCaja | undefined; apagado: boolean; resumen?: string | null;
  /** Lo de abajo del menú; como función recibe `cerrar` (Tareas vinculadas lleva a un mensaje y cierra el menú). */
  children?: ReactNode | ((cerrar: () => void) => ReactNode);
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const imagen = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const elegir = (fs: FileList | null, input: HTMLInputElement) => {
    const lista = Array.from(fs ?? []);
    input.value = '';
    setAbierto(false);
    if (lista.length) a?.onSumar(lista);
  };
  const adjunta = !!a?.puede;
  return (
    <div className="co-mas-caja" ref={caja}>
      <button type="button" className="ch-adjuntar" aria-haspopup="menu" aria-expanded={abierto} disabled={apagado}
        onClick={() => setAbierto((v) => !v)} aria-label="Más opciones" title="Adjuntar y elegir con qué corre">
        <Icon name="plus" size={18} />
      </button>
      {resumen && !abierto && <span className="co-mas-caja__resumen">{resumen}</span>}
      {abierto && (
        <div className="co-mas-caja__panel" role="menu">
          {adjunta && (
            <div className="co-mas-caja__tiles">
              <button type="button" role="menuitem" className="co-mas-caja__tile" onClick={() => archivo.current?.click()}>
                <IconoChat nombre="archivo" size={20} /><span>Importar archivo</span>
              </button>
              <button type="button" role="menuitem" className="co-mas-caja__tile" onClick={() => imagen.current?.click()}>
                <IconoChat nombre="foto" size={20} /><span>Imagen</span>
              </button>
            </div>
          )}
          {children && <div className="co-mas-caja__opciones">{typeof children === 'function' ? children(() => setAbierto(false)) : children}</div>}
        </div>
      )}
      <input ref={archivo} type="file" accept={ACCEPT_ADJUNTOS_CHAT} multiple hidden onChange={(e) => elegir(e.target.files, e.target)} />
      <input ref={imagen} type="file" accept="image/*" multiple hidden onChange={(e) => elegir(e.target.files, e.target)} />
    </div>
  );
}
