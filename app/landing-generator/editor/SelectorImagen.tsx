'use client';

// =============================================================================
// SelectorImagen — elegir una imagen o un video: Subir · Buscar imágenes · Enlace · Biblioteca
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Diseño:
// docs/diseno-editor-landing.md (D6). Gamma reparte esto en el placeholder de la imagen
// (⤒ subir · 🔍 buscar · ✨ generar) y en la «Biblioteca multimedia»; los textos son los de su
// catálogo en español («Suelta archivos aquí», «Buscar imágenes», «Pega o escribe una URL de
// imagen», «Biblioteca multimedia», «Cargar más», «No se encontraron resultados»).
// Lo que NO está todavía: «Generar imagen con IA» — va por Google Flow con la extensión del
// cliente (D5) y se construye después del primer armado.
//
// Lo abre el armazón cuando una pieza llama `elegirImagen()` del contexto, y lo cierra con lo
// elegido (`onElegir(url)`) o sin nada (`onCerrar`). Toda URL que devuelve es del bucket público
// `landing-imagenes`, la única que el render acepta:
//   · Subir: `subirArchivo` del contexto (firma → el navegador sube con XHR y progreso REAL →
//     el server verifica los magic bytes). La barra la alimenta ese progreso.
//   · Buscar: `{accion:'buscar'}` con la sugerencia precargada; elegir manda el ID, nunca una URL
//     (anti-SSRF), y el server la copia al bucket.
//   · Enlace: `{accion:'desdeUrl'}` baja la imagen con la baranda de destinos y la copia.
//   · Biblioteca: lo que ya está en el bucket del workspace.
//
// ⚠️ `onCerrar` DE IDENTIDAD FIJA y sin cerrar mientras sube o copia (AGENTS.md, «Todo <Modal>
//    recibe un onCerrar de identidad FIJA»): con una flecha nueva por render, el campo de la
//    búsqueda perdía el foco con cada letra.
// ⚠️ El alto del modal es FIJO: cambiar de pestaña no lo achica (pedido de Martín sobre los
//    detalles: «JAMÁS achiques el tamaño de un detail según lo que contenga dentro»).
// =============================================================================

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { useCerrarEstable, useFocoInicial } from '@/app/customer-success/curso/dialogo-foco';
import { useEditorLanding } from './contexto';
import {
  TIPOS_IMAGEN, TIPOS_VIDEO, TOPE_IMAGEN_BYTES, TOPE_VIDEO_BYTES,
  type ArchivoBiblioteca, type FotoStock,
} from '@/lib/editor-landing/api-tipos';
import { EstilosPanelesB, Ico } from './paneles/PanelAgente';
import { pedirImagenes } from '../cliente';
import { motivoParaNoSubir, tipoDeArchivo } from './subir';

export type PropsSelectorImagen = {
  abierto: boolean;
  modo: 'imagen' | 'video';
  /** Lo que se precarga en «Buscar imágenes» (lo propone la IA o el título de la sección). */
  sugerencia?: string;
  onElegir: (url: string) => void;
  onCerrar: () => void;
};

type Pestana = 'subir' | 'buscar' | 'enlace' | 'biblioteca';

type RespBuscar = { ok: true; fotos: FotoStock[]; pagina: number; hayMas: boolean };
type RespUrl = { ok: true; url: string; tipo?: string };
type RespBiblioteca = { ok: true; archivos: ArchivoBiblioteca[] };

const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/**
 * ¿Este archivo se puede subir ACÁ? La validación del archivo es la de `subirArchivo` (subir.ts:
 * el tipo por el navegador o por la extensión, y el tope de cada uno) — una sola —; esto suma lo
 * propio del selector: una imagen donde se pidió un video no sirve, aunque se pueda subir.
 */
export function problemaDeArchivo(f: { name: string; type: string; size: number }, modo: 'imagen' | 'video'): string | null {
  const motivo = motivoParaNoSubir(f);
  if (motivo) return motivo;
  const tipo = tipoDeArchivo(f) ?? '';
  const delModo: readonly string[] = modo === 'video' ? TIPOS_VIDEO : TIPOS_IMAGEN;
  if (!delModo.includes(tipo)) return modo === 'video' ? 'Elige un video' : 'Elige una imagen';
  return null;
}

export function SelectorImagen(props: PropsSelectorImagen) {
  if (!props.abierto) return null;
  // Montado en cada apertura: el estado (pestaña, búsqueda, progreso) arranca de cero.
  return <SelectorAbierto {...props} />;
}

export default SelectorImagen;

function SelectorAbierto({ modo, sugerencia, onElegir, onCerrar }: PropsSelectorImagen) {
  const { subirArchivo } = useEditorLanding();
  const pestanas: { id: Pestana; rotulo: string; ico: string }[] = modo === 'video'
    ? [{ id: 'subir', rotulo: 'Subir', ico: 'subir' }, { id: 'enlace', rotulo: 'Enlace', ico: 'enlace' }, { id: 'biblioteca', rotulo: 'Biblioteca', ico: 'carpeta' }]
    : [{ id: 'subir', rotulo: 'Subir', ico: 'subir' }, { id: 'buscar', rotulo: 'Buscar imágenes', ico: 'buscar-imagen' }, { id: 'enlace', rotulo: 'Enlace', ico: 'enlace' }, { id: 'biblioteca', rotulo: 'Biblioteca', ico: 'carpeta' }];
  const [pestana, setPestana] = useState<Pestana>(modo === 'imagen' && sugerencia?.trim() ? 'buscar' : 'subir');
  const [ocupado, setOcupado] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);
  const cerrar = useCerrarEstable(onCerrar, ocupado);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  const elegido = useCallback((url: string) => {
    if (!vivo.current) return;
    onElegir(url);
  }, [onElegir]);

  return (
    <Modal titulo={modo === 'video' ? 'Video' : 'Imagen'} onCerrar={cerrar} ancho={720} alto="min(82vh, 640px)" sinFiletes>
      <EstilosPanelesB />
      <style href="gma-selector" precedence="medium">{CSS_SELECTOR}</style>
      <div className="gma gma-pb gma-si">
        <div className="gma-si-pestanas" role="tablist">
          {pestanas.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} className="gma-si-pestana" disabled={ocupado && pestana !== p.id}
              onClick={() => { setPestana(p.id); setFalla(null); }}>
              <Ico n={p.ico} t={15} /> {p.rotulo}
            </button>
          ))}
        </div>
        {falla && <p className="gma-rv-error" role="alert">{falla}</p>}
        <div className="gma-si-cuerpo">
          {pestana === 'subir' && <Subir modo={modo} subirArchivo={subirArchivo} onOcupado={setOcupado} onFalla={setFalla} onListo={elegido} />}
          {pestana === 'buscar' && <Buscar sugerencia={sugerencia ?? ''} onOcupado={setOcupado} onFalla={setFalla} onListo={elegido} ocupado={ocupado} />}
          {pestana === 'enlace' && <Enlace modo={modo} onOcupado={setOcupado} onFalla={setFalla} onListo={elegido} ocupado={ocupado} />}
          {pestana === 'biblioteca' && <Biblioteca modo={modo} onFalla={setFalla} onListo={elegido} />}
        </div>
      </div>
    </Modal>
  );
}

type PropsPestana = { onFalla: (e: string | null) => void; onListo: (url: string) => void };

function Subir({ modo, subirArchivo, onOcupado, onFalla, onListo }: PropsPestana & {
  modo: 'imagen' | 'video';
  subirArchivo: (f: File, onProgreso?: (pct: number) => void) => Promise<string>;
  onOcupado: (v: boolean) => void;
}) {
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState<{ nombre: string; pct: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tipos = modo === 'video' ? TIPOS_VIDEO : TIPOS_IMAGEN;

  const subir = async (f: File | undefined | null) => {
    if (!f || subiendo) return;
    const problema = problemaDeArchivo(f, modo);
    if (problema) { onFalla(problema); return; }
    onFalla(null);
    onOcupado(true);
    setSubiendo({ nombre: f.name, pct: 0 });
    try {
      const url = await subirArchivo(f, (pct) => setSubiendo((s) => (s ? { ...s, pct: Math.max(0, Math.min(100, Math.round(pct))) } : s)));
      onOcupado(false);
      onListo(url);
    } catch (e) {
      onOcupado(false);
      setSubiendo(null);
      onFalla(e instanceof Error && e.message ? e.message : 'No se pudo subir.');
    }
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    void subir(e.dataTransfer.files?.[0]);
  };

  if (subiendo) {
    return (
      <div className="gma-si-subiendo" aria-live="polite">
        <span className="gma-si-nombre">{subiendo.nombre}</span>
        <div className="gma-si-progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={subiendo.pct}>
          <div style={{ width: `${subiendo.pct}%` }} />
        </div>
        <span className="gma-si-pct">{subiendo.pct} %</span>
      </div>
    );
  }

  return (
    <div
      className="gma-si-zona"
      data-sobre={arrastrando ? '' : undefined}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); if (!arrastrando) setArrastrando(true); }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={soltar}
    >
      <input ref={inputRef} type="file" accept={tipos.join(',')} hidden onChange={(e) => { void subir(e.target.files?.[0]); e.target.value = ''; }} />
      <Ico n="subir" t={30} />
      <b>{arrastrando ? 'Suelta archivos aquí' : modo === 'video' ? 'Arrastra un video o haz clic para subirlo' : 'Arrastra una imagen o haz clic para subirla'}</b>
      <span>{modo === 'video' ? `MP4 o WebM · hasta ${mb(TOPE_VIDEO_BYTES)}` : `PNG, JPG, WebP o GIF · hasta ${mb(TOPE_IMAGEN_BYTES)}`}</span>
    </div>
  );
}

function Buscar({ sugerencia, ocupado, onOcupado, onFalla, onListo }: PropsPestana & { sugerencia: string; ocupado: boolean; onOcupado: (v: boolean) => void }) {
  const [q, setQ] = useState(sugerencia);
  const [fotos, setFotos] = useState<FotoStock[] | null>(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [copiando, setCopiando] = useState<string | null>(null);
  const ultima = useRef('');
  useFocoInicial('gma-si-buscar');

  const buscar = useCallback(async (consulta: string, pag: number) => {
    const t = consulta.trim();
    if (!t) return;
    setBuscando(true);
    onFalla(null);
    ultima.current = t;
    const r = await pedirImagenes<RespBuscar>({ accion: 'buscar', q: t, pagina: pag });
    setBuscando(false);
    if (ultima.current !== t) return;
    if (!r.ok) { onFalla(r.error); return; }
    setFotos((prev) => (pag > 1 && prev ? [...prev, ...r.fotos] : r.fotos));
    setPagina(r.pagina || pag);
    setHayMas(!!r.hayMas);
  }, [onFalla]);

  // Con sugerencia, la búsqueda sale sola al abrir.
  const arranco = useRef(false);
  useEffect(() => {
    if (arranco.current || !sugerencia.trim()) return;
    arranco.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- es sincronizar con la red: la búsqueda va al server
    void buscar(sugerencia, 1);
  }, [sugerencia, buscar]);

  const elegir = async (f: FotoStock) => {
    if (ocupado) return;
    setCopiando(f.id);
    onOcupado(true);
    onFalla(null);
    const r = await pedirImagenes<RespUrl>({ accion: 'elegir', id: f.id });
    onOcupado(false);
    setCopiando(null);
    if (!r.ok) { onFalla(r.error); return; }
    onListo(r.url);
  };

  return (
    <div className="gma-si-buscar">
      <form className="gma-si-form" onSubmit={(e) => { e.preventDefault(); void buscar(q, 1); }}>
        <input id="gma-si-buscar" className="gma-si-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imágenes" aria-label="Buscar imágenes" />
        <button type="submit" className="gma-pb-boton" data-v="primario" disabled={!q.trim() || buscando}>{buscando ? <span className="gma-pb-giro" aria-hidden /> : <Ico n="buscar" t={14} />} Buscar</button>
      </form>
      {fotos === null && !buscando && <div className="gma-si-vacio">Fotos de uso libre</div>}
      {fotos === null && buscando && <div className="gma-si-vacio"><span className="gma-pb-giro" aria-label="Buscando" /></div>}
      {fotos !== null && fotos.length === 0 && !buscando && <div className="gma-si-vacio">No se encontraron resultados</div>}
      {fotos !== null && fotos.length > 0 && (
        <>
          <div className="gma-si-grilla">
            {fotos.map((f) => (
              <button key={f.id} type="button" className="gma-si-foto" onClick={() => void elegir(f)} disabled={ocupado} aria-label={`Usar la foto de ${f.autor}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.mini} alt="" loading="lazy" referrerPolicy="no-referrer" />
                <span className="gma-si-credito">{f.autor}{f.licencia ? ` · ${f.licencia}` : ''}</span>
                {copiando === f.id && <span className="gma-si-copiando"><span className="gma-pb-giro" aria-hidden /></span>}
              </button>
            ))}
          </div>
          {hayMas && (
            <div className="gma-si-mas">
              <button type="button" className="gma-pb-boton" data-v="contorno" onClick={() => void buscar(ultima.current, pagina + 1)} disabled={buscando || ocupado}>
                {buscando && <span className="gma-pb-giro" aria-hidden />} Cargar más
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Enlace({ modo, ocupado, onOcupado, onFalla, onListo }: PropsPestana & { modo: 'imagen' | 'video'; ocupado: boolean; onOcupado: (v: boolean) => void }) {
  const [url, setUrl] = useState('');
  useFocoInicial('gma-si-enlace');
  const valida = /^https?:\/\/\S+$/i.test(url.trim());

  const usar = async () => {
    if (!valida || ocupado) return;
    onOcupado(true);
    onFalla(null);
    const r = await pedirImagenes<RespUrl>({ accion: 'desdeUrl', url: url.trim() });
    onOcupado(false);
    if (!r.ok) { onFalla(r.error); return; }
    onListo(r.url);
  };

  return (
    <form className="gma-si-enlace" onSubmit={(e) => { e.preventDefault(); void usar(); }}>
      <input id="gma-si-enlace" className="gma-si-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder={modo === 'video' ? 'Pega o escribe la URL de un video MP4' : 'Pega o escribe una URL de imagen'} aria-label="Enlace" />
      <button type="submit" className="gma-pb-boton" data-v="primario" disabled={!valida || ocupado}>{ocupado && <span className="gma-pb-giro" aria-hidden />} Usar</button>
    </form>
  );
}

function Biblioteca({ modo, onFalla, onListo }: PropsPestana & { modo: 'imagen' | 'video' }) {
  const [archivos, setArchivos] = useState<ArchivoBiblioteca[] | null>(null);
  useEffect(() => {
    let vivo = true;
    void pedirImagenes<RespBiblioteca>({ accion: 'biblioteca' }).then((r) => {
      if (!vivo) return;
      if (!r.ok) { onFalla(r.error); setArchivos([]); return; }
      setArchivos(r.archivos.filter((a) => a.tipo === modo).sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado)));
    });
    return () => { vivo = false; };
  }, [modo, onFalla]);

  if (archivos === null) return <div className="gma-si-vacio"><span className="gma-pb-giro" aria-label="Cargando" /></div>;
  if (!archivos.length) return <div className="gma-si-vacio">Aquí aparecerá lo que subas.</div>;
  return (
    <div className="gma-si-grilla">
      {archivos.map((a) => (
        <button key={a.url} type="button" className="gma-si-foto" onClick={() => onListo(a.url)} aria-label={a.nombre}>
          {a.tipo === 'video'
            ? <video src={a.url} muted preload="metadata" playsInline />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={a.url} alt="" loading="lazy" />}
        </button>
      ))}
    </div>
  );
}

const CSS_SELECTOR = `
.gma-si{display:flex;flex-direction:column;gap:12px;min-height:100%}
.gma-si-pestanas{display:flex;flex-wrap:wrap;gap:4px}
.gma-si-pestana{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border:0;border-radius:8px;background:transparent;color:var(--pb-tinta);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
.gma-si-pestana:hover:not(:disabled){background:var(--pb-sup)}
.gma-si-pestana[aria-selected="true"]{background:var(--pb-celeste2)}
.gma-si-pestana:disabled{opacity:.45;cursor:default}
.gma-si-cuerpo{flex:1;min-height:0}
.gma-si-zona{display:grid;justify-items:center;align-content:center;gap:8px;min-height:300px;padding:24px;border-radius:14px;border:1.5px dashed var(--pb-borde);background:var(--pb-sup);color:var(--pb-tenue);text-align:center;cursor:pointer;transition:border-color .15s ease,background .15s ease}
.gma-si-zona:hover,.gma-si-zona:focus-visible,.gma-si-zona[data-sobre]{border-color:var(--pb-vivo);background:var(--pb-celeste);outline:none}
.gma-si-zona b{font-size:14.5px;font-weight:600;color:var(--pb-texto)}
.gma-si-zona span{font-size:12.5px}
.gma-si-subiendo{display:grid;gap:10px;align-content:center;min-height:300px;padding:24px}
.gma-si-nombre{font-size:13.5px;font-weight:600;color:var(--pb-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gma-si-progreso{height:8px;border-radius:999px;background:var(--pb-sup2);overflow:hidden}
.gma-si-progreso>div{height:100%;border-radius:999px;background:var(--pb-vivo);transition:width .2s ease}
.gma-si-pct{font-size:12.5px;color:var(--pb-tenue);font-variant-numeric:tabular-nums}
.gma-si-buscar{display:grid;gap:12px}
.gma-si-form,.gma-si-enlace{display:flex;gap:8px}
.gma-si-input{flex:1;min-width:0;height:36px;padding:0 12px;border:0;border-radius:10px;background:var(--pb-fondo);box-shadow:0 0 0 1px var(--pb-borde);color:var(--pb-texto);font:inherit;font-size:14px;outline:none}
.gma-si-input:focus{box-shadow:0 0 0 1.5px var(--pb-vivo)}
.gma-si-input::placeholder{color:var(--pb-suave)}
.gma-si-vacio{display:grid;place-items:center;min-height:200px;color:var(--pb-suave);font-size:13px;text-align:center}
.gma-si-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.gma-si-foto{position:relative;display:block;aspect-ratio:4/3;padding:0;border:0;border-radius:10px;overflow:hidden;background:var(--pb-sup);cursor:pointer}
.gma-si-foto img,.gma-si-foto video{display:block;width:100%;height:100%;object-fit:cover}
.gma-si-foto:hover,.gma-si-foto:focus-visible{box-shadow:0 0 0 2px var(--pb-vivo);outline:none}
.gma-si-foto:disabled{cursor:default}
.gma-si-credito{position:absolute;left:0;right:0;bottom:0;padding:14px 8px 5px;background:linear-gradient(to bottom,transparent,rgba(0,0,0,.6));color:#ffffff;font-size:11px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0;transition:opacity .15s ease}
.gma-si-foto:hover .gma-si-credito,.gma-si-foto:focus-visible .gma-si-credito{opacity:1}
.gma-si-copiando{position:absolute;inset:0;display:grid;place-items:center;background:rgba(255,255,255,.6);color:#0540ad}
.gma-si-mas{display:flex;justify-content:center;padding-top:4px}
`;
