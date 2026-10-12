'use client';

// =============================================================================
// VistaAdjuntos — la vista previa de lo que se va a mandar, como en WhatsApp Web
// =============================================================================
// Pedido de Martín (11/10/2026): «debería salir la vista previa del documento que acabo de subir, como
// lo tiene whatsapp… se ve la preview, y puedo agregar más documentos... Y aún escribir un mensaje
// abajo... Quiero que apliques este cambio no solo a offer, sino a todos los chats que consuman esto de
// subir documento.» Mandó la captura de WhatsApp Web con un PDF elegido: el área del chat se reemplaza
// por la vista previa. Esta pieza es ESA pantalla, y es la MISMA para todos los chats:
//   · ChatHilo (app/whatsapp/_shared): los grupos de WhatsApp de MaKo y el simulador de /automations;
//   · Offer (app/offer/ChatOffer.tsx), sobre el área del chat;
//   · el chat de MaKo del teléfono (app/m/mako), que la monta otro agente con esta misma API.
//
// Lo que dibuja, de arriba a abajo: la ✕ (descarta todo), el nombre y «8 páginas · 1,2 MB»; la vista
// previa grande del elegido; el campo del mensaje con su emoji; y la tira de miniaturas con el «+» para
// sumar más (respeta `accept` y el máximo), la ✕ de cada una y el botón redondo de Enviar.
//
// ⚠️ NO SUBE NI LEE NADA. Junta archivos; subir, leer y mandar lo hace quien la monta, recién en
//    `onEnviar`. La lista es CONTROLADA (`items`): quien la monta decide qué queda si un envío falla.
//    `useListaAdjuntos` (abajo) es la lista con la validación de `agregarALista`, para no repetirla.
// ⚠️ LAS URL `blob:` VIVEN EN UN EFECTO POR ELEMENTO (`useUrlDe`): se crean al montar la miniatura o la
//    vista grande y se sueltan al desmontar (quitar el archivo, cerrar la vista, cambiar de elegido).
//    Creadas en un `useMemo`, el doble montaje de StrictMode las soltaba y la imagen quedaba rota en dev.
// ⚠️ EL PDF SE ABRE CON `unpdf` IMPORTADO DINÁMICO (pdf.js adentro, ~1,6 MB): sólo cuando hay un PDF,
//    nunca en el bundle de entrada. La primera página se dibuja UNA vez por archivo (caché por `File`) y
//    la usan la miniatura y la vista grande. Si falla, tarjeta con ícono, nombre y tamaño.
// ⚠️ ESCAPE CIERRA, Y LA VISTA ES UNA CAPA (`useCapaModal`, anidada): con el emoji abierto, Escape
//    cierra el emoji y no la vista; y montada adentro de un Modal (el ensayo del AI Step), el Modal se
//    abstiene. Enter manda desde el campo (y desde cualquier lugar de la vista que no sea un botón).
// ⚠️ `data-esquina-ocupada` en la fila de abajo: el Enviar vive en el rincón de abajo a la derecha y la
//    esquina de los avisos lo taparía (AGENTS.md).

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { EmojiPicker } from '../EmojiPicker';
import { PopoverWA, iconComposer, insertarEnCursor } from './ComposerWhatsApp';
import { IconSmiley, SendArrow } from './composer-icons';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { Spinner } from '@/app/_ui/Feedback';
import { useCapaModal } from '@/app/_components/pila-modales';
import {
  MAX_ADJUNTOS, agregarALista, detalleDeAdjunto, elegidoTrasQuitar, teclaDeVista, tipoDeVista,
  type ItemAdjunto, type TipoVista, type TopesAdjuntos,
} from './adjuntos-vista';

export type { ItemAdjunto, TopesAdjuntos } from './adjuntos-vista';

// ── La lista (controlada por quien monta la vista) ───────────────────────────────────────────

/**
 * La lista de adjuntos con la validación de la casa (`agregarALista`). `ref` lleva lo de AHORA para lo
 * que decide después de un `await` (un envío largo no puede mandar la lista del render en que empezó).
 * `agregar` devuelve los motivos de lo que no entró; dónde se muestran lo decide quien llama.
 */
export function useListaAdjuntos(topes: TopesAdjuntos, inicial?: () => ItemAdjunto[]) {
  const [items, setItems] = useState<ItemAdjunto[]>(() => inicial?.() ?? []);
  // Arranca con lo mismo que el estado (useRef sólo mira su valor en el primer render).
  const ref = useRef<ItemAdjunto[]>(items);
  const poner = (next: ItemAdjunto[]) => { ref.current = next; setItems(next); };
  return {
    items,
    ref,
    /** Suma archivos al final; devuelve por qué no entró lo que no entró. */
    agregar: (archivos: File[]): string[] => {
      const r = agregarALista(ref.current, archivos, topes);
      if (r.items.length !== ref.current.length) poner(r.items);
      return r.errores;
    },
    quitar: (id: string) => poner(ref.current.filter((x) => x.id !== id)),
    vaciar: () => { if (ref.current.length) poner([]); },
    /** Deja exactamente estos (los que faltan mandar tras un fallo, o el borrador de otro chat). */
    poner,
  };
}

// ── Las URL y el PDF ─────────────────────────────────────────────────────────────────────────

/** Una URL `blob:` para mostrar un binario: nace con el elemento y se suelta con él. */
function useUrlDe(b: Blob | null): string | null {
  const [url, setUrl] = useState<{ b: Blob; u: string } | null>(null);
  useEffect(() => {
    if (!b) return;
    const u = URL.createObjectURL(b);
    setUrl({ b, u });
    return () => { URL.revokeObjectURL(u); };
  }, [b]);
  return b && url?.b === b ? url.u : null;
}

type PrimeraPagina = { paginas: number; imagen: Blob | null };
const pdfs = new WeakMap<File, Promise<PrimeraPagina>>();

/** El lado largo de la primera página dibujada, en píxeles: nítida en la vista grande, liviana en memoria. */
const LADO_PDF = 1100;

/**
 * Abre el PDF en el navegador: cuántas páginas tiene y la primera como imagen. Una vez por archivo (la
 * miniatura y la vista grande comparten la promesa). Si no se puede dibujar la página pero sí contar,
 * vuelve con las páginas y sin imagen; si no se puede abrir, la promesa falla y va la tarjeta.
 */
function primeraPagina(file: File): Promise<PrimeraPagina> {
  const ya = pdfs.get(file);
  if (ya) return ya;
  const p = (async (): Promise<PrimeraPagina> => {
    // pdf.js usa Math.sumPrecise, que no está en todos los navegadores (lib/archivo-a-texto.ts, igual).
    const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
    if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
    const { getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    try {
      const paginas = pdf.numPages;
      let imagen: Blob | null = null;
      try {
        const pagina = await pdf.getPage(1);
        const base = pagina.getViewport({ scale: 1 });
        const escala = Math.min(2.5, LADO_PDF / Math.max(base.width, base.height, 1));
        const vp = pagina.getViewport({ scale: escala });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(vp.width));
        canvas.height = Math.max(1, Math.ceil(vp.height));
        await pagina.render({ canvas, viewport: vp }).promise;
        imagen = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.86));
        canvas.width = 0; canvas.height = 0;
        pagina.cleanup();
      } catch { imagen = null; }
      return { paginas, imagen };
    } finally {
      // Como lo cierra unpdf: el documento se suelta por su tarea de carga.
      void pdf.loadingTask.destroy().catch(() => {});
    }
  })();
  pdfs.set(file, p);
  return p;
}

type EstadoPdf = { estado: 'cargando' } | ({ estado: 'listo' } & PrimeraPagina) | { estado: 'fallo' };

/** La primera página y las páginas de un PDF (null si no es un PDF). */
function usePdf(file: File | null): EstadoPdf | null {
  const [r, setR] = useState<{ file: File; e: EstadoPdf } | null>(null);
  useEffect(() => {
    if (!file) return;
    let vivo = true;
    primeraPagina(file).then(
      (x) => { if (vivo) setR({ file, e: { estado: 'listo', ...x } }); },
      () => { if (vivo) setR({ file, e: { estado: 'fallo' } }); },
    );
    return () => { vivo = false; };
  }, [file]);
  if (!file) return null;
  return r && r.file === file ? r.e : { estado: 'cargando' };
}

const ICONO: Record<TipoVista, NombreIconoMenu> = { imagen: 'imagen', video: 'video', audio: 'audio', pdf: 'archivo', archivo: 'archivo' };

// ── La vista grande ──────────────────────────────────────────────────────────────────────────

/** La tarjeta de lo que no tiene vista previa (o no se pudo dibujar): ícono, nombre y tamaño. */
function Tarjeta({ item, tipo, paginas, children }: { item: ItemAdjunto; tipo: TipoVista; paginas?: number | null; children?: ReactNode }) {
  return (
    <div style={{ width: 'min(300px, 100%)', padding: '26px 22px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', color: 'var(--ink)' }}>
      <span aria-hidden style={{ color: 'var(--dim)', display: 'inline-flex' }}><IconoMenu nombre={ICONO[tipo]} size={44} /></span>
      <div style={{ maxWidth: '100%', fontWeight: 600, fontSize: 'var(--fs-md)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</div>
      <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{detalleDeAdjunto({ bytes: item.file.size, paginas })}</div>
      {children}
    </div>
  );
}

const MEDIA_GRANDE: CSSProperties = { display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' };

function Previa({ item }: { item: ItemAdjunto }) {
  const tipo = tipoDeVista(item.file.name, item.file.type);
  const pdf = usePdf(tipo === 'pdf' ? item.file : null);
  const binario = tipo === 'imagen' || tipo === 'video' || tipo === 'audio' ? item.file : pdf?.estado === 'listo' ? pdf.imagen : null;
  const url = useUrlDe(binario);
  const [roto, setRoto] = useState(false);

  if (tipo === 'pdf' && pdf?.estado === 'cargando') {
    return <span style={{ color: 'var(--dim)', display: 'inline-flex' }}><Spinner size={28} /></span>;
  }
  if (roto || tipo === 'archivo' || (tipo === 'pdf' && !(pdf?.estado === 'listo' && pdf.imagen))) {
    return <Tarjeta item={item} tipo={tipo} paginas={pdf?.estado === 'listo' ? pdf.paginas : null} />;
  }
  if (!url) return null;
  if (tipo === 'audio') {
    return (
      <Tarjeta item={item} tipo={tipo}>
        <audio src={url} controls preload="metadata" onError={() => setRoto(true)} style={{ width: '100%', marginTop: 6 }} />
      </Tarjeta>
    );
  }
  if (tipo === 'video') {
    return <video src={url} controls playsInline preload="metadata" onError={() => setRoto(true)} style={MEDIA_GRANDE} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={item.file.name} onError={() => setRoto(true)} style={{ ...MEDIA_GRANDE, background: 'var(--surface)' }} />;
}

// ── Las miniaturas ───────────────────────────────────────────────────────────────────────────

const LADO_MINI = 54;

function ContenidoMini({ item }: { item: ItemAdjunto }) {
  const tipo = tipoDeVista(item.file.name, item.file.type);
  const pdf = usePdf(tipo === 'pdf' ? item.file : null);
  const binario = tipo === 'imagen' || tipo === 'video' ? item.file : pdf?.estado === 'listo' ? pdf.imagen : null;
  const url = useUrlDe(binario);
  const [roto, setRoto] = useState(false);
  const cubre: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' };
  if (url && !roto && tipo === 'video') return <video src={url} muted playsInline preload="metadata" onError={() => setRoto(true)} style={cubre} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (url && !roto) return <img src={url} alt="" onError={() => setRoto(true)} style={{ ...cubre, background: 'var(--surface)' }} />;
  return <span aria-hidden style={{ color: 'var(--dim)', display: 'inline-flex' }}><IconoMenu nombre={ICONO[tipo]} size={22} /></span>;
}

// ── La vista ─────────────────────────────────────────────────────────────────────────────────

export type VistaAdjuntosProps = {
  /** Los archivos, en el orden en que se van a mandar. Con la lista vacía, quien monta no dibuja la vista. */
  items: ItemAdjunto[];
  /** El «+» (y lo que se suelte encima). Quien monta valida con su tope (`useListaAdjuntos`). */
  onAgregar: (archivos: File[]) => void;
  /** La ✕ de una miniatura. */
  onQuitar: (id: string) => void;
  /** La ✕ de arriba y Escape: descarta TODO. */
  onCerrar: () => void;
  /** El mensaje (va con el primero, o con el turno). */
  texto: string;
  onTexto: (v: string) => void;
  /** Enviar y Enter. Recién acá se sube, se lee o se manda. */
  onEnviar: () => void;
  /** El `accept` del «+» (el mismo del clip). */
  accept?: string;
  /** Con esta cantidad el «+» se apaga (default `MAX_ADJUNTOS`, el mismo de `agregar`; esto es lo que se ve). */
  maxArchivos?: number;
  /** Mientras se sube, se lee o se manda: los controles se apagan (el campo no). */
  enviando?: boolean;
  /**
   * false = Enviar apagado, lo demás no (Offer: MaKo todavía contesta el mensaje anterior). Un Enviar
   * encendido que no hace nada se lee como un botón roto.
   */
  puedeEnviar?: boolean;
  /** Lo que está pasando, con su giro: «Leyendo «precios.pdf»…». */
  estado?: string | null;
  /** Por qué no salió (o por qué no entró un archivo), en una frase. */
  error?: string | null;
  /** El id del archivo que falló: su miniatura va con borde rojo. */
  conError?: string | null;
  /** El color de la miniatura elegida y del Enviar (un token). Default el verde de WhatsApp. */
  acento?: string;
  placeholder?: string;
};

export function VistaAdjuntos({
  items, onAgregar, onQuitar, onCerrar, texto, onTexto, onEnviar, accept, maxArchivos = MAX_ADJUNTOS,
  enviando = false, puedeEnviar = true, estado, error, conError, acento = 'var(--wa)', placeholder,
}: VistaAdjuntosProps) {
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const inputMas = useRef<HTMLInputElement>(null);
  const [btnEmoji, setBtnEmoji] = useState<HTMLButtonElement | null>(null);
  const [emoji, setEmoji] = useState(false);
  const textoVivo = useRef(texto);
  const cursorPendiente = useRef<number | null>(null);
  const capa = useCapaModal(true, { anidada: true });
  const arriba = capa.esElDeArriba;
  const cerrar = useRef(onCerrar);
  const ocupada = useRef(enviando);
  useEffect(() => { cerrar.current = onCerrar; ocupada.current = enviando; }, [onCerrar, enviando]);

  // La miniatura elegida. Lo que llega NUEVO (el «+», un arrastre) queda elegido, como en WhatsApp: se
  // calcula en el render con los ids del render anterior (el patrón de «ajustar el estado a una prop»).
  const ids = items.map((i) => i.id);
  const firma = ids.join('|');
  const [vistos, setVistos] = useState<{ firma: string; ids: string[]; elegido: string | null }>(() => ({ firma, ids, elegido: ids[0] ?? null }));
  if (vistos.firma !== firma) {
    const nuevo = ids.find((x) => !vistos.ids.includes(x));
    const elegido = nuevo ?? (vistos.elegido && ids.includes(vistos.elegido) ? vistos.elegido : ids[0] ?? null);
    setVistos({ firma, ids, elegido });
  }
  const elegidoId = vistos.firma === firma ? vistos.elegido : ids[0] ?? null;
  const elegido = items.find((i) => i.id === elegidoId) ?? items[0] ?? null;
  const elegir = (id: string) => setVistos((v) => ({ ...v, elegido: id }));
  const quitar = (id: string) => {
    const siguiente = elegidoTrasQuitar(ids, elegido?.id ?? null, id);
    setVistos((v) => ({ ...v, elegido: siguiente }));
    onQuitar(id);
  };

  const tipoElegido = elegido ? tipoDeVista(elegido.file.name, elegido.file.type) : 'archivo';
  const pdfElegido = usePdf(elegido && tipoElegido === 'pdf' ? elegido.file : null);
  const lleno = maxArchivos > 0 && items.length >= maxArchivos;

  // Al abrir, el foco va al campo: Enter manda sin tener que hacer clic.
  useEffect(() => { campo.current?.focus({ preventScroll: true }); }, []);

  // El campo crece con el texto hasta su tope, y el cursor vuelve donde estaba tras un emoji.
  useLayoutEffect(() => {
    textoVivo.current = texto;
    const el = campo.current;
    if (!el) return;
    if (cursorPendiente.current != null) {
      const c = cursorPendiente.current;
      cursorPendiente.current = null;
      try { el.setSelectionRange(c, c); } catch { /* el campo ya no está */ }
    }
    el.style.height = 'auto';
    const borde = el.offsetHeight - el.clientHeight;
    const alto = el.scrollHeight + borde;
    el.style.height = `${Math.min(alto, 120)}px`;
    el.style.overflowY = alto > 120 ? 'auto' : 'hidden';
  }, [texto]);

  // Escape: en `document` y en captura, sólo si nada está abierto encima (el emoji), y frenando a los
  // hermanos (AGENTS.md: «un popover anclado también es una capa»). Mientras se sube o se lee, no
  // descarta: lo que está en vuelo no tiene a dónde volver.
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (teclaDeVista({ key: e.key }) !== 'cerrar' || !arriba()) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (!ocupada.current) cerrar.current();
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [arriba]);

  const apagadoEnviar = enviando || !puedeEnviar;
  const enviar = () => { if (!apagadoEnviar && items.length) onEnviar(); };
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    // Lo que se teclea en el emoji (un portal) también sube por acá en el árbol de React: sólo cuenta lo
    // que pasa ADENTRO de la vista.
    const t = e.target as HTMLElement | null;
    if (!t || !raiz.current?.contains(t)) return;
    const accion = teclaDeVista({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing, enBoton: !!t.closest('button, a, input, select') });
    if (accion !== 'enviar') return;
    e.preventDefault();
    enviar();
  };
  // Soltar archivos encima de la vista suma, como el «+». Se frena acá: quien monta la vista puede tener
  // su propio «soltar» en el contenedor (Offer), y llegarían dos veces.
  const alArrastrar = (e: DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const alSoltar = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    e.stopPropagation();
    if (!enviando) onAgregar(Array.from(e.dataTransfer.files));
  };
  const insertarEmoji = (em: string) => {
    const el = campo.current;
    const r = insertarEnCursor(textoVivo.current, el?.selectionStart, el?.selectionEnd, em);
    cursorPendiente.current = r.cursor;
    textoVivo.current = r.valor;
    onTexto(r.valor);
  };

  const detalle = elegido ? detalleDeAdjunto({ bytes: elegido.file.size, paginas: pdfElegido?.estado === 'listo' ? pdfElegido.paginas : null }) : '';

  return (
    <div ref={raiz} role="region" aria-label="Vista previa de los archivos" onKeyDown={alTeclear} onDragOver={alArrastrar} onDrop={alSoltar}
      style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif" }}>
      <style>{CSS_VISTA}</style>

      {/* Arriba: la ✕ (descarta todo) y, al centro, el nombre y «8 páginas · 1,2 MB». */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button type="button" onClick={onCerrar} disabled={enviando} title="Descartar" aria-label="Cerrar la vista previa"
          style={{ ...iconComposer, opacity: enviando ? 0.5 : 1 }}><IconoMenu nombre="cerrar" size={20} /></button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{elegido?.file.name ?? ''}</div>
          {detalle && <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{detalle}</div>}
        </div>
        <span aria-hidden style={{ flex: 'none', width: 42 }} />
      </div>

      {/* La vista previa grande del elegido. La caja de adentro es ABSOLUTA: el `max-height: 100%` de la
          imagen necesita un alto definido, y el de un hijo de flex no lo es en Safari. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px 20px', overflow: 'hidden' }}>
          {elegido && <Previa key={elegido.id} item={elegido} />}
        </div>
      </div>

      {(estado || error) && (
        <div style={{ flex: 'none', display: 'flex', justifyContent: 'center', padding: '0 16px 8px' }}>
          {estado ? (
            <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
              <Spinner size={14} />{estado}
            </span>
          ) : (
            <span role="alert" style={{ maxWidth: 680, padding: '6px 12px', borderRadius: 10, background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: 'var(--fs-sm)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{error}</span>
          )}
        </div>
      )}

      {/* El mensaje, con su emoji, como el composer. */}
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'center', padding: '0 16px 10px' }}>
        <div style={{ width: '100%', maxWidth: 680, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '4px 6px 4px 4px', borderRadius: 24, border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
          <button type="button" ref={setBtnEmoji} onClick={() => setEmoji((a) => !a)} title="Emojis" aria-label="Emojis" aria-expanded={emoji}
            style={{ ...iconComposer, width: 38, height: 38, color: emoji ? 'var(--primary)' : 'var(--dim)' }}><IconSmiley /></button>
          <textarea ref={campo} value={texto} rows={1}
            onChange={(e) => { textoVivo.current = e.target.value; onTexto(e.target.value); }}
            placeholder={placeholder ?? 'Escribe un mensaje'} aria-label={placeholder ?? 'Mensaje'}
            style={{ flex: 1, minWidth: 0, minHeight: 38, resize: 'none', padding: '9px 8px', border: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.35, outline: 'none' }} />
        </div>
      </div>

      {/* Abajo: las miniaturas con el «+», y Enviar en el rincón. */}
      <div data-esquina-ocupada="" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="mk-scroll-x" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'max-content', margin: '0 auto', padding: '8px 4px' }}>
            <div role="list" aria-label="Archivos" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {items.map((it) => {
              const sel = it.id === elegido?.id;
              const mal = it.id === conError;
              return (
                <div key={it.id} role="listitem" className="mk-va-mini" data-sel={sel || undefined} style={{ position: 'relative', flex: 'none' }}>
                  <button type="button" onClick={() => elegir(it.id)} title={it.file.name} aria-label={`Ver ${it.file.name}`} aria-pressed={sel}
                    style={{ width: LADO_MINI, height: LADO_MINI, padding: 0, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: `2px solid ${mal ? 'var(--bad)' : sel ? acento : 'var(--border)'}` }}>
                    <ContenidoMini item={it} />
                  </button>
                  <button type="button" className="mk-va-x" onClick={() => quitar(it.id)} disabled={enviando} title="Quitar" aria-label={`Quitar ${it.file.name}`}
                    style={{ position: 'absolute', top: -7, right: -7, width: 20, height: 20, padding: 0, borderRadius: '50%', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: enviando ? 'default' : 'pointer' }}>
                    <IconoMenu nombre="cerrar" size={11} />
                  </button>
                </div>
              );
            })}
            </div>
            <button type="button" onClick={() => inputMas.current?.click()} disabled={enviando || lleno}
              title={lleno ? `Hasta ${maxArchivos} archivos` : 'Agregar'} aria-label="Agregar archivos"
              style={{ flex: 'none', width: LADO_MINI, height: LADO_MINI, borderRadius: 10, border: '2px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: enviando || lleno ? 'default' : 'pointer', opacity: enviando || lleno ? 0.45 : 1 }}>
              <IconoMenu nombre="agregar" size={22} />
            </button>
            <input ref={inputMas} type="file" multiple accept={accept} hidden
              onChange={(e) => { const lista = Array.from(e.target.files ?? []); e.target.value = ''; if (lista.length) onAgregar(lista); }} />
          </div>
        </div>
        <button type="button" onClick={enviar} disabled={apagadoEnviar} title="Enviar" aria-label="Enviar"
          style={{ flex: 'none', width: 54, height: 54, borderRadius: '50%', border: 'none', background: acento, color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: apagadoEnviar ? 'default' : 'pointer', opacity: apagadoEnviar ? 0.6 : 1 }}>
          {enviando ? <Spinner size={20} /> : <SendArrow />}
        </button>
      </div>

      {emoji && (
        <PopoverWA ancla={btnEmoji} etiqueta="Emojis" onCerrar={() => setEmoji(false)}>
          <EmojiPicker onPick={insertarEmoji} onClose={() => setEmoji(false)} />
        </PopoverWA>
      )}
    </div>
  );
}

// La ✕ de cada miniatura: a la vista en la elegida, al pasar el mouse y con el foco; siempre en un
// teléfono (sin hover, una ✕ que sólo aparece al pasar el mouse no existe).
const CSS_VISTA = '.mk-va-mini .mk-va-x{opacity:0;transition:opacity .12s ease}.mk-va-mini:hover .mk-va-x,.mk-va-mini[data-sel] .mk-va-x,.mk-va-x:focus-visible{opacity:1}@media (hover:none){.mk-va-mini .mk-va-x{opacity:1}}';
