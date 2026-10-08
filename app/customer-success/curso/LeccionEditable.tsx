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
// Y los ajustes del 08/10/2026 (los de la lección), textuales:
//   «11. Elimina la opción de "Subir vídeo", solo mediante link. Y por lo tanto elimina el botón, todo
//        el placeholder de "Agregar vídeo" debería ser el botón que me abra la opción de colocar el link.
//    12. Elimina lo de "Concepto" etc... Y los minutos, eso debería tomarlo automáticamente el tiempo
//        del vídeo.
//    13. Lo de "Texto al costado / Texto abajo" debería estar dentro del recuadro de la descripción y
//        la tarea, arriba de todo, arriba de la descripción.
//     9. No se entiende el botón de "Cierra módulo".
//    18. Te falta el botón de arrepentimiento para muchas acciones, el de 5 segundos de "Deshacer".»
// (El formulario de la tarea —la pregunta como título, el texto de ejemplo, arrastrar, «Nuevo campo»,
// la comunidad— vive en ./EditorCampos.tsx.)
//
// Lo que arma `leccionDelEditor(c, ctx)`, el `LeccionUgc` que dibuja app/_cursos/CursoUgc.tsx (que es
// el MISMO dibujo que ve el alumno: lo que se edita acá se ve igual en su portal):
//   · `video`         el reproductor, y abajo «Cambiar link» y «Quitar» (quien edita);
//   · `sinVideo`      el recuadro punteado «Agregar video»: el recuadro ENTERO es el botón, y abre el
//                     campo para pegar el link (YouTube, Vimeo, Loom, Drive). Sin subir archivos.
//   · `debajoDelVideo` lo que hay que decir del video (los minutos, que salen solos; un link de afuera);
//   · `papel`         arriba el interruptor «Texto al costado / Texto abajo» (lo trae el dibujo), la
//                     DESCRIPCIÓN (el editor rico, con adjuntos) y DEBAJO la TAREA (la instrucción, el
//                     formulario, «Obligatoria para avanzar» y «Una respuesta por área»), o el botón
//                     punteado «Agregar tarea».
// El título se edita con un clic en el propio dibujo (`TextoEditable`, `edicion.onTexto`).
//
// ⚠️ CADA PARTE GUARDA LO SUYO, con `guardarCampoClaseAction` (un `update` de SUS columnas, nunca la
//    fila): la descripción con un respiro después de la última tecla, la tarea al dejar de escribir.
//    Un guardado de la fila armada en el navegador pisaría lo que otra parte guardó un segundo antes
//    (lib/curso-admin.ts, «la lección que se edita en su lugar»).
// ⚠️ LO ESCRITO VIVE EN ESTADO LOCAL Y NO SE RESIEMBRA DE LAS PROPS, a propósito (AGENTS.md: «un
//    useState sembrado de props no se resiembra»): la lección se monta con `key` = la clase
//    (CursoUgc), así que cambiar de clase la remonta; y adentro de la misma clase, lo que vuelve del
//    server es lo SANEADO, que no puede volver al editor mientras alguien escribe (el cursor saltaría).
// ⚠️ SALIR NO PIERDE LO ESCRITO: al desmontarse (otra clase, otro módulo) y al ocultarse la pestaña, lo
//    pendiente se manda en el acto. Lo que NO cubre: cerrar el navegador dentro del respiro (una server
//    action no sobrevive a la pestaña, y no hay `sendBeacon` para ellas).
// ⚠️ «DESHACER» ESCRIBE EN EL SERVER (AGENTS.md: revertir sólo la pantalla miente hasta el F5): vuelve a
//    llamar al MISMO camino con lo de antes. Y funciona aunque ya te hayas ido de la clase: si la lección
//    sigue montada pone lo de antes en pantalla, y si no, escribe directo y la tab recibe la clase.
// ⚠️ NADA DE MODALES PROPIOS ACÁ ADENTRO: la hoja del curso deja sin fondo ni borde a todo `button` de
//    `.ahdoc`, y un `Modal` de la app no se portalea. Las confirmaciones y el aviso de «Deshacer» los
//    dibuja la tab, afuera del curso (`ctx.confirmar`, `ctx.deshacer`).
// ⚠️ TEXTO DE PANTALLA CORTO y en voz neutra (lo arma el equipo, pero el guard de voseo mira todo).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Campo, Clase } from '@/lib/curso';
import { reproductorDeClase, tieneTarea } from '@/lib/curso';
import type { LeccionUgc } from '@/app/_cursos/tipos';
import { Switch } from '@/app/_ui';
import EditorRico from '@/app/_ui/EditorRico';
import { HtmlSeguro, idDeRef, refsEnHtml } from '@/app/_ui/HtmlSeguro';
import { ACEPTA_ADJUNTO, ACEPTA_IMAGEN_ADJUNTO, crearSubidorDeAdjuntos } from '@/lib/curso-adjuntos-reglas';
import Reproductor from '@/app/compartido/curso/[token]/Reproductor';
import TareaAlumno from '@/app/compartido/curso/[token]/TareaAlumno';
import { VistaPreviaCtx } from '@/app/compartido/curso/[token]/vista-previa';
import { opcionesComunidadAction, urlVerVideoAction } from './actions';
import { urlSubidaAdjuntoAction, registrarAdjuntoAction, urlsAdjuntosAction } from './adjuntos-actions';
import { guardarCampoClaseAction } from './modulos-actions';
import { subirConProgreso } from './subir-video';
import { EditorCampos, type MotivoCampos } from './EditorCampos';
import { videoDeClase } from './reglas';
import {
  AVISO_DESHACER, AYUDA_OBLIGATORIA, AYUDA_POR_AREA, RESPIRO_DESCRIPCION_MS, RESPIRO_TAREA_MS, ROTULO_OBLIGATORIA,
  ROTULO_POR_AREA, cambiosParaQuitarTarea, faltaEnFormulario, htmlInicialDeDescripcion, linkDeVideo, lugarDelVideo,
  minutosDeDuracion, oembedDeLoom, ofreceCierraModulo, ofrecePorArea, tareaAbierta, textoDeGuardado,
  type EstadoGuardado, type LugarDelVideo, type OpcionesComunidad,
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
  /** ¿El módulo de la clase es una etapa del kanban? «Obligatoria para avanzar» sólo ahí. */
  vinculado: boolean;
  /** Cuántos clientes ya tienen avance en la clase. */
  conAvance: number;
  /**
   * ¿El curso les pide a sus clientes sus ÁREAS (alguna clase del producto tiene el campo de áreas)? Sin
   * eso, «Una respuesta por área» no se ofrece (`ofrecePorArea`): no cambiaría nada.
   */
  cursoPideAreas?: boolean;
  /** La clase como quedó en el server, para que la tab la tenga (las tarjetas, la vista del alumno). */
  onClase: (c: Clase) => void;
  /** Un aviso corto de algo que no salió (el toast de la tab). */
  avisar: (texto: string) => void;
  /** Una pregunta antes de algo que no se deshace. La dibuja la tab, afuera del curso (ver la cabecera). */
  confirmar: (mensaje: string, o: { titulo: string; boton: string }) => Promise<boolean>;
  /**
   * El aviso de 5 segundos con «Deshacer» (item 18): el Toast de la tab, afuera del curso. Sin esto no se
   * ofrece (un «Deshacer» que no deshace nada es peor que no ofrecerlo).
   */
  deshacer?: (texto: string, onDeshacer: () => void) => void;
};

/**
 * La lección de una clase para la tab Curso. Se llama en cada render (CursoUgc, `leccion`): no usa
 * hooks, arma las piezas que sí los usan.
 */
export function leccionDelEditor(c: Clase, ctx: CtxLeccion): LeccionUgc {
  const lugar = lugarDelVideo(c);
  return {
    video: lugar === 'marco'
      ? { cuerpo: <VideoDeClase clase={c} ctx={ctx} />, barra: ctx.puedeEditar ? <ControlesDelVideo key={claveDeVideo(c)} c={c} ctx={ctx} /> : undefined }
      : undefined,
    sinVideo: lugar === 'vacio' && ctx.puedeEditar ? <AgregarVideo c={c} ctx={ctx} /> : undefined,
    debajoDelVideo: hayFicha(c, ctx, lugar) ? <FichaDeLaClase c={c} ctx={ctx} lugar={lugar} /> : undefined,
    // Como función: el dibujo le pasa el interruptor de la disposición, que va ADENTRO del papel (item 13).
    papel: (arriba) => <PapelDelEditor c={c} ctx={ctx} arriba={arriba} />,
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

/** ¿Sigue montado? Para un «Deshacer» que llega cuando quizás ya te fuiste de la clase. */
function useMontado() {
  const r = useRef(true);
  useEffect(() => { r.current = true; return () => { r.current = false; }; }, []);
  return r;
}

/**
 * Escribe UNA parte con su action y devuelve la clase como quedó (o `null`, con el aviso). La usan los
 * «Deshacer», que corren cuando la pieza que los ofreció puede ya no estar en pantalla.
 */
async function escribir(claseId: number, cambio: Cambio, ctx: { current: CtxLeccion }): Promise<Clase | null> {
  try {
    const r = await guardarCampoClaseAction(claseId, cambio);
    if (!r.ok) { ctx.current.avisar(r.error); return null; }
    return r.clase;
  } catch {
    ctx.current.avisar('No se pudo deshacer.');
    return null;
  }
}

// ── El video ─────────────────────────────────────────────────────────────────

/**
 * Los minutos de la clase, SOLOS (item 12): cuando el reproductor sabe cuánto dura el video (YouTube,
 * Vimeo, un archivo) o lo dice el oEmbed de Loom, y no coinciden con los guardados, se guardan. UNA vez
 * por video: volver a la clase no vuelve a escribir. Sólo quien edita: alguien del equipo que mira no
 * escribe nada. Drive no lo dice: ahí no hay minutos (y no se muestra nada).
 */
function useMinutosDelVideo(c: Clase, ctx: CtxLeccion) {
  const ctxRef = useUltimo(ctx);
  const hecho = useRef<string | null>(null);
  const clave = claveDeVideo(c);
  const { id, minutos } = c;
  return useCallback((seg: number) => {
    const min = minutosDeDuracion(seg);
    if (!ctxRef.current.puedeEditar || min == null || hecho.current === clave) return;
    hecho.current = clave;
    if (min === minutos) return;
    void guardarCampoClaseAction(id, { minutos: min })
      .then((r) => { if (r.ok) ctxRef.current.onClase(r.clase); })
      .catch(() => { /* sin minutos no se cae nada: la próxima vez que se abra se vuelve a intentar */ });
  }, [id, minutos, clave, ctxRef]);
}

/**
 * El video de la clase, con el MISMO reproductor del portal en modo vista previa (no manda avance:
 * no hay alumno). Un video SUBIDO (de antes del 08/10/2026) no tiene link público: se pide uno firmado
 * de vida corta (`urlVerVideoAction`, que alcanza con poder mirar la tab).
 */
function VideoDeClase({ clase, ctx }: { clase: Clase; ctx: CtxLeccion }) {
  const { video } = reproductorDeClase(clase);
  const [firmada, setFirmada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alDurar = useMinutosDelVideo(clase, ctx);
  const path = video?.tipo === 'archivo' ? clase.videoPath : null;
  useEffect(() => {
    if (!path) return;
    let vivo = true;
    urlVerVideoAction(path)
      .then((r) => { if (vivo) { if (r.ok) setFirmada(r.url); else setError(r.error); } })
      .catch(() => { if (vivo) setError('No pude abrir el video.'); });
    return () => { vivo = false; };
  }, [path]);
  // Loom va en un iframe que no dice cuánto dura: lo dice su oEmbed (con CORS abierto, medido).
  const loom = video?.tipo === 'iframe' ? oembedDeLoom(clase.videoUrl) : null;
  useEffect(() => {
    if (!loom || !ctx.puedeEditar) return;
    let vivo = true;
    fetch(loom, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { duration?: unknown } | null) => { if (vivo && typeof j?.duration === 'number') alDurar(j.duration); })
      .catch(() => { /* sin duración, sin minutos */ });
    return () => { vivo = false; };
  }, [loom, ctx.puedeEditar, alDurar]);
  if (!video) return null;
  if (video.tipo === 'archivo') {
    if (error) return <p className="cp-nota" style={{ padding: 16, color: '#fff' }}>{error}</p>;
    if (!firmada) return null;
    return (
      <VistaPreviaCtx.Provider value>
        <Reproductor token="" claseId={clase.id} video={{ tipo: 'directo', url: firmada }} titulo={clase.titulo} onPct={() => {}} onDuracion={alDurar} />
      </VistaPreviaCtx.Provider>
    );
  }
  return (
    <VistaPreviaCtx.Provider value>
      <Reproductor token="" claseId={clase.id} video={video} titulo={clase.titulo} onPct={() => {}} onDuracion={alDurar} />
    </VistaPreviaCtx.Provider>
  );
}

/**
 * Poner, cambiar o quitar el video de una clase: SÓLO POR LINK (item 11). Lo usan el recuadro de
 * «Agregar video» y los controles de un video puesto: es UNA regla para los dos caminos.
 *
 * ⚠️ QUITAR UN LINK SE DESHACE (item 18): vuelve el mismo link y sus minutos. Un video SUBIDO de antes
 *    no: el server borra el archivo del bucket al quitarlo (`guardarCampoClase`), así que ahí se pregunta
 *    antes y no hay «Deshacer» que mienta.
 */
function useCambioDeVideo(c: Clase, ctx: CtxLeccion) {
  const ctxRef = useUltimo(ctx);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

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

  const quitar = async () => {
    const antes = { url: c.videoTipo !== 'archivo' ? c.videoUrl : null, minutos: c.minutos };
    setOcupado(true);
    setError(null);
    const clase = await guardar({ video: null });
    setOcupado(false);
    if (!clase) return;
    ctxRef.current.onClase(clase);
    const url = antes.url;
    if (!url) return;
    ctxRef.current.deshacer?.(AVISO_DESHACER.video, () => {
      void (async () => {
        let x = await escribir(c.id, { video: { tipo: 'url', url } }, ctxRef);
        // El server vacía los minutos al cambiar el video (son del video de antes): vuelven los suyos.
        if (x && antes.minutos != null) x = (await escribir(c.id, { minutos: antes.minutos }, ctxRef)) ?? x;
        if (x) ctxRef.current.onClase(x);
      })();
    });
  };

  return { error, ocupado, usarLink, quitar, limpiar: () => setError(null) };
}

type CambioDeVideo = ReturnType<typeof useCambioDeVideo>;

/** El campo para pegar el link, con «Usar» y «Cancelar». El foco va al campo: es lo único que hay para hacer. */
function FormLink({ v, onListo, onCancelar }: { v: CambioDeVideo; onListo: () => void; onCancelar: () => void }) {
  const [link, setLink] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { campo.current?.focus(); }, []);
  return (
    <form className="cu-vid-fila" onSubmit={(e) => {
      e.preventDefault();
      void v.usarLink(link).then((ok) => { if (ok) { setLink(''); onListo(); } });
    }}>
      <input ref={campo} className="cu-vid-input" type="url" inputMode="url" value={link} placeholder="https://"
        aria-label="Link del video" disabled={v.ocupado} onChange={(e) => { setLink(e.target.value); v.limpiar(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancelar(); } }} />
      <button type="submit" className="ugc-btn primary" disabled={v.ocupado}>Usar</button>
      <button type="button" className="ugc-btn" disabled={v.ocupado} onClick={() => { v.limpiar(); onCancelar(); }}>Cancelar</button>
    </form>
  );
}

/**
 * El recuadro de «Agregar video» (`LeccionUgc.sinVideo`). EL RECUADRO ENTERO ES EL BOTÓN (item 11): un
 * clic en cualquier parte abre el campo para pegar el link, ahí mismo.
 */
function AgregarVideo({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  const v = useCambioDeVideo(c, ctx);
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" className="cu-vacio-boton" onClick={() => { v.limpiar(); setAbierto(true); }}>
        <span className="cu-vacio-mas" aria-hidden>+</span>
        <span className="cu-vacio-t">Agregar video</span>
        <span className="cu-vid-nota">YouTube, Vimeo, Loom o Drive</span>
      </button>
    );
  }
  return (
    <div className="cu-vacio">
      <span className="cu-vacio-t">Pega el link del video</span>
      <FormLink v={v} onListo={() => setAbierto(false)} onCancelar={() => setAbierto(false)} />
      <span className="cu-vid-nota">YouTube, Vimeo, Loom o Drive</span>
      {v.error && <p className="cu-vid-error" role="alert">{v.error}</p>}
    </div>
  );
}

/** Lo que dice el video puesto y sus dos acciones: «Cambiar link» y «Quitar». */
function ControlesDelVideo({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  const v = useCambioDeVideo(c, ctx);
  const [cambiando, setCambiando] = useState(false);
  const info = videoDeClase(c);
  if (cambiando) {
    return (
      <div className="cu-vid-barra">
        <FormLink v={v} onListo={() => setCambiando(false)} onCancelar={() => setCambiando(false)} />
        {v.error && <p className="cu-vid-error" role="alert">{v.error}</p>}
      </div>
    );
  }
  const quitar = async () => {
    // Un archivo subido se BORRA del bucket (`guardarCampoClase`): no hay vuelta atrás, y se dice antes.
    // Un link se quita en el acto y se ofrece «Deshacer».
    if (c.videoTipo === 'archivo' && !(await ctx.confirmar('El archivo se borra.', { titulo: '¿Quitar el video?', boton: 'Quitar' }))) return;
    await v.quitar();
  };
  return (
    <div className="cu-vid-barra">
      <span className={`cu-vid-nota${info.medible ? '' : ' cu-tenue'}`}>{info.rotulo}{info.medible ? '' : ' · sin medir'}</span>
      <span className="cu-vid-acciones">
        <button type="button" className="ugc-btn" disabled={v.ocupado} onClick={() => { v.limpiar(); setCambiando(true); }}>Cambiar link</button>
        <button type="button" className="ugc-btn" disabled={v.ocupado} onClick={() => void quitar()}>Quitar</button>
      </span>
      {v.error && <p className="cu-vid-error" role="alert">{v.error}</p>}
    </div>
  );
}

// ── Debajo del video: los minutos y un link de afuera ────────────────────────

/** ¿Hay algo que decir debajo del video? Sin nada, no se dibuja el hueco (un margen vacío). */
function hayFicha(c: Clase, ctx: CtxLeccion, lugar: LugarDelVideo): boolean {
  return lugar === 'afuera' || c.minutos != null || (lugar === 'marco' && !ctx.puedeEditar)
    || (c.obligatoria && tieneTarea(c) && ctx.vinculado);
}

/**
 * Debajo del video. ⚠️ SIN «Concepto» Y SIN MINUTOS A MANO desde el 08/10/2026 (item 12): el tipo de la
 * clase sigue en la base con su valor y salió de la pantalla; los minutos salen solos del video
 * (`useMinutosDelVideo`) y acá sólo se leen. Un link que no se reproduce adentro (`afuera`) va acá.
 */
function FichaDeLaClase({ c, ctx, lugar }: { c: Clase; ctx: CtxLeccion; lugar: LugarDelVideo }) {
  const v = videoDeClase(c);
  return (
    <div className="cu-ficha">
      <span className="cu-ficha-meta">
        {c.minutos != null && <span>{c.minutos} min</span>}
        {/* Con el video en el marco, quien edita lo lee en la franja de abajo del video. */}
        {(lugar === 'afuera' || (lugar === 'marco' && !ctx.puedeEditar)) && (
          <span className={v.medible ? '' : 'cu-tenue'}>{v.rotulo}{v.medible ? '' : ' · sin medir'}</span>
        )}
        {c.obligatoria && tieneTarea(c) && ctx.vinculado && <span className="cu-chip">Obligatoria</span>}
      </span>
      {lugar === 'afuera' && <VideoDeClase clase={c} ctx={ctx} />}
      {lugar === 'afuera' && ctx.puedeEditar && <ControlesDelVideo key={claveDeVideo(c)} c={c} ctx={ctx} />}
    </div>
  );
}

// ── El papel: la disposición, la descripción y debajo la tarea ───────────────

/**
 * El papel de la lección: arriba de todo el interruptor de la disposición (lo trae el dibujo, item 13),
 * después la descripción y DEBAJO la tarea, siempre juntas (item 14): el mismo orden que en el portal.
 */
function PapelDelEditor({ c, ctx, arriba }: { c: Clase; ctx: CtxLeccion; arriba: ReactNode }) {
  return (
    <div className="ugc-paper cu-papel">
      {/* React 19 sube esta hoja al <head> UNA vez (la deduplica por `href`). */}
      <style href="cu-leccion" precedence="medium">{CSS_LECCION}</style>
      {arriba != null && <div className="cu-papel-dispo" data-recorrido="leccion-disposicion">{arriba}</div>}
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
    <div className="cu-desc" data-recorrido="leccion-descripcion">
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
 * ella, la instrucción, el formulario (`EditorCampos`), «Obligatoria para avanzar» y, si el curso pide
 * áreas, «Una respuesta por área».
 *
 * ⚠️ UN FORMULARIO A MEDIAS NO SE MANDA: mientras se arma un quiz, cada tecla deja algo incompleto
 *    (una pregunta sin correcta). La pantalla dice qué falta (`faltaEnFormulario`, la regla del
 *    server) y guarda cuando está completo.
 * ⚠️ «OBLIGATORIA PARA AVANZAR» MIRA LO GUARDADO: antes de prenderla se manda lo pendiente de la tarea, o
 *    el server contestaría que no hay tarea sobre una que se está escribiendo.
 * ⚠️ QUITAR LA TAREA, BORRAR Y MOVER UN CAMPO SE DESHACEN (item 18), y por eso quitar ya no pregunta: lo
 *    que contestaron los clientes no se borra (cuelga del id de cada campo), y «Deshacer» devuelve los
 *    mismos campos, así que vuelve a verse. Preguntar antes de algo que se deshace es fricción de más
 *    (app/_ui/Toast.tsx).
 */
function TareaEditable({ c, ctx }: { c: Clase; ctx: CtxLeccion }) {
  const ctxRef = useUltimo(ctx);
  const montado = useMontado();
  const claseId = c.id;
  const [tocada, setTocada] = useState(false);
  const [tarea, setTarea] = useState(c.tarea);
  const [campos, setCampos] = useState<Campo[]>(c.campos);
  const [obligatoria, setObligatoria] = useState(c.obligatoria);
  const [porArea, setPorArea] = useState(c.porArea === true);
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
  const ponerCampos = (cs: Campo[]) => {
    setCampos(cs);
    ultimosCampos.current = cs;
    setEstado('sucio');
    window.clearTimeout(timerCampos.current);
    timerCampos.current = window.setTimeout(() => { void guardarCampos(); }, RESPIRO_TAREA_MS);
  };

  /**
   * Vuelve a una lista de campos de ANTES («Deshacer» de borrar o mover). Con la lección en pantalla, la
   * pone y la guarda en el acto; si ya te fuiste de la clase, la escribe directo.
   */
  const volverCampos = (antes: Campo[]) => {
    if (montado.current) { ponerCampos(antes); void guardarCampos(); return; }
    void escribir(claseId, { campos: antes }, ctxRef).then((x) => { if (x) ctxRef.current.onClase(x); });
  };

  const cambiarCampos = (cs: Campo[], motivo?: MotivoCampos) => {
    const antes = ultimosCampos.current;
    ponerCampos(cs);
    // Borrar, mover, cambiar el tipo o quitar una pregunta con algo escrito (los dos últimos, revisión
    // final del 08/10/2026): todo lo que se deshace vuelve a la lista de antes. «nuevo» sólo enfoca.
    const aviso = motivo && motivo !== 'nuevo' ? AVISO_DESHACER[motivo] : null;
    if (aviso) ctxRef.current.deshacer?.(aviso, () => volverCampos(antes));
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

  const cambiarPorArea = async (v: boolean) => {
    const antes = porArea;
    setPorArea(v);
    const r = await mandar({ porArea: v });
    if (!r) setPorArea(antes);
    else setPorArea(r.porArea === true);
  };

  /**
   * Quita la tarea (la instrucción y el formulario). ⚠️ Se vacía lo que pueda haber en el server: lo que
   * contestó (`c`, de la tab) y lo que se mandó y todavía no volvió. Las server actions se ENCOLAN, así
   * que esto llega después de cualquier guardado en vuelo y no lo puede dejar vivo debajo de una pantalla
   * sin tarea.
   */
  const quitar = async () => {
    window.clearTimeout(timerTarea.current);
    window.clearTimeout(timerCampos.current);
    const foto = {
      tarea: [ultimaTarea.current, guardadaTarea.current, c.tarea].find((t) => t.trim()) ?? '',
      campos: ultimosCampos.current.length ? ultimosCampos.current : c.campos,
      obligatoria,
    };
    setOcupado(true);
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
    ctxRef.current.deshacer?.(AVISO_DESHACER.tarea, () => { void volverTarea(foto); });
  };

  /** «Deshacer» de quitar la tarea: vuelven la instrucción, los MISMOS campos (con sus ids) y la marca. */
  const volverTarea = async (foto: { tarea: string; campos: Campo[]; obligatoria: boolean }) => {
    // En orden, y se corta en el primero que falle (su aviso ya salió): la marca necesita la tarea puesta.
    const pasos: Cambio[] = [
      ...(foto.tarea.trim() ? [{ tarea: foto.tarea }] : []),
      ...(foto.campos.length ? [{ campos: foto.campos }] : []),
      ...(foto.obligatoria ? [{ obligatoria: true }] : []),
    ];
    let x: Clase | null = null;
    for (const p of pasos) {
      const r = await escribir(claseId, p, ctxRef);
      if (!r) break;
      x = r;
    }
    if (!x) return;
    ctxRef.current.onClase(x);
    if (!montado.current) return;
    setTarea(x.tarea); ultimaTarea.current = x.tarea; guardadaTarea.current = x.tarea;
    setCampos(x.campos); ultimosCampos.current = x.campos; guardadosCampos.current = JSON.stringify(x.campos);
    setObligatoria(x.obligatoria);
    setEstado('limpio');
  };

  if (!tareaAbierta({ tarea, campos }, tocada)) {
    return (
      <button type="button" className="cu-agregar" data-recorrido="leccion-tarea" onClick={() => setTocada(true)}>+ Agregar tarea</button>
    );
  }
  const conTarea = tieneTarea({ tarea, campos });
  const texto = textoDeGuardado(estado);
  return (
    <section className="cu-tarea" aria-label="Tarea" data-recorrido="leccion-tarea">
      <div className="cu-tarea-cab">
        <span className="cp-eyebrow">Tarea</span>
        {texto && <span className={`cu-estado cu-estado--${typeof estado === 'object' ? 'falta' : estado}`} role="status">{texto}</span>}
        <button type="button" className="cu-quitar" disabled={ocupado} onClick={() => void quitar()}>Quitar</button>
      </div>
      {/* El campo de la casa (`mk-textarea`), escrito acá para poder tomarle el foco. */}
      <textarea ref={instruccion} className="mk-textarea" rows={3} value={tarea} placeholder="Qué tiene que hacer" aria-label="Instrucción de la tarea"
        disabled={ocupado} onChange={(e) => cambiarTarea(e.target.value)} onBlur={() => void guardarTarea()} />
      <EditorCampos campos={campos} onCampos={cambiarCampos} deshabilitado={ocupado} cargarComunidad={cargarComunidadDe(ctx.productoId)} />
      {/* «Cierra el módulo» no se entendía (item 9): el rótulo dice qué ES y la línea, qué PASA. */}
      {ofreceCierraModulo(ctx.vinculado) && (
        <div className="cu-marca" data-recorrido="leccion-obligatoria">
          <Switch checked={obligatoria && conTarea} onChange={(v) => void cambiarObligatoria(v)}
            disabled={ocupado || !conTarea} label={ROTULO_OBLIGATORIA} hint={conTarea ? AYUDA_OBLIGATORIA : 'Necesita una tarea.'} />
        </div>
      )}
      {/* «Por área» vivía en el menú de la clase y no se entendía (item 15): acá, al lado de lo que cambia. */}
      {ofrecePorArea(ctx.cursoPideAreas === true, porArea) && (
        <div className="cu-marca">
          <Switch checked={porArea} onChange={(v) => void cambiarPorArea(v)} disabled={ocupado}
            label={ROTULO_POR_AREA} hint={AYUDA_POR_AREA} />
        </div>
      )}
    </section>
  );
}

/**
 * Lo que hay en la comunidad del producto, para armar un campo «Publicar» / «Comentar». UNA función por
 * producto (estable entre renders): el formulario la pide una vez.
 */
const cargadores = new Map<number, () => Promise<OpcionesComunidad | null>>();
function cargarComunidadDe(productoId: number): () => Promise<OpcionesComunidad | null> {
  let f = cargadores.get(productoId);
  if (!f) {
    f = async () => {
      const r = await opcionesComunidadAction(productoId);
      return r.ok ? { categorias: r.categorias, posts: r.posts } : null;
    };
    cargadores.set(productoId, f);
  }
  return f;
}

// ── Estilos ──────────────────────────────────────────────────────────────────
// Todo bajo `.ahdoc.ahdoc--ugc .ugc`: la lección vive adentro del dibujo del curso, cuya hoja pone en
// cero el margen y el relleno de todo y deja sin fondo ni borde a todo button (`.ahdoc button`), y con
// esta especificidad se le gana sin `!important`.
// ⚠️ Es un template literal: adentro no va ningún acento grave ni la secuencia de interpolación, ni en
//    un comentario (AGENTS.md). Los cortan en silencio y la lección sale sin estilo.
export const CSS_LECCION = `
.ahdoc.ahdoc--ugc .ugc .cu-papel > * + * { margin-top: 18px; }
.ahdoc.ahdoc--ugc .ugc .cu-papel-dispo { display: flex; justify-content: flex-end; }
/* En el telefono la leccion va siempre apilada y el interruptor se esconde (app/_cursos/estilos.ts, max-width
   760px). Su caja tambien: vacia dejaba un hueco arriba de la descripcion, y el recorrido de la clase la
   contaba como presente y senalaba una caja de alto cero (revision final del 08/10/2026). */
@media (max-width: 760px) { .ahdoc.ahdoc--ugc .ugc .cu-papel-dispo { display: none; } }
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
.ahdoc.ahdoc--ugc .ugc .cu-marca { padding: 2px 0; }

.ahdoc.ahdoc--ugc .ugc .cu-vacio {
  align-self: stretch; flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; border-radius: 14px;
}
.ahdoc.ahdoc--ugc .ugc .cu-vacio-boton {
  position: absolute; inset: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 18px; border-radius: 16px; cursor: pointer; background: transparent; color: var(--u-ink);
  font: inherit; text-align: center; transition: background .12s;
}
.ahdoc.ahdoc--ugc .ugc .cu-vacio-boton:hover { background: var(--u-lime-a22); }
.ahdoc.ahdoc--ugc .ugc .cu-vacio-boton:focus-visible { outline: 3px solid var(--u-lime); outline-offset: -3px; }
.ahdoc.ahdoc--ugc .ugc .cu-vacio-mas {
  display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%;
  border: 2px solid var(--u-ink); background: var(--u-card); font: 800 24px/1 var(--font-jetbrains), monospace;
}
.ahdoc.ahdoc--ugc .ugc .cu-vacio-t { font-weight: 800; font-size: 20px; letter-spacing: -.01em; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-fila { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; width: 100%; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-barra .cu-vid-fila { justify-content: flex-start; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-input {
  flex: 1 1 220px; min-width: 0; max-width: 420px; min-height: 36px; padding: 0 12px;
  border: 2px solid var(--u-ink); border-radius: 9px; background: var(--u-card); color: var(--u-ink);
  font: 500 13px/1 var(--font-jetbrains), monospace;
}
.ahdoc.ahdoc--ugc .ugc .cu-vid-nota { font: 600 10.5px/1.4 var(--font-jetbrains), monospace; color: var(--u-ink-60); }
.ahdoc.ahdoc--ugc .ugc .cu-vid-error { margin: 0; font-size: 12.5px; font-weight: 600; color: #b3261e; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; width: 100%; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-acciones { display: inline-flex; gap: 8px; margin-left: auto; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-barra .ugc-btn:disabled, .ahdoc.ahdoc--ugc .ugc .cu-vid-fila .ugc-btn:disabled { opacity: .5; cursor: default; }

.ahdoc.ahdoc--ugc .ugc .cu-ficha { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; justify-content: space-between; }
.ahdoc.ahdoc--ugc .ugc .cu-ficha-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 12.5px; color: var(--u-ink-60); }
.ahdoc.ahdoc--ugc .ugc .cu-tenue { opacity: .7; }
.ahdoc.ahdoc--ugc .ugc .cu-chip { padding: 4px 9px; border-radius: 999px; background: var(--u-lime); color: var(--u-ink); font: 700 10.5px/1.2 var(--font-jetbrains), monospace; }
`;
