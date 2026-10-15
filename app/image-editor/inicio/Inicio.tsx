'use client';

// =============================================================================
// El Inicio del Image Editor: la copia del Inicio de Canva
// =============================================================================
// Como el de Canva 2025–26 (docs/editor-imagen/relevamiento-canva-armazon.md §8):
//   · arriba, la franja con el degradado muy claro (#DAF1F8 → #E9DEFC), el titular
//     «¿Qué diseñaremos hoy?» con texto en degradado, los chips («Mis diseños»,
//     «Plantillas», «MaKo IA» con su insignia «Nuevo») y el buscador grande;
//   · la fila de accesos por tipo: círculos de color con ícono blanco y el rótulo
//     debajo. Un círculo abre debajo sus tamaños; «Video» lleva al Video Editor y
//     «Elegir el tamaño» abre el diálogo «Crear un diseño» (./CrearDiseno.tsx);
//   · «Diseños recientes», en cuadrícula o en lista.
//
// Los chips eligen DÓNDE busca el buscador, como en Canva: «Mis diseños» busca sólo
// en los recientes y «Plantillas» muestra los tamaños en blanco (las plantillas de
// verdad llegan con el catálogo propio, tanda 4). «MaKo IA» queda apagado hasta que
// haya IA de imagen (el puente a Flow).
//
// Lo que NO se copia de Canva: el logo, sus íconos (acá son de lucide), la fuente,
// sus plantillas y fotos, y «Canva IA».
//
// Los diseños son los de ESTE workspace, en la base (/api/image-editor/disenos, mig 0278). Al
// entrar, lo que haya quedado en el navegador de la etapa 1 sube solo (../mako/mudanza.ts).
// Crear = guardar un documento en blanco y navegar a /image-editor/<id> con el `?ws=`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Folder, LayoutGrid, LayoutTemplate, List, Proportions, Search, Sparkles, Video, X } from 'lucide-react';
import Link, { useRouter } from '@/app/_ui/Link';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { useConfirm } from '@/app/_ui/Confirm';
import { createBlankDocument } from '../_doory/lib/document';
import type { ResumenDiseno } from '@/lib/image-editor/tipos';
import { mudarLocales } from '../mako/mudanza';
import { borrarDiseno, crearDiseno, listarDisenos } from '../mako/nube';
import { rutaDiseno, rutaEditor } from '../ruta';
import { CrearDiseno, type VistaCrear } from './CrearDiseno';
import { TarjetaTamano } from './TarjetaTamano';
import {
  COLOR_ELEGIR, COLOR_VIDEO, TIPOS,
  buscarTamanos, coincide, medidaEscrita, medidasDe, nuevoDe, tamanoPorMedidas, tamanosDe,
  type NuevoDiseno, type Tipo,
} from './tamanos';
import styles from './inicio.module.css';

/** Dónde busca el buscador: en todo, sólo en los diseños o sólo en los tamaños. */
type Ambito = 'todo' | 'disenos' | 'plantillas';

const PLACEHOLDER: Record<Ambito, string> = {
  todo: 'Busca tamaños y diseños',
  disenos: 'Busca en tus diseños',
  plantillas: 'Busca tamaños',
};

/** Los círculos de la fila de accesos, en el orden de Canva (Sitio web va sólo en el diálogo). */
const CIRCULOS: Tipo[] = ['presentacion', 'social', 'foto'];
const CIRCULOS_DESPUES_DEL_VIDEO: Tipo[] = ['impresion'];

// ── Preferencia de vista (por persona y navegador; si el navegador no deja guardar, cuadrícula) ──

type Vista = 'cuadricula' | 'lista';
const CLAVE_VISTA = 'mako-image-editor-vista';

function leerVista(): Vista {
  try {
    return window.localStorage.getItem(CLAVE_VISTA) === 'lista' ? 'lista' : 'cuadricula';
  } catch {
    return 'cuadricula';
  }
}

function guardarVista(v: Vista) {
  try {
    window.localStorage.setItem(CLAVE_VISTA, v);
  } catch {
    // Sin almacenamiento (ventana privada, sitio bloqueado): la vista vale hasta recargar.
  }
}

// ── Un diseño de la lista ──

/** Lo que la lista dibuja de un diseño de la base (../../../lib/image-editor/tipos.ts → ResumenDiseno). */
type FilaLista = { id: string; title: string; width: number; height: number; pageCount: number; updatedAt: number; miniatura: string | null };

const aFila = (d: ResumenDiseno): FilaLista => ({
  id: d.id, title: d.titulo, width: d.ancho, height: d.alto, pageCount: d.paginas, updatedAt: Date.parse(d.actualizado) || 0, miniatura: d.miniatura,
});

// ── Textos de un diseño ──

/** «Publicación de Instagram · 1080 × 1080 px · 3 páginas». */
function detalleDe(d: FilaLista): string {
  const tamano = tamanoPorMedidas(d.width, d.height);
  const partes = [tamano?.nombre, `${d.width} × ${d.height} px`, d.pageCount > 1 ? `${d.pageCount} páginas` : null];
  return partes.filter(Boolean).join(' · ');
}

function editadoHace(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60_000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** La miniatura guardada o, si todavía no hay, la hoja en blanco con su proporción. */
function Miniatura({ d, lado }: { d: FilaLista; lado: number }) {
  if (d.miniatura) return <img src={d.miniatura} alt="" draggable={false} />;
  const escala = lado / Math.max(d.width, d.height);
  return (
    <span
      className={styles.hoja}
      style={{ width: Math.max(6, Math.round(d.width * escala)), height: Math.max(6, Math.round(d.height * escala)) }}
    />
  );
}

function TarjetaDiseno({ d, onAbrir, onBorrar }: { d: FilaLista; onAbrir: () => void; onBorrar: () => void }) {
  return (
    <div className={styles.tarjeta}>
      <button type="button" className={styles.miniatura} onClick={onAbrir} aria-label={`Abrir «${d.title}»`}>
        <Miniatura d={d} lado={136} />
      </button>
      <span className={styles.borrar}>
        <BotonBorrar talla="sm" title={`Eliminar «${d.title}»`} onClick={onBorrar} />
      </span>
      <button type="button" className={styles.nombre} onClick={onAbrir} title={d.title}>{d.title}</button>
      <span className={styles.detalle} title={detalleDe(d)}>{detalleDe(d)}</span>
    </div>
  );
}

function FilaDiseno({ d, onAbrir, onBorrar }: { d: FilaLista; onAbrir: () => void; onBorrar: () => void }) {
  const tamano = tamanoPorMedidas(d.width, d.height);
  return (
    <li className={styles.fila}>
      <button type="button" className={styles.abrir} onClick={onAbrir} title={d.title}>
        <span className={styles.mini}><Miniatura d={d} lado={36} /></span>
        <span className={styles.nombreFila}>{d.title}</span>
      </button>
      <span className={`${styles.celda} ${styles.celdaTipo}`}>{tamano ? tamano.nombre : `${d.width} × ${d.height} px`}</span>
      <span className={`${styles.celda} ${styles.celdaEditado}`}>{editadoHace(d.updatedAt)}</span>
      <BotonBorrar talla="sm" title={`Eliminar «${d.title}»`} onClick={onBorrar} />
    </li>
  );
}

export function Inicio({ ws }: { ws: number | null }) {
  const router = useRouter();
  const { confirm, confirmNode } = useConfirm();
  const [disenos, setDisenos] = useState<FilaLista[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [ambito, setAmbito] = useState<Ambito>('todo');
  const [tipoAbierto, setTipoAbierto] = useState<Tipo | null>(null);
  const [dialogo, setDialogo] = useState<VistaCrear | null>(null);
  const [vista, setVista] = useState<Vista>(leerVista);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const resultados = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => {
    void listarDisenos().then((r) => {
      if (r.ok) setDisenos(r.disenos.map(aFila));
      else { setDisenos([]); setError(r.error); }
    });
  }, []);
  // Primero sube lo que haya quedado en el navegador (etapa 1); después lista. Si la mudanza falla,
  // la copia local queda y se reintenta la próxima vez: la lista sale igual.
  useEffect(() => {
    void mudarLocales(ws).catch(() => undefined).finally(cargar);
  }, [ws, cargar]);

  async function crear(nuevo: NuevoDiseno) {
    if (creando) return;
    setCreando(true);
    setError(null);
    try {
      const r = await crearDiseno({
        titulo: 'Diseño sin título',
        doc: createBlankDocument(nuevo.ancho, nuevo.alto, { unit: nuevo.unidad, presetId: nuevo.presetId }),
      });
      if (!r.ok) throw new Error(r.error);
      // `creando` queda prendido: la pantalla se va, y un segundo clic no crea otro.
      router.push(rutaDiseno(r.id));
    } catch {
      setError('No se pudo crear el diseño.');
      setCreando(false);
    }
  }

  const abrir = (d: FilaLista) => router.push(rutaDiseno(d.id));

  async function borrar(d: FilaLista) {
    if (!(await confirm(`Se elimina «${d.title}».`, { title: 'Eliminar diseño' }))) return;
    const r = await borrarDiseno(d.id);
    if (!r.ok) setError('No se pudo eliminar.');
    cargar();
  }

  function elegirAmbito(a: Ambito) {
    setAmbito((actual) => (actual === a ? 'todo' : a));
    buscador.current?.focus();
  }

  function cambiarVista() {
    const v: Vista = vista === 'cuadricula' ? 'lista' : 'cuadricula';
    setVista(v);
    guardarVista(v);
  }

  function irAResultados() {
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    resultados.current?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
  }

  // ── Qué se ve ──
  const buscando = busqueda.trim() !== '';
  const verAccesos = ambito === 'todo' && !buscando;
  const verTamanos = ambito === 'plantillas' || (ambito === 'todo' && buscando);
  const verRecientes = ambito !== 'plantillas';

  const escrita = verTamanos && buscando ? medidaEscrita(busqueda) : null;
  const tamanos = verTamanos ? buscarTamanos(busqueda) : [];
  const recientes = useMemo(
    () => (disenos ?? []).filter((d) => !buscando || coincide(`${d.title} ${detalleDe(d)}`, busqueda)),
    [disenos, buscando, busqueda],
  );
  const hayTamanos = tamanos.length > 0 || escrita !== null;
  const sinNada = buscando && disenos !== null && !(verTamanos && hayTamanos) && !(verRecientes && recientes.length > 0);

  const circulo = (t: Tipo) => {
    const tipo = TIPOS.find((x) => x.id === t);
    if (!tipo) return null;
    const abierto = tipoAbierto === t;
    return (
      <button key={t} type="button" className={styles.acceso} aria-expanded={abierto} onClick={() => setTipoAbierto(abierto ? null : t)}>
        <span className={styles.circulo} style={{ background: tipo.color }}>
          <tipo.Icono size={22} strokeWidth={2} aria-hidden />
        </span>
        <span className={styles.rotulo}>{tipo.circulo}</span>
      </button>
    );
  };

  return (
    <div className={styles.inicio}>
      <section className={styles.franja}>
        <h1 className={styles.titular}>¿Qué diseñaremos hoy?</h1>

        <div className={styles.chips} role="group" aria-label="Buscar en">
          <button type="button" className={styles.chip} aria-pressed={ambito === 'disenos'} onClick={() => elegirAmbito('disenos')}>
            <Folder size={16} aria-hidden />
            Mis diseños
          </button>
          <button type="button" className={styles.chip} aria-pressed={ambito === 'plantillas'} onClick={() => elegirAmbito('plantillas')}>
            <LayoutTemplate size={16} aria-hidden />
            Plantillas
          </button>
          <button type="button" className={styles.chip} disabled title="Pronto">
            <Sparkles size={16} aria-hidden />
            MaKo IA
            <span className={styles.insignia}>Nuevo</span>
          </button>
        </div>

        <form className={styles.buscador} role="search" onSubmit={(e) => { e.preventDefault(); irAResultados(); }}>
          <Search className={styles.lupa} size={20} aria-hidden />
          <input
            ref={buscador}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={PLACEHOLDER[ambito]}
            aria-label={PLACEHOLDER[ambito]}
            autoComplete="off"
            spellCheck={false}
          />
          {busqueda && (
            <button type="button" className={styles.limpiar} aria-label="Vaciar la búsqueda" title="Vaciar la búsqueda" onClick={() => { setBusqueda(''); buscador.current?.focus(); }}>
              <X size={18} aria-hidden />
            </button>
          )}
          <button type="submit" className={styles.ir} aria-label="Buscar" title="Buscar" disabled={!buscando}>
            <ArrowRight size={20} aria-hidden />
          </button>
        </form>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {verAccesos && (
        <>
          <nav className={styles.accesos} aria-label="Tipos de diseño">
            <div className={styles.filaAccesos}>
              {CIRCULOS.map(circulo)}
              <Link href={rutaEditor('/video-editor')} className={styles.acceso}>
                <span className={styles.circulo} style={{ background: COLOR_VIDEO }}>
                  <Video size={22} strokeWidth={2} aria-hidden />
                </span>
                <span className={styles.rotulo}>Video</span>
              </Link>
              {CIRCULOS_DESPUES_DEL_VIDEO.map(circulo)}
              <button type="button" className={styles.acceso} aria-haspopup="dialog" onClick={() => setDialogo('social')}>
                <span className={`${styles.circulo} ${styles.circuloGris}`} style={{ background: COLOR_ELEGIR }}>
                  <Proportions size={22} strokeWidth={2} aria-hidden />
                </span>
                <span className={styles.rotulo}>Elegir el tamaño</span>
              </button>
            </div>
          </nav>

          {tipoAbierto && (
            <div className={styles.formatos} role="region" aria-label={TIPOS.find((t) => t.id === tipoAbierto)?.categoria}>
              {tamanosDe(tipoAbierto).map((t) => (
                <TarjetaTamano key={t.id} nombre={t.nombre} medidas={medidasDe(t)} ancho={t.ancho} alto={t.alto} disabled={creando} onClick={() => void crear(nuevoDe(t))} />
              ))}
            </div>
          )}
        </>
      )}

      <div ref={resultados} className={styles.resultados}>
        {verTamanos && hayTamanos && (
          <section className={styles.seccion}>
            <div className={styles.encabezado}>
              <h2>Tamaños</h2>
            </div>
            <div className={styles.grillaTamanos}>
              {escrita && (
                <TarjetaTamano
                  nombre="Tamaño personalizado"
                  medidas={medidasDe(escrita)}
                  ancho={escrita.ancho}
                  alto={escrita.alto}
                  disabled={creando}
                  onClick={() => void crear({ ...escrita, unidad: 'px' })}
                />
              )}
              {tamanos.map((t) => (
                <TarjetaTamano key={t.id} nombre={t.nombre} medidas={medidasDe(t)} ancho={t.ancho} alto={t.alto} disabled={creando} onClick={() => void crear(nuevoDe(t))} />
              ))}
            </div>
          </section>
        )}

        {verRecientes && disenos !== null && (!buscando || recientes.length > 0) && (
          <section className={styles.seccion}>
            <div className={styles.encabezado}>
              <h2>Diseños recientes</h2>
              {disenos.length > 0 && (
                <button
                  type="button"
                  className={styles.botonVista}
                  onClick={cambiarVista}
                  aria-label={vista === 'cuadricula' ? 'Ver en forma de lista' : 'Ver en forma de cuadrícula'}
                  title={vista === 'cuadricula' ? 'Ver en forma de lista' : 'Ver en forma de cuadrícula'}
                >
                  {vista === 'cuadricula' ? <List size={20} aria-hidden /> : <LayoutGrid size={20} aria-hidden />}
                </button>
              )}
            </div>

            {disenos.length === 0 ? (
              <div className={styles.vacio}>
                <p>Todavía no hay diseños.</p>
                <button type="button" className={styles.primario} onClick={() => setDialogo('social')}>Crear un diseño</button>
              </div>
            ) : vista === 'cuadricula' ? (
              <div className={styles.grilla}>
                {recientes.map((d) => (
                  <TarjetaDiseno key={d.id} d={d} onAbrir={() => abrir(d)} onBorrar={() => void borrar(d)} />
                ))}
              </div>
            ) : (
              <div className={styles.tabla}>
                <div className={styles.filaCabecera} aria-hidden>
                  <span>Nombre</span>
                  <span className={styles.celdaTipo}>Tipo</span>
                  <span className={styles.celdaEditado}>Editado</span>
                  <span />
                </div>
                <ul className={styles.lista}>
                  {recientes.map((d) => (
                    <FilaDiseno key={d.id} d={d} onAbrir={() => abrir(d)} onBorrar={() => void borrar(d)} />
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {sinNada && <p className={styles.sinResultados}>Sin resultados.</p>}
      </div>

      {dialogo && (
        <CrearDiseno inicial={dialogo} creando={creando} onCrear={(n) => void crear(n)} onCerrar={() => setDialogo(null)} />
      )}
      {confirmNode}
    </div>
  );
}
