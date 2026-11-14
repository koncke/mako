'use client';

// =============================================================================
// «Replicar un link o un texto» — lo que TRAE la persona, replicado con el mismo flujo que un outlier (14/11/2026)
// =============================================================================
// El Cerebro, de la llamada con Julio: Copywriting replica «guion de reels, de historias, secuencias de historias, de YouTube, VSL…
// de tu competencia». Acá: qué es (un botón), el link o el texto pegado, y archivos (un guion en PDF, capturas de las historias).
// «Replicar» crea la página vacía que lo replica (lib/copywriter/pegado-servidor.ts) y abre en ella: ahí MaKo transcribe si es un
// video, pregunta la oferta y escribe la pieza entera, con el original al lado (app/copywriter/PanelMaKo.tsx).
// Texto corto en la pantalla (memoria «texto-de-pantalla-corto»): el porqué vive acá.
// =============================================================================

import { useRef, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { INFO_PEGADO, TIPOS_PEGADO, queEsLoPegado, type TipoPegado } from '@/lib/copywriter/pegado';
import { pedirReplicarPegado } from './cliente';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import oc from './outliers.module.css';

/** Lo que se puede subir: lo que lee el lector de los chats (lib/adjuntos-del-chat.ts). */
const ACEPTA = '.pdf,.docx,.txt,.md,image/*';
const TOPE_ARCHIVOS = 6;

/** Qué es, adivinado del link mientras la persona no eligió (un YouTube es un YouTube; una página, su VSL). */
function adivinar(texto: string): TipoPegado | null {
  const lo = queEsLoPegado(texto);
  return lo.clase === 'youtube' ? 'youtube' : lo.clase === 'pagina' ? 'vsl' : null;
}

export function ReplicarPegado({ onCerrar, onListo }: { onCerrar: () => void; onListo: (paginaId: string) => void }) {
  const [elegido, setElegido] = useState<TipoPegado | null>(null);
  const [texto, setTexto] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Cerrar mientras lee no lleva a la página: la persona se fue (la página igual queda en «Mis guiones»).
  const cerrada = useRef(false);
  const cerrar = () => { cerrada.current = true; onCerrar(); };

  const tipo = elegido ?? adivinar(texto);
  const puede = !!tipo && (!!texto.trim() || archivos.length > 0) && !trabajando;

  const replicar = async () => {
    if (!puede || !tipo) return;
    setTrabajando(true);
    setError(null);
    const r = await pedirReplicarPegado(tipo, texto, archivos);
    if (cerrada.current) return;
    if (!r.ok) { setTrabajando(false); setError(r.error); return; }
    onListo(r.pagina.id);
  };

  return (
    <Modal titulo="Replicar un link o un texto" onCerrar={cerrar} ancho={600} completaEnCelular
      pie={<button type="button" className={s.boton} onClick={() => void replicar()} disabled={!puede}>{trabajando ? 'Leyendo…' : 'Replicar'}</button>}>
      <div className={oc.pegado}>
        <div className={oc.pegadoTipos} role="group" aria-label="Qué es">
          {TIPOS_PEGADO.map((t) => (
            <button key={t} type="button" aria-pressed={tipo === t} className={s.pastilla} onClick={() => setElegido(t)}>{INFO_PEGADO[t].boton}</button>
          ))}
        </div>
        <textarea className={oc.pegadoTexto} value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} aria-label="El link o el texto"
          placeholder="Pega un link de YouTube, la página de un VSL o el texto" />
        <div className={oc.pegadoArchivos}>
          <button type="button" className={s.texto} onClick={() => input.current?.click()} disabled={archivos.length >= TOPE_ARCHIVOS}>+ Subir archivo</button>
          {archivos.map((f, i) => (
            <span key={`${f.name}-${i}`} className={oc.pegadoArchivo}>
              {f.name}
              <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setArchivos((xs) => xs.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
          <input ref={input} type="file" accept={ACEPTA} multiple hidden
            onChange={(e) => { const fs = Array.from(e.target.files ?? []); setArchivos((xs) => [...xs, ...fs].slice(0, TOPE_ARCHIVOS)); e.target.value = ''; }} />
        </div>
        {error ? <p role="alert" className={s.aviso}>{error}<ReportarASoporte /></p> : null}
      </div>
    </Modal>
  );
}
