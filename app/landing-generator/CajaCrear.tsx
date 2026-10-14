'use client';

// =============================================================================
// CajaCrear — «¿Qué vas a crear hoy?»: la caja de Gamma 5 con Landing | Presentación,
// el dictado por voz, «Crear con IA» y, debajo, las plantillas del tipo elegido
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 6), textual: «Al momento de crear nuevo tengo
// que elegir si crear landing, presentación... Sería bueno que ahí aparezcan los templates
// (deberías hacer más templates de presentaciones)... Y también quiero ahí mismo agregar la
// funcionalidad que tenemos en "nueva automatización", donde le escribo a la IA o le mando un
// audio, pero me gusta el formato que hiciste de "¿Qué vas a crear hoy?", solo falta agregar
// la funcionalidad de dictarle con audio, como lo tenemos en donde te mencioné.»
// Decisión T4 de docs/diseno-editor-landing.md.
//
// TANDA 6 (14/10/2026). Martín, textual:
//   3. «La sección de "Crear con IA", le faltan las opciones de "Analizar Landing" y "Replicar Landing".
//      Y que el botón de "Importar" que solo sea importar, no que sea con URL, para eso ya las otras
//      opciones que te dije... Y esta sección de "Crear con IA" debería estar en la tab principal de
//      landing generator, en la sección de "¿Qué vas a crear hoy?".»
//   4. «Como vamos a tener esa sección, elimina todas las opciones actuales dentro del "+" en el cuadro
//      del chat. Y que en ese + solo quede la opción de importar archivo y otras opciones así, para subir
//      imagen y esas cosas...»
//   5. «En el chat, si yo pego un link, me debería aparecer pintado de azul y que diga "Analiza esta
//      landing" y que se pueda cambiar a "Replica esta landing".»
//   6. «Las miniaturas y el título de abajo en las plantillas, deberían estar englobadas en un contendor,
//      para que se entienda que ese título corresponde a esa miniatura... Elimina los subtitulos de cada
//      plantilla. Y me gustaría que esos bloques tengan como una sombra, que se separe del fondo.»
//
// Qué tiene, de arriba abajo:
//   · el título grande y la caja blanca (CajaPedido.tsx, la MISMA del modal «Nueva automatización»);
//   · adentro, el pedido con el ejemplo que se ESCRIBE SOLO, y la fila de abajo: el «+», Plan | Express,
//     el MICRÓFONO (`BotonDictar`, importado, no copiado) y el ↑ de enviar;
//   · el «+» sólo ADJUNTA (punto 4): «Importar archivo» (PowerPoint, Word, PDF, una planilla, un audio…) y
//     «Subir imagen». Se lee con el lector de la casa (`leerArchivo`, ./cliente.ts → /api/landing-generator/
//     importar) y queda como chip arriba del campo; al enviar, su texto va a «Pegar texto» y lo escrito, a
//     las instrucciones. Lo que había antes en el «+» sigue alcanzable: «Importar archivo o URL» = la
//     tarjeta «Importar» (archivos) y «Analizar / Replicar landing» (URLs); «Usar plantilla» = la grilla de
//     abajo y «Plantillas» de la barra; «Del generador anterior» = la galería de Plantillas (Inicio.tsx);
//   · UN LINK PEGADO (punto 5, `sacarLink` de ./panel-reglas.ts) sale del texto y queda EN LUGAR del campo
//     como un chip azul, con la pastilla «Analiza esta landing» ⇄ «Replica esta landing» (y en Replicar, el
//     formato). El ↑ hace eso con la URL: lo mismo que las tarjetas de abajo;
//   · las pastillas Landing | Presentación;
//   · «Crear con IA» (punto 3): Pegar texto · Generar · Importar · Analizar landing · Replicar landing, las
//     tarjetas que tenía /landing-generator/crear. Se abren a la DERECHA del Panel, en la misma ruta;
//   · las plantillas del tipo elegido (punto 6): miniatura y nombre en UNA tarjeta con sombra, sin la
//     descripción (sigue en los datos). Tocar una CREA y ABRE (navegación dura: cambió QUÉ EXISTE).
//
// Enviar no genera acá: le pasa el pedido al Panel (`onAccion`), que abre «Crear con IA» a la derecha con
// el pedido EN MEMORIA (`ArranqueIA`, ./panel-reglas.ts). Plan muestra el esquema para aprobar y Express
// genera directo. Lo que cambia con el tipo vive en crear/tipo.ts y lo usan las dos puertas.
//
// Dónde va: adentro de `.gma.gp` con CSS_GP (MiniaturaLanding.tsx) y la hoja del contenido
// (`CSS_CONTENIDO`, la pone la página del Panel). Trae SU hoja (`CSS_CAJA` + las pastillas).
// ⚠️ LA CAJA LA MONTA TAMBIÉN /automations (CajaPedido.tsx): el «+», el link y las tarjetas son de ESTA
//    puerta y van por las props de la caja (`antes`, `adjunto`, `enLugarDelCampo`), no adentro de ella.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWs } from '@/app/_ui/Link';
import { CajaPedido, ChipCaja, CSS_CAJA_PEDIDO, TITULO_CAJA } from './CajaPedido';
import { tarjetasDe, type JsonNodo } from '@/lib/editor-landing/doc';
import { formatoDe } from '@/lib/editor-landing/api-tipos';
import { temaPorId } from '@/lib/editor-landing/temas';
import type { FormatoReplicar } from '@/lib/editor-landing/replicar-reglas';
import { EXT_POR_FAMILIA, porQueNoPuedo, puedeLeerse } from '@/lib/formatos-archivo';
import {
  Desplegable, Ico, ItemMenu, MenuFlotante, MiniaturaLanding, irDuro, marcarReciente, pedirDocs, useAviso, type OpcionDesplegable,
} from './MiniaturaLanding';
import { leerArchivo } from './cliente';
import { hostDe, sacarLink, type ArranqueIA, type PasoIA } from './panel-reglas';
import {
  EJEMPLOS_CAJA, docDe, pedidoDeDiseno, pedidoDePlantilla, plantillasDe, type PlantillaCrear, type TipoCrear,
} from './crear/tipo';
import { CSS_TIPO, SelectorTipo } from './crear/PiezasTipo';
import { DialogoObjetivo } from './crear/DialogoObjetivo';
import { FORMATO_INICIAL, OPCIONES_FORMATO } from './crear/Replicar';

/** Lo que se eligió en la caja. El Panel lo abre a su derecha (Inicio.tsx). */
export type AccionCaja =
  | { que: 'ia'; paso: PasoIA; tipo: TipoCrear; arranque?: ArranqueIA }
  | { que: 'analizar'; url?: string }
  | { que: 'replicar'; url?: string; formato?: FormatoReplicar };

export type PropsCajaCrear = {
  /** El tipo con el que abre (por ejemplo, el de `?tipo=` de la query). Sin él, una landing. */
  tipoInicial?: TipoCrear;
  onAccion: (a: AccionCaja) => void;
};

/** El placeholder cuando el ejemplo ya paró (el de la caja de Gamma). */
const PLACEHOLDER_QUIETO = '¿Qué quieres crear?';
/** El placeholder con un archivo adjunto: el pedido ya es el archivo. */
const PLACEHOLDER_ARCHIVO = 'Qué hacer con el archivo (opcional)';

/** «Crear con IA» (tanda 6, punto 3): las tarjetas de /landing-generator/crear, ahora en la tab. Rótulos cortos. */
type OpcionIA = 'pegar' | 'generar' | 'importar' | 'analizar' | 'replicar';
export const OPCIONES_IA: readonly { id: OpcionIA; titulo: string; sub: string; icono: string; popular?: boolean }[] = [
  { id: 'pegar', titulo: 'Pegar texto', sub: 'Tus notas o tu guion', icono: 'texto-aa' },
  { id: 'generar', titulo: 'Generar', sub: 'Desde una idea', icono: 'destellos', popular: true },
  { id: 'importar', titulo: 'Importar', sub: 'PowerPoint, Word o PDF', icono: 'subir' },
  { id: 'analizar', titulo: 'Analizar landing', sub: 'Su diagnóstico', icono: 'reporte' },
  { id: 'replicar', titulo: 'Replicar landing', sub: 'Cópiala al editor', icono: 'copiar' },
];

/** Qué hacer con un link pegado (punto 5). */
type AccionLink = 'analizar' | 'replicar';
const ACCIONES_LINK: readonly OpcionDesplegable<AccionLink>[] = [
  { valor: 'analizar', texto: 'Analiza esta landing', icono: 'reporte' },
  { valor: 'replicar', texto: 'Replica esta landing', icono: 'copiar' },
];

/** El «+» (punto 4): un archivo de texto, oficina, audio o video, o una imagen (las familias de lib/formatos-archivo.ts). */
const extDe = (familias: readonly (keyof typeof EXT_POR_FAMILIA)[]) => familias.flatMap((f) => EXT_POR_FAMILIA[f].map((e) => `.${e}`)).join(',');
export const ACCEPT_ARCHIVO = extDe(['texto', 'docx', 'pdf', 'xlsx', 'pptx', 'opendocument', 'audio', 'video']);
export const ACCEPT_IMAGEN = extDe(['imagen']);

/** El archivo de la caja: leyéndose, leído (con su texto) o que no se pudo leer. */
type ArchivoCaja = { nombre: string; imagen: boolean } & ({ estado: 'leyendo' } | { estado: 'listo'; texto: string } | { estado: 'error' });

export default function CajaCrear({ tipoInicial = 'landing', onAccion }: PropsCajaCrear) {
  const ws = useWs();
  const { avisar, nodo: aviso } = useAviso();
  const [tipo, setTipo] = useState<TipoCrear>(tipoInicial);
  const [pedido, setPedido] = useState('');
  const [modo, setModo] = useState<'plan' | 'express'>('plan');
  const [menuMas, setMenuMas] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** La plantilla que se está creando (una a la vez: un doble clic no crea dos). */
  const [creando, setCreando] = useState<string | null>(null);
  const [muestras, setMuestras] = useState<Partial<Record<TipoCrear, Record<string, JsonNodo | null>>>>({});
  const cerrarMas = useCallback(() => setMenuMas(null), []);
  /** El DISEÑO que se tocó y espera su objetivo («¿De qué quieres crearla?»), o null. */
  const [eligiendo, setEligiendo] = useState<PlantillaCrear | null>(null);
  const cerrarEleccion = useCallback(() => setEligiendo(null), []);
  /** El link pegado (punto 5), qué hacer con él y, si se replica, en qué formato. */
  const [link, setLink] = useState<string | null>(null);
  const [accionLink, setAccionLink] = useState<AccionLink>('analizar');
  const [formatoLink, setFormatoLink] = useState<FormatoReplicar>(FORMATO_INICIAL);
  /** El archivo o la imagen del «+» (punto 4). */
  const [archivo, setArchivo] = useState<ArchivoCaja | null>(null);
  const subida = useRef<AbortController | null>(null);
  const elegirArchivo = useRef<HTMLInputElement>(null);
  const elegirImagen = useRef<HTMLInputElement>(null);
  useEffect(() => () => subida.current?.abort(), []);

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

  const quitarArchivo = () => { subida.current?.abort(); subida.current = null; setArchivo(null); };

  /** Lo escrito o pegado: un link completo sale del texto y queda como chip (`sacarLink`). */
  const alEscribir = (v: string) => {
    const r = sacarLink(pedido, v);
    if (!r) { setPedido(v); return; }
    quitarArchivo();
    setError(null);
    setLink(r.link);
    setPedido(r.texto);
  };

  /** El «+»: se lee el archivo (o la imagen, por visión) y queda como chip arriba del campo. */
  const subir = (file: File, imagen: boolean) => {
    quitarArchivo();
    setLink(null);
    setError(null);
    if (!puedeLeerse(file.name, file.type)) { setError(porQueNoPuedo(file.name) || 'No puedo leer ese archivo.'); return; }
    const base = { nombre: file.name, imagen };
    const ac = new AbortController();
    subida.current = ac;
    setArchivo({ ...base, estado: 'leyendo' });
    void leerArchivo(file, ac.signal).then((r) => {
      if (ac.signal.aborted) return;
      if (!r.ok) { setArchivo({ ...base, estado: 'error' }); setError(r.error); return; }
      setArchivo({ ...base, estado: 'listo', texto: r.texto });
    });
  };

  /** ¿Se puede mandar? Un link, un archivo leído, o algo escrito. */
  const listo = link ? true : archivo ? archivo.estado === 'listo' : !!pedido.trim();

  const enviar = () => {
    if (link) {
      onAccion(accionLink === 'analizar' ? { que: 'analizar', url: link } : { que: 'replicar', url: link, formato: formatoLink });
      return;
    }
    if (archivo) {
      if (archivo.estado !== 'listo') return;
      onAccion({ que: 'ia', paso: 'pegar', tipo, arranque: { modo, prompt: pedido.trim(), archivo: { nombre: archivo.nombre, texto: archivo.texto } } });
      return;
    }
    const p = pedido.trim();
    if (!p) return;
    onAccion({ que: 'ia', paso: 'generar', tipo, arranque: { prompt: p, modo } });
  };

  /** Una tarjeta de «Crear con IA». */
  const elegir = (o: OpcionIA) => {
    if (o === 'analizar') onAccion({ que: 'analizar' });
    else if (o === 'replicar') onAccion({ que: 'replicar' });
    else onAccion({ que: 'ia', paso: o, tipo });
  };

  /** Crear y abrir: lo que cambió es QUÉ EXISTE, así que la navegación es dura. */
  const crear = async (clave: string, alta: ReturnType<typeof pedidoDePlantilla>) => {
    if (creando) return;
    setCreando(clave);
    const r = await pedirDocs(alta);
    if (!r.ok) { setCreando(null); avisar('No se pudo crear'); console.error('[caja crear] plantilla', clave, r.error); return; }
    marcarReciente(r.doc.id);
    irDuro(`/landing-generator/${r.doc.id}`, ws);
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

  // El link pegado, EN LUGAR del campo: el chip azul y qué hacer con él (punto 5).
  const conLink = link ? (
    <div className="gp-cc-link">
      <ChipCaja icono="enlace" texto={hostDe(link)} onQuitar={() => setLink(null)} etiquetaQuitar="Quitar el enlace" />
      <span className="gp-cc-link-accion">
        <Desplegable etiqueta="Qué hacer" valor={accionLink} onCambio={setAccionLink} opciones={ACCIONES_LINK} ancho={240} />
      </span>
      {accionLink === 'replicar' && (
        <Desplegable etiqueta="Formato" valor={formatoLink} onCambio={setFormatoLink} opciones={OPCIONES_FORMATO} ancho={220} />
      )}
    </div>
  ) : null;

  return (
    <section className="gp-cc" aria-label="Crear">
      <style dangerouslySetInnerHTML={{ __html: CSS_TIPO + CSS_CAJA_PEDIDO + CSS_CAJA }} />

      {/* LA CAJA ES CajaPedido.tsx, la MISMA del modal «Nueva automatización» de /automations (decimocuarta tanda): el
          campo con el ejemplo que se escribe solo (vuelve a empezar con la lista del tipo nuevo: `reinicio`), el
          micrófono y el ↑. Lo de esta puerta va por sus props: el «+» y «Plan | Express» (`antes`), el archivo
          (`adjunto`) y el link pegado (`enLugarDelCampo`, tanda 6). */}
      <CajaPedido
        titulo={{ texto: TITULO_CAJA, nivel: 1 }}
        reinicio={tipo}
        ejemplos={EJEMPLOS_CAJA[tipo]}
        valor={pedido}
        animar={!archivo}
        placeholderQuieto={archivo ? PLACEHOLDER_ARCHIVO : PLACEHOLDER_QUIETO}
        etiqueta="Qué quieres crear"
        listo={listo}
        onValor={alEscribir}
        onEnviar={enviar}
        onError={setError}
        adjunto={archivo ? (
          <ChipCaja icono={archivo.imagen ? 'imagen' : 'archivo'} texto={archivo.nombre} error={archivo.estado === 'error'}
            detalle={archivo.estado === 'leyendo' ? 'Leyendo…' : null} onQuitar={quitarArchivo} etiquetaQuitar="Quitar el archivo" />
        ) : null}
        enLugarDelCampo={conLink}
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
            {!link && (
              <Desplegable
                etiqueta="Modo"
                valor={modo}
                onCambio={setModo}
                ancho={300}
                opciones={[
                  { valor: 'plan', texto: 'Plan', etiqueta: 'Predeterminado', sub: 'Revisa el esquema antes de crear', icono: 'lista' },
                  { valor: 'express', texto: 'Express', sub: 'Más rápido, sin revisar el esquema', icono: 'rayo' },
                ]}
              />
            )}
          </>
        )}
      />
      {error && <p className="gp-error gp-cc-error" role="alert">{error}</p>}

      <SelectorTipo valor={tipo} onCambio={setTipo} deshabilitado={!!creando} />

      <section className="gp-cc-ia" aria-labelledby="gp-cc-ia-titulo">
        <h2 id="gp-cc-ia-titulo" className="gp-cc-subtitulo">Crear con IA</h2>
        <div className="gp-cc-opciones">
          {OPCIONES_IA.map((o) => (
            <button key={o.id} type="button" className="gp-cc-opcion" onClick={() => elegir(o.id)}>
              <span className="gp-cc-ilus" data-tipo={o.id}>
                {o.id === 'pegar' ? <span className="gp-cc-ilus-aa">Aa</span> : <Ico n={o.icono} t={30} />}
              </span>
              <span className="gp-cc-opcion-titulo">
                {o.titulo}
                {o.popular && <span className="gp-chip gp-cc-popular"><Ico n="rayo" t={11} /> Popular</span>}
              </span>
              <span className="gp-cc-opcion-sub">{o.sub}</span>
            </button>
          ))}
        </div>
      </section>

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

      {/* El «+» sólo adjunta (tanda 6, punto 4). Los dos `input` viven afuera del menú: tocar una opción lo cierra. */}
      {menuMas && (
        <MenuFlotante ancla={menuMas} onCerrar={cerrarMas} ancho={250}>
          <ItemMenu icono="subir" texto="Importar archivo" sub="PowerPoint, Word o PDF" onClick={() => { setMenuMas(null); elegirArchivo.current?.click(); }} />
          <ItemMenu icono="imagen" texto="Subir imagen" onClick={() => { setMenuMas(null); elegirImagen.current?.click(); }} />
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
 * Lo de la página alrededor de la caja (tokens de CSS_GP): el error, el link pegado, «Crear con IA» y las
 * plantillas. La caja trae su hoja (CSS_CAJA_PEDIDO).
 * Tanda 6: las tarjetas de «Crear con IA» son las de /landing-generator/crear (la ilustración de Gamma con
 * su degradado), y las de las plantillas, UNA tarjeta (miniatura + nombre) con borde y sombra que la
 * separa del fondo; en oscuro la sombra es más honda (sobre un fondo oscuro, una sombra clara no se ve).
 */
const CSS_CAJA = `
.gp .gp-cc { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; margin: 8px 0 28px; }
.gp .gp-cc-error { max-width: 720px; margin: -6px 0 0; }
.gp .gp-cc-subtitulo { margin: 0; font-size: 18px; font-weight: 600; color: var(--gp-titulo); }

/* El link pegado: el chip azul y la pastilla de qué hacer (también azul: son la misma cosa). */
.gp .gp-cc-link { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.gp .gp-cc-link .gp-cc-chip { max-width: min(100%, 320px); }
.gp .gp-cc-link-accion .gp-pildora { border-color: var(--gp-azul-200); background: var(--gp-azul-50); color: var(--gp-azul-600); font-weight: 600; }
.gp .gp-cc-link-accion .gp-pildora:hover:not(:disabled) { background: var(--gp-azul-100); }
[data-tema="oscuro"] .gp .gp-cc-link-accion .gp-pildora { border-color: #0540ad; background: #0b2e79; color: #aad5fe; }

/* «Crear con IA»: cinco tarjetas con la ilustración de Gamma. */
.gp .gp-cc-ia { display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 8px; }
.gp .gp-cc-opciones { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
.gp .gp-cc-opcion { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; padding: 10px 10px 14px; border: 1px solid var(--gp-borde-suave); border-radius: 12px; background: var(--gp-superficie); box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 6px 16px -6px rgba(0,0,0,.14); text-align: center; cursor: pointer; transition: transform .18s, box-shadow .18s; }
.gp .gp-cc-opcion:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,.12), 0 4px 6px -2px rgba(0,0,0,.06); }
.gp .gp-cc-opcion-titulo { display: inline-flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; font-size: 15px; font-weight: 600; line-height: 1.25; color: var(--gp-titulo); }
.gp .gp-cc-opcion-sub { font-size: 12.5px; line-height: 1.35; color: var(--gp-tenue); }
.gp .gp-cc-popular { background: var(--gp-azul-100); color: var(--gp-azul-800); text-transform: uppercase; letter-spacing: .03em; font-size: 10px; }
.gp .gp-cc-ilus { position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 5 / 3; border-radius: 8px; overflow: hidden; color: #fff; }
.gp .gp-cc-ilus::after { content: ""; position: absolute; left: -10%; right: -10%; bottom: -35%; height: 70%; border-radius: 50%; background: rgba(255,255,255,.18); }
.gp .gp-cc-ilus .gp-ico, .gp .gp-cc-ilus-aa { position: relative; z-index: 1; }
.gp .gp-cc-ilus-aa { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
.gp .gp-cc-ilus[data-tipo="pegar"] { background: linear-gradient(180deg, #2b1a5c 0%, #6b3fa0 60%, #c58fd8 100%); }
.gp .gp-cc-ilus[data-tipo="generar"] { background: radial-gradient(circle at 70% 30%, #fff3c6 0 12%, transparent 13%), linear-gradient(180deg, #ffd6e0 0%, #ffb3c7 55%, #f08aa8 100%); }
.gp .gp-cc-ilus[data-tipo="importar"] { background: linear-gradient(180deg, #d7f5e9 0%, #a8e6cf 50%, #f7b8d0 100%); color: #1c481d; }
.gp .gp-cc-ilus[data-tipo="analizar"] { background: linear-gradient(180deg, #0b2e79 0%, #2c88f7 60%, #84c1fa 100%); }
.gp .gp-cc-ilus[data-tipo="replicar"] { background: linear-gradient(180deg, #fff1d6 0%, #ffc98a 55%, #f59e5b 100%); color: #5a2a00; }

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
[data-tema="oscuro"] .gp .gp-cc-plantilla, [data-tema="oscuro"] .gp .gp-cc-opcion { box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 24px -8px rgba(0,0,0,.6); }

@media (max-width: 1100px) {
  .gp .gp-cc-opciones { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .gp .gp-cc-opciones { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .gp .gp-cc-ilus { aspect-ratio: 2 / 1; }
  .gp .gp-cc-opcion-titulo { font-size: 14px; }
  .gp .gp-cc-grilla { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
}
`;
