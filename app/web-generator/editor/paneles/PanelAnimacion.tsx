'use client';

// =============================================================================
// paneles/PanelAnimacion — «Animar»: el estilo de toda la landing y el efecto de cada sección
// =============================================================================
// Pedido de Martín (14/10/2026), a «¿cuál de los dos frentes?»: «las dos cosas» — las animaciones de la página y
// el video de fondo en loop. Decidido el 15/10 (no se re-pregunta): el panel se COPIA del de animaciones del Image
// Editor más la ayuda pública de Canva; DOS niveles, un estilo para toda la landing y un efecto por sección, NUNCA
// por bloque («Editar con IA» rehace los bloques y perdería el ajuste); cada efecto se reproduce solo al pasar el
// mouse; el video de fondo no se ofrece hoy (`VIDEO_FONDO.disponible` es false).
//
// FUENTE COPIADA (Gamma no tiene panel de animaciones: sólo el interruptor, que sigue en «Configuración»):
//   · app/image-editor/_doory/editor/panels/AnimatePanel.tsx — la estructura: el segmentado «Elemento | Página»
//     (acá «Sección | Página», y arranca en Sección si hay una sección activa), el estado vacío («Nada
//     seleccionado» + «Animar la página»), la grilla por grupos con las flechas entre tiles (`onGridKey` →
//     `alMoverEnGrilla`), la caja «Ajustes: <efecto>» con la Dirección y «Quitar animación», el botón «Animar la
//     página» debajo, y en Página «Animación de página» con su línea de ayuda.
//   · .../panels/AnimateThumb.tsx → TileAnimacion.tsx; .../panels/Animate.module.css → las medidas de abajo (grilla
//     de 3 columnas con 8 px, baldosa con el rótulo de 13 px debajo, título de grupo 14/700, la elegida con borde de
//     selección; el violeta de Canva es acá el azul de selección de Gamma); .../animation/useReducedMotion.ts →
//     `useMenosMovimiento`; .../animation/strings.ts (`panel.*`, `timeline.play`) → los textos, tal cual salvo
//     «elemento» → «sección».
//   · La ayuda de Canva «Apply, change, or remove animations» (https://www.canva.com/help/animate-designs/, leída el
//     15/10/2026 con curl: WebFetch recibe 403): «On the toolbar above the editor, select Animate» (el botón
//     «Animar» de la barra de herramientas, EditorLanding.tsx), «select the Page tab / the Element tab» (el
//     segmentado), «To preview an animation, hover your mouse cursor over it» (la tile), «To apply an animation,
//     select it from the options» (un clic aplica, sin «Aceptar»), «Select Remove animation» y «When the Reduce
//     motion setting is turned on for a device, animations are reduced» (las vistas previas quietas, con el renglón).
// LO QUE NO SE COPIA, y por qué: Salida y Énfasis (una página no «sale», y lo que se mueve solo más de 5 s pide
// pausa: animaciones.ts, «LO QUE NO VA»); duración, retraso, suavizado y las velocidades Lento/Medio/Rápido de
// Canva (el modelo guarda el efecto y la dirección; los tiempos son del catálogo, iguales en la publicada); la
// pestaña «Text» de Canva (títulos de a palabra o de a letra son ESTILOS de la página, «Palabras» y «Máquina de
// escribir»); «Create an Animation» (un recorrido a mano) y «Appear on click» (son de presentación); transiciones
// de página (son de Presentar); «Quitar todas las animaciones de esta página» (lo hace el interruptor).
//
// CÓMO ESCRIBE: el efecto de la sección, por UNA transacción de TipTap (`setNodeMarkup`, como EstiloSeccion.tsx):
// Ctrl+Z lo deshace y el autoguardado lo guarda. El estilo y el interruptor, por `setConfig` del contexto
// (`useConfigViva`). El lienzo muestra el estilo nuevo sin tocar las secciones: sus data-* los pone un plugin de
// decoraciones (animacion-reglas.ts, `pluginAnimacionSecciones`) al que el armazón le pasa la config.
//
// CUÁNDO SE MUEVE ALGO (decidido el 14/10; docs/hallazgos-editor-landing.md, «Animaciones…»): una tile, sólo con el
// mouse encima o con foco, y nunca con «reducir movimiento»; al elegir un efecto, esa sección se reproduce UNA vez en
// el lienzo, y al elegir un estilo, las secciones que se ven — salvo con «reducir movimiento»; el ▶ «Reproducir la
// página» reproduce SIEMPRE (es una acción apretada a propósito). Nada se mueve al abrir el panel. La clase de la
// publicada que esconde lo no visto NUNCA va en la app (escondería las miniaturas de la tira y del Panel).
//
// EL ▶, decidido acá: cada sección se reproduce UNA vez AL ENTRAR EN PANTALLA (las que ya se ven, enseguida), con
// el umbral del script de la publicada. Todas a la vez animaría secciones que nadie ve y quien bajara después no
// vería nada; así, quien baja por el lienzo ve lo que verá quien entre a la página. Una diferencia a propósito: en
// la publicada lo que corta la primera pantalla entra quieto (el arreglo del parpadeo); acá también se anima,
// porque quien aprieta ▶ quiere VER el efecto.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as EventoTecla } from 'react';
import { useEditorState } from '@tiptap/react';
import { closeHistory } from '@tiptap/pm/history';
import { tituloDeTarjeta, type AttrsTarjeta, type JsonNodo } from '@/lib/editor-landing/doc';
import { ESTILOS_PAGINA, SIN_ANIMACION, VIDEO_FONDO, efectoPorId, sanearEstilo, type AnimacionSeccion, type Direccion, type IdEstilo } from '@/lib/editor-landing/animaciones';
import { varsDeTema } from '@/lib/editor-landing/temas';
import { terminoTarjeta } from '@/lib/editor-landing/api-tipos';
import { useEditorLanding, type ModoAnimar, type PedidoAnimar } from '../contexto';
import { seccionPorId } from '../insertar';
import { Ico } from '../MenuDocumento';
import { EstilosGmp, FilaAjuste, Interruptor, useConfigViva, useFijo } from '../dialogos/piezas-gma';
import {
  CONSULTA_MENOS_MOVIMIENTO, DIRECCION_UI, GRILLA,
  cambiosAlElegir, cambiosDeDireccion, datosDeTile, duracionDelDom, pideMenosMovimiento, reproducirPagina, reproducirUnaVez, vistaDeSeccion,
  type SeccionDom,
} from '../animacion-reglas';
import { TileAnimacion } from './TileAnimacion';

// ─────────────────────────────────────────────────────────────────────────────
// La hoja (las medidas de Animate.module.css en el chrome de Gamma: tokens `--gmp-*` de piezas-gma.tsx)
// ─────────────────────────────────────────────────────────────────────────────
// Un string sin backticks a propósito: se sirve tal cual dentro de un <style>.

const CSS_PANEL_ANIMACION = [
  '.gmp-anim-panel{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--gmp-fondo)}',
  '.gmp-anim{display:flex;flex-direction:column;gap:12px}',
  '.gmp-anim-ayuda,.gmp-anim-elegida{margin:0;color:var(--gmp-tenue);font-size:13px;line-height:18px}',
  '.gmp-anim-elegida{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.gmp-anim-apagadas{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:8px;background:var(--gmp-suave);color:var(--gmp-tinta);font-size:13px;font-weight:600}',
  '.gmp-anim-grupos{display:flex;flex-direction:column;gap:16px}',
  '.gmp-anim-grupo{display:flex;flex-direction:column;gap:8px}',
  '.gmp-anim-grupo-tit{margin:0;color:var(--gmp-tinta);font-size:14px;font-weight:700;line-height:20px}',
  '.gmp-anim-grilla{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
  '.gmp-anim-grilla[data-apagado]{opacity:.55}',
  // La baldosa (Animate.module.css `.thumb`): el rótulo debajo, la elegida con el borde de selección.
  '.gmp-anim-tile{display:flex;flex-direction:column;gap:4px;min-width:0;padding:4px 4px 6px;border:0;border-radius:8px;background:transparent;color:var(--gmp-tinta);cursor:pointer}',
  '.gmp-anim-tile:focus-visible{outline:none;box-shadow:0 0 0 2px var(--gmp-azul-linea)}',
  '.gmp-anim-ventana{position:relative;display:block;width:100%;aspect-ratio:160/110;border-radius:8px;overflow:hidden;background:var(--gm-fondo,#f5f5f6);background-size:cover;background-position:center}',
  '.gmp-anim-ventana::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}',
  '.gmp-anim-tile:hover .gmp-anim-ventana::after{box-shadow:inset 0 0 0 2px rgba(57,70,96,.25)}',
  '.gmp-anim-tile[aria-pressed="true"] .gmp-anim-ventana::after{box-shadow:inset 0 0 0 2px var(--gmp-azul-linea)}',
  '.gmp-anim-tile-nombre{overflow:hidden;font-size:13px;line-height:18px;text-align:center;text-overflow:ellipsis;white-space:nowrap}',
  '.gmp-anim-tile[aria-pressed="true"] .gmp-anim-tile-nombre{font-weight:600}',
  // La escena: una sección de 300×206 con la hoja de la landing (la misma de la publicada), achicada a un tercio.
  // Los selectores llevan `.gmp-anim-escena.gm-doc` para ganarle a los de la hoja (`.gm-doc .gm-tarjeta`).
  '.gmp-anim-escena.gm-doc{position:absolute;left:50%;top:50%;display:flex;align-items:center;justify-content:center;width:300px;height:206px;font-size:16px;transform:translate(-50%,-50%) scale(.34);pointer-events:none}',
  '.gmp-anim-escena.gm-doc .gm-tarjeta{width:248px;margin:0;min-height:0}',
  '.gmp-anim-escena.gm-doc .gm-tarjeta-cuerpo{padding:22px 24px;align-content:start}',
  '.gmp-anim-escena.gm-doc .gm-tarjeta-cuerpo > * + *{margin-top:12px}',
  '.gmp-anim-escena.gm-doc .gm-tarjeta-cuerpo > h3.gmp-anim-titulo{display:flex;flex-wrap:nowrap;gap:7px;height:22px;margin:0;font-size:0;line-height:0;background:none}',
  '.gmp-anim-titulo > span{display:inline-block;flex:none;width:46px;height:22px;border-radius:5px;background:var(--gm-titulo,#161616)}',
  '.gmp-anim-titulo[data-piezas="letra"]{gap:4px}',
  '.gmp-anim-titulo[data-piezas="letra"] > span{width:14px}',
  '.gmp-anim-renglon{display:block;height:10px;border-radius:5px;background:var(--gm-texto-tenue,#8b8b90)}',
  '.gmp-anim-renglon-corto{width:70%}',
  '.gmp-anim-boton{display:block;width:84px;height:26px;border-radius:var(--gm-radio-boton,8px);background:var(--gm-boton,var(--gm-acento,#0540ad))}',
  // Ajustes y pie
  '.gmp-anim-ajustes{display:flex;flex-direction:column;gap:12px;padding-top:12px;border-top:1px solid var(--gmp-borde)}',
  '.gmp-anim-campo{display:flex;flex-direction:column;gap:6px}',
  '.gmp-anim-campo-tit{color:var(--gmp-tinta);font-size:14px;font-weight:600;line-height:20px}',
  '.gmp-anim-campo .gmp-seg{align-self:flex-start}',
  '.gmp-anim-campo .gmp-seg button{min-width:36px;padding:0 10px}',
  '.gmp-anim-boton-pie{align-self:flex-start}',
  // El estado vacío (Animate.module.css `.empty`)
  '.gmp-anim-vacio{display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 8px;color:var(--gmp-tenue);font-size:13px;line-height:1.5;text-align:center}',
  '.gmp-anim-vacio p{margin:0;max-width:30ch}',
  '.gmp-anim-vacio .gmp-anim-vacio-tit{color:var(--gmp-tinta);font-weight:700}',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// Piezas
// ─────────────────────────────────────────────────────────────────────────────

/** «Reducir movimiento» al día (copia de useReducedMotion.ts del Image Editor). */
function useMenosMovimiento(): boolean {
  const [menos, setMenos] = useState(() => pideMenosMovimiento());
  useEffect(() => {
    const q = typeof window !== 'undefined' ? window.matchMedia?.(CONSULTA_MENOS_MOVIMIENTO) : undefined;
    if (!q) return;
    const alCambiar = () => setMenos(q.matches);
    alCambiar();
    q.addEventListener('change', alCambiar);
    return () => q.removeEventListener('change', alCambiar);
  }, []);
  return menos;
}

/** Las flechas se mueven entre las tiles de una grilla (con Tab se recorrerían todas): `onGridKey` del Image Editor. */
function alMoverEnGrilla(e: EventoTecla<HTMLDivElement>): void {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
  const tiles = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
  const en = tiles.indexOf(document.activeElement as HTMLButtonElement);
  if (en < 0) return;
  const columnas = Math.max(1, Math.round(e.currentTarget.clientWidth / (tiles[0]?.offsetWidth || 1)));
  const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? columnas : -columnas;
  const sig = tiles[Math.min(tiles.length - 1, Math.max(0, en + paso))];
  if (sig && sig !== tiles[en]) {
    e.preventDefault();
    sig.focus();
  }
}

/**
 * El lugar previsto del video de fondo del hero (animaciones.ts, `VIDEO_FONDO`). Hoy NO se ofrece: lo genera sólo
 * MaKo por el puente a Flow (Martín, 15/10: «B · Sólo generado por MaKo, cuando el puente pueda») y el puente
 * todavía no le devuelve el video a MaKo. El modelo (`AttrsTarjeta.videoFondo`), el saneo y el render ya están;
 * cuando `VIDEO_FONDO.disponible` pase a true, el control va acá: en la vista de una sección con el diseño «fondo».
 */
function VideoDeFondo(_: { seccionId: string }): null {
  return null;
}

const DATOS_NINGUNA = datosDeTile({ tipo: 'efecto', efecto: SIN_ANIMACION });

// ─────────────────────────────────────────────────────────────────────────────
// El panel
// ─────────────────────────────────────────────────────────────────────────────

export function PanelAnimacion({ onCerrar, pedido }: { onCerrar?: () => void; pedido?: PedidoAnimar | null } = {}) {
  const { panelDer } = useEditorLanding();
  if (panelDer !== 'animacion') return null;
  return <PanelAnimacionAbierto onCerrar={onCerrar} pedido={pedido ?? null} />;
}

function PanelAnimacionAbierto({ onCerrar, pedido }: { onCerrar?: () => void; pedido: PedidoAnimar | null }) {
  const { editor, tarjetaActiva, tema, setPanelDer } = useEditorLanding();
  const { config, cambiar } = useConfigViva();
  const cerrar = useFijo(() => (onCerrar ? onCerrar() : setPanelDer(null)));
  const menos = useMenosMovimiento();
  const pagina = config.pagina;
  const Uno = terminoTarjeta(config, { mayuscula: true });
  const uno = terminoTarjeta(config);
  const vars = useMemo(() => varsDeTema(tema) as CSSProperties, [tema]);

  // Arranca en «Sección» si hay una activa (Image Editor: `count > 0 ? 'element' : 'page'`); un pedido nuevo de la
  // barra o del menú de una sección la cambia.
  const [modo, setModo] = useState<ModoAnimar>(pedido?.modo ?? (tarjetaActiva ? 'seccion' : 'pagina'));
  const pedidoVisto = useRef(pedido?.n ?? 0);
  useEffect(() => {
    if (!pedido || pedido.n === pedidoVisto.current) return;
    pedidoVisto.current = pedido.n;
    setModo(pedido.modo);
  }, [pedido]);

  // La sección activa, en vivo (el armazón va con `shouldRerenderOnTransaction: false`).
  const seccion = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed || !tarjetaActiva) return null;
      const s = seccionPorId(e.state.doc, tarjetaActiva);
      if (!s) return null;
      return {
        id: s.id,
        indice: s.indice,
        animacion: (s.nodo.attrs.animacion ?? null) as unknown,
        animacionDireccion: (s.nodo.attrs.animacionDireccion ?? null) as unknown,
        disenoFondo: s.nodo.attrs.diseno === 'fondo',
        titulo: tituloDeTarjeta(s.nodo.toJSON() as JsonNodo),
      };
    },
  }) ?? null;
  const vista = seccion ? vistaDeSeccion(seccion, pagina) : null;
  const efectoElegido = vista?.elegido && vista.elegido !== SIN_ANIMACION ? efectoPorId(vista.elegido) : null;

  // ── El lienzo: lo que se reproduce ahí se corta al empezar otra cosa y al cerrar el panel ──
  const cortarLienzo = useRef<(() => void) | null>(null);
  const cortar = useCallback(() => { cortarLienzo.current?.(); cortarLienzo.current = null; }, []);
  useEffect(() => cortar, [cortar]);

  const seccionesDom = useCallback((): SeccionDom[] => {
    if (!editor || editor.isDestroyed) return [];
    return Array.from(editor.view.dom.children).filter((el) => el.classList.contains('gm-tarjeta')) as unknown as SeccionDom[];
  }, [editor]);
  const lienzo = useCallback(() => (editor && !editor.isDestroyed ? editor.view.dom.closest('.gma-lienzo') : null), [editor]);

  /** La sección recién cambiada, UNA vez en el lienzo (después del cuadro en que ProseMirror le puso los data-*). */
  const verSeccion = (id: string) => {
    if (menos) return;
    requestAnimationFrame(() => {
      if (!editor || editor.isDestroyed) return;
      const s = seccionPorId(editor.state.doc, id);
      const dom = s ? editor.view.nodeDOM(s.pos) : null;
      if (!(dom instanceof HTMLElement)) return;
      cortar();
      const el = dom as unknown as SeccionDom;
      cortarLienzo.current = reproducirUnaVez(el, duracionDelDom(el));
    });
  };

  /**
   * Escribe en la sección `id`, en UNA transacción deshacible y cerrada (`closeHistory`, como `setAttrs` de
   * TarjetaVista): dos tiles elegidas seguidas son dos pasos de Ctrl+Z, no uno. false si la sección ya no está.
   */
  const escribir = (id: string, cambios: Partial<AttrsTarjeta>): boolean => {
    if (!editor || editor.isDestroyed) return false;
    return editor.commands.command(({ tr, state }) => {
      const s = seccionPorId(state.doc, id);
      if (!s) return false;
      tr.setNodeMarkup(s.pos, undefined, { ...s.nodo.attrs, ...cambios });
      closeHistory(tr);
      return true;
    });
  };

  const elegir = (valor: AnimacionSeccion) => {
    if (seccion && escribir(seccion.id, cambiosAlElegir(valor, seccion))) verSeccion(seccion.id);
  };
  const ponerDireccion = (d: Direccion) => {
    const c = seccion ? cambiosDeDireccion(d, seccion) : null;
    if (seccion && c && escribir(seccion.id, c)) verSeccion(seccion.id);
  };

  // ── La página ──
  const ponerInterruptor = useCallback((v: boolean) => cambiar((c) => ({ ...c, pagina: { ...c.pagina, animaciones: v } })), [cambiar]);
  // Al elegir un estilo, las secciones que se ven lo muestran una vez. El estilo llega al lienzo cuando el armazón
  // se lo pasa al plugin, y su efecto corre DESPUÉS que los del panel (el padre, al final): se espera un cuadro.
  const [verEstilo, setVerEstilo] = useState(0);
  const ponerEstilo = (id: IdEstilo) => {
    cambiar((c) => ({ ...c, pagina: { ...c.pagina, estiloAnimacion: id } }));
    setVerEstilo((n) => n + 1);
  };
  useEffect(() => {
    if (!verEstilo || menos || !pagina.animaciones) return;
    const raf = requestAnimationFrame(() => {
      cortar();
      cortarLienzo.current = reproducirPagina(seccionesDom(), { raiz: lienzo(), soloLasDePantalla: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [verEstilo]); // eslint-disable-line react-hooks/exhaustive-deps

  /** ▶: cada sección, una vez al entrar en pantalla (ver la cabecera). Aunque el sistema pida menos movimiento. */
  const reproducirTodo = () => {
    cortar();
    cortarLienzo.current = reproducirPagina(seccionesDom(), { raiz: lienzo() });
  };

  const estiloActual = sanearEstilo(pagina.estiloAnimacion);

  return (
    <div className="gma gmp gmp-anim-panel">
      <EstilosGmp extra={{ href: 'gmp-panel-animacion', css: CSS_PANEL_ANIMACION }} />
      <div className="gmp-cajon-cab">
        <h2 className="gmp-cajon-tit">Animar</h2>
        <button type="button" className="gmp-x" onClick={cerrar} aria-label="Cerrar" title="Cerrar"><Ico n="cerrar" t={18} /></button>
      </div>
      <div className="gmp-cajon-cuerpo gmp-anim">
        <div className="gmp-seg gmp-seg-ancho" role="group" aria-label="Animar">
          <button type="button" aria-pressed={modo === 'seccion'} onClick={() => setModo('seccion')}>{Uno}</button>
          <button type="button" aria-pressed={modo === 'pagina'} onClick={() => setModo('pagina')}>Página</button>
        </div>
        {menos ? <p className="gmp-anim-ayuda">Las vistas previas están en pausa porque tu sistema pide reducir el movimiento.</p> : null}

        {modo === 'seccion' ? (
          !seccion || !vista ? (
            <div className="gmp-anim-vacio">
              <Ico n="brillo" t={22} />
              <p className="gmp-anim-vacio-tit">Nada seleccionado</p>
              <p>{`Selecciona una ${uno} para animarla, o anima toda la página de una vez.`}</p>
              <button type="button" className="gmp-btn gmp-btn-secundario" onClick={() => setModo('pagina')}>Animar la página</button>
            </div>
          ) : (
            <>
              <p className="gmp-anim-elegida" title={seccion.titulo || undefined}>
                {`${Uno} ${seccion.indice + 1}${seccion.titulo ? ` · ${seccion.titulo}` : ''}`}
              </p>
              {!pagina.animaciones ? (
                <div className="gmp-anim-apagadas">
                  <span>Animaciones apagadas</span>
                  <button type="button" className="gmp-btn gmp-btn-contorno gmp-btn-chico" onClick={() => ponerInterruptor(true)}>Activar</button>
                </div>
              ) : vista.elegido === null ? (
                <p className="gmp-anim-ayuda">{`Usa la de la página: ${vista.estiloPagina}`}</p>
              ) : null}
              <div className="gmp-anim-grupos">
                {GRILLA.map((g, i) => (
                  <section key={g.id} className="gmp-anim-grupo">
                    <h3 className="gmp-anim-grupo-tit">{g.nombre}</h3>
                    <div className="gmp-anim-grilla" role="group" aria-label={g.nombre} onKeyDown={alMoverEnGrilla}>
                      {i === 0 ? (
                        <TileAnimacion nombre="Ninguna" datos={DATOS_NINGUNA} seleccionada={vista.elegido === SIN_ANIMACION}
                          onElegir={() => elegir(SIN_ANIMACION)} vars={vars} quieta={menos} />
                      ) : null}
                      {g.efectos.map((e) => (
                        <TileAnimacion
                          key={e.id}
                          nombre={e.nombre}
                          datos={datosDeTile({ tipo: 'efecto', efecto: e.id, direccion: vista.elegido === e.id ? vista.direccion : null })}
                          seleccionada={vista.elegido === e.id}
                          onElegir={() => elegir(e.id)}
                          vars={vars}
                          quieta={menos}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              {efectoElegido ? (
                <section className="gmp-anim-ajustes" aria-label="Ajustes">
                  <h3 className="gmp-anim-grupo-tit">{`Ajustes: ${efectoElegido.nombre}`}</h3>
                  {vista.direcciones.length > 1 ? (
                    <div className="gmp-anim-campo">
                      <span className="gmp-anim-campo-tit">Dirección</span>
                      <div className="gmp-seg" role="group" aria-label="Dirección">
                        {vista.direcciones.map((d) => (
                          <button key={d} type="button" aria-pressed={vista.direccion === d} aria-label={DIRECCION_UI[d].nombre} title={DIRECCION_UI[d].nombre}
                            onClick={() => ponerDireccion(d)}>
                            <Ico n={DIRECCION_UI[d].icono} t={14} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <button type="button" className="gmp-btn gmp-btn-fantasma gmp-anim-boton-pie" onClick={() => elegir(null)}>
                    <Ico n="papelera" t={15} />Quitar animación
                  </button>
                </section>
              ) : vista.elegido === SIN_ANIMACION ? (
                <button type="button" className="gmp-btn gmp-btn-fantasma gmp-anim-boton-pie" onClick={() => elegir(null)}>Usar la de la página</button>
              ) : null}
              {VIDEO_FONDO.disponible && seccion.disenoFondo ? <VideoDeFondo seccionId={seccion.id} /> : null}
              <button type="button" className="gmp-btn gmp-btn-secundario gmp-anim-boton-pie" onClick={() => setModo('pagina')}>
                <Ico n="brillo" t={15} />Animar la página
              </button>
            </>
          )
        ) : (
          <div className="gmp-anim-grupos">
            <FilaAjuste titulo="Animaciones">
              <Interruptor etiqueta="Animaciones" activo={pagina.animaciones} onCambiar={ponerInterruptor} />
            </FilaAjuste>
            <section className="gmp-anim-grupo">
              <h3 className="gmp-anim-grupo-tit">Animación de página</h3>
              <p className="gmp-anim-ayuda">{`Anima cada ${uno} al entrar en pantalla, de arriba abajo.`}</p>
              <div className="gmp-anim-grilla" role="group" aria-label="Animación de página" onKeyDown={alMoverEnGrilla}
                data-apagado={pagina.animaciones ? undefined : ''}>
                {ESTILOS_PAGINA.map((s) => (
                  <TileAnimacion
                    key={s.id}
                    nombre={s.nombre}
                    datos={datosDeTile({ tipo: 'estilo', estilo: s.id })}
                    seleccionada={estiloActual === s.id}
                    onElegir={() => ponerEstilo(s.id)}
                    vars={vars}
                    quieta={menos}
                  />
                ))}
              </div>
            </section>
            <button type="button" className="gmp-btn gmp-btn-primario gmp-anim-boton-pie" disabled={!pagina.animaciones} onClick={reproducirTodo}>
              <Ico n="play-relleno" t={14} />Reproducir la página
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PanelAnimacion;
