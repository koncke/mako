'use client';

// =============================================================================
// ImportarModal — la bandeja de archivos antes de que MaKo los lea
// =============================================================================
// Antes el botón «importar» abría el buscador de archivos del sistema OPERATIVO de
// una: elegías uno solo, y recién ahí aparecía un modal con un spinner genérico. Si
// fallaba, el archivo desaparecía sin decir cuál ni por qué, y había que empezar de
// nuevo. Ahora el botón abre ESTO: una bandeja, como la de subir videos a una campaña.
//
// Lo que cambia para quien lo usa:
//  · se ven los archivos ANTES de mandarlos, con su peso, y se pueden sacar;
//  · entran varios de una, arrastrando o eligiendo;
//  · cada uno dice en qué estado está y, si falla, por qué — sin llevarse los otros;
//  · el modal NUNCA crece: la lista scrollea adentro (contrato de WizardShell).
//
// Qué NO hace: no extrae. Junta los archivos y se los pasa a quien lo abrió; la
// extracción y la revisión siguen viviendo en ReunionExtractModal, que es donde el
// usuario ya sabe corregir lo que MaKo entendió.
// =============================================================================

import { useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

import { ACCEPT_IMPORTAR, MAX_ARCHIVO_BYTES, iconoDeArchivo, comoSeLee, puedeLeerse } from '@/lib/formatos-archivo';

// La lista YA NO se copia acá. Vivía duplicada del server con un comentario que decía
// «si allá se agrega un formato, se agrega acá», y eso es exactamente lo que se olvidó
// hacer en el tercer lugar (WhatsApp), donde un .txt rebotaba. `lib/formatos-archivo.ts`
// no tiene `server-only` justamente para que el navegador pueda importarla.
const ACCEPT = ACCEPT_IMPORTAR;
const MAX_ARCHIVOS = 12;
const MAX_BYTES = MAX_ARCHIVO_BYTES;
/** El proxy corta el body a 20 MB (next.config.ts). Mandar 21 MB no falla con un
 *  mensaje: falla con un 413 crudo, así que el tope se avisa ACÁ, antes de subir. */
const MAX_TOTAL = 18 * 1024 * 1024;

const peso = (n: number): string => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// El ícono y el «qué va a hacer con esto» también salen del clasificador compartido:
// eran dos listas más que podían quedarse viejas cada una por su cuenta.
const iconoDe = iconoDeArchivo;

type Item = { id: string; file: File; error?: string };

const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' };

export function ImportarModal({ onListo, onClose }: {
  /** Los archivos que el usuario eligió, ya validados. */
  onListo: (files: File[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [sobre, setSobre] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const validos = items.filter((i) => !i.error);
  // El total cuenta SOLO lo que se va a mandar. Sumar también los descartados hacía
  // que un archivo de 30 MB —que ya está marcado como fuera y no viaja— bloqueara el
  // botón y dejara al usuario sin entender por qué, con los otros cuatro en verde.
  const total = validos.reduce((s, i) => s + i.file.size, 0);
  const excedido = total > MAX_TOTAL;

  const agregar = (fl: FileList | File[] | null) => {
    if (!fl) return;
    const nuevos: Item[] = [];
    for (const f of Array.from(fl)) {
      if (items.some((i) => i.file.name === f.name && i.file.size === f.size)) continue; // ya está
      if (items.length + nuevos.length >= MAX_ARCHIVOS) break;
      // El formato se chequea ACÁ, con el mismo clasificador que usa el server. El
      // `accept` del input solo filtra el diálogo del sistema: arrastrando entra
      // cualquier cosa, y hasta ahora un .xlsx viajaba entero para que el server
      // contestara «no sé leer ese formato». Decirlo antes de subir 18 MB es gratis.
      const error = f.size > MAX_BYTES ? 'pesa más de 25 MB'
        : !puedeLeerse(f.name, f.type) ? 'no sé leer ese formato'
          : undefined;
      nuevos.push({ id: `${f.name}-${f.size}-${nuevos.length}`, file: f, error });
    }
    if (nuevos.length) setItems((xs) => [...xs, ...nuevos]);
  };

  const soltar = (e: DragEvent) => { e.preventDefault(); setSobre(false); agregar(e.dataTransfer?.files ?? null); };

  return (
    <WizardShell
      ancho={640}
      titulo="Importar al plan"
      total={1} idx={0}
      pregunta="¿Qué quieres que lea?"
      puedeAvanzar={validos.length > 0 && !excedido}
      enUltimo
      confirmLabel={validos.length > 1 ? `Leer los ${validos.length} →` : 'Leer y sacar las tareas →'}
      atrasLabel="Cancelar"
      onAtras={onClose}
      onSiguiente={() => {}}
      onConfirmar={() => onListo(validos.map((i) => i.file))}
      onClose={onClose}
    >
      <div style={{ fontFamily: SANS }}>
        {/* La zona de soltar. Es también el botón: click = buscador de archivos. */}
        <div
          onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
          onDragLeave={() => setSobre(false)}
          onDrop={soltar}
          onClick={() => input.current?.click()}
          style={{
            border: `1.5px dashed ${sobre ? 'var(--primary)' : 'var(--border-strong)'}`,
            background: sobre ? 'color-mix(in srgb, var(--primary) 7%, transparent)' : 'var(--surface-2)',
            borderRadius: 13, padding: '22px 18px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s, background .15s',
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 6 }}>📥</div>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>Arrastra los archivos aquí</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5 }}>
            o haz clic para buscarlos. Notas, transcripciones, PDFs, capturas, audios de una reunión — MaKo los lee y saca las tareas.
          </div>
          <input ref={input} type="file" accept={ACCEPT} multiple style={{ display: 'none' }}
            onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
        </div>

        {items.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
              <span style={label}>{items.length} archivo{items.length > 1 ? 's' : ''}</span>
              <span style={{ ...label, color: excedido ? 'var(--danger, #D0504A)' : 'var(--faint)' }}>{peso(total)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((it) => (
                <div key={it.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10,
                  border: `1px solid ${it.error ? 'color-mix(in srgb, var(--danger, #D0504A) 40%, var(--border))' : 'var(--border)'}`,
                  background: 'var(--surface)',
                }}>
                  <span style={{ fontSize: 16, flex: 'none' }}>{iconoDe(it.file.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.file.name}</div>
                    <div style={{ fontSize: 11.5, color: it.error ? 'var(--danger, #D0504A)' : 'var(--faint)', marginTop: 2 }}>
                      {it.error ?? `${peso(it.file.size)} · ${comoSeLee(it.file.name)}`}
                    </div>
                  </div>
                  <button type="button" aria-label={`Sacar ${it.file.name}`} onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}
                    style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 3, flex: 'none' }}>×</button>
                </div>
              ))}
            </div>
            {excedido && (
              <div style={{ marginTop: 9, fontSize: 12.5, color: 'var(--danger, #D0504A)', lineHeight: 1.5 }}>
                Juntos pesan más de 18 MB y no van a llegar enteros. Saca alguno y mándalos en dos tandas.
              </div>
            )}
            {items.length >= MAX_ARCHIVOS && (
              <div style={{ marginTop: 9, fontSize: 12.5, color: 'var(--dim)' }}>Hasta {MAX_ARCHIVOS} por vez.</div>
            )}
          </div>
        )}

        {items.length > 1 && !excedido && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10 }}>
            Los va a leer como <strong>un mismo asunto</strong>: si son la transcripción de una reunión y sus anexos, no vas a terminar con la misma tarea repetida una vez por archivo.
          </div>
        )}
      </div>
    </WizardShell>
  );
}
