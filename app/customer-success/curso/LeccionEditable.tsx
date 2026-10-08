'use client';

// =============================================================================
// LeccionEditable — la lección de la tab Curso, que se edita EN SU LUGAR
// =============================================================================
// Pedido de Martín (07/10/2026), items 13 a 17, textual:
//   «13. Elimina la sección de "Notas" en todos lados.
//    14. Dentro de una clase, no deberían haber tabs de "Tarea" y "Descripción", por defecto ambas
//        juntas siempre, y primero siempre la descripción.
//    15. Elimina el botón de "grabar/no grabar".
//    16. Elimina el botón de "Editar", para eso ya se edita en cada parte... Si quiero editar el
//        título, le doy click, como la descripción... Si quiero agregar un vídeo, al igual que al
//        agregar una nueva clase, debe siempre estar un placeholder donde iría el vídeo para la opción
//        de "Agregar vídeo"... Lo mismo con el botón de "Agregar tarea" ahí mismo abajo de la
//        descripción, como placeholder.
//    17. Se debería poder adjuntar cosas a la descripción... Imágenes, PDF, archivos, etc.»
// Decisiones: docs/diseno-curso-skool.md, D4.
//
// Lo que arma `leccionDelEditor(c, ctx)`, el `LeccionUgc` que dibuja app/_cursos/CursoUgc.tsx (que es
// el MISMO dibujo que ve el alumno: lo que se edita acá se ve igual en su portal):
//   · `video`         el reproductor, y abajo «Cambiar» y «Quitar» (quien edita);
//   · `sinVideo`      el recuadro punteado «Agregar video», con dos caminos: pegar un link (YouTube,
//                     Vimeo, Loom, Drive) o subir un archivo con su barra de progreso;
//   · `debajoDelVideo` la ficha (tipo, minutos, de qué es el video) y un link de afuera;
//   · `papel`         la DESCRIPCIÓN (el editor rico, con adjuntos) y DEBAJO la TAREA (la instrucción, el
//                     formulario y «Cierra el módulo»), o el botón punteado «Agregar tarea».
// El título se edita con un clic en el propio dibujo (`TextoEditable`, `edicion.onTexto`).
//
// ⚠️ CADA PARTE GUARDA LO SUYO, con `guardarCampoClaseAction` (un `update` de SUS columnas, nunca la
//    fila): la descripción con un respiro después de la última tecla, la tarea al dejar de escribir,
//    el video al terminar la subida. Un guardado de la fila armada en el navegador pisaría lo que otra
//    parte guardó un segundo antes (lib/curso-admin.ts, «la lección que se edita en su lugar»).
// ⚠️ LO ESCRITO VIVE EN ESTADO LOCAL Y NO SE RESIEMBRA DE LAS PROPS, a propósito (AGENTS.md: «un
//    useState sembrado de props no se resiembra»): la lección se monta con `key` = la clase
//    (CursoUgc), así que cambiar de clase la remonta; y adentro de la misma clase, lo que vuelve del
//    server es lo SANEADO, que no puede volver al editor mientras alguien escribe (el cursor saltaría).
// ⚠️ SALIR NO PIERDE LO ESCRITO: al desmontarse (otra clase, otro módulo) y al ocultarse la pestaña, lo
//    pendiente se manda en el acto. Lo que NO cubre: cerrar el navegador dentro del respiro (una server
//    action no sobrevive a la pestaña, y no hay `sendBeacon` para ellas).
// ⚠️ NADA DE MODALES PROPIOS ACÁ ADENTRO: la hoja del curso deja sin fondo ni borde a todo `button` de
//    `.ahdoc`, y un `Modal` de la app no se portalea. Las confirmaciones las dibuja la tab, afuera del
//    curso (`ctx.confirmar`).
// ⚠️ TEXTO DE PANTALLA CORTO y en voz neutra (lo arma el equipo, pero el guard de voseo mira todo).

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { Campo, Clase, TipoClase } from '@/lib/curso';
import { reproductorDeClase, tieneTarea } from '@/lib/curso';
import type { LeccionUgc } from '@/app/_cursos/tipos';
import { Select, Switch } from '@/app/_ui';
import EditorRico from '@/app/_ui/EditorRico';
import { HtmlSeguro, idDeRef, refsEnHtml } from '@/app/_ui/HtmlSeguro';
import { ACEPTA_ADJUNTO, ACEPTA_IMAGEN_ADJUNTO, crearSubidorDeAdjuntos } from '@/lib/curso-adjuntos-reglas';
import Reproductor from '@/app/compartido/curso/[token]/Reproductor';
import TareaAlumno from '@/app/compartido/curso/[token]/TareaAlumno';
import { VistaPreviaCtx } from '@/app/compartido/curso/[token]/vista-previa';
import { urlSubidaVideoAction, descartarVideoAction, urlVerVideoAction } from './actions';
import { urlSubidaAdjuntoAction, registrarAdjuntoAction, urlsAdjuntosAction } from './adjuntos-actions';
import { guardarCampoClaseAction } from './modulos-actions';
import { subirConProgreso, duracionDeArchivo, type Subida } from './subir-video';
import { EditorCampos } from './EditorCampos';
import { MIME_VIDEO, TIPOS_CLASE, TOPE_VIDEO_BYTES, mimeDeArchivo, rotuloTipo, videoDeClase } from './reglas';
import {
  RESPIRO_DESCRIPCION_MS, RESPIRO_TAREA_MS, cambiosParaQuitarTarea, faltaEnFormulario, htmlInicialDeDescripcion,
  linkDeVideo, lugarDelVideo, minutosDeDuracion, ofreceCierraModulo, tareaAbierta, textoDeGuardado,
  type EstadoGuardado, type LugarDelVideo,
} from './leccion-reglas';

/** Lo que se guarda de una parte (el contrato de `guardarCampoClaseAction`). */
type Cambio = Parameters<typeof guardarCampoClaseAction>[1];

/**
 * Lo que la lección necesita de la tab. Se arma en cada render: las piezas lo leen por un ref
 * (`useUltimo`), así una respuesta que llega tarde usa el de ahora y no el de cuando se pidió.
 */
export type CtxLeccion = {
  productoId: number;
  /** Un admin del workspace (lib/workspace.ts): edita. El resto del equipo mira. */
  puedeEditar: boolean;
  /** ¿El módulo de la clase es una etapa del kanban? «Cierra el módulo» sólo ahí. */
  vinculado: boolean;
  /** Cuántos clientes ya tienen avance en la clase (lo que dice el aviso de quitar la tarea). */
  conAvance: number;
  /** La clase como quedó en el server, para que la tab la tenga (las tarjetas, la vista del alumno). */
  onClase: (c: Clase) => void;
  /** Un aviso corto de algo que no salió (el toast de la tab). */
  avisar: (texto: string) => void;
  /** Una pregunta antes de algo que no se deshace. La dibuja la tab, afuera del curso (ver la cabecera). */
  confirmar: (mensaje: string, o: { titulo: string; boton: string }) => Promise<boolean>;
};

/**
 * La lección de una clase para la tab Curso. Se llama en cada render (CursoUgc, `leccion`): no usa
 * hooks, arma las piezas que sí los usan.
 */
export function leccionDelEditor(c: Clase, ctx: CtxLeccion): LeccionUgc {
  const lugar = lugarDelVideo(c);
  return {
    video: lugar === 'marco'
      ? { cuerpo: <VideoDeClase clase={c} />, barra: ctx.puedeEditar ? <ControlesDelVideo key={claveDeVideo(c)} c={c} ctx={ctx} /> : undefined }
      : undefined,
    sinVideo: lugar === 'vacio' && ctx.puedeEditar ? <AgregarVideo c={c} ctx={ctx} /> : undefined,
    debajoDelVideo: <FichaDeLaClase c={c} ctx={ctx} lugar={lugar} />,
    papel: <PapelDelEditor c={c} ctx={ctx} />,
  };
}

/** El video que tiene la clase, como clave: cambiarlo remonta sus controles (vuelven cerrados). */
const claveDeVideo = (c: Clase) => `${c.videoTipo}:${c.videoUrl ?? c.videoPath ?? ''}`;

/** Lo último de un valor que cambia en cada render, para lo que corre después (una respuesta, un timer). */
function useUltimo<T>(v: T) {
  const r = useRef(v);
  useEffect(() => { r.current = v; });
  return r;
}

// ── El video ─────────────────────────────────────────────────────────────────

/** Lo que acepta el campo de archivo: los formatos del bucket (`MIME_VIDEO`) y sus extensiones. */
const ACEPTA_VIDEO = [...MIME_VIDEO, '.mp4', '.webm', '.mov', '.m4v'].join(',');

/**
 * El video de la clase, con el MISMO reproductor del portal en modo vista previa (no manda avance:
 * no hay alumno). Un video SUBIDO no tiene link público: se pide uno firmado de vida corta
 * (`urlVerVideoAction`, que alcanza con poder mirar la tab).
 */
function VideoDeClase({ clase }: { clase: Clase }) {
  const { video } = reproductorDeClase(clase);
  const [firmada, setFirmada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = video?.tipo === 'archivo' ? clase.videoPath : null;
  useEffect(() => {
    if (!path) return;
    let vivo = true;
    urlVerVideoAction(path)
      .then((r) => { if (vivo) { if (r.ok) setFirmada(r.url); else setError(r.error); } })
      .catch(() => { if (vivo) setError('No pude abrir el video.'); });
    return () => { vivo = false; };
  }, [path]);
  if (!video) return null;
  if (video.tipo === 'archivo') {
    if (error) return <p className="cp-nota" style={{ padding: 16, color: '#fff' }}>{error}</p>;
    if (!firmada) return null;
    return (
      <VistaPreviaCtx.Provider value>
        <Reproductor token="" claseId={clase.id} video={{ tipo: 'directo', url: firmada }} titulo={clase.titulo} onPct={() => {}} />
      </VistaPreviaCtx.Provider>
    );
  }
  return (
    <VistaPreviaCtx.Provider value>
      <Reproductor token="" claseId={clase.id} video={video} titulo={clase.titulo} onPct={() => {}} />
    </VistaPreviaCtx.Provider>
  );
}

/**
 * Poner, cambiar o quitar el video de una clase. Lo usan el recuadro de «Agregar video» y los
 * controles de un video puesto: es UNA regla para los dos caminos.
 *
 * ⚠️ EL ARCHIVO VA DEL NAVEGADOR AL BUCKET con una URL firmada (una server action topa en 1 MB) y con
 *    barra de progreso por XHR (`fetch` no da el progreso de SUBIDA: AGENTS.md, «tres topes»). Recién
 *    al terminar se guarda en la clase, y el server verifica que haya llegado.
 * ⚠️ UNA SUBIDA QUE NO QUEDÓ EN LA CLASE SE DESCARTA: salir de la lección la corta, y un archivo subido
 *    que no se pudo guardar se borra. Cada video son hasta 2 GiB en un Storage de 5 para toda la
 *    plataforma.
 * ⚠️ LOS MINUTOS SALEN DEL ARCHIVO: si el navegador puede leer la duración, se guardan con el video
 *    nuevo (era lo que hacía el editor de la clase que se fue).
 */
function useCambioDeVideo(c: Clase, ctx: CtxLeccion) {
  const ctxRef = useUltimo(ctx);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const subida = useRef<Subida | null>(null);
  const sinGuardar = useRef<string | null>(null);

  useEffect(() => () => {
    subida.current?.cancelar();
    if (sinGuardar.current) void descartarVideoAction(sinGuardar.current).catch(() => {});
  }, []);

  const guardar = async (cambio: Cambio): Promise<Clase | null> => {
    try {
      const r = await guardarCampoClaseAction(c.id, cambio);
      if (!r.ok) { setError(r.error); return null; }
      return r.clase;
    } catch {
      setError('No se pudo guardar.');
      return null;
    }
  };

  const usarLink = async (raw: string): Promise<boolean> => {
    const l = linkDeVideo(raw);
    if (!l.ok) { setError(l.error); return false; }
    setOcupado(true);
    setError(null);
    const clase = await guardar({ video: { tipo: 'url', url: l.url } });
    setOcupado(false);
    if (clase) ctxRef.current.onClase(clase);
    return !!clase;
  };

  const subir = async (file: File) => {
    setError(null);
    const mime = mimeDeArchivo(file.name, file.type);
    if (!mime) { setError('Ese formato no va: MP4, WEBM o MOV.'); return; }
    if (file.size > TOPE_VIDEO_BYTES) { setError('Pasa de 2 GB.'); return; }
    // El tipo corregido viaja en la parte del multipart (ver subir-video.ts). `new File` sobre el
    // mismo archivo no copia los bytes: es otra vista del mismo blob.
    const archivo = file.type === mime ? file : new File([file], file.name, { type: mime });
    setOcupado(true);
    try {
      const duracion = await duracionDeArchivo(archivo);
      const firma = await urlSubidaVideoAction(ctx.productoId, mime, archivo.size);
      if (!firma.ok) { setError(firma.error); return; }
      setPct(0);
      const s = subirConProgreso(firma.signedUrl, archivo, firma.apikey, setPct);
      subida.current = s;
      await s.promesa;
      subida.current = null;
      sinGuardar.current = firma.path;
      let clase = await guardar({ video: { tipo: 'archivo', path: firma.path } });
      if (!clase) {
        void descartarVideoAction(firma.path).catch(() => {});
        sinGuardar.current = null;
        return;
      }
      sinGuardar.current = null;
      const min = minutosDeDuracion(duracion);
      if (min != null && min !== clase.minutos) {
        // Si los minutos no se pudieron guardar, el video ya quedó: no se dice nada, se ven en la ficha.
        const conMin = await guardarCampoClaseAction(c.id, { minutos: min }).catch(() => null);
        if (conMin?.ok) clase = conMin.clase;
      }
      ctxRef.current.onClase(clase);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo subir.');
    } finally {
      subida.current = null;
      setPct(null);
      setOcupado(false);
    }
  };

  const quitar = async () => {
    setOcupado(true);
    setError(null);
    const clase = await guardar({ video: null });
    setOcupado(false);
    if (clase) ctxRef.current.onClase(clase);
  };

  return {
    pct, error, ocupado, usarLink, subir, quitar,
    cancelar: () => subida.current?.cancelar(),
    limpiar: () => setError(null),
  };
}

type CambioDeVideo = ReturnType<typeof useCambioDeVideo>;

/** ¿Lo que se arrastra trae un archivo? (una tarjeta del curso que se arrastra no es un archivo). */
const traeArchivo = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/** Los dos caminos para poner un video: pegar un link o subir un archivo. Con la subida en curso, su barra. */
function PanelVideo({ v, alVolver }: { v: CambioDeVideo; alVolver?: () => void }) {
  const [modo, setModo] = useState<'elegir' | 'link'>('elegir');
  const [link, setLink] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  // El foco va al campo al abrirlo: es lo único que hay para hacer ahí.
  useEffect(() => { if (modo === 'link') campo.current?.focus(); }, [modo]);

  if (v.pct != null) {
    return (
      <div className="cu-vid-fila">
        <span className="cu-barra" role="progressbar" aria-label="Subiendo el video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.pct}>
          <span style={{ width: `${v.pct}%` }} />
        </span>
        <span className="cu-vid-nota">{v.pct}%</span>
        <button type="button" className="ugc-btn" onClick={v.cancelar}>Cancelar</button>
      </div>
    );
  }
  if (modo === 'link') {
    return (
      <form className="cu-vid-fila" onSubmit={(e) => {
        e.preventDefault();
        void v.usarLink(link).then((ok) => { if (ok) { setLink(''); setModo('elegir'); alVolver?.(); } });
      }}>
        <input ref={campo} className="cu-vid-input" type="url" inputMode="url" value={link} placeholder="https://"
          aria-label="Link del video" disabled={v.ocupado} onChange={(e) => { setLink(e.target.value); v.limpiar(); }} />
        <button type="submit" className="ugc-btn primary" disabled={v.ocupado}>Usar</button>
        <button type="button" className="ugc-btn" disabled={v.ocupado} onClick={() => { setModo('elegir'); setLink(''); v.limpiar(); }}>Volver</button>
      </form>
    );
  }
  return (
    <div className="cu-vid-fila">
      <button type="button" className="ugc-btn" disabled={v.ocupado} onClick={() => { setModo('link'); v.limpiar(); }}>Pegar un link</button>
      <label className="ugc-btn cu-vid-archivo" aria-disabled={v.ocupado || undefined}>
        <input type="file" accept={ACEPTA_VIDEO} disabled={v.ocupado}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void v.subir(f); }} />
        Subir un archivo
      </label>
      {alVolver && <button type="button" className="ugc-btn" disabled={v.ocupado} onClick={() => { v.limpiar(); alVolver(); }}>Volver</button>}
    </div>
  );
}

/**
 * El recuadro de «Agregar video» (`LeccionUgc.sinVideo`). Va adentro del 16:9 punteado que dibuja
 * CursoUgc, y también recibe un archivo SOLTADO encima.
 */
function AgregarVideo({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  const v = useCambioDeVideo(c, ctx);
  const [encima, setEncima] = useState(false);
  return (
    <div className={`cu-vacio${encima ? ' es-encima' : ''}`}
      onDragOver={(e) => { if (traeArchivo(e) && !v.ocupado) { e.preventDefault(); setEncima(true); } }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        const f = e.dataTransfer?.files?.[0];
        if (!f || v.ocupado) return;
        e.preventDefault();
        setEncima(false);
        void v.subir(f);
      }}>
      <span className="cu-vacio-t">Agregar video</span>
      <PanelVideo v={v} />
      <span className="cu-vid-nota">YouTube, Vimeo, Loom o Drive · MP4, WEBM o MOV</span>
      {v.error && <p className="cu-vid-error" role="alert">{v.error}</p>}
    </div>
  );
}

/** Lo que dice el video puesto y sus dos acciones: «Cambiar» (los mismos dos caminos) y «Quitar». */
function ControlesDelVideo({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  const v = useCambioDeVideo(c, ctx);
  const [cambiando, setCambiando] = useState(false);
  const info = videoDeClase(c);
  if (cambiando || v.pct != null) {
    return (
      <div className="cu-vid-barra">
        <PanelVideo v={v} alVolver={v.pct == null ? () => setCambiando(false) : undefined} />
        {v.error && <p className="cu-vid-error" role="alert">{v.error}</p>}
      </div>
    );
  }
  const quitar = async () => {
    // Un archivo subido se BORRA del bucket si ninguna otra clase lo usa (`guardarCampoClase`): no
    // hay vuelta atrás, y se dice antes.
    const ok = await ctx.confirmar(c.videoTipo === 'archivo' ? 'El archivo se borra.' : 'La clase queda sin video.', { titulo: '¿Quitar el video?', boton: 'Quitar' });
    if (ok) await v.quitar();
  };
  return (
    <div className="cu-vid-barra">
      <span className={`cu-vid-nota${info.medible ? '' : ' cu-tenue'}`}>{info.rotulo}{info.medible ? '' : ' · sin medir'}</span>
      <span className="cu-vid-acciones">
        <button type="button" className="ugc-btn" disabled={v.ocupado} onClick={() => { v.limpiar(); setCambiando(true); }}>Cambiar</button>
        <button type="button" className="ugc-btn" disabled={v.ocupado} onClick={() => void quitar()}>Quitar</button>
      </span>
      {v.error && <p className="cu-vid-error" role="alert">{v.error}</p>}
    </div>
  );
}

// ── La ficha: el tipo, los minutos y de qué es el video ─────────────────────

/**
 * Debajo del video. Quien edita cambia el tipo y los minutos acá (eran del editor de la clase que se
 * fue); el resto los lee. Un link que no se reproduce adentro (`afuera`) va acá, con sus controles.
 */
function FichaDeLaClase({ c, ctx, lugar }: { c: Clase; ctx: CtxLeccion; lugar: LugarDelVideo }) {
  const v = videoDeClase(c);
  return (
    <div className="cu-ficha">
      <span className="cu-ficha-meta">
        {ctx.puedeEditar ? <TipoDeLaClase key={c.id} c={c} ctx={ctx} /> : <span>{rotuloTipo(c.tipo)}</span>}
        {ctx.puedeEditar
          ? <MinutosDeLaClase key={`${c.id}:${c.minutos ?? ''}`} c={c} ctx={ctx} />
          : c.minutos != null && <span>{c.minutos} min</span>}
        {lugar === 'vacio' && <span className="cu-tenue">Sin video</span>}
        {/* Con el video en el marco, quien edita lo lee en la franja de abajo del video. */}
        {(lugar === 'afuera' || (lugar === 'marco' && !ctx.puedeEditar)) && (
          <span className={v.medible ? '' : 'cu-tenue'}>{v.rotulo}{v.medible ? '' : ' · sin medir'}</span>
        )}
        {c.obligatoria && tieneTarea(c) && ctx.vinculado && <span className="cu-chip">Cierra el módulo</span>}
      </span>
      {lugar === 'afuera' && <VideoDeClase clase={c} />}
      {lugar === 'afuera' && ctx.puedeEditar && <ControlesDelVideo key={claveDeVideo(c)} c={c} ctx={ctx} />}
    </div>
  );
}

/** El tipo de la clase (Clase, Concepto, Demostración…): se guarda al elegirlo. */
function TipoDeLaClase({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  const ctxRef = useUltimo(ctx);
  const [tipo, setTipo] = useState<TipoClase>(c.tipo);
  const elegir = async (v: string) => {
    const antes = tipo;
    setTipo(v as TipoClase);
    try {
      const r = await guardarCampoClaseAction(c.id, { tipo: v as TipoClase });
      if (!r.ok) { setTipo(antes); ctxRef.current.avisar(r.error); return; }
      ctxRef.current.onClase(r.clase);
    } catch {
      setTipo(antes);
      ctxRef.current.avisar('No se pudo guardar.');
    }
  };
  return (
    <Select value={tipo} width={150} ariaLabel="Tipo de clase" onChange={(v) => void elegir(v)}
      options={TIPOS_CLASE.map((t) => ({ value: t.value, label: t.label }))} />
  );
}

/** Los minutos de la clase: se guardan al salir del campo (o con Enter). Vacío = sin minutos. */
function MinutosDeLaClase({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  const ctxRef = useUltimo(ctx);
  const [texto, setTexto] = useState(c.minutos != null ? String(c.minutos) : '');
  const guardar = async () => {
    const limpio = texto.trim();
    const valor = limpio === '' ? null : Number(limpio);
    if (valor === c.minutos) return;
    if (valor !== null && (!Number.isFinite(valor) || valor < 0 || valor > 600)) {
      setTexto(c.minutos != null ? String(c.minutos) : '');
      ctxRef.current.avisar('Los minutos no cierran.');
      return;
    }
    try {
      const r = await guardarCampoClaseAction(c.id, { minutos: valor === null ? null : Math.round(valor) });
      if (!r.ok) { ctxRef.current.avisar(r.error); return; }
      ctxRef.current.onClase(r.clase);
    } catch {
      ctxRef.current.avisar('No se pudo guardar.');
    }
  };
  return (
    <label className="cu-min-et">
      <input className="cu-min" type="number" min={0} max={600} inputMode="numeric" value={texto} aria-label="Minutos de la clase"
        onChange={(e) => setTexto(e.target.value)} onBlur={() => void guardar()}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      min
    </label>
  );
}

// ── El papel: la descripción y debajo la tarea ───────────────────────────────

/**
 * El papel de la lección. PRIMERO la descripción y DEBAJO la tarea, siempre juntas (item 14): el
 * mismo orden que en el portal del alumno.
 */
function PapelDelEditor({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  return (
    <div className="ugc-paper cu-papel">
      {/* React 19 sube esta hoja al <head> UNA vez (la deduplica por `href`). */}
      <style href="cu-leccion" precedence="medium">{CSS_LECCION}</style>
      {ctx.puedeEditar ? <DescripcionEditable c={c} ctx={ctx} /> : <DescripcionLectura c={c} />}
      {ctx.puedeEditar ? <TareaEditable c={c} ctx={ctx} /> : tieneTarea(c) ? <TareaComoLaVeElAlumno c={c} /> : null}
    </div>
  );
}

/**
 * Las URLs con las que el EQUIPO ve los adjuntos de una descripción (firmadas, de vida corta). Una
 * action para todas las que faltan, y cada id se pide UNA vez: las server actions se ENCOLAN, y volver
 * a pedir en cada tecla un id que no se pudo firmar pondría una fila de viajes detrás de cada letra.
 */
function useUrlsDeAdjuntos(html: string) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const pedidos = useRef(new Set<string>());
  useEffect(() => {
    const faltan = refsEnHtml(html).filter((id) => !pedidos.current.has(id));
    if (!faltan.length) return;
    faltan.forEach((id) => pedidos.current.add(id));
    urlsAdjuntosAction(faltan)
      .then((r) => { if (r.ok) setUrls((u) => ({ ...u, ...r.urls })); })
      .catch(() => { /* sin URL la imagen no se dibuja y el chip queda sin link: no se cae nada */ });
  }, [html]);
  return useCallback((ref: string) => urls[idDeRef(ref) ?? ''] ?? null, [urls]);
}

/** La descripción para quien MIRA la tab sin editarla: la rica, o el texto plano en párrafos. */
function DescripcionLectura({ c }: { c: Clase }) {
  const html = c.descripcionHtml?.trim() ? c.descripcionHtml : '';
  const urlDeAdjunto = useUrlsDeAdjuntos(html);
  if (html) return <HtmlSeguro html={html} urlDeAdjunto={urlDeAdjunto} />;
  const texto = c.descripcion.trim();
  return texto ? <>{texto.split(/\n{2,}/).map((p, i) => <p key={i} className="ugc-doc-p">{p}</p>)}</> : null;
}

/**
 * La descripción, editable como un documento (item 17): el editor rico con imágenes, PDF y archivos.
 * Se guarda sola con un respiro; lo que se guarda lo SANEA el server (lista blanca), y los adjuntos van
 * por referencia (`mako-adjunto:<id>`), que cada uno ve con su URL.
 */
function DescripcionEditable({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  const ctxRef = useUltimo(ctx);
  const [html, setHtml] = useState(() => htmlInicialDeDescripcion(c));
  const [estado, setEstado] = useState<EstadoGuardado>('limpio');
  const ultimo = useRef(html);
  // Lo que se considera guardado: lo que se cargó (aunque sea el texto plano convertido, que no se
  // guarda hasta que alguien edite) y después lo último que se MANDÓ y el server aceptó.
  const guardado = useRef(html);
  const timer = useRef<number | undefined>(undefined);
  const claseId = c.id;
  const urlDeAdjunto = useUrlsDeAdjuntos(html);
  const subirAdjunto = useMemo(() => crearSubidorDeAdjuntos(
    { firmar: urlSubidaAdjuntoAction, registrar: registrarAdjuntoAction, subir: subirConProgreso },
    { productoId: ctx.productoId, claseId },
  ), [ctx.productoId, claseId]);

  const guardar = useCallback(async (h: string) => {
    window.clearTimeout(timer.current);
    if (h === guardado.current) { setEstado((e) => (e === 'sucio' ? 'limpio' : e)); return; }
    setEstado('guardando');
    try {
      const r = await guardarCampoClaseAction(claseId, { descripcionHtml: h });
      if (!r.ok) { setEstado('error'); ctxRef.current.avisar(r.error); return; }
      guardado.current = h;
      ctxRef.current.onClase(r.clase);
      setEstado(ultimo.current === h ? 'guardado' : 'sucio');
    } catch {
      setEstado('error');
    }
  }, [claseId, ctxRef]);

  // Ocultar la pestaña manda lo pendiente; desmontarse (otra clase), también.
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden' && ultimo.current !== guardado.current) void guardar(ultimo.current); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, [guardar]);
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    const h = ultimo.current;
    if (h === guardado.current) return;
    void guardarCampoClaseAction(claseId, { descripcionHtml: h })
      .then((r) => { if (r.ok) ctxRef.current.onClase(r.clase); else ctxRef.current.avisar(r.error); })
      .catch(() => {});
  }, [claseId, ctxRef]);

  const cambiar = (h: string) => {
    setHtml(h);
    ultimo.current = h;
    setEstado(h === guardado.current ? 'limpio' : 'sucio');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void guardar(h); }, RESPIRO_DESCRIPCION_MS);
  };

  const texto = textoDeGuardado(estado);
  return (
    <div className="cu-desc">
      <EditorRico valor={html} onCambio={cambiar} subirAdjunto={subirAdjunto} urlDeAdjunto={urlDeAdjunto}
        aceptaArchivos={ACEPTA_ADJUNTO} aceptaImagenes={ACEPTA_IMAGEN_ADJUNTO} minAlto={120}
        placeholder={'Escribe la descripción…'} etiqueta="Descripción de la clase" />
      {texto && <span className={`cu-estado cu-estado--${typeof estado === 'object' ? 'falta' : estado}`} role="status">{texto}</span>}
    </div>
  );
}

/** La tarea como la ve el alumno, para quien mira la tab sin editar: en vista previa, no guarda nada. */
function TareaComoLaVeElAlumno({ c }: { c: Clase }) {
  return (
    <VistaPreviaCtx.Provider value>
      <TareaAlumno token="" claseId={c.id} tarea={c.tarea} campos={c.campos}
        valoresIniciales={{}} estadoInicial="pendiente" onEstado={() => {}} onAvance={() => {}} />
    </VistaPreviaCtx.Provider>
  );
}

/**
 * La tarea, DEBAJO de la descripción (item 16): sin tarea, el botón punteado «Agregar tarea»; con
 * ella, la instrucción, el formulario (`EditorCampos`, con los tipos de la #18) y «Cierra el módulo».
 *
 * ⚠️ UN FORMULARIO A MEDIAS NO SE MANDA: mientras se arma un quiz, cada tecla deja algo incompleto
 *    (una pregunta sin correcta). La pantalla dice qué falta (`faltaEnFormulario`, la regla del
 *    server) y guarda cuando está completo.
 * ⚠️ «CIERRA EL MÓDULO» MIRA LO GUARDADO: antes de prenderla se manda lo pendiente de la tarea, o el
 *    server contestaría que no hay tarea sobre una que se está escribiendo.
 */
function TareaEditable({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  const ctxRef = useUltimo(ctx);
  const claseId = c.id;
  const [tocada, setTocada] = useState(false);
  const [tarea, setTarea] = useState(c.tarea);
  const [campos, setCampos] = useState<Campo[]>(c.campos);
  const [obligatoria, setObligatoria] = useState(c.obligatoria);
  const [estado, setEstado] = useState<EstadoGuardado>('limpio');
  const [ocupado, setOcupado] = useState(false);
  const instruccion = useRef<HTMLTextAreaElement>(null);
  const ultimaTarea = useRef(c.tarea);
  const ultimosCampos = useRef<Campo[]>(c.campos);
  const guardadaTarea = useRef(c.tarea);
  const guardadosCampos = useRef(JSON.stringify(c.campos));
  const timerTarea = useRef<number | undefined>(undefined);
  const timerCampos = useRef<number | undefined>(undefined);

  /** Manda UN cambio. La clase que vuelve trae la marca como quedó (el server la apaga sin tarea). */
  const mandar = useCallback(async (cambio: Cambio): Promise<Clase | null> => {
    setEstado('guardando');
    try {
      const r = await guardarCampoClaseAction(claseId, cambio);
      if (!r.ok) { setEstado('error'); ctxRef.current.avisar(r.error); return null; }
      ctxRef.current.onClase(r.clase);
      setObligatoria(r.clase.obligatoria);
      setEstado('guardado');
      return r.clase;
    } catch {
      setEstado('error');
      return null;
    }
  }, [claseId, ctxRef]);

  const guardarTarea = useCallback(async () => {
    window.clearTimeout(timerTarea.current);
    const t = ultimaTarea.current;
    if (t.trim() === guardadaTarea.current.trim()) return;
    const r = await mandar({ tarea: t });
    if (r) guardadaTarea.current = r.tarea;
  }, [mandar]);

  const guardarCampos = useCallback(async () => {
    window.clearTimeout(timerCampos.current);
    const cs = ultimosCampos.current;
    const firma = JSON.stringify(cs);
    if (firma === guardadosCampos.current) return;
    const falta = faltaEnFormulario(cs);
    if (falta) { setEstado({ falta }); return; }
    // Lo que se compara la próxima vez es lo que se MANDÓ: el server lo sanea (saca renglones vacíos),
    // y esa versión no vuelve al editor mientras se escribe (las listas se editan crudas, ver
    // EditorCampos).
    const r = await mandar({ campos: cs });
    if (r) guardadosCampos.current = firma;
  }, [mandar]);

  // Lo pendiente sale al ocultar la pestaña y al irse de la clase. ⚠️ Al irse se llama a lo ÚLTIMO
  // (`pendientes.current` en la limpieza, a propósito): las dos funciones miran refs, no el render.
  const pendientes = useUltimo({ guardarTarea, guardarCampos });
  useEffect(() => {
    const salir = () => { void pendientes.current.guardarTarea(); void pendientes.current.guardarCampos(); };
    const alOcultar = () => { if (document.visibilityState === 'hidden') salir(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      salir();
    };
  }, [pendientes]);

  // «Agregar tarea» abre la instrucción con el cursor adentro: es lo primero que se escribe.
  useEffect(() => { if (tocada) instruccion.current?.focus(); }, [tocada]);

  const cambiarTarea = (t: string) => {
    setTarea(t);
    ultimaTarea.current = t;
    setEstado('sucio');
    window.clearTimeout(timerTarea.current);
    timerTarea.current = window.setTimeout(() => { void guardarTarea(); }, RESPIRO_TAREA_MS);
  };
  const cambiarCampos = (cs: Campo[]) => {
    setCampos(cs);
    ultimosCampos.current = cs;
    setEstado('sucio');
    window.clearTimeout(timerCampos.current);
    timerCampos.current = window.setTimeout(() => { void guardarCampos(); }, RESPIRO_TAREA_MS);
  };

  const cambiarObligatoria = async (v: boolean) => {
    setOcupado(true);
    await guardarTarea();
    await guardarCampos();
    const antes = obligatoria;
    setObligatoria(v);
    const r = await mandar({ obligatoria: v });
    if (!r) setObligatoria(antes);
    setOcupado(false);
  };

  const quitar = async () => {
    const n = ctx.conAvance;
    const ok = await ctx.confirmar(
      n > 0 ? `Lo que respondieron ${n} ${n === 1 ? 'cliente' : 'clientes'} deja de verse.` : 'La clase queda sin tarea.',
      { titulo: '¿Quitar la tarea?', boton: 'Quitar' },
    );
    if (!ok) return;
    window.clearTimeout(timerTarea.current);
    window.clearTimeout(timerCampos.current);
    setOcupado(true);
    // Se vacía lo que pueda haber en el server: lo que contestó (`c`, de la tab) y lo que se mandó y
    // todavía no volvió. Las server actions se ENCOLAN, así que esto llega después de cualquier
    // guardado en vuelo y no lo puede dejar vivo debajo de una pantalla sin tarea.
    const enElServer = {
      tarea: [c.tarea, guardadaTarea.current, ultimaTarea.current].find((t) => t.trim()) ?? '',
      campos: c.campos.length ? c.campos : ultimosCampos.current,
    };
    for (const cambio of cambiosParaQuitarTarea(enElServer)) {
      if (!(await mandar(cambio))) { setOcupado(false); return; }
    }
    setTarea(''); ultimaTarea.current = ''; guardadaTarea.current = '';
    setCampos([]); ultimosCampos.current = []; guardadosCampos.current = '[]';
    setTocada(false);
    setEstado('limpio');
    setOcupado(false);
  };

  if (!tareaAbierta({ tarea, campos }, tocada)) {
    return (
      <button type="button" className="cu-agregar" onClick={() => setTocada(true)}>+ Agregar tarea</button>
    );
  }
  const conTarea = tieneTarea({ tarea, campos });
  const texto = textoDeGuardado(estado);
  return (
    <section className="cu-tarea" aria-label="Tarea">
      <div className="cu-tarea-cab">
        <span className="cp-eyebrow">Tarea</span>
        {texto && <span className={`cu-estado cu-estado--${typeof estado === 'object' ? 'falta' : estado}`} role="status">{texto}</span>}
        <button type="button" className="cu-quitar" disabled={ocupado} onClick={() => void quitar()}>Quitar</button>
      </div>
      {/* El campo de la casa (`mk-textarea`), escrito acá para poder tomarle el foco. */}
      <textarea ref={instruccion} className="mk-textarea" rows={3} value={tarea} placeholder="Qué tiene que hacer" aria-label="Instrucción de la tarea"
        disabled={ocupado} onChange={(e) => cambiarTarea(e.target.value)} onBlur={() => void guardarTarea()} />
      <EditorCampos campos={campos} onCampos={cambiarCampos} deshabilitado={ocupado} />
      {ofreceCierraModulo(ctx.vinculado) && (
        <Switch checked={obligatoria && conTarea} onChange={(v) => void cambiarObligatoria(v)}
          disabled={ocupado || !conTarea} label="Cierra el módulo" hint={conTarea ? undefined : 'Necesita una tarea.'} />
      )}
    </section>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
// Todo bajo `.ahdoc.ahdoc--ugc .ugc`: la lección vive adentro del dibujo del curso, cuya hoja pone en
// cero el margen y el relleno de todo y deja sin fondo ni borde a todo button (`.ahdoc button`), y con
// esta especificidad se le gana sin `!important`.
// ⚠️ Es un template literal: adentro no va ningún acento grave ni la secuencia de interpolación, ni en
//    un comentario (AGENTS.md). Los cortan en silencio y la lección sale sin estilo.
export const CSS_LECCION = `
.ahdoc.ahdoc--ugc .ugc .cu-papel > * + * { margin-top: 18px; }
.ahdoc.ahdoc--ugc .ugc .cu-desc { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ahdoc.ahdoc--ugc .ugc .cu-estado { align-self: flex-end; font: 600 10.5px/1.3 var(--font-jetbrains), monospace; color: var(--u-ink-60); }
.ahdoc.ahdoc--ugc .ugc .cu-estado--error { color: #b3261e; }
.ahdoc.ahdoc--ugc .ugc .cu-estado--falta { color: #8a5a00; }
.ahdoc.ahdoc--ugc .ugc .cu-agregar {
  display: flex; align-items: center; justify-content: center; width: 100%; min-height: 64px; cursor: pointer;
  border: 2px dashed var(--u-ink-40); border-radius: 12px; background: transparent; color: var(--u-ink);
  font: 700 13px/1 var(--font-jetbrains), monospace;
}
.ahdoc.ahdoc--ugc .ugc .cu-agregar:hover { border-color: var(--u-ink); background: var(--u-card); }
.ahdoc.ahdoc--ugc .ugc .cu-tarea { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding-top: 16px; border-top: 1px dashed var(--u-ink-40); }
.ahdoc.ahdoc--ugc .ugc .cu-tarea-cab { display: flex; align-items: center; gap: 10px; }
.ahdoc.ahdoc--ugc .ugc .cu-tarea-cab .cu-estado { margin-left: auto; align-self: center; }
.ahdoc.ahdoc--ugc .ugc .cu-tarea-cab .cu-estado + .cu-quitar { margin-left: 0; }
.ahdoc.ahdoc--ugc .ugc .cu-quitar {
  margin-left: auto; padding: 5px 9px; border-radius: 7px; cursor: pointer; background: transparent;
  font: 600 11px/1 var(--font-jetbrains), monospace; color: var(--u-ink-60);
}
.ahdoc.ahdoc--ugc .ugc .cu-quitar:hover:not(:disabled) { background: #f6c9c1; color: var(--u-ink); }
.ahdoc.ahdoc--ugc .ugc .cu-quitar:disabled { opacity: .5; cursor: default; }

.ahdoc.ahdoc--ugc .ugc .cu-vacio {
  align-self: stretch; flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; border-radius: 14px; transition: background .12s;
}
.ahdoc.ahdoc--ugc .ugc .cu-vacio.es-encima { background: var(--u-lime-a22); }
.ahdoc.ahdoc--ugc .ugc .cu-vacio-t { font-weight: 800; font-size: 20px; letter-spacing: -.01em; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-fila { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; width: 100%; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-barra .cu-vid-fila { justify-content: flex-start; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-input {
  flex: 1 1 220px; min-width: 0; max-width: 420px; min-height: 36px; padding: 0 12px;
  border: 2px solid var(--u-ink); border-radius: 9px; background: var(--u-card); color: var(--u-ink);
  font: 500 13px/1 var(--font-jetbrains), monospace;
}
.ahdoc.ahdoc--ugc .ugc .cu-vid-archivo { position: relative; cursor: pointer; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-archivo input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-archivo:focus-within { outline: 3px solid var(--u-lime); outline-offset: 2px; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-archivo[aria-disabled="true"] { opacity: .5; cursor: default; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-nota { font: 600 10.5px/1.4 var(--font-jetbrains), monospace; color: var(--u-ink-60); }
.ahdoc.ahdoc--ugc .ugc .cu-vid-error { margin: 0; font-size: 12.5px; font-weight: 600; color: #b3261e; }
.ahdoc.ahdoc--ugc .ugc .cu-barra {
  position: relative; flex: 1 1 200px; max-width: 360px; height: 10px; overflow: hidden;
  border: 1.5px solid var(--u-ink); border-radius: 999px; background: var(--u-card);
}
.ahdoc.ahdoc--ugc .ugc .cu-barra > span { position: absolute; left: 0; top: 0; bottom: 0; background: var(--u-lime); transition: width .2s ease; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; width: 100%; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-acciones { display: inline-flex; gap: 8px; margin-left: auto; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-barra .ugc-btn:disabled, .ahdoc.ahdoc--ugc .ugc .cu-vid-fila .ugc-btn:disabled { opacity: .5; cursor: default; }

.ahdoc.ahdoc--ugc .ugc .cu-ficha { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; justify-content: space-between; }
.ahdoc.ahdoc--ugc .ugc .cu-ficha-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 12.5px; color: var(--u-ink-60); }
.ahdoc.ahdoc--ugc .ugc .cu-tenue { opacity: .7; }
.ahdoc.ahdoc--ugc .ugc .cu-chip { padding: 4px 9px; border-radius: 999px; background: var(--u-lime); color: var(--u-ink); font: 700 10.5px/1.2 var(--font-jetbrains), monospace; }
.ahdoc.ahdoc--ugc .ugc .cu-min-et { display: inline-flex; align-items: center; gap: 6px; }
.ahdoc.ahdoc--ugc .ugc .cu-min {
  width: 64px; min-height: 32px; padding: 0 8px; border: 1.5px solid var(--u-ink-40); border-radius: 8px;
  background: var(--u-card); color: var(--u-ink); font: 600 12px/1 var(--font-jetbrains), monospace;
}
`;
