'use client';

// =============================================================================
// ComentariosClase — los comentarios de UNA clase, debajo de la lección
// =============================================================================
// Item 13 del audio del 08/10/2026 (docs/feedback-curso-08oct.md, minuto 15:00): «Algo que falta
// dentro de las clases, tal vez estaría bueno, es agregar si el usuario quiere agregar un apartado de
// chat, que a veces muchas plataformas tienen, entonces vos puedes chatear acerca de esa clase».
//
// Lo montan las DOS pantallas del curso en el hueco `despues` de la lección (app/_cursos/tipos.ts,
// «a lo ancho, debajo de las dos columnas»): el portal del alumno (app/compartido/curso/[token]/
// PortalAlumno.tsx, con `apiDelAlumno`) y la tab Curso del equipo (app/customer-success/curso/CursoApp.tsx,
// con `apiDelEquipo`). Sólo si el curso tiene prendido «Comentarios en las clases» (el menú de la marca,
// lib/curso-estilo.ts); y aun montado, el que decide si se ve y se escribe es el server
// (lib/comunidad-datos.ts, `claseParaComentar`: la clase se le abre a ESE alumno y es de ESE producto).
//
// ⚠️ NO ES UN CHAT NUEVO: es el hilo de un post de la comunidad del producto (mig 0227), así que cada
//    comentario suma puntos, avisa en la campana, se modera y se ve también en la tab Comunidad
//    (`?post=`). Por eso habla con la MISMA API que la comunidad (app/_comunidad/api.ts).
//
// ⚠️ ADENTRO DEL CURSO, Y ESO DECIDE TRES COSAS:
//    · los estilos van con `.ahdoc .ugc` delante: la hoja del curso le saca el relleno a todo (`.ahdoc *`)
//      y el fondo y el borde a cada `button` (`.ahdoc button`), y su `.ugc-paper` deja el texto sin poder
//      seleccionarse (`user-select: none`);
//    · NADA DE `Modal` NI `Confirm`: adentro del curso no se portalean y sus botones salen sin piel
//      (hallazgos-customer-success, tanda 2). Borrar pregunta en la misma línea;
//    · los botones son los del curso (`ugc-btn`), así el hilo se lee como parte de la clase.
//
// ⚠️ SIN @MENCIONES CON SUGERENCIAS: el campo de la comunidad (CampoMenciones) cuelga del contexto de
//    <Comunidad>, que acá no existe. Responder avisa igual a quien se le contestó (`avisosDeComentario`);
//    editar conserva las menciones que el comentario ya tenía, si su nombre sigue en el texto.
//
// Texto de pantalla corto y en TÚ: lo lee el alumno de un negocio mexicano.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiComunidad } from '@/app/_comunidad/api';
import type { ComentarioVista, HiloClaseVista, MiembroVista } from '@/lib/comunidad-tipos';
import { TOPE_COMENTARIO, haceCuanto, mencionesDeTokens, nombraA, type TokenTexto } from '@/lib/comunidad-reglas';

/** Cuánto queda a la vista un aviso de la línea de estado (no hay toast adentro del curso). */
const AVISO_MS = 4000;

export function ComentariosClase({ api, claseId, linkComunidad, vistaPrevia = false }: {
  /** El camino al server (el del alumno o el del equipo). Sin los métodos de la clase, no se dibuja. */
  api: ApiComunidad | null;
  claseId: number;
  /** Sólo el equipo: el link a la tab Comunidad con el hilo abierto (`/customer-success/comunidad?post=`). */
  linkComunidad?: (postId: number) => string;
  /** La vista previa del equipo: sin alumno detrás no se lee ni se escribe nada. */
  vistaPrevia?: boolean;
}) {
  const [hilo, setHilo] = useState<HiloClaseVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // ⚠️ EL RELOJ ARRANCA EN `null` Y SE PRENDE AL MONTAR: un «hace 3 min» calculado en el server y otro
  //    acá no coinciden al hidratar (la misma regla que <Comunidad>).
  const [ahora, setAhora] = useState<number | null>(null);
  const timerAviso = useRef<number | undefined>(undefined);

  const avisar = useCallback((t: string) => {
    setAviso(t);
    window.clearTimeout(timerAviso.current);
    timerAviso.current = window.setTimeout(() => setAviso(null), AVISO_MS);
  }, []);

  useEffect(() => {
    const primera = window.setTimeout(() => setAhora(Date.now()), 0);
    const t = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => { window.clearTimeout(primera); window.clearInterval(t); window.clearTimeout(timerAviso.current); };
  }, []);

  useEffect(() => {
    if (vistaPrevia || !api?.hiloClase) return;
    let vivo = true;
    void api.hiloClase(claseId).then((r) => {
      if (!vivo) return;
      if (r.ok) setHilo(r.hilo); else setError(r.error);
    });
    return () => { vivo = false; };
  }, [api, claseId, vistaPrevia]);

  if (vistaPrevia) {
    return (
      <Caja n={null} acciones={null}>
        <p className="ccl-vacio">En la vista previa no se comenta.</p>
      </Caja>
    );
  }
  if (!api?.hiloClase || !api.comentarClase) return null;
  if (error) return <Caja n={null} acciones={null}><p className="ccl-mal" role="alert">{error}</p></Caja>;
  // Un «Cargando…» escrito no es un loader (AGENTS.md): va el giro.
  if (!hilo) return <Caja n={null} acciones={null}><span className="ccl-giro" role="status" aria-label="Cargando los comentarios" /></Caja>;

  const cambiarHilo = (f: (h: ComentarioVista[]) => ComentarioVista[]) => setHilo((x) => (x ? { ...x, hilo: f(x.hilo) } : x));
  const reemplazar = (id: number, f: (c: ComentarioVista) => ComentarioVista) => cambiarHilo((h) => h.map((r) => (r.id === id
    ? f(r)
    : { ...r, respuestas: r.respuestas.map((x) => (x.id === id ? f(x) : x)) })));
  const quitar = (id: number) => cambiarHilo((h) => h.filter((r) => r.id !== id).map((r) => ({ ...r, respuestas: r.respuestas.filter((x) => x.id !== id) })));
  const agregar = (c: ComentarioVista) => cambiarHilo((h) => (c.padreId == null
    ? [...h, c]
    : h.map((r) => (r.id === c.padreId ? { ...r, respuestas: [...r.respuestas, c] } : r))));

  /** El primer comentario de la clase crea el hilo, y quien lo crea lo sigue (lo hace el server). */
  const comentarPrimerNivel = async (texto: string): Promise<boolean> => {
    const r = await api.comentarClase!(claseId, { cuerpo: texto, menciones: [], responderA: null });
    if (!r.ok) { avisar(r.error); return false; }
    setHilo((x) => (x ? { ...x, postId: r.postId, sigo: x.postId == null ? true : x.sigo, hilo: [...x.hilo, r.comentario] } : x));
    return true;
  };
  const responder = async (texto: string, a: number): Promise<boolean> => {
    if (hilo.postId == null) return false;
    const r = await api.comentar(hilo.postId, { cuerpo: texto, menciones: [], responderA: a });
    if (!r.ok) { avisar(r.error); return false; }
    agregar(r.comentario);
    return true;
  };
  const seguir = async () => {
    if (hilo.postId == null) return;
    const si = !hilo.sigo;
    setHilo((x) => (x ? { ...x, sigo: si } : x));
    const r = await api.seguirPost(hilo.postId, si);
    if (!r.ok) { setHilo((x) => (x ? { ...x, sigo: !si } : x)); avisar(r.error); return; }
    avisar(si ? 'Siguiendo' : 'Ya no lo sigues');
  };
  const cerrar = async () => {
    if (hilo.postId == null || !api.cerrarComentarios) return;
    const r = await api.cerrarComentarios(hilo.postId, !hilo.cerrado);
    if (!r.ok) { avisar(r.error); return; }
    setHilo((x) => (x ? { ...x, cerrado: r.cerrado } : x));
    avisar(r.cerrado ? 'Comentarios cerrados' : 'Comentarios abiertos');
  };

  const total = hilo.hilo.reduce((n, c) => n + 1 + c.respuestas.length, 0);
  const acciones = hilo.postId != null ? (
    <>
      <button type="button" className="ccl-link" aria-pressed={hilo.sigo} onClick={() => void seguir()}
        title={hilo.sigo ? 'Te avisamos de los comentarios nuevos' : 'Avisarme de los comentarios nuevos'}>
        {hilo.sigo ? 'Siguiendo' : 'Seguir'}
      </button>
      {hilo.puedoModerar && api.cerrarComentarios && (
        <button type="button" className="ccl-link" onClick={() => void cerrar()}>{hilo.cerrado ? 'Abrir comentarios' : 'Cerrar comentarios'}</button>
      )}
      {linkComunidad && <a className="ccl-link" href={linkComunidad(hilo.postId)}>Ver en Comunidad</a>}
    </>
  ) : null;

  return (
    <Caja n={total} acciones={acciones}>
      {hilo.cerrado
        ? <p className="ccl-vacio">Comentarios cerrados.</p>
        : <Escribir yo={hilo.yo} placeholder="Escribe un comentario" boton="Comentar" onEnviar={comentarPrimerNivel} />}
      {total === 0 && !hilo.cerrado && <p className="ccl-vacio">Todavía no hay comentarios.</p>}
      <ul className="ccl-lista">
        {hilo.hilo.map((c) => (
          <Comentario key={c.id} c={c} api={api} ahora={ahora} cerrado={hilo.cerrado} avisar={avisar}
            onCambio={(f) => reemplazar(c.id, f)} onBorrado={quitar} onCambioRespuesta={reemplazar}
            yo={hilo.yo} onResponder={(t) => responder(t, c.id)} />
        ))}
      </ul>
      {aviso && <p className="ccl-aviso" role="status">{aviso}</p>}
    </Caja>
  );
}

/** El recuadro, con su título y la cuenta. Lleva los estilos (van adentro del curso: ver la cabecera). */
function Caja({ n, acciones, children }: { n: number | null; acciones: ReactNode; children: ReactNode }) {
  return (
    <section className="ccl" aria-label="Comentarios de la clase">
      <style dangerouslySetInnerHTML={{ __html: CSS_COMENTARIOS }} />
      <header className="ccl-cab">
        <h2 className="ccl-tit">Comentarios{n != null && n > 0 ? <span className="ccl-n">{n}</span> : null}</h2>
        {acciones && <span className="ccl-cab-acc">{acciones}</span>}
      </header>
      {children}
    </section>
  );
}

const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

function Cara({ m, chica = false }: { m: Pick<MiembroVista, 'nombre' | 'foto'>; chica?: boolean }) {
  const [rota, setRota] = useState(false);
  const t = chica ? 28 : 34;
  return m.foto && !rota
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="ccl-cara" src={m.foto} alt="" width={t} height={t} referrerPolicy="no-referrer" onError={() => setRota(true)} style={{ width: t, height: t }} />
    : <span className="ccl-cara ccl-cara--ini" aria-hidden style={{ width: t, height: t, fontSize: Math.round(t * 0.38) }}>{iniciales(m.nombre)}</span>;
}

/** Un cuerpo ya partido (texto, links, menciones). NUNCA HTML: cada pedazo es texto de React. */
function Texto({ tokens }: { tokens: readonly TokenTexto[] }) {
  return (
    <p className="ccl-texto">
      {tokens.map((t, i) => (t.tipo === 'link'
        ? <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow">{t.texto}</a>
        : t.tipo === 'mencion' ? <b key={i}>{t.texto}</b> : <span key={i}>{t.texto}</span>))}
    </p>
  );
}

/** El campo de escribir, con su cara. Ctrl+Enter (o Cmd+Enter) manda. */
function Escribir({ yo, placeholder, boton, onEnviar, onCancelar, autoFocus = false }: {
  yo: MiembroVista; placeholder: string; boton: string;
  /** `true` = salió (el campo se vacía). */
  onEnviar: (texto: string) => Promise<boolean>;
  onCancelar?: () => void;
  autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const ok = await onEnviar(texto);
    setEnviando(false);
    if (ok) setTexto('');
  };
  return (
    <div className="ccl-escribir">
      <Cara m={yo} chica={!!onCancelar} />
      <div className="ccl-escribir-col">
        <textarea className="ccl-campo" value={texto} placeholder={placeholder} aria-label={placeholder} rows={2}
          maxLength={TOPE_COMENTARIO} autoFocus={autoFocus} disabled={enviando}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void enviar(); } }} />
        {(texto.trim() || onCancelar) && (
          <div className="ccl-escribir-pie">
            {onCancelar && <button type="button" className="ccl-link" onClick={onCancelar}>No responder</button>}
            <button type="button" className="ugc-btn primary" disabled={!texto.trim() || enviando} onClick={() => void enviar()}>
              {enviando ? 'Enviando…' : boton}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Comentario({ c, api, ahora, cerrado, avisar, onCambio, onBorrado, onCambioRespuesta, yo, onResponder, chico = false }: {
  c: ComentarioVista;
  api: ApiComunidad;
  ahora: number | null;
  cerrado: boolean;
  avisar: (t: string) => void;
  onCambio: (f: (c: ComentarioVista) => ComentarioVista) => void;
  onBorrado: (id: number) => void;
  onCambioRespuesta: (id: number, f: (c: ComentarioVista) => ComentarioVista) => void;
  yo: MiembroVista;
  /** Contestar en el hilo de ESTE comentario (sólo los de primer nivel lo reciben; ver abajo). */
  onResponder?: (texto: string) => Promise<boolean>;
  chico?: boolean;
}) {
  const [respondiendo, setRespondiendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(c.texto);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [likeando, setLikeando] = useState(false);

  const like = async () => {
    if (!c.puedoLikear || likeando) return;
    const si = !c.meGusta;
    const antes = { likes: c.likes, meGusta: c.meGusta };
    onCambio((x) => ({ ...x, likes: Math.max(0, x.likes + (si ? 1 : -1)), meGusta: si }));
    setLikeando(true);
    const r = await api.like(`c:${c.id}`, si);
    setLikeando(false);
    if (r.ok) onCambio((x) => ({ ...x, likes: r.likes, meGusta: r.meGusta }));
    else { onCambio((x) => ({ ...x, ...antes })); avisar(r.error); }
  };
  const guardar = async () => {
    if (!texto.trim() || guardando) return;
    setGuardando(true);
    // Las menciones que el comentario YA tenía siguen si su nombre sigue en el texto (como en la comunidad).
    const menciones = mencionesDeTokens(c.cuerpo).filter((m) => nombraA(texto, m.nombre)).map((m) => m.clave);
    const r = await api.editarComentario(c.id, { cuerpo: texto, menciones, responderA: null });
    setGuardando(false);
    if (!r.ok) { avisar(r.error); return; }
    onCambio((x) => ({ ...x, cuerpo: r.cuerpo, texto: r.texto, editado: true }));
    setEditando(false);
  };
  const borrar = async () => {
    const r = await api.borrarComentario(c.id);
    setBorrando(false);
    if (!r.ok) { avisar(r.error); return; }
    onBorrado(c.id);
  };

  // DOS NIVELES, como la comunidad (`padreDeRespuesta` en el server): se responde a un comentario de
  // PRIMER nivel y la respuesta cuelga de él. Por eso «Responder» y su campo viven sólo en el de primer
  // nivel (las respuestas no reciben `onResponder`).
  return (
    <li className={`ccl-com${chico ? ' ccl-com--resp' : ''}`}>
      <Cara m={c.autor} chica={chico} />
      <div className="ccl-com-cuerpo">
        <div className="ccl-com-cab">
          <b className="ccl-nombre">{c.autor.nombre}</b>
          {c.autor.equipo && <span className="ccl-tag">Equipo</span>}
          {ahora != null && <span className="ccl-meta">{haceCuanto(c.creado, ahora)}{c.editado ? ' · editado' : ''}</span>}
        </div>
        {editando ? (
          <div className="ccl-escribir-col">
            <textarea className="ccl-campo" value={texto} aria-label="Editar comentario" rows={2} maxLength={TOPE_COMENTARIO}
              autoFocus disabled={guardando} onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void guardar(); } }} />
            <div className="ccl-escribir-pie">
              <button type="button" className="ccl-link" onClick={() => { setEditando(false); setTexto(c.texto); }}>No guardar</button>
              <button type="button" className="ugc-btn primary" disabled={!texto.trim() || guardando} onClick={() => void guardar()}>Guardar</button>
            </div>
          </div>
        ) : <Texto tokens={c.cuerpo} />}
        <div className="ccl-acc">
          <button type="button" className="ccl-link" aria-pressed={c.meGusta} disabled={!c.puedoLikear || likeando}
            title={c.puedoLikear ? (c.meGusta ? 'Quitar like' : 'Me gusta') : 'Es tuyo'} onClick={() => void like()}>
            {c.meGusta ? '♥' : '♡'} {c.likes}
          </button>
          {!cerrado && onResponder && <button type="button" className="ccl-link" onClick={() => setRespondiendo(true)}>Responder</button>}
          {!editando && c.puedoEditar && <button type="button" className="ccl-link" onClick={() => { setTexto(c.texto); setEditando(true); }}>Editar</button>}
          {c.puedoBorrar && (borrando ? (
            <span className="ccl-confirma">
              {c.respuestas.length ? '¿Con sus respuestas?' : '¿Borrar?'}
              <button type="button" className="ccl-link ccl-link--mal" onClick={() => void borrar()}>Borrar</button>
              <button type="button" className="ccl-link" onClick={() => setBorrando(false)}>No</button>
            </span>
          ) : <button type="button" className="ccl-link" onClick={() => setBorrando(true)}>Borrar</button>)}
        </div>
        {(c.respuestas.length > 0 || respondiendo) && (
          <ul className="ccl-lista ccl-lista--resp">
            {c.respuestas.map((x) => (
              <Comentario key={x.id} c={x} api={api} ahora={ahora} cerrado={cerrado} avisar={avisar} chico
                onCambio={(f) => onCambioRespuesta(x.id, f)} onBorrado={onBorrado} onCambioRespuesta={onCambioRespuesta} yo={yo} />
            ))}
            {respondiendo && !cerrado && onResponder && (
              <li className="ccl-com ccl-com--resp ccl-com--campo">
                <Escribir yo={yo} placeholder="Tu respuesta" boton="Responder" autoFocus
                  onCancelar={() => setRespondiendo(false)}
                  onEnviar={async (t) => { const ok = await onResponder(t); if (ok) setRespondiendo(false); return ok; }} />
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad (AGENTS.md).
// Todo con «.ahdoc .ugc» delante: la hoja del curso resetea márgenes, rellenos, fondos y bordes de lo que
// esté adentro (ver la cabecera), y una regla de menos peso pierde en silencio.
const CSS_COMENTARIOS = `
.ahdoc .ugc .ccl{ margin:28px 0 8px; background:#fff; border:2px solid var(--u-ink); border-radius:14px;
  box-shadow:var(--u-sh-md); padding:20px 22px; display:flex; flex-direction:column; gap:14px; user-select:text; }
.ahdoc .ugc .ccl-cab{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.ahdoc .ugc .ccl-tit{ font-size:18px; font-weight:800; letter-spacing:-0.01em; margin:0; display:flex; align-items:center; gap:8px; }
.ahdoc .ugc .ccl-n{ font-size:12px; font-weight:700; padding:2px 8px; border-radius:999px; background:var(--u-lime); border:1.5px solid var(--u-ink); }
.ahdoc .ugc .ccl-cab-acc{ display:inline-flex; align-items:center; gap:12px; flex-wrap:wrap; }
.ahdoc .ugc .ccl-link{ font-size:12.5px; font-weight:600; color:var(--u-ink-60); text-decoration:underline; text-underline-offset:2px; cursor:pointer; padding:2px 0; }
.ahdoc .ugc .ccl-link:hover{ color:var(--u-ink); }
.ahdoc .ugc .ccl-link[aria-pressed="true"]{ color:var(--u-ink); }
.ahdoc .ugc .ccl-link:disabled{ opacity:.5; cursor:default; text-decoration:none; }
.ahdoc .ugc .ccl-link--mal{ color:#b42318; }
.ahdoc .ugc .ccl-lista{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:14px; }
.ahdoc .ugc .ccl-lista--resp{ margin-top:10px; gap:10px; }
.ahdoc .ugc .ccl-com{ display:flex; gap:10px; align-items:flex-start; min-width:0; }
.ahdoc .ugc .ccl-com-cuerpo{ flex:1; min-width:0; }
.ahdoc .ugc .ccl-com-cab{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.ahdoc .ugc .ccl-nombre{ font-size:13.5px; font-weight:700; }
.ahdoc .ugc .ccl-tag{ font-size:10.5px; font-weight:700; padding:1px 7px; border-radius:999px; background:var(--u-lime-soft); border:1px solid var(--u-ink); }
.ahdoc .ugc .ccl-meta{ font-size:12px; color:var(--u-ink-60); }
.ahdoc .ugc .ccl-texto{ margin:4px 0 0; font-size:14px; line-height:1.5; white-space:pre-wrap; overflow-wrap:anywhere; }
.ahdoc .ugc .ccl-texto a{ text-decoration:underline; }
.ahdoc .ugc .ccl-acc{ display:flex; align-items:center; gap:14px; margin-top:6px; flex-wrap:wrap; }
.ahdoc .ugc .ccl-confirma{ display:inline-flex; align-items:center; gap:8px; font-size:12.5px; }
.ahdoc .ugc .ccl-cara{ flex:none; border-radius:999px; border:1.5px solid var(--u-ink); object-fit:cover; background:var(--u-card-2); }
.ahdoc .ugc .ccl-cara--ini{ display:inline-grid; place-items:center; font-weight:700; }
.ahdoc .ugc .ccl-escribir{ display:flex; gap:10px; align-items:flex-start; }
.ahdoc .ugc .ccl-escribir-col{ flex:1; min-width:0; display:flex; flex-direction:column; gap:8px; }
.ahdoc .ugc .ccl-campo{ width:100%; resize:vertical; min-height:56px; padding:9px 11px; border:1.5px solid var(--u-ink);
  border-radius:10px; font:inherit; font-size:14px; line-height:1.45; background:var(--u-card); color:var(--u-ink); }
.ahdoc .ugc .ccl-campo:focus{ outline:2px solid var(--u-lime); outline-offset:1px; }
.ahdoc .ugc .ccl-escribir-pie{ display:flex; justify-content:flex-end; align-items:center; gap:12px; }
.ahdoc .ugc .ccl-vacio{ margin:0; font-size:13px; color:var(--u-ink-60); }
.ahdoc .ugc .ccl-mal{ margin:0; font-size:13px; color:#b42318; }
.ahdoc .ugc .ccl-aviso{ margin:0; font-size:12.5px; font-weight:600; }
.ahdoc .ugc .ccl-giro{ display:inline-block; width:18px; height:18px; border:2px solid var(--u-line); border-top-color:var(--u-ink);
  border-radius:999px; animation:ccl-giro .8s linear infinite; }
@keyframes ccl-giro{ to{ transform:rotate(360deg); } }
@media (max-width: 640px){ .ahdoc .ugc .ccl{ padding:16px 14px; } }
`;
