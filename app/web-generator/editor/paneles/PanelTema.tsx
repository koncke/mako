'use client';

// =============================================================================
// PanelTema — el cajón «Tema» de Gamma (doc-theme-drawer), a la derecha del editor
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Copia del panel de temas de
// Gamma 5 (gamma-ui.md §5.12.1 y gamma-tokens.md §9): título «Tema» grande, «+ Nuevo tema»,
// el segmentado Personalizado | Estándar con la lupa, los filtros Oscuro · Claro · Profesional ·
// Colorido y la grilla de dos columnas con la vista previa REAL de cada tema (su fondo y una
// tarjeta con «Título» y «Cuerpo y enlace» pintada con sus variables). El activo lleva ✓ y borde
// azul; al pasar el cursor aparece «Personalizar», que abre el editor de tema.
//
// Vive ADENTRO de la columna derecha del armazón (`aside.gma-der`, 360 px, EditorLanding.tsx):
// no se portalea ni entra a la pila de modales, porque es parte del layout y no una capa
// encima. Escape lo cierra sólo si no hay ningún modal abierto (el editor de tema, una
// confirmación): ésos contestan primero.
//
// Cambiar de tema es `setConfig({ ...config, tema })` (contexto.ts): el armazón guarda. Los
// temas propios del workspace se leen y se escriben por `/api/landing-generator`
// (`temas`, `guardarTema`, `borrarTema`); el panel no toca el documento por otro camino.
//
// ⚠️ El armazón resuelve `tema` con SU lista de temas propios. Al guardar o borrar uno, el panel
// avisa con el evento `EVENTO_TEMAS_PROPIOS` (detail = la lista nueva) para que el armazón la
// reemplace; sin eso, un tema propio recién creado se aplicaría y se vería como el default
// hasta recargar la página (temaPorId cae al default con un id que no conoce).
//
// Lo que NO se copia de Gamma: «Importar» (no hay de dónde importar un tema de Gamma) y el
// texto de ayuda bajo el título (narra lo que el panel ya muestra).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { modalDeArriba } from '@/app/_components/pila-modales';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import type { TemaPropio } from '@/lib/editor-landing/api-tipos';
import { TEMAS, temaPorId, urlFuentes, varsDeTema, type Tema } from '@/lib/editor-landing/temas';
import { useEditorLanding } from '../contexto';
import { EstilosGmp, Giro, Icono, MenuGma, pedir, sinAcentos, useConfigViva, useConfirmaGma, useFijo } from '../dialogos/piezas-gma';
import { EditorTema, type ArranqueEditorTema } from './EditorTema';

/** El evento con el que el panel le pasa al armazón la lista nueva de temas propios. */
export const EVENTO_TEMAS_PROPIOS = 'editor-landing:temas-propios';

export function avisarTemasPropios(lista: TemaPropio[]): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<TemaPropio[]>(EVENTO_TEMAS_PROPIOS, { detail: lista }));
}

type Filtro = 'oscuro' | 'claro' | 'profesional' | 'colorido';
const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'oscuro', texto: 'Oscuro' },
  { valor: 'claro', texto: 'Claro' },
  { valor: 'profesional', texto: 'Profesional' },
  { valor: 'colorido', texto: 'Colorido' },
];

/** ¿El tema pasa los filtros elegidos? (Oscuro y Claro se excluyen entre sí.) */
export function pasaFiltros(t: Tema, filtros: ReadonlySet<Filtro>, q: string): boolean {
  if (filtros.has('oscuro') && t.grupo !== 'oscuro') return false;
  if (filtros.has('claro') && t.grupo !== 'claro') return false;
  if (filtros.has('profesional') && !t.etiquetas.includes('profesional')) return false;
  if (filtros.has('colorido') && !t.etiquetas.includes('colorido')) return false;
  if (q.trim() && !sinAcentos(t.nombre).includes(sinAcentos(q.trim()))) return false;
  return true;
}

const CSS_PANEL_TEMA = [
  '.gmp-panel{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--gmp-fondo)}',
  '.gmp-tema-acciones{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 16px}',
  '.gmp-tema-barra{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
  '.gmp-tema-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}',
  '.gmp-temas{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
  '.gmp-tile{position:relative;border:2px solid transparent;border-radius:12px;padding:5px}',
  '.gmp-tile:hover{background:var(--gmp-suave)}',
  '.gmp-tile[data-activo]{border-color:var(--gmp-azul-linea);background:var(--gmp-azul-claro)}',
  '.gmp-tile-elegir{display:block;width:100%;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;color:inherit}',
  '.gmp-muestra{display:flex;align-items:center;justify-content:center;aspect-ratio:16/11;padding:10px;border-radius:8px;overflow:hidden;background:var(--gm-fondo);background-size:cover;background-position:center;font-size:10.5px}',
  '.gmp-muestra-tarjeta{width:100%;padding:9px 11px;border-radius:var(--gm-radio-tarjeta);background:var(--gm-tarjeta-fondo);box-shadow:var(--gm-tarjeta-borde),var(--gm-tarjeta-sombra);-webkit-backdrop-filter:var(--gm-tarjeta-filtro);backdrop-filter:var(--gm-tarjeta-filtro)}',
  '.gmp-muestra-titulo{font-family:var(--gm-fuente-titulo);font-weight:var(--gm-peso-titulo);font-size:1.6em;line-height:1.15;letter-spacing:var(--gm-tracking-titulos);color:var(--gm-titulo-relleno);background:var(--gm-titulo-degradado);-webkit-background-clip:text;background-clip:text;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.gmp-muestra-cuerpo{margin-top:3px;font-family:var(--gm-fuente-cuerpo);font-weight:var(--gm-peso-cuerpo);color:var(--gm-texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.gmp-muestra-cuerpo u{color:var(--gm-enlace)}',
  '.gmp-tile-pie{display:flex;align-items:center;gap:4px;min-height:26px;padding:5px 2px 0;font-size:13px;font-weight:600;color:var(--gmp-tinta)}',
  '.gmp-tile-pie>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.gmp-tile-menu{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--gmp-texto);cursor:pointer}',
  '.gmp-tile-menu:hover{background:var(--gmp-hover)}',
  '.gmp-tile-personalizar{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);opacity:0;pointer-events:none;transition:opacity .12s;box-shadow:0 2px 8px rgba(0,0,0,.2)}',
  '.gmp-tile:hover .gmp-tile-personalizar,.gmp-tile:focus-within .gmp-tile-personalizar{opacity:1;pointer-events:auto}',
].join('\n');

/** La vista previa de un tema: su fondo y una tarjeta con «Título» y «Cuerpo y enlace». */
export function MuestraTema({ tema }: { tema: Tema }) {
  return (
    <div className="gmp-muestra" style={varsDeTema(tema) as CSSProperties} aria-hidden>
      <div className="gmp-muestra-tarjeta">
        <div className="gmp-muestra-titulo">Título</div>
        <div className="gmp-muestra-cuerpo">Cuerpo y <u>enlace</u></div>
      </div>
    </div>
  );
}

export function PanelTema({ onCerrar }: { onCerrar?: () => void } = {}) {
  const { panelDer } = useEditorLanding();
  if (panelDer !== 'tema') return null;
  return <PanelTemaAbierto onCerrar={onCerrar} />;
}

function PanelTemaAbierto({ onCerrar }: { onCerrar?: () => void }) {
  const { setPanelDer, avisar } = useEditorLanding();
  const { config, cambiar } = useConfigViva();
  const { confirmar, nodoConfirma } = useConfirmaGma();
  const cerrar = useFijo(() => (onCerrar ? onCerrar() : setPanelDer(null)));

  const [vista, setVista] = useState<'propios' | 'estandar'>(config.tema.startsWith('ws:') ? 'propios' : 'estandar');
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  const [filtros, setFiltros] = useState<Set<Filtro>>(new Set());
  const [propios, setPropios] = useState<TemaPropio[] | null>(null);
  const [errorPropios, setErrorPropios] = useState<string | null>(null);
  const [editando, setEditando] = useState<ArranqueEditorTema | null>(null);
  const [menu, setMenu] = useState<{ id: string; ancla: HTMLElement } | null>(null);
  const buscador = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setErrorPropios(null);
    const r = await pedir<'temas'>({ accion: 'temas' });
    if (r.ok) setPropios(r.temas);
    else setErrorPropios(r.error);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    // Sin capa propia: contesta el Escape sólo si no hay un modal abierto (que es el de arriba).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || modalDeArriba() !== null) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('.ProseMirror')) return;
      cerrar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cerrar]);

  useEffect(() => { if (buscando) buscador.current?.focus(); }, [buscando]);

  const temasPropios = useMemo(() => (propios ?? []).map((p) => ({ propio: p, tema: temaPorId('ws:' + p.id, propios) })), [propios]);
  const lista: { tema: Tema; propio: TemaPropio | null }[] = vista === 'estandar'
    ? TEMAS.map((t) => ({ tema: t, propio: null }))
    : temasPropios;
  const visibles = lista.filter((x) => pasaFiltros(x.tema, filtros, q));
  const fuentes = urlFuentes(visibles.map((x) => x.tema));

  const aplicar = (id: string) => {
    if (config.tema === id) return;
    cambiar((c) => ({ ...c, tema: id }));
  };

  const alternarFiltro = (f: Filtro) => setFiltros((prev) => {
    const s = new Set(prev);
    if (s.has(f)) s.delete(f);
    else {
      s.add(f);
      if (f === 'oscuro') s.delete('claro');
      if (f === 'claro') s.delete('oscuro');
    }
    return s;
  });

  const aleatorio = () => {
    const candidatos = visibles.filter((x) => x.tema.id !== config.tema);
    if (!candidatos.length) return;
    aplicar(candidatos[Math.floor(Math.random() * candidatos.length)].tema.id);
  };

  /** La base de un tema nuevo: la del tema propio aplicado, o el tema del catálogo aplicado. */
  const baseActual = (): string => {
    if (config.tema.startsWith('ws:')) return propios?.find((p) => 'ws:' + p.id === config.tema)?.base ?? 'pewter';
    return TEMAS.some((t) => t.id === config.tema) ? config.tema : 'pewter';
  };

  const personalizar = (t: Tema, propio: TemaPropio | null) => {
    setEditando(propio
      ? { id: propio.id, nombre: propio.nombre, base: propio.base, cambios: propio.cambios }
      : { id: null, nombre: 'Copia de ' + t.nombre, base: t.id, cambios: {} });
  };

  const guardado = (t: TemaPropio, todos: TemaPropio[]) => {
    setPropios(todos);
    avisarTemasPropios(todos);
    setEditando(null);
    setVista('propios');
    cambiar((c) => ({ ...c, tema: 'ws:' + t.id }));
  };

  const borrado = (temaId: string, todos: TemaPropio[], base: string) => {
    setPropios(todos);
    avisarTemasPropios(todos);
    setEditando(null);
    // Si la landing usaba el tema borrado, vuelve a su base (no al default).
    if (config.tema === 'ws:' + temaId) cambiar((c) => ({ ...c, tema: base }));
  };

  const borrarDesdeMenu = async (p: TemaPropio) => {
    setMenu(null);
    const ok = await confirmar({ titulo: 'Eliminar tema', texto: 'Las landings que lo usan vuelven al tema base.', boton: 'Eliminar' });
    if (!ok) return;
    const r = await pedir<'borrarTema'>({ accion: 'borrarTema', temaId: p.id });
    if (!r.ok) { avisar(r.error); return; }
    avisar('Tema eliminado');
    borrado(p.id, r.temas, p.base);
  };

  const menuPropio = menu ? propios?.find((p) => p.id === menu.id) ?? null : null;

  return (
    <>
      {(
        <div className="gma gmp gmp-panel">
          <EstilosGmp extra={{ href: 'gmp-panel-tema', css: CSS_PANEL_TEMA }} />
          {fuentes && <link rel="stylesheet" href={fuentes} precedence="low" />}
          <div className="gmp-cajon-cab">
            <h2 className="gmp-cajon-tit">Tema</h2>
            <button type="button" className="gmp-x" onClick={cerrar} aria-label="Cerrar" title="Cerrar"><Icono nombre="cerrar" tam={18} /></button>
          </div>
          <div className="gmp-cajon-cuerpo">
            <div className="gmp-tema-acciones">
              <button type="button" className="gmp-btn gmp-btn-contorno"
                onClick={() => setEditando({ id: null, nombre: 'Tema sin título', base: baseActual(), cambios: {} })}>
                <Icono nombre="mas" tam={14} />Nuevo tema
              </button>
              <button type="button" className="gmp-btn gmp-btn-fantasma" onClick={aleatorio} title="Tema aleatorio">
                <Icono nombre="aleatorio" tam={14} />Tema aleatorio
              </button>
            </div>

            <div className="gmp-tema-barra">
              <div className="gmp-seg" role="tablist" aria-label="Temas">
                <button type="button" role="tab" aria-pressed={vista === 'propios'} aria-selected={vista === 'propios'} onClick={() => setVista('propios')}>
                  <Icono nombre="lapiz" tam={14} />Personalizado
                </button>
                <button type="button" role="tab" aria-pressed={vista === 'estandar'} aria-selected={vista === 'estandar'} onClick={() => setVista('estandar')}>
                  <Icono nombre="tema" tam={14} />Estándar
                </button>
              </div>
              <span style={{ flex: 1 }} />
              <button type="button" className="gmp-x" aria-label="Buscar temas" title="Buscar" aria-pressed={buscando}
                onClick={() => { setBuscando((v) => !v); if (buscando) setQ(''); }}>
                <Icono nombre="buscar" tam={17} />
              </button>
            </div>
            {buscando && (
              <input ref={buscador} className="gmp-input" placeholder="Buscar" value={q} aria-label="Buscar temas"
                onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
            )}

            <div className="gmp-tema-chips" role="group" aria-label="Filtros">
              {FILTROS.map((f) => (
                <button key={f.valor} type="button" className="gmp-chip" aria-pressed={filtros.has(f.valor)} onClick={() => alternarFiltro(f.valor)}>{f.texto}</button>
              ))}
            </div>

            {vista === 'propios' && propios === null && !errorPropios && <Giro />}
            {vista === 'propios' && errorPropios && (
              <div className="gmp-vacio">
                <p className="gmp-error" style={{ marginBottom: 8 }}>No se pudieron leer los temas</p>
                <button type="button" className="gmp-btn gmp-btn-contorno gmp-btn-chico" onClick={() => void cargar()}>Reintentar</button>
              </div>
            )}
            {vista === 'propios' && propios && !propios.length && <p className="gmp-vacio">Todavía no hay temas propios.</p>}
            {visibles.length === 0 && lista.length > 0 && <p className="gmp-vacio">Sin resultados</p>}

            <div className="gmp-temas">
              {visibles.map(({ tema: t, propio }) => {
                const activo = config.tema === t.id;
                return (
                  <div key={t.id} className="gmp-tile" data-activo={activo ? '' : undefined}>
                    <button type="button" className="gmp-tile-elegir" aria-pressed={activo} aria-label={`Usar el tema ${t.nombre}`} onClick={() => aplicar(t.id)}>
                      <MuestraTema tema={t} />
                    </button>
                    <div className="gmp-tile-pie">
                      {activo && <Icono nombre="check" tam={14} style={{ color: 'var(--gmp-azul-linea)' }} />}
                      <span title={t.nombre}>{t.nombre}</span>
                      {propio && (
                        <button type="button" className="gmp-tile-menu" aria-label={`Opciones del tema ${t.nombre}`} title="Opciones"
                          onClick={(e) => setMenu({ id: propio.id, ancla: e.currentTarget })}>
                          <Icono nombre="puntos" tam={16} />
                        </button>
                      )}
                    </div>
                    <button type="button" className="gmp-btn gmp-btn-primario gmp-btn-chico gmp-tile-personalizar" onClick={() => personalizar(t, propio)}>
                      Personalizar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {menu && menuPropio && (
        <MenuGma ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={180} etiqueta="Opciones del tema">
          <button type="button" role="menuitem" className="gmp-menu-item"
            onClick={() => { setMenu(null); personalizar(temaPorId('ws:' + menuPropio.id, propios), menuPropio); }}>
            <Icono nombre="lapiz" tam={15} />Personalizar
          </button>
          <button type="button" role="menuitem" className="gmp-menu-item gmp-menu-item-peligro" onClick={() => void borrarDesdeMenu(menuPropio)}>
            <IconoBorrar size={15} />Eliminar
          </button>
        </MenuGma>
      )}
      {editando && (
        <EditorTema
          arranque={editando}
          onCerrar={() => setEditando(null)}
          onGuardado={guardado}
          onBorrado={(id, todos) => borrado(id, todos, editando.base)}
        />
      )}
      {nodoConfirma}
    </>
  );
}

export default PanelTema;
