'use client';

// =============================================================================
// CajaCrear — «¿Qué vas a crear hoy?»: UN cuadro con modos (Generar · Importar · Analizar landing · Replicar landing),
// Landing | Presentación y, debajo, las plantillas del tipo elegido
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 6), textual: «Al momento de crear nuevo tengo que elegir si crear landing,
// presentación... Sería bueno que ahí aparezcan los templates (deberías hacer más templates de presentaciones)... Y también
// quiero ahí mismo agregar la funcionalidad que tenemos en "nueva automatización", donde le escribo a la IA o le mando un
// audio, pero me gusta el formato que hiciste de "¿Qué vas a crear hoy?", solo falta agregar la funcionalidad de dictarle
// con audio, como lo tenemos en donde te mencioné.» Decisión T4 de docs/diseno-editor-landing.md.
//
// TANDA 6 (14/10/2026): «Crear con IA» con Analizar y Replicar en la tab, el «+» sólo para adjuntar, el link pegado en
// azul con «Analiza esta landing» ⇄ «Replica esta landing», y las plantillas en tarjetas con sombra.
//
// TANDA 7 (15/10/2026). Martín, textual:
//   «2. Las 5 opciones abajo del título "¿Qué vas a crear hoy?".
//    3. Cuando le doy click a una opción, lo que debe cambiar es el recuadro de chat de abajo, no redireccionarme a otro
//       lugar.
//    4. No entiendo la diferencia entre las 2 primeras... Si tu tampoco ves diferencia entre esas 2, elimina y conserva la
//       de "Generar desde una idea".
//    5. Cuando vayas reemplazando el bloque de texto que está hoy en día, no quiero que desaparezca el diseño de ese
//       recuadro, quiero que se mantenga igual... Por ejemplo para las 2 primeras opciones sería lo mismo... Y aprovecha el
//       diseño que ya tenemos para meter las opciones... Por ejemplo la de "Personalizar", podría ir por defecto en el
//       botón de + o en el desplegable de "plan", ya decide tú con criterio dónde iría... O por ejemplo las opciones de
//       "Ejemplos de instrucciones", revisa dónde ponerlas o si directamente eliminarlas... Lo que no quiero es que esos
//       ejemplos sean otras tarjetas, porque si tenemos las tarjetas de arriba y abajo los templates y agregas tarjetas de
//       ejemplo es un montón... Tampoco quiero el botón de "aleatorio"... Todas las opciones como "Español México, la
//       cantidad de secciones, el CTA de Agendar reunión u otros, etc... Deben ir dentro de + o en algún desplegable así...
//    6. Si elijo "Importar" simplemente el cuadro de texto se transforma en un contenedor de importación típico, pero con
//       el mismo tamaño y diseño que el cuadro de texto. Y cuando se importe algo, que vuelva al cuadro de texto, pero esta
//       vez ya se pueden previsualizar la miniatura de lo importado en el cuadro de texto. Y los usuarios podrán importar y
//       darle instrucciones. Y ya por defecto el cuadro de texto en cualquier estado debe admitir un arrastre de archivo, si
//       se arrastra se debe poner allí.
//    7. Y para las opciones de link, lo mismo que lo anterior, el cuadro de texto se transforma en el contenedor del link
//       con un placeholder de soltar el link... Y cuando lo sueltan se vuelve al texto para poder seguir escribiendo. Y en
//       el cuadro de texto, cuando pego un link y se pone en azul y al lado aparece la opción de analizar o replicar, todo
//       eso debería seguir siendo el cuadro de texto, solo que esos son chips del texto... Pero si le doy a borrar, se
//       deben borrar. O si quiero seguir escribiendo luego de pegar eso.»
//
// Qué tiene, de arriba abajo:
//   · el título y, debajo, los MODOS (un grupo con `aria-pressed`, no tarjetas): elegir uno cambia el cuadro, nada
//     navega. Las tarjetas de «Crear con IA» se fueron; «Pegar texto» también (pegar un texto largo es pegarlo acá: la
//     opción «Tu texto» —de guía, resumir, tal cual— aparece sola, ver crear/caja-modos.ts, `esTextoLargo`);
//   · EL cuadro (CajaPedido.tsx, el MISMO de /automations, con su marco, su alto y su fila de abajo en todos los modos):
//       Generar  el campo con el ejemplo que se escribe solo (sin tarjetas de ejemplos ni «Aleatorio»);
//       Importar el contenedor para soltar o elegir un archivo; con uno, vuelve al texto con su MINIATURA adentro;
//       Analizar / Replicar  el contenedor del link; pegado o soltado, vuelve al texto con el link y su pastilla como
//                CHIPS del renglón: se sigue escribiendo después, y Backspace al principio los borra (primero la
//                pastilla, después el link);
//     y en cualquier modo, un archivo arrastrado se adjunta y un link arrastrado se vuelve chips;
//   · en la fila de abajo: el «+» (adjuntar un archivo o una imagen, y las indicaciones recientes) y «Plan», que dice
//     CÓMO se genera (Plan o Express, la cantidad, el objetivo, el idioma y «Más ajustes»: crear/AjustesCaja.tsx);
//   · Landing | Presentación y las plantillas del tipo (tocar una CREA y ABRE: navegación dura, cambió QUÉ EXISTE).
//
// Lo que NO se ve en una captura (qué modo queda, qué se manda) es PURO y tiene test: crear/caja-modos.ts.
// El modo viaja en la URL: lo escribe el Panel (Inicio.tsx) con `onModo`, y el Panel lo puede cambiar desde afuera
// («Nueva landing», «Analizar una página» de Crear, un link) con la prop `modo`.
// Mandar no genera acá: le pasa el pedido al Panel (`onAccion`), que abre a su derecha el resultado (Crear, el
// Diagnóstico, Replicar). Lo que cambia con el tipo vive en crear/tipo.ts.
//
// Dónde va: adentro de `.gma.gp` con CSS_GP (MiniaturaLanding.tsx). Trae SU hoja (`CSS_CAJA` + las de sus piezas).
// ⚠️ LA CAJA LA MONTAN TAMBIÉN /automations y el Dashboard (CajaPedido.tsx): los modos, el «+», el link y el archivo son
//    de ESTA puerta y van por las props de la caja (`bajoTitulo`, `antes`, `antesDelCampo`, `adjunto`, `bajoElCampo`,
//    `enLugarDelCampo`, `onSoltar`), nunca adentro de ella.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useWs } from '@/app/_ui/Link';
import { CajaPedido, ChipCaja, CSS_CAJA_PEDIDO, TITULO_CAJA } from './CajaPedido';
import { tarjetasDe, type JsonNodo } from '@/lib/editor-landing/doc';
import { formatoDe, type ParamsGeneracion } from '@/lib/editor-landing/api-tipos';
import { temaPorId } from '@/lib/editor-landing/temas';
import { EXT_POR_FAMILIA, familiaDeArchivo, porQueNoPuedo, puedeLeerse } from '@/lib/formatos-archivo';
import {
  Desplegable, Ico, ItemMenu, MenuFlotante, MiniaturaLanding, SeparadorMenu, haceCuanto, irDuro, marcarReciente, pedirDocs, useAviso,
  type OpcionDesplegable,
} from './MiniaturaLanding';
import { leerArchivo } from './cliente';
import { hostDe, type AccionCaja } from './panel-reglas';
import {
  EJEMPLOS_CAJA, docDe, pedidoDeDiseno, pedidoDePlantilla, plantillasDe, type PlantillaCrear, type TipoCrear,
} from './crear/tipo';
import { CSS_TIPO, SelectorTipo } from './crear/PiezasTipo';
import { DialogoObjetivo } from './crear/DialogoObjetivo';
import { OPCIONES_FORMATO } from './crear/Replicar';
import {
  OPCIONES_MODO, TOPE_TEXTO, alEnviar, alEscribir, avisoDeTexto, borrarAlInicio, cajaDeSemilla, cambiarFormato, conArchivo, conLink,
  elegirModo, linkSoltado, listoParaEnviar, muestraTuTexto, placeholderDe, quitarArchivo, quitarLink, tipoDeArchivo, vistaDeCaja,
  type AccionLink, type ArchivoCaja, type EstadoCaja, type ModoCaja, type SemillaCaja,
} from './crear/caja-modos';
import { MODOS_TEXTO, paramsIniciales, type ModoGen } from './crear/ajustes';
import { BotonComo, CSS_AJUSTES, PanelMasAjustes } from './crear/AjustesCaja';
import { leerIndicaciones, type Indicacion } from './crear/recientes';

/** Lo que se eligió en la caja. El Panel lo abre a su derecha (Inicio.tsx, con `derechaDeAccion`). Vive en panel-reglas.ts (puro). */
export type { AccionCaja };

export type PropsCajaCrear = {
  /** El modo del cuadro: lo decide el Panel (sale de la URL). Generar por default. */
  modo?: ModoCaja;
  /** El cuadro cambió de modo solo (un link pegado, un archivo soltado, Backspace) o de tipo: el Panel lo escribe en la URL. */
  onModo?: (modo: ModoCaja, tipo: TipoCrear) => void;
  /** El tipo con el que abre (por ejemplo, el de `?tipo=` de la query). Sin él, una landing. */
  tipoInicial?: TipoCrear;
  /** Lo que trae UNA vez: lo de vuelta de Crear (el pedido, sus ajustes) o el deep link de la landing de base. */
  semilla?: SemillaCaja | null;
  /** Las landings ya analizadas (la «landing de base» de «Más ajustes» sale de acá, validada). */
  analizadas?: readonly { url: string; veredicto: string | null; score: number | null }[];
  errorAnalizadas?: string | null;
  onAccion: (a: AccionCaja) => void;
};

/** Qué hacer con un link (la pastilla, tanda 6, punto 5). */
const ACCIONES_LINK: readonly OpcionDesplegable<AccionLink>[] = [
  { valor: 'analizar', texto: 'Analiza esta landing', icono: 'reporte' },
  { valor: 'replicar', texto: 'Replica esta landing', icono: 'copiar' },
];

/** El «+»: un archivo de texto, oficina, audio o video, o una imagen (las familias de lib/formatos-archivo.ts). */
const extDe = (familias: readonly (keyof typeof EXT_POR_FAMILIA)[]) => familias.flatMap((f) => EXT_POR_FAMILIA[f].map((e) => `.${e}`)).join(',');
export const ACCEPT_ARCHIVO = extDe(['texto', 'docx', 'pdf', 'xlsx', 'pptx', 'opendocument', 'audio', 'video']);
export const ACCEPT_IMAGEN = extDe(['imagen']);

/** Cuántas indicaciones recientes ofrece el «+». */
const RECIENTES_EN_MAS = 3;

const SIN_ANALIZADAS: readonly { url: string; veredicto: string | null; score: number | null }[] = [];

export default function CajaCrear({
  modo = 'generar', onModo, tipoInicial = 'landing', semilla = null, analizadas = SIN_ANALIZADAS, errorAnalizadas = null, onAccion,
}: PropsCajaCrear) {
  const ws = useWs();
  const { avisar, nodo: aviso } = useAviso();
  const [tipo, setTipo] = useState<TipoCrear>(semilla?.tipo ?? tipoInicial);
  /** EL estado del cuadro: el modo, lo escrito, el link y el archivo (crear/caja-modos.ts, puro). */
  const [estado, setEstado] = useState<EstadoCaja>(() => cajaDeSemilla(modo, semilla));
  const [modoGen, setModoGen] = useState<ModoGen>(semilla?.modoGen ?? 'plan');
  const [params, setParams] = useState<ParamsGeneracion>(() => paramsIniciales(semilla, analizadas));
  /** Lo tipeado en el contenedor del link (Analizar / Replicar sin link todavía). */
  const [escritoLink, setEscritoLink] = useState('');
  const [masAjustes, setMasAjustes] = useState(false);
  const [menuMas, setMenuMas] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recientes, setRecientes] = useState<Indicacion[]>([]);
  const [ahora, setAhora] = useState<number | null>(null);
  /** La plantilla que se está creando (una a la vez: un doble clic no crea dos). */
  const [creando, setCreando] = useState<string | null>(null);
  const [muestras, setMuestras] = useState<Partial<Record<TipoCrear, Record<string, JsonNodo | null>>>>({});
  /** El DISEÑO que se tocó y espera su objetivo («¿De qué quieres crearla?»), o null. */
  const [eligiendo, setEligiendo] = useState<PlantillaCrear | null>(null);
  const cerrarMas = useCallback(() => setMenuMas(null), []);
  const cerrarEleccion = useCallback(() => setEligiendo(null), []);
  const subida = useRef<AbortController | null>(null);
  const vistaImagen = useRef<string | null>(null);
  const elegirArchivo = useRef<HTMLInputElement>(null);
  const elegirImagen = useRef<HTMLInputElement>(null);
  const campo = useRef<HTMLTextAreaElement | null>(null);
  const campoLink = useRef<HTMLInputElement>(null);
  const set = useCallback(<K extends keyof ParamsGeneracion>(k: K, v: ParamsGeneracion[K]) => setParams((p) => ({ ...p, [k]: v })), []);

  // El Panel cambió el modo (la URL, «Nueva landing», «Analizar una página»): el cuadro lo toma. Se ajusta EN EL RENDER
  // (no en un efecto) para que no se dibuje un cuadro con el modo viejo.
  const [modoVisto, setModoVisto] = useState(modo);
  if (modo !== modoVisto) {
    setModoVisto(modo);
    if (estado.modo !== modo) setEstado(elegirModo(estado, modo));
  }
  // El cuadro cambió de modo solo (o de tipo): el Panel lo escribe en la URL. `onModo` es de identidad fija (Inicio).
  useEffect(() => { onModo?.(estado.modo, tipo); }, [estado.modo, tipo, onModo]);

  const vista = vistaDeCaja(estado);

  // Sin archivo, lo que se estaba leyendo se corta y la miniatura de la imagen se suelta (un objectURL vive hasta que
  // se revoca). Mira el ESTADO: el archivo se va por la ✕, por elegir otro modo o desde el Panel.
  const hayArchivo = !!estado.archivo;
  useEffect(() => {
    if (hayArchivo) return;
    subida.current?.abort();
    subida.current = null;
    if (vistaImagen.current) { URL.revokeObjectURL(vistaImagen.current); vistaImagen.current = null; }
  }, [hayArchivo]);
  useEffect(() => () => {
    subida.current?.abort();
    if (vistaImagen.current) URL.revokeObjectURL(vistaImagen.current);
  }, []);

  // El contenedor del link toma el foco al aparecer o al pasar de Analizar a Replicar (elegirlos es para pegar uno).
  const modoActual = estado.modo;
  useLayoutEffect(() => { if (vista === 'link') campoLink.current?.focus(); }, [vista, modoActual]);

  // Comodidades de este navegador: se leen después de montar (el server no las tiene).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecientes(leerIndicaciones());
    setAhora(Date.now());
  }, []);

  // `contenido()` arma ids NUEVOS en cada llamada: las muestras se arman después de montar (si
  // no, el HTML del server y el del navegador no coincidirían), y sólo las del tipo que se ve.
  useEffect(() => {
    if (muestras[tipo]) return;
    const m = Object.fromEntries(plantillasDe(tipo).map((p) => {
      const pagina = p.contenido().paginas[0];
      return [p.id, pagina ? tarjetasDe(pagina)[0] ?? null : null];
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuestras((x) => ({ ...x, [tipo]: m }));
  }, [tipo, muestras]);

  /** El foco al campo de texto (después de un chip, de un archivo, de una indicación reciente). */
  const alCampo = () => window.requestAnimationFrame(() => {
    const t = campo.current;
    if (!t) return;
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
  });

  const elegir = (m: ModoCaja) => {
    setError(null);
    setEstado((e) => elegirModo(e, m));
    if (m === 'generar') alCampo();
  };

  /** Lee el archivo (o la imagen, por visión) y queda como MINIATURA adentro del cuadro. */
  const subir = (file: File, imagen: boolean) => {
    setMenuMas(null);
    setError(null);
    if (!puedeLeerse(file.name, file.type)) { setError(porQueNoPuedo(file.name) || 'No puedo leer ese archivo.'); return; }
    subida.current?.abort();
    if (vistaImagen.current) URL.revokeObjectURL(vistaImagen.current);
    vistaImagen.current = imagen ? URL.createObjectURL(file) : null;
    const base = { nombre: file.name, imagen, ...(vistaImagen.current ? { vista: vistaImagen.current } : {}) };
    const ac = new AbortController();
    subida.current = ac;
    setEstado((e) => conArchivo(e, { ...base, estado: 'leyendo' }));
    alCampo();
    void leerArchivo(file, ac.signal).then((r) => {
      if (ac.signal.aborted) return;
      const listo: ArchivoCaja = r.ok ? { ...base, estado: 'listo', texto: r.texto } : { ...base, estado: 'error' };
      setEstado((e) => (e.archivo ? { ...e, archivo: listo } : e));
      if (!r.ok) setError(r.error);
    });
  };

  /** Lo que se arrastra al cuadro (o un archivo pegado): un archivo se adjunta; un link, chips. Si no, lo del navegador. */
  const soltar = (d: DataTransfer): boolean => {
    const f = d.files?.[0];
    if (f) { subir(f, familiaDeArchivo(f.name, f.type) === 'imagen'); return true; }
    const url = linkSoltado(d.getData('text/uri-list'), d.getData('text/plain'));
    if (!url) return false;
    setError(null);
    setEscritoLink('');
    setEstado((e) => conLink(e, url));
    alCampo();
    return true;
  };

  /** Lo tipeado en el contenedor del link: pegado (o cerrado por un espacio), un link completo vuelve al texto como chips. */
  const escribirLink = (v: string) => {
    const r = alEscribir({ ...estado, texto: escritoLink, link: null, archivo: null }, v);
    if (r.link) { setEscritoLink(''); setEstado((e) => conLink(e, r.link!.url)); alCampo(); return; }
    setEscritoLink(v);
  };

  const enviar = () => {
    const r = alEnviar(estado, { tipo, modo: modoGen, params }, escritoLink);
    if (r.que === 'chips') { setEscritoLink(''); setEstado(r.estado); alCampo(); return; }
    if (r.que === 'accion') onAccion(r.accion);
  };

  /** Backspace (o Supr) con el foco en la pastilla o el formato: se va la pastilla, como con Backspace al principio. */
  const teclaEnPastilla = (e: KeyboardEvent<HTMLSpanElement>) => {
    if ((e.key !== 'Backspace' && e.key !== 'Delete') || !(e.target instanceof HTMLButtonElement)) return;
    const n = borrarAlInicio(estado);
    if (!n) return;
    e.preventDefault();
    setEstado(n);
    alCampo();
  };

  /** Crear y abrir: lo que cambió es QUÉ EXISTE, así que la navegación es dura. */
  const crear = async (clave: string, alta: ReturnType<typeof pedidoDePlantilla>) => {
    if (creando) return;
    setCreando(clave);
    const r = await pedirDocs(alta);
    if (!r.ok) { setCreando(null); avisar('No se pudo crear'); console.error('[caja crear] plantilla', clave, r.error); return; }
    marcarReciente(r.doc.id);
    irDuro(`/web-generator/${r.doc.id}`, ws);
  };

  /** Un DISEÑO de landing pregunta primero de qué es (el copy); una presentación se crea directo. */
  const usar = (p: PlantillaCrear) => {
    if (creando) return;
    if (p.pideObjetivo) { setEligiendo(p); return; }
    void crear(p.id, pedidoDePlantilla(p));
  };

  const conObjetivo = (objetivo: string) => {
    if (!eligiendo || creando) return;
    const alta = pedidoDeDiseno(eligiendo, objetivo);
    if (!alta) { avisar('No se pudo crear'); return; }
    void crear(`${eligiendo.id}:${objetivo}`, alta);
  };

  const lista = plantillasDe(tipo);
  const m = muestras[tipo];
  const link = estado.link;
  const tuTexto = muestraTuTexto(estado);
  const nota = avisoDeTexto(estado);
  // La landing de base se VE en el cuadro (lo que viaja a la IA está en la pantalla); en una presentación no viaja.
  const base = tipo === 'landing' && vista !== 'link' && !link?.accion ? params.basadoEnUrl : null;
  const recientesMas = vista === 'texto' && !estado.texto.trim() && !link && !estado.archivo ? recientes.slice(0, RECIENTES_EN_MAS) : [];

  // ── Lo que va adentro del cuadro ────────────────────────────────────────────

  // Los chips del renglón (punto 7): el link en azul y su pastilla (y en Replicar, el formato), antes del texto.
  const chips = link ? (
    <>
      <ChipCaja icono="enlace" texto={hostDe(link.url)} titulo={link.url} nombre={`Enlace: ${hostDe(link.url)}`}
        onQuitar={() => { setEstado(quitarLink); alCampo(); }} etiquetaQuitar="Quitar el enlace" />
      {link.accion && (
        <span className="gp-cc-link-accion" onKeyDown={teclaEnPastilla}>
          <Desplegable etiqueta="Qué hacer" valor={link.accion} onCambio={(a) => setEstado((e) => elegirModo(e, a))} opciones={ACCIONES_LINK} ancho={240} />
          {link.accion === 'replicar' && (
            <Desplegable etiqueta="Formato" valor={link.formato} onCambio={(f) => setEstado((e) => cambiarFormato(e, f))} opciones={OPCIONES_FORMATO} ancho={220} />
          )}
        </span>
      )}
    </>
  ) : null;

  // La miniatura del archivo (punto 6) y la landing de base, ARRIBA del campo.
  const adjunto = estado.archivo || base ? (
    <>
      {estado.archivo && <MiniaturaArchivo archivo={estado.archivo} onQuitar={() => { setEstado(quitarArchivo); setError(null); }} />}
      {base && (
        <ChipCaja icono="reporte" texto={`Sobre ${hostDe(base)}`} titulo={base} nombre={`Landing de base: ${hostDe(base)}`}
          onQuitar={() => set('basadoEnUrl', null)} etiquetaQuitar="Quitar la landing de base" />
      )}
    </>
  ) : null;

  // Importar sin archivo (punto 6): el contenedor de importación, del alto del campo.
  const contenedorArchivo = (
    <div className="gp-cc-soltar" onClick={(e) => { if (e.target === e.currentTarget) elegirArchivo.current?.click(); }}>
      <span className="gp-cc-soltar-icono" aria-hidden="true"><Ico n="subir" t={20} /></span>
      <span className="gp-cc-soltar-textos">
        <span className="gp-cc-soltar-titulo">
          Suelta tu archivo aquí o{' '}
          <button type="button" className="gp-cc-soltar-elegir" onClick={() => elegirArchivo.current?.click()}>elígelo</button>
        </span>
        <span className="gp-cc-soltar-sub">PowerPoint, Word o PDF</span>
      </span>
    </div>
  );

  // Analizar o Replicar sin link (punto 7): el contenedor del link.
  const contenedorLink = (
    <div className="gp-cc-pegar-link">
      <span className="gp-cc-pegar-link-icono" aria-hidden="true"><Ico n="enlace" t={18} /></span>
      <input
        ref={campoLink}
        className="gp-cc-link-entrada"
        type="text"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        value={escritoLink}
        maxLength={2_000}
        placeholder="Pega o suelta el link de la landing"
        aria-label={estado.modo === 'replicar' ? 'Link de la landing a replicar' : 'Link de la landing a analizar'}
        onChange={(e) => escribirLink(e.target.value)}
      />
    </div>
  );

  // Adentro, debajo del texto: «Tu texto» con un texto largo o un archivo, y el aviso de lo que no se usa.
  const bajo = tuTexto || nota ? (
    <>
      {tuTexto && (
        <div className="gp-cc-tutexto" role="group" aria-label="Qué hacer con tu texto">
          <span className="gp-cc-tutexto-rotulo">Tu texto</span>
          {MODOS_TEXTO.map((t) => (
            <button key={t.valor} type="button" aria-pressed={params.modoTexto === t.valor} title={t.ayuda} onClick={() => set('modoTexto', t.valor)}>
              <Ico n={t.icono} t={13} /> {t.texto}
            </button>
          ))}
        </div>
      )}
      {nota && <p className="gp-cc-nota" role="status">{nota}</p>}
    </>
  ) : null;

  return (
    <section className="gp-cc" aria-label="Crear">
      <style dangerouslySetInnerHTML={{ __html: CSS_TIPO + CSS_CAJA_PEDIDO + CSS_AJUSTES + CSS_CAJA }} />

      {/* LA CAJA ES CajaPedido.tsx, la MISMA del modal «Nueva automatización» y del Dashboard: el campo con el ejemplo
          que se escribe solo, el micrófono y el ↑. Lo de esta puerta va por sus props (ver la cabecera). */}
      <CajaPedido
        titulo={{ texto: TITULO_CAJA, nivel: 1 }}
        bajoTitulo={(
          <div className="gp-cc-modos" role="group" aria-label="Qué quieres hacer">
            {OPCIONES_MODO.map((o) => (
              <button key={o.id} type="button" className="gp-cc-modo" aria-pressed={estado.modo === o.id} onClick={() => elegir(o.id)}>
                <Ico n={o.icono} t={15} /> {o.titulo}
              </button>
            ))}
          </div>
        )}
        modo={vista}
        reinicio={tipo}
        ejemplos={EJEMPLOS_CAJA[tipo]}
        valor={estado.texto}
        animar={!estado.archivo && !link}
        placeholderQuieto={placeholderDe(estado)}
        etiqueta="Qué quieres crear"
        tope={TOPE_TEXTO}
        listo={listoParaEnviar(estado, escritoLink)}
        onValor={(v) => { setError(null); setEstado((e) => alEscribir(e, v)); }}
        onEnviar={enviar}
        onError={setError}
        refCampo={campo}
        antesDelCampo={chips}
        onBorrarAlInicio={() => {
          const n = borrarAlInicio(estado);
          if (!n) return false;
          setEstado(n);
          return true;
        }}
        adjunto={adjunto}
        enLugarDelCampo={vista === 'importar' ? contenedorArchivo : vista === 'link' ? contenedorLink : null}
        bajoElCampo={bajo}
        onSoltar={soltar}
        dictado={vista === 'texto'}
        antes={(
          <>
            <button
              type="button"
              className="gp-cc-mas"
              aria-label="Adjuntar"
              aria-haspopup="menu"
              aria-expanded={!!menuMas}
              onClick={(e) => setMenuMas(menuMas ? null : e.currentTarget)}
            >
              <Ico n="mas" t={16} />
            </button>
            {vista !== 'link' && !link?.accion && (
              <BotonComo
                modo={modoGen}
                onModo={setModoGen}
                params={params}
                set={set}
                tipo={tipo}
                cantidadApagada={tuTexto && params.modoTexto === 'conservar'}
                onMasAjustes={() => setMasAjustes(true)}
              />
            )}
          </>
        )}
      />
      {masAjustes && (
        <PanelMasAjustes
          params={params}
          set={set}
          tipo={tipo}
          analizadas={analizadas}
          errorAnalizadas={errorAnalizadas}
          onAnalizarUna={() => { setMasAjustes(false); elegir('analizar'); }}
          onCerrar={() => setMasAjustes(false)}
        />
      )}
      {error && <p className="gp-error gp-cc-error" role="alert">{error}</p>}

      <SelectorTipo valor={tipo} onCambio={setTipo} deshabilitado={!!creando} />

      <section className="gp-cc-plantillas" aria-labelledby="gp-cc-plantillas-titulo">
        <h2 id="gp-cc-plantillas-titulo" className="gp-cc-subtitulo">{tipo === 'landing' ? 'Diseños' : 'Plantillas'}</h2>
        <div className="gp-cc-grilla">
          {lista.map((p) => (
            <button
              key={p.id}
              type="button"
              className="gp-cc-plantilla"
              disabled={!!creando}
              data-creando={creando === p.id ? 'si' : undefined}
              aria-label={`Crear ${docDe(tipo)} con ${p.pideObjetivo ? 'el diseño' : 'la plantilla'} ${p.nombre}`}
              onClick={() => usar(p)}
            >
              <div className="gp-cc-mini">
                {m
                  ? <MiniaturaLanding tarjeta={m[p.id] ?? null} tema={temaPorId(p.tema)} formato={formatoDe(p)} proporcion={p.proporcion} />
                  : <div className="gp-mini gp-brillo" style={{ aspectRatio: tipo === 'presentacion' ? '16 / 9' : '16 / 10' }} />}
                {creando === p.id
                  ? <span className="gp-cc-usar" data-visible="si"><span className="gp-giro" /> Creando</span>
                  : <span className="gp-cc-usar">{p.pideObjetivo ? 'Usar diseño' : 'Usar plantilla'}</span>}
              </div>
              <span className="gp-cc-nombre">{p.nombre}</span>
            </button>
          ))}
        </div>
      </section>

      {/* El «+» adjunta (tanda 6, punto 4) y ofrece las indicaciones recientes (tanda 7: vivían en «Generar»). Los dos
          `input` viven afuera del menú: tocar una opción lo cierra. */}
      {menuMas && (
        <MenuFlotante ancla={menuMas} onCerrar={cerrarMas} ancho={270}>
          <ItemMenu icono="subir" texto="Importar archivo" sub="PowerPoint, Word o PDF" onClick={() => { setMenuMas(null); elegirArchivo.current?.click(); }} />
          <ItemMenu icono="imagen" texto="Subir imagen" onClick={() => { setMenuMas(null); elegirImagen.current?.click(); }} />
          {recientesMas.length > 0 && <SeparadorMenu />}
          {recientesMas.map((r) => (
            <ItemMenu
              key={`${r.modo}-${r.t}`}
              icono="historial"
              texto={r.texto.split('\n')[0].slice(0, 60)}
              sub={ahora ? haceCuanto(r.t, ahora) : undefined}
              onClick={() => { setMenuMas(null); setEstado((e) => ({ ...e, texto: r.texto.slice(0, TOPE_TEXTO) })); alCampo(); }}
            />
          ))}
        </MenuFlotante>
      )}
      <input ref={elegirArchivo} type="file" accept={ACCEPT_ARCHIVO} hidden tabIndex={-1} aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f, false); }} />
      <input ref={elegirImagen} type="file" accept={ACCEPT_IMAGEN} hidden tabIndex={-1} aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f, true); }} />
      {eligiendo && <DialogoObjetivo ocupado={!!creando} onElegir={conObjetivo} onCerrar={cerrarEleccion} />}
      {aviso}
    </section>
  );
}

/**
 * La MINIATURA del archivo adentro del cuadro (punto 6): la imagen misma, o el ícono de su tipo con el nombre, y la ✕.
 * Mientras se lee dice «Leyendo…»; si no se pudo, va en rojo y el ↑ no se prende.
 */
function MiniaturaArchivo({ archivo, onQuitar }: { archivo: ArchivoCaja; onQuitar: () => void }) {
  const t = tipoDeArchivo(archivo.nombre);
  const sub = archivo.estado === 'leyendo' ? 'Leyendo…' : archivo.estado === 'error' ? 'No se pudo leer' : t.etiqueta;
  return (
    <span className="gp-cc-archivo" data-familia={t.familia} data-estado={archivo.estado} role="group" aria-label={`Archivo: ${archivo.nombre}`}>
      <span className="gp-cc-archivo-icono">
        {archivo.vista ? <img src={archivo.vista} alt="" /> : <Ico n={t.icono} t={20} />}
        {archivo.estado === 'leyendo' && <span className="gp-giro" aria-hidden="true" />}
      </span>
      <span className="gp-cc-archivo-textos">
        <span className="gp-cc-archivo-nombre" title={archivo.nombre}>{archivo.nombre}</span>
        <span className="gp-cc-archivo-sub">{sub}</span>
      </span>
      <button type="button" className="gp-cc-archivo-quitar" aria-label="Quitar el archivo" title="Quitar el archivo" onClick={onQuitar}>
        <Ico n="cerrar" t={12} />
      </button>
    </span>
  );
}

/**
 * Lo de la página alrededor de la caja (tokens de CSS_GP): los modos, los contenedores (del alto del campo: el cuadro
 * mide lo mismo en los cuatro modos), los chips, la miniatura del archivo, «Tu texto», el aviso y las plantillas. La
 * caja trae su hoja (CSS_CAJA_PEDIDO) y el desplegable de Plan la suya (CSS_AJUSTES).
 * Las tarjetas de las plantillas: UNA tarjeta (miniatura + nombre) con borde y sombra que la separa del fondo; en
 * oscuro la sombra es más honda (sobre un fondo oscuro, una sombra clara no se ve).
 */
const CSS_CAJA = `
.gp .gp-cc { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; margin: 8px 0 28px; }
.gp .gp-cc-error { max-width: 720px; margin: -6px 0 0; }
.gp .gp-cc-subtitulo { margin: 0; font-size: 18px; font-weight: 600; color: var(--gp-titulo); }

/* Los modos (punto 2): un grupo compacto arriba del cuadro, no tarjetas. */
.gp .gp-cc-modos { display: inline-flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-top: -4px; padding: 4px; border: 1px solid var(--gp-borde-suave); border-radius: 9999px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-cc-modo { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 34px; padding: 0 14px; border: 0; border-radius: 9999px; background: transparent; color: var(--gp-texto); font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: background-color .15s, color .15s; }
.gp .gp-cc-modo:hover { background: var(--gp-hover); }
.gp .gp-cc-modo[aria-pressed="true"] { background: var(--gp-activo-fondo); color: var(--gp-activo-texto); }

/* Importar sin archivo: el contenedor típico (punteado, para soltar o elegir), adentro del MISMO cuadro y del alto del campo. */
.gp .gp-cc-caja .gp-cc-en-lugar { min-height: 70px; padding: 10px 10px 2px; }
.gp .gp-cc-soltar { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 58px; padding: 6px 14px; border: 1.5px dashed var(--gp-azul-300); border-radius: 10px; background: color-mix(in srgb, var(--gp-azul-50) 60%, transparent); cursor: pointer; }
.gp .gp-cc-caja[data-arrastre="si"] .gp-cc-soltar { border-color: var(--gp-azul-500); }
.gp .gp-cc-soltar-icono { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 9999px; background: var(--gp-superficie); color: var(--gp-azul-600); box-shadow: var(--gp-sombra-tarjeta); pointer-events: none; }
.gp .gp-cc-soltar-textos { display: flex; flex-direction: column; gap: 2px; min-width: 0; pointer-events: none; }
.gp .gp-cc-soltar-titulo { font-size: 15px; font-weight: 500; line-height: 1.4; color: var(--gp-texto); }
.gp .gp-cc-soltar-elegir { padding: 0; border: 0; background: transparent; color: var(--gp-activo-texto); font-size: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; pointer-events: auto; }
.gp .gp-cc-soltar-sub { font-size: 12.5px; line-height: 1.3; color: var(--gp-debil); }

/* Analizar o Replicar sin link: el contenedor del link, del alto del campo. */
.gp .gp-cc-pegar-link { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 58px; padding: 0 8px; }
.gp .gp-cc-pegar-link-icono { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 9999px; background: var(--gp-azul-50); color: var(--gp-azul-600); }
.gp .gp-cc-link-entrada { flex: 1; min-width: 0; height: 40px; padding: 0; border: 0; background: transparent; color: var(--gp-azul-600); font: inherit; font-size: 16px; outline: none; }
.gp .gp-cc-link-entrada::placeholder { color: var(--gp-debil); }

/* La pastilla del link (también azul: son la misma cosa). */
.gp .gp-cc-link-accion { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.gp .gp-cc-link-accion .gp-pildora { border-color: var(--gp-azul-200); background: var(--gp-azul-50); color: var(--gp-azul-600); font-weight: 600; }
.gp .gp-cc-link-accion .gp-pildora:hover:not(:disabled) { background: var(--gp-azul-100); }
[data-tema="oscuro"] .gp .gp-cc-link-accion .gp-pildora { border-color: #0540ad; background: #0b2e79; color: #aad5fe; }
.gp .gp-cc-linea > .gp-cc-chip { max-width: min(100%, 280px); }

/* La miniatura del archivo (punto 6): una tarjetita adentro del cuadro, con su ✕ en la esquina. */
.gp .gp-cc-archivo { position: relative; display: inline-flex; align-items: center; gap: 10px; max-width: min(100%, 300px); padding: 6px 30px 6px 6px; border: 1px solid var(--gp-borde-suave); border-radius: 12px; background: var(--gp-superficie-2); }
.gp .gp-cc-archivo-icono { position: relative; display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 8px; overflow: hidden; background: #6b7280; color: #fff; }
.gp .gp-cc-archivo[data-familia="pdf"] .gp-cc-archivo-icono { background: #dc2626; }
.gp .gp-cc-archivo[data-familia="docx"] .gp-cc-archivo-icono { background: #2563eb; }
.gp .gp-cc-archivo[data-familia="pptx"] .gp-cc-archivo-icono { background: #ea580c; }
.gp .gp-cc-archivo[data-familia="xlsx"] .gp-cc-archivo-icono { background: #16a34a; }
.gp .gp-cc-archivo[data-familia="audio"] .gp-cc-archivo-icono, .gp .gp-cc-archivo[data-familia="video"] .gp-cc-archivo-icono { background: #7c3aed; }
.gp .gp-cc-archivo-icono img { width: 100%; height: 100%; object-fit: cover; }
.gp .gp-cc-archivo-icono .gp-giro { position: absolute; width: 18px; height: 18px; }
.gp .gp-cc-archivo-textos { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.gp .gp-cc-archivo-nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; font-weight: 600; color: var(--gp-texto); }
.gp .gp-cc-archivo-sub { font-size: 12px; color: var(--gp-tenue); }
.gp .gp-cc-archivo[data-estado="error"] { border-color: var(--gp-peligro); }
.gp .gp-cc-archivo[data-estado="error"] .gp-cc-archivo-sub { color: var(--gp-peligro); }
.gp .gp-cc-archivo-quitar { position: absolute; top: 4px; right: 4px; display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 9999px; background: transparent; color: var(--gp-tenue); cursor: pointer; }
.gp .gp-cc-archivo-quitar:hover { background: var(--gp-hover); color: var(--gp-texto); }

/* «Tu texto» y el aviso, adentro del cuadro debajo del texto. */
.gp .gp-cc-tutexto { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 3px 3px 3px 10px; border-radius: 10px; background: var(--gp-borde-suave); }
.gp .gp-cc-tutexto-rotulo { margin-right: 4px; font-size: 12.5px; font-weight: 600; color: var(--gp-tenue); }
.gp .gp-cc-tutexto button { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--gp-texto); font-size: 13px; font-weight: 500; cursor: pointer; }
.gp .gp-cc-tutexto button[aria-pressed="true"] { background: var(--gp-superficie); color: var(--gp-activo-texto); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-cc-nota { margin: 0; font-size: 13px; color: var(--gp-tenue); }

/* Las plantillas: miniatura y nombre en UNA tarjeta con sombra (tanda 6, punto 6). */
.gp .gp-cc-plantillas { display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 8px; scroll-margin-top: 16px; }
.gp .gp-cc-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 18px; }
.gp .gp-cc-plantilla { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 8px 8px 12px; border: 1px solid var(--gp-borde-suave); border-radius: 14px; background: var(--gp-superficie); box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 8px 20px -8px rgba(0,0,0,.18); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: box-shadow .15s, border-color .15s, transform .15s; }
.gp .gp-cc-plantilla:disabled { cursor: default; }
.gp .gp-cc-plantilla:disabled:not([data-creando="si"]) { opacity: .6; }
.gp .gp-cc-mini { position: relative; display: block; border-radius: 8px; box-shadow: 0 0 0 1px var(--gp-borde-suave); }
.gp .gp-cc-mini .gp-mini { border-radius: 8px; }
.gp .gp-cc-plantilla:hover:not(:disabled), .gp .gp-cc-plantilla:focus-visible { border-color: var(--gp-azul-300); box-shadow: 0 0 0 1px var(--gp-azul-300), 0 12px 24px -10px rgba(0,0,0,.25); transform: translateY(-2px); }
.gp .gp-cc-usar { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 9999px; background: var(--gp-primario); color: var(--gp-primario-texto); font-size: 13px; font-weight: 600; white-space: nowrap; opacity: 0; transition: opacity .15s; pointer-events: none; }
.gp .gp-cc-usar .gp-giro { width: 13px; height: 13px; }
.gp .gp-cc-plantilla:hover:not(:disabled) .gp-cc-usar, .gp .gp-cc-plantilla:focus-visible .gp-cc-usar, .gp .gp-cc-usar[data-visible="si"] { opacity: 1; }
.gp .gp-cc-nombre { padding: 0 4px; font-size: 14.5px; font-weight: 600; line-height: 1.3; color: var(--gp-titulo); }
[data-tema="oscuro"] .gp .gp-cc-plantilla { box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 24px -8px rgba(0,0,0,.6); }

/* Teléfono: los cuatro modos de a dos (cuatro en fila no entran en 390 px), del ancho del cuadro. */
@media (max-width: 560px) {
  .gp .gp-cc-modos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; border-radius: 16px; }
  .gp .gp-cc-modo { border-radius: 12px; padding: 0 8px; font-size: 13.5px; }
  /* «Tu texto» en un renglón: sin los íconos, las tres opciones entran en 390 px. */
  .gp .gp-cc-tutexto button .gp-ico { display: none; }
}
@media (max-width: 760px) {
  .gp .gp-cc-grilla { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
}
`;
