// =============================================================================
// Los estilos de la vista de funnel (DialogoFunnel.tsx), 13/11/2026
// =============================================================================
// Como string y no como .module.css: los tests importan los componentes del editor desde Node (PanelPaginas, por ejemplo), y
// Node no sabe cargar un .css (la primera versión, con módulo CSS, rompió tests/editor-landing-armazon.test.ts con «Unexpected
// token '.'»). El componente los pone en un <style> propio; las clases llevan el prefijo gfn- para no chocar con nada.
// =============================================================================

/** El nombre de cada clase. */
export const s = {
  capa: 'gfn-capa',
  barra: 'gfn-barra',
  tenue: 'gfn-tenue',
  lienzo: 'gfn-lienzo',
  titulo: 'gfn-titulo',
  fila: 'gfn-fila',
  tramo: 'gfn-tramo',
  paso: 'gfn-paso',
  mini: 'gfn-mini',
  num: 'gfn-num',
  portada: 'gfn-portada',
  cuerpo: 'gfn-cuerpo',
  ruta: 'gfn-ruta',
  chip: 'gfn-chip',
  otras: 'gfn-otras',
  alerta: 'gfn-alerta',
  abrir: 'gfn-abrir',
  flecha: 'gfn-flecha',
  suave: 'gfn-suave',
  rotulo: 'gfn-rotulo',
  linea: 'gfn-linea',
  rota: 'gfn-rota',
  menu: 'gfn-menu',
  nuevo: 'gfn-nuevo',
  punto: 'gfn-punto',
} as const;

export const CSS_FUNNEL = `.gfn-capa, .gfn-capa * { box-sizing: border-box; }
.gfn-capa { position: fixed; inset: 0; display: flex; flex-direction: column; background: var(--gma-fondo, #f5f6f8); color: var(--gma-texto, #1f2430); }
.gfn-barra { height: 52px; flex: none; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: var(--gma-panel, #ffffff); border-bottom: 1px solid var(--gma-borde, #e3e6eb); }
.gfn-barra b { font-size: 15px; }
.gfn-tenue { color: var(--gma-tenue, #6b7280); font-size: 13px; }
.gfn-lienzo { flex: 1; overflow: auto; padding: 28px 24px 24px; }
.gfn-titulo { font-size: 20px; margin: 0 0 20px; }
.gfn-fila { display: flex; align-items: flex-start; min-width: max-content; }
.gfn-tramo { display: flex; align-items: flex-start; }
.gfn-paso { width: 200px; background: var(--gma-panel, #ffffff); border: 1px solid var(--gma-borde, #e3e6eb); border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06); }
.gfn-paso[data-activa='si'] { outline: 2px solid var(--gma-azul, #2f6fed); outline-offset: 2px; }
.gfn-mini { position: relative; height: 112px; border-top: 6px solid #c4cad4; background: linear-gradient(180deg, #fbfbfc, #f1f3f6); border-bottom: 1px solid var(--gma-borde, #e3e6eb); padding: 34px 12px 10px; overflow: hidden; }
.gfn-num { position: absolute; top: 8px; left: 10px; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 1px solid var(--gma-borde, #e3e6eb); font-size: 12px; font-weight: 700; display: grid; place-items: center; }
.gfn-portada { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-weight: 700; font-size: 13px; line-height: 1.3; color: #3b4252; }
.gfn-cuerpo { padding: 12px 14px 14px; display: grid; gap: 4px; justify-items: start; }
.gfn-cuerpo h3 { margin: 0; font-size: 15px; }
.gfn-ruta { color: var(--gma-tenue, #6b7280); font-size: 12.5px; }
.gfn-chip { margin-top: 4px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #fff; }
.gfn-otras { margin-top: 4px; font-size: 12px; color: var(--gma-tenue, #6b7280); }
.gfn-alerta { margin-top: 4px; font-size: 12px; color: #d93025; font-weight: 600; }
.gfn-abrir { margin-top: 8px; border: 0; background: none; padding: 0; color: var(--gma-azul, #2f6fed); font-weight: 600; font-size: 13px; cursor: pointer; }
.gfn-flecha { position: relative; width: 104px; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 104px 6px 0; }
.gfn-flecha.gfn-suave { width: 56px; }
.gfn-rotulo { border: 0; background: none; padding: 2px 4px; border-radius: 6px; font-size: 12px; line-height: 1.3; color: var(--gma-tenue, #6b7280); text-align: center; cursor: pointer; }
.gfn-rotulo:hover { background: rgba(47, 111, 237, 0.08); color: var(--gma-texto, #1f2430); }
.gfn-linea { width: 100%; height: 2px; background: #9aa3b2; position: relative; }
.gfn-linea::after { content: ''; position: absolute; right: -1px; top: -5px; border-left: 9px solid #9aa3b2; border-top: 6px solid transparent; border-bottom: 6px solid transparent; }
.gfn-suave .gfn-linea { background: #c4cad4; }
.gfn-suave .gfn-linea::after { border-left-color: #c4cad4; }
.gfn-rota .gfn-rotulo { color: #d93025; }
.gfn-rota .gfn-linea { background: repeating-linear-gradient(90deg, #d93025 0 6px, transparent 6px 11px); }
.gfn-rota .gfn-linea::after { border-left-color: #d93025; }
.gfn-menu { position: absolute; top: 150px; left: -40px; width: 230px; background: #fff; border: 1px solid var(--gma-borde, #e3e6eb); border-radius: 10px; box-shadow: 0 10px 30px rgba(16, 24, 40, 0.14); padding: 6px; z-index: 2; display: grid; }
.gfn-menu p { margin: 4px 8px 6px; color: var(--gma-tenue, #6b7280); font-size: 12.5px; }
.gfn-menu button { border: 0; background: none; text-align: left; padding: 7px 8px; border-radius: 7px; font-size: 13px; cursor: pointer; }
.gfn-menu button:hover, .gfn-menu button[data-sel='si'] { background: #e8f0fe; color: var(--gma-azul, #2f6fed); }
.gfn-nuevo { width: 184px; margin-top: 0; border: 2px dashed #c4cad4; border-radius: 14px; padding: 14px 12px; background: #fafbfc; display: grid; gap: 6px; }
.gfn-nuevo b { margin-bottom: 4px; }
.gfn-nuevo button { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 1px solid var(--gma-borde, #e3e6eb); border-radius: 8px; background: #fff; font-weight: 500; font-size: 13px; cursor: pointer; text-align: left; }
.gfn-nuevo button:hover:not(:disabled) { border-color: var(--gma-azul, #2f6fed); }
.gfn-nuevo button:disabled { opacity: 0.5; cursor: default; }
.gfn-punto { width: 9px; height: 9px; border-radius: 50%; flex: none; }

/* En el teléfono, el recorrido baja: una tarjeta debajo de la otra y las flechas hacia abajo. */
@media (max-width: 768px) {
  .gfn-lienzo { padding: 18px 16px; }
  .gfn-fila, .gfn-tramo { flex-direction: column; align-items: stretch; min-width: 0; }
  .gfn-paso, .gfn-nuevo { width: 100%; }
  .gfn-mini { height: 84px; }
  .gfn-flecha, .gfn-flecha.gfn-suave { width: 100%; padding: 6px 0; flex-direction: row; justify-content: center; }
  .gfn-linea { width: 2px; height: 26px; order: -1; }
  .gfn-linea::after { right: -5px; top: auto; bottom: -1px; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 9px solid #9aa3b2; }
  .gfn-suave .gfn-linea::after { border-left-color: transparent; border-top-color: #c4cad4; }
  .gfn-rota .gfn-linea { background: repeating-linear-gradient(180deg, #d93025 0 6px, transparent 6px 11px); }
  .gfn-rota .gfn-linea::after { border-left-color: transparent; border-top-color: #d93025; }
  .gfn-menu { top: 40px; left: 0; }
}
`;
