'use client';

// =============================================================================
// PanelDiagnostico — el diagnóstico de una landing, a la DERECHA del Panel (tanda 2, T2 y T5)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2), textual:
//   2. «"Diagnóstico" no debería ser otra ruta, debería abrirse ahí a la derecha.»
//   7. «… que al analizar una landing sea como un "tutorial" de los que tenemos en MaKo, que se ponga
//      opaco y señale el lugar donde se esta haciendo el comentario, y luego que queden guardados todos
//      los comentarios y sugerencias y claro, la opción de solucionarlo allí mismo con IA.»
//   8. «También si traigo una landing de afuera, tiene que funcionar el paso anterior, se tiene que
//      previsualizar y comenzar con los "comentarios"... Y me gustaría si es una landing de afuera tener
//      la opción de replicarla con nuestro editor.»
//
//   <PanelDiagnostico docId={12} onCerrar={…} />                 una landing NUESTRA
//   <PanelDiagnostico url="https://su-landing.com" onCerrar={…} /> una de AFUERA
//
// Lo monta el Panel (Inicio.tsx) en su área principal, adentro de `.gma .gp` (de ahí salen los botones
// y los menús de Gamma: CSS_GP). Arriba, el veredicto y las acciones; a la izquierda, la VISTA de la
// landing (VistaNuestra: el render público en el mismo documento; VistaAfuera: el HTML bajado en un
// iframe aislado); a la derecha, la LISTA de los comentarios guardados (Comentario.tsx). Al terminar un
// análisis arranca el RECORRIDO (RecorridoDiagnostico.tsx) por los pendientes, de arriba hacia abajo de
// la página; «Ver recorrido» lo vuelve a abrir y «Ver» de una fila lo abre desde ahí.
//
// Lo que no se ve en el código:
//   · ABRIR NO ANALIZA SI YA HAY COMENTARIOS GUARDADOS: el análisis cuesta una llamada a la IA (con las
//     keys del negocio) y tarda. Sin nada guardado, arranca solo — para eso se eligió «Diagnóstico».
//   · «Solucionar con IA» abre la landing DE NUEVO antes de pedir (la versión y la sección de ahora, no
//     las del momento en que se abrió el panel), guarda una versión «Antes de un cambio de IA» antes de
//     aplicar (D8) y guarda con la versión que abrió: si alguien guardó en el medio, lo dice y no pisa.
//   · «Replicar en el editor» crea una landing NUEVA, así que se navega DURO (AGENTS.md, «si lo que
//     cambió es QUÉ EXISTE…»), con el `?ws=`.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link, { useWs } from '@/app/_ui/Link';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { htmlDePagina } from '@/lib/editor-landing/render';
import { temaPorId, urlFuentes } from '@/lib/editor-landing/temas';
import { docPagina, tarjetasDe } from '@/lib/editor-landing/doc';
import { formatoDe, proporcionDe, type LandingCompleta, type TemaPropio } from '@/lib/editor-landing/api-tipos';
import {
  instruccionDeSugerencia, objetivoDe, ordenarParaRecorrido, paginaPrincipal, tarjetaDeRecorrido,
  type EstadoSugerencia, type PedidoDiagnostico, type RespuestaDiagnostico, type RespuestaListaDiagnostico, type Sugerencia,
} from '@/lib/editor-landing/diagnostico';
import type { RespuestaReplicar } from '@/lib/editor-landing/replicar-reglas';
import { MOTIVO_ANTES_DE_IA, anclasResueltas, huella, idDe, planDeAplicacion } from '../editor/diff-tarjetas';
import { PLAZO_IA_MS, pedirDocs, pedirIA, postJson, type FallaPedido } from '../cliente';
import { Filtros, Ico, ItemMenu, MenuFlotante, irDuro, useAviso } from '../MiniaturaLanding';
import { RecorridoDiagnostico, type PasoDiagnostico } from './RecorridoDiagnostico';
import { VistaNuestra } from './VistaNuestra';
import { VistaAfuera } from './VistaAfuera';
import { Comentario, type EstadoArreglo } from './Comentario';
import type { ControlVista, ObjetivoVista } from './vista';

type Props = {
  docId?: number;
  url?: string;
  onCerrar: () => void;
  /** Una página de AFUERA se acaba de analizar (la URL que contestó el server): el Panel la suma a su barra sin recargar. */
  onAnalizada?: (url: string) => void;
};

/** El análisis piensa y una página de afuera además se baja: el plazo de la ruta (300 s) y un margen. */
const PLAZO_ANALISIS_MS = 305_000;
/** Cuánto se espera a que la vista ubique los comentarios antes de abrir el recorrido solo. */
const ESPERA_RECORRIDO_MS = 1_200;

const pedirDiagnostico = (cuerpo: PedidoDiagnostico, ms = 65_000) =>
  postJson<RespuestaDiagnostico>('/api/landing-generator/diagnostico', cuerpo, ms);

const esLista = (r: RespuestaDiagnostico | FallaPedido): r is RespuestaListaDiagnostico => r.ok && 'sugerencias' in r;

function hostDe(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}

/** El panel. Se remonta entero al cambiar de landing (`key`): ningún estado de la anterior sobrevive. */
export default function PanelDiagnostico(props: Props) {
  const clave = props.docId != null ? `d${props.docId}` : `u${props.url ?? ''}`;
  return <PanelInterno key={clave} {...props} />;
}

function PanelInterno({ docId, url, onCerrar, onAnalizada }: Props) {
  const ws = useWs();
  const deNuestra = docId != null;
  const objetivo = useMemo(() => (deNuestra ? { docId } : { url: url ?? '' }), [deNuestra, docId, url]);

  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [resumen, setResumen] = useState<RespuestaListaDiagnostico['resumen']>(null);
  const [cargando, setCargando] = useState(true);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pegable, setPegable] = useState(false);
  const [pegado, setPegado] = useState('');
  const [doc, setDoc] = useState<LandingCompleta | null>(null);
  const [temas, setTemas] = useState<TemaPropio[]>([]);
  const [filtro, setFiltro] = useState<EstadoSugerencia>('pendiente');
  const [activa, setActiva] = useState<number | null>(null);
  // Sube cuando la vista vuelve a ubicar los comentarios (la lista repinta «Sin ubicar»). El movimiento
  // de la vista NO pasa por acá: va por `senal`, sin redibujar el panel (ver EVENTO_MOVIO en ./vista).
  const [, setUbicadas] = useState(0);
  const senal = useMemo(() => new EventTarget(), []);
  const [arreglos, setArreglos] = useState<Record<number, EstadoArreglo | undefined>>({});
  const [recorrido, setRecorrido] = useState<{ abierto: boolean; desde: number; pasos: PasoDiagnostico[] }>({ abierto: false, desde: 0, pasos: [] });
  const [quiereRecorrido, setQuiereRecorrido] = useState(false);
  const [menuReplicar, setMenuReplicar] = useState<HTMLElement | null>(null);
  const [replicando, setReplicando] = useState(false);
  const controlRef = useRef<ControlVista | null>(null);
  const { avisar, nodo: aviso } = useAviso();

  const aplicarLista = useCallback((r: RespuestaListaDiagnostico) => {
    setSugerencias(r.sugerencias);
    if (r.resumen) setResumen(r.resumen);
  }, []);

  const analizar = useCallback(async (texto?: string) => {
    setAnalizando(true);
    setError(null);
    setPegable(false);
    const r = await pedirDiagnostico({ accion: 'analizar', ...objetivo, ...(texto ? { texto } : {}) }, PLAZO_ANALISIS_MS);
    setAnalizando(false);
    if (!esLista(r)) {
      const f = r as { error?: string; pegable?: boolean };
      setError(f.error ?? 'No se pudo analizar.');
      setPegable(f.pegable === true);
      return;
    }
    aplicarLista(r);
    if (!deNuestra && r.url) onAnalizada?.(r.url);
    setFiltro('pendiente');
    avisar(r.nuevas ? (r.nuevas === 1 ? '1 comentario nuevo' : `${r.nuevas} comentarios nuevos`) : 'Sin comentarios nuevos');
    if (r.sugerencias.some((s) => s.estado === 'pendiente')) setQuiereRecorrido(true);
  }, [objetivo, aplicarLista, avisar, deNuestra, onAnalizada]);

  // Al abrir: lo guardado (y la landing, si es nuestra). Sin nada guardado, analiza solo.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [lista, abierta, propios] = await Promise.all([
        pedirDiagnostico({ accion: 'listar', ...objetivo }),
        deNuestra && docId != null ? pedirDocs({ accion: 'abrir', id: docId }) : Promise.resolve(null),
        deNuestra ? pedirDocs({ accion: 'temas' }) : Promise.resolve(null),
      ]);
      if (!vivo) return;
      if (abierta && abierta.ok) setDoc(abierta.doc);
      if (propios && propios.ok) setTemas(propios.temas);
      setCargando(false);
      if (!esLista(lista)) { setError((lista as { error?: string }).error ?? 'No se pudo abrir.'); return; }
      if (abierta && !abierta.ok) { setError(abierta.error); return; }
      aplicarLista(lista);
      if (!lista.sugerencias.length && !lista.resumen) void analizar();
    })();
    return () => { vivo = false; };
    // Una vez por landing: el panel se remonta al cambiar (`key` en PanelDiagnostico).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── La vista ───────────────────────────────────────────────────────────────
  const tema = useMemo(() => (doc ? temaPorId(doc.config.tema, temas) : null), [doc, temas]);
  const pagina = useMemo(() => (doc ? paginaPrincipal(doc.contenido) : null), [doc]);
  const html = useMemo(() => (doc && tema && pagina ? htmlDePagina(pagina, doc.config, tema, { modo: 'exportar' }) : ''), [doc, tema, pagina]);
  const objetivos = useMemo<ObjetivoVista[]>(() => sugerencias.map((s) => ({ id: s.id, cita: s.cita, seccionId: s.seccionId })), [sugerencias]);
  // La URL normalizada como la del server (sin query, sin www): el iframe se pide UNA vez, con la misma
  // dirección que la llave de los comentarios y de landing_analyses.
  const urlVista = useMemo(() => { const o = url ? objetivoDe({ url }) : null; return o && 'url' in o ? o.url : null; }, [url]);
  const onUbicar = useCallback(() => setUbicadas((t) => t + 1), []);

  // ── El recorrido ───────────────────────────────────────────────────────────
  const pendientes = useMemo(() => sugerencias.filter((s) => s.estado === 'pendiente'), [sugerencias]);
  const abrirRecorrido = useCallback((desdeId?: number) => {
    const ctl = controlRef.current;
    const elegida = desdeId != null ? sugerencias.find((s) => s.id === desdeId) : undefined;
    // «Ver» de uno que ya no está pendiente: sólo ése.
    const base = elegida && elegida.estado !== 'pendiente' ? [elegida] : pendientes;
    const orden = ordenarParaRecorrido(base, (id) => ctl?.posicion(id) ?? null);
    const pasos = orden.map((s) => ({ id: s.id, severidad: s.hallazgo.severidad, ...tarjetaDeRecorrido(s.hallazgo) }));
    if (!pasos.length) return;
    const desde = desdeId != null ? Math.max(0, pasos.findIndex((p) => p.id === desdeId)) : 0;
    setRecorrido({ abierto: true, desde, pasos });
  }, [sugerencias, pendientes]);

  // Recién analizada: el recorrido arranca solo cuando la vista tuvo un momento para ubicar las citas.
  useEffect(() => {
    if (!quiereRecorrido) return;
    const t = setTimeout(() => { setQuiereRecorrido(false); abrirRecorrido(); }, ESPERA_RECORRIDO_MS);
    return () => clearTimeout(t);
  }, [quiereRecorrido, abrirRecorrido]);

  const irA = useCallback((id: number) => controlRef.current?.ir(id) ?? Promise.resolve(null), []);
  const cajaDe = useCallback((id: number) => controlRef.current?.caja(id) ?? null, []);
  const cerrarRecorrido = useCallback(() => setRecorrido((r) => ({ ...r, abierto: false })), []);

  // ── Estados ────────────────────────────────────────────────────────────────
  // El tipo va escrito: el «Deshacer» del aviso se llama a sí mismo, y sin la anotación el tipo de la
  // función dependería de sí mismo.
  const cambiarEstado: (s: Sugerencia, estado: EstadoSugerencia) => Promise<void> = useCallback(async (s: Sugerencia, estado: EstadoSugerencia) => {
    const antes = s.estado;
    setSugerencias((xs) => xs.map((x) => (x.id === s.id ? { ...x, estado } : x)));
    const r = await pedirDiagnostico({ accion: 'estado', id: s.id, estado });
    if (!r.ok || !('sugerencia' in r)) {
      setSugerencias((xs) => xs.map((x) => (x.id === s.id ? { ...x, estado: antes } : x)));
      avisar('No se pudo guardar');
      return;
    }
    setSugerencias((xs) => xs.map((x) => (x.id === s.id ? r.sugerencia : x)));
    if (estado !== 'pendiente') avisar(estado === 'resuelta' ? 'Marcada como resuelta' : 'Comentario descartado', () => void cambiarEstado({ ...s, estado }, antes));
  }, [avisar]);

  // ── Solucionar con IA (una landing nuestra) ──────────────────────────────────
  const ponerArreglo = (id: number, a: EstadoArreglo | undefined) => setArreglos((m) => ({ ...m, [id]: a }));

  const solucionar = useCallback(async (s: Sugerencia) => {
    if (docId == null || !s.seccionId) return;
    ponerArreglo(s.id, { fase: 'pidiendo' });
    const a = await pedirDocs({ accion: 'abrir', id: docId });
    if (!a.ok) { ponerArreglo(s.id, { fase: 'error', error: a.error }); return; }
    setDoc(a.doc);
    const pag = paginaPrincipal(a.doc.contenido);
    const todas = pag ? tarjetasDe(pag) : [];
    const original = todas.find((t) => idDe(t) === s.seccionId);
    if (!pag || !original) { ponerArreglo(s.id, { fase: 'error', error: 'Esa sección ya no está.' }); return; }
    const r = await pedirIA({
      accion: 'editar',
      instruccion: instruccionDeSugerencia(s.hallazgo),
      tarjetas: [original],
      alcance: 'seccion',
      params: { formato: formatoDe(a.doc.config) },
    });
    if (!r.ok) { ponerArreglo(s.id, { fase: 'error', error: r.error }); return; }
    if (!('tarjetas' in r) || !r.tarjetas.length) { ponerArreglo(s.id, { fase: 'error', error: 'MaKo no propuso cambios.' }); return; }
    ponerArreglo(s.id, { fase: 'revision', original, propuestas: anclasResueltas(r.tarjetas, [original], todas) });
  }, [docId]);

  /**
   * Aceptar: se abre la landing OTRA VEZ y la propuesta se aplica sobre lo que hay AHORA (otra
   * propuesta aceptada en el medio no se pisa). Si ESA sección cambió desde que se pidió, no se aplica:
   * la propuesta se escribió sobre otro texto. Antes de guardar, la versión «Antes de un cambio de IA».
   */
  const aceptar = useCallback(async (s: Sugerencia) => {
    const st = arreglos[s.id];
    if (docId == null || !st || st.fase !== 'revision') return;
    const fallar = (error: string) => ponerArreglo(s.id, { fase: 'error', error });
    ponerArreglo(s.id, { ...st, fase: 'aplicando' });
    const a = await pedirDocs({ accion: 'abrir', id: docId });
    if (!a.ok) { fallar(a.error); return; }
    const idSeccion = idDe(st.original);
    const pag = a.doc.contenido.paginas.find((p) => tarjetasDe(p).some((t) => idDe(t) === idSeccion));
    const todas = pag ? tarjetasDe(pag) : [];
    const actual = todas.find((t) => idDe(t) === idSeccion);
    if (!pag || !actual) { fallar('Esa sección ya no está.'); return; }
    if (huella(actual) !== huella(st.original)) { fallar('Esa sección cambió mientras tanto. Vuelve a pedirlo.'); return; }
    const resultado = planDeAplicacion(todas, st.propuestas, { anclaNuevas: idSeccion }).resultado;
    const contenido = { ...a.doc.contenido, paginas: a.doc.contenido.paginas.map((p) => (p.id === pag.id ? { ...p, doc: docPagina(resultado) } : p)) };
    const v = await pedirDocs({ accion: 'guardarVersion', id: docId, motivo: MOTIVO_ANTES_DE_IA });
    if (!v.ok) { fallar('No pude guardar la versión de antes. Vuelve a intentarlo.'); return; }
    const g = await pedirDocs({ accion: 'guardar', id: docId, version: a.doc.version, contenido });
    if (!g.ok) { fallar(g.conflicto ? 'La landing cambió mientras tanto. Vuelve a pedirlo.' : g.error); return; }
    setDoc({ ...a.doc, contenido, version: g.version, actualizado: g.actualizado, cambiosSinPublicar: g.cambiosSinPublicar });
    ponerArreglo(s.id, undefined);
    await cambiarEstado(s, 'resuelta');
    avisar('Cambio aplicado');
  }, [arreglos, docId, cambiarEstado, avisar]);

  // ── Replicar (una de afuera) ────────────────────────────────────────────────
  const replicar = useCallback(async (modo: 'bloques' | 'fiel') => {
    setMenuReplicar(null);
    if (!urlVista) return;
    setReplicando(true);
    const r = await postJson<RespuestaReplicar>('/api/landing-generator/replicar', { url: urlVista, modo }, PLAZO_IA_MS);
    if (!r.ok) { setReplicando(false); setError(r.error); return; }
    irDuro(`/landing-generator/${r.id}`, ws);
  }, [urlVista, ws]);

  // ── Lo que se dibuja ───────────────────────────────────────────────────────
  const cuenta = (e: EstadoSugerencia) => sugerencias.filter((s) => s.estado === e).length;
  const visibles = sugerencias.filter((s) => s.estado === filtro);
  const nombre = deNuestra ? (doc?.titulo || 'Landing') : hostDe(urlVista ?? '');

  return (
    <section className="gdg" aria-label="Diagnóstico">
      <style href="gm-contenido" precedence="medium">{CSS_CONTENIDO}</style>
      <style href="gdg-panel" precedence="medium">{CSS_PANEL_DIAGNOSTICO}</style>
      {tema && <link rel="stylesheet" href={urlFuentes([tema])} precedence="default" />}

      <header className="gdg-cab">
        <div className="gdg-cab-titulos">
          <span className="gdg-cab-rotulo">Diagnóstico</span>
          <h2 className="gdg-cab-nombre" title={deNuestra ? nombre : urlVista ?? ''}>{nombre}</h2>
          {resumen && (resumen.score != null || resumen.veredicto) && (
            <p className="gdg-cab-veredicto">
              {resumen.score != null && <span className="gdg-score">{resumen.score}/10</span>}
              {resumen.veredicto && <span>{resumen.veredicto}</span>}
            </p>
          )}
        </div>
        <div className="gdg-cab-acciones">
          <button type="button" className="gp-btn gp-btn-primario" disabled={!pendientes.length || analizando} onClick={() => abrirRecorrido()}>
            <Ico n="play" t={14} /> Ver recorrido
          </button>
          <button type="button" className="gp-btn gp-btn-contorno" disabled={analizando || cargando} onClick={() => void analizar(pegado.trim() || undefined)}>
            <Ico n="refrescar" t={14} /> {sugerencias.length || resumen ? 'Volver a analizar' : 'Analizar'}
          </button>
          {deNuestra && docId != null && (
            <Link href={`/landing-generator/${docId}`} className="gp-btn gp-btn-contorno"><Ico n="lapiz" t={14} /> Abrir en el editor</Link>
          )}
          {!deNuestra && (
            <button type="button" className="gp-btn gp-btn-contorno" disabled={replicando || !urlVista} aria-haspopup="menu" aria-expanded={!!menuReplicar} onClick={(e) => setMenuReplicar(menuReplicar ? null : e.currentTarget)}>
              {replicando ? <span className="gp-giro" aria-hidden /> : <Ico n="copiar" t={14} />} Replicar en el editor <Ico n="chevron-abajo" t={12} />
            </button>
          )}
          <button type="button" className="gdg-cerrar" aria-label="Cerrar diagnóstico" title="Cerrar" onClick={onCerrar}><Ico n="cerrar" t={16} /></button>
        </div>
      </header>
      {replicando && <p className="gdg-cab-nota">Replicando… puede tardar unos minutos.</p>}
      {menuReplicar && (
        <MenuFlotante ancla={menuReplicar} onCerrar={() => setMenuReplicar(null)} ancho={260} alinear="derecha">
          <ItemMenu icono="grilla-mas" texto="Como bloques editables" sub="El texto, en secciones del editor" onClick={() => void replicar('bloques')} />
          <ItemMenu icono="diseno" texto="Copia fiel (HTML)" sub="Su HTML y sus estilos" onClick={() => void replicar('fiel')} />
        </MenuFlotante>
      )}

      <div className="gdg-cuerpo">
        <div className="gdg-col-vista">
          {deNuestra
            ? (html
              ? <VistaNuestra html={html} objetivos={objetivos} controlRef={controlRef} senal={senal} onUbicar={onUbicar} />
              : <div className="gdg-vista gdg-vista-cargando gp-brillo" aria-hidden />)
            : (urlVista
              ? <VistaAfuera url={urlVista} objetivos={objetivos} controlRef={controlRef} senal={senal} onUbicar={onUbicar} />
              : <div className="gdg-vista" />)}
        </div>

        <aside className="gdg-col-lista" aria-label="Comentarios">
          <Filtros
            valor={filtro}
            onCambio={setFiltro}
            etiqueta="Filtrar comentarios"
            opciones={[
              { valor: 'pendiente', texto: `Pendientes ${cuenta('pendiente')}` },
              { valor: 'resuelta', texto: `Resueltas ${cuenta('resuelta')}` },
              { valor: 'descartada', texto: `Descartadas ${cuenta('descartada')}` },
            ]}
          />
          {analizando && (
            <p className="gdg-trabajando"><span className="gp-giro" aria-hidden /> Analizando… puede tardar 1-2 minutos.</p>
          )}
          {error && <p className="gdg-error" role="alert">{error}</p>}
          {pegable && (
            <div className="gdg-pegar">
              <textarea
                className="gdg-pegar-texto"
                value={pegado}
                onChange={(e) => setPegado(e.target.value)}
                placeholder="Pega aquí el texto de la página, de arriba a abajo"
                rows={6}
              />
              <button type="button" className="gp-btn gp-btn-primario" disabled={analizando || !pegado.trim()} onClick={() => void analizar(pegado.trim())}>Analizar este texto</button>
            </div>
          )}
          {cargando && !analizando && <p className="gdg-vacio"><span className="gp-giro" aria-hidden /></p>}
          {!cargando && !analizando && !error && !sugerencias.length && resumen && <p className="gdg-vacio">MaKo no encontró nada que señalar.</p>}
          {!cargando && sugerencias.length > 0 && !visibles.length && <p className="gdg-vacio">No hay comentarios aquí.</p>}
          <ul className="gdg-lista">
            {visibles.map((s) => (
              <Comentario
                key={s.id}
                s={s}
                activa={activa === s.id}
                ubicacion={controlRef.current ? controlRef.current.ubicacion(s.id) : undefined}
                deNuestra={deNuestra}
                tema={tema}
                formato={doc ? formatoDe(doc.config) : 'pagina'}
                proporcion={doc ? proporcionDe(doc.config) : '16:9'}
                arreglo={arreglos[s.id]}
                onVer={() => abrirRecorrido(s.id)}
                onEstado={(e) => void cambiarEstado(s, e)}
                onSolucionar={() => void solucionar(s)}
                onAceptar={() => void aceptar(s)}
                onDescartarPropuesta={() => ponerArreglo(s.id, undefined)}
              />
            ))}
          </ul>
        </aside>
      </div>

      <RecorridoDiagnostico
        pasos={recorrido.pasos}
        abierto={recorrido.abierto}
        desde={recorrido.desde}
        ir={irA}
        caja={cajaDe}
        senal={senal}
        onPaso={setActiva}
        onCerrar={cerrarRecorrido}
      />
      {aviso}
    </section>
  );
}

/** La hoja del panel (scope `.gdg`, adentro del `.gp` del Panel: los botones y menús son los de Gamma). */
const CSS_PANEL_DIAGNOSTICO = `
/* Alto de la VENTANA (como la barra lateral del Panel, sticky a 100vh): la vista y la lista scrollean
   por dentro y el recorrido mide contra lo que se ve. La derecha del Panel le saca el padding
   (.gp-contenido[data-vista="diagnostico"], Inicio.tsx): el aire va aquí. */
.gdg { display: flex; flex-direction: column; height: 100vh; height: 100dvh; box-sizing: border-box; padding: 16px 20px; min-width: 0; gap: 12px; }
.gdg-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.gdg-cab-titulos { min-width: 0; flex: 1 1 240px; }
.gdg-cab-rotulo { font-size: 12px; font-weight: 600; color: var(--gp-tenue, #6b6b72); text-transform: uppercase; letter-spacing: .04em; }
.gdg-cab-nombre { margin: 2px 0 0; font-size: 20px; font-weight: 650; color: var(--gp-titulo, #18181b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gdg-cab-veredicto { display: flex; align-items: center; gap: 8px; margin: 4px 0 0; font-size: 13.5px; color: var(--gp-tenue, #6b6b72); }
.gdg-score { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 9999px; background: var(--gp-azul-100, #e0edff); color: var(--gp-azul-800, #1e3a8a); font-weight: 650; font-variant-numeric: tabular-nums; }
.gdg-cab-acciones { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gdg-cab-nota { margin: -6px 0 0; font-size: 13px; color: var(--gp-tenue, #6b6b72); }
.gdg-cerrar { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: 9999px; background: transparent; color: var(--gp-texto, #27272a); cursor: pointer; }
.gdg-cerrar:hover { background: var(--gp-hover, rgba(0,0,0,.06)); }
.gdg-cuerpo { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); gap: 16px; }
.gdg-col-vista { min-width: 0; min-height: 0; display: flex; }
.gdg-vista { position: relative; flex: 1 1 auto; min-height: 420px; border: 1px solid var(--gp-borde, #e4e4e7); border-radius: 12px; overflow: auto; background: var(--gp-superficie, #fff); }
.gdg-vista--nuestra { container-type: inline-size; overscroll-behavior: contain; }
.gdg-vista--nuestra .gdg-lienzo .gm-doc { --gm-base: calc(100cqw / 68.5); --gm-base-movil: calc(100cqw / 68.5); }
.gdg-vista--afuera { overflow: hidden; display: flex; }
.gdg-iframe { flex: 1 1 auto; width: 100%; height: 100%; min-height: 420px; border: 0; display: block; background: #fff; }
.gdg-vista-cargando { border: 0; }
.gdg-vista-aviso { position: absolute; inset: auto 16px 16px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 10px; background: var(--gp-menu-fondo, #fff); box-shadow: var(--gp-sombra-menu, 0 8px 16px rgba(0,0,0,.12)); font-size: 13.5px; color: var(--gp-texto, #27272a); }
.gdg-vista-aviso p { margin: 0; }
.gdg-col-lista { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 2px; }
.gdg-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.gdg-trabajando, .gdg-com-trabajando { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13.5px; color: var(--gp-tenue, #6b6b72); }
.gdg-error, .gdg-com-error { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--gp-peligro-fondo, #fdecec); color: var(--gp-peligro, #b42318); font-size: 13.5px; }
.gdg-vacio { margin: 0; padding: 24px 0; text-align: center; color: var(--gp-tenue, #6b6b72); font-size: 14px; }
.gdg-pegar { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.gdg-pegar-texto { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--gp-borde, #e4e4e7); border-radius: 8px; font: inherit; font-size: 13.5px; resize: vertical; background: var(--gp-superficie, #fff); color: var(--gp-texto, #27272a); }
.gdg-com { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border: 1px solid var(--gp-borde, #e4e4e7); border-radius: 12px; background: var(--gp-superficie, #fff); transition: border-color .15s, box-shadow .15s; }
.gdg-com[data-activa="si"] { border-color: var(--gp-azul-500, #3b82f6); box-shadow: 0 0 0 1px var(--gp-azul-500, #3b82f6); }
.gdg-com[data-estado="resuelta"], .gdg-com[data-estado="descartada"] { opacity: .78; }
.gdg-com-cab { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.gdg-sev { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 9999px; font-size: 11.5px; font-weight: 650; background: var(--gp-azul-100, #e0edff); color: var(--gp-azul-800, #1e3a8a); }
.gdg-sev[data-sev="alta"] { background: var(--gp-peligro-fondo, #fdecec); color: var(--gp-peligro, #b42318); }
.gdg-sev[data-sev="media"] { background: #fff4e0; color: #9a5b00; }
[data-tema="oscuro"] .gdg-sev[data-sev="media"] { background: #3d2a05; color: #f5c46b; }
.gdg-com-estado, .gdg-com-sin { font-size: 12px; font-weight: 600; color: var(--gp-tenue, #6b6b72); }
.gdg-com-tit { all: unset; cursor: pointer; font-size: 14.5px; font-weight: 650; line-height: 1.35; color: var(--gp-titulo, #18181b); }
.gdg-com-tit:hover { text-decoration: underline; }
.gdg-com-tit:focus-visible { outline: 2px solid var(--gp-azul-500, #3b82f6); outline-offset: 2px; border-radius: 4px; }
.gdg-com-cita { margin: 0; padding-left: 10px; border-left: 3px solid var(--gp-borde, #e4e4e7); font-size: 13px; font-style: italic; color: var(--gp-tenue, #6b6b72); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.gdg-com-arreglo { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--gp-texto, #27272a); }
.gdg-com-porque { font-size: 13px; color: var(--gp-tenue, #6b6b72); }
.gdg-com-porque summary { cursor: pointer; font-weight: 600; }
.gdg-com-porque p { margin: 4px 0 0; line-height: 1.5; }
.gdg-com-acciones { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.gdg-com-acciones .gp-btn { height: 28px; padding: 0 10px; font-size: 13px; }
.gdg-com-revision { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.gdg-segmento { display: inline-flex; align-self: flex-start; padding: 2px; border-radius: 999px; background: var(--gp-superficie-2, #f4f4f5); gap: 2px; }
.gdg-segmento > button { height: 26px; padding: 0 11px; border: 0; border-radius: 999px; background: transparent; color: var(--gp-tenue, #6b6b72); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.gdg-segmento > button[aria-pressed="true"] { background: var(--gp-superficie, #fff); color: var(--gp-texto, #27272a); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.gdg-com-mini { border: 1px solid var(--gp-borde-suave, #f0f0f2); border-radius: 8px; overflow: hidden; }
@media (max-width: 980px) {
  .gdg { height: auto; min-height: 100dvh; padding: 12px 16px; }
  .gdg-cuerpo { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(360px, 60vh) auto; }
  .gdg-col-lista { overflow: visible; }
}
`;
