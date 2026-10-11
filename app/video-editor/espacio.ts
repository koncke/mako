// =============================================================================
// El espacio de almacenamiento local del Video Editor, POR WORKSPACE
// =============================================================================
// El motor de OpenCut guarda proyectos y medios en IndexedDB + OPFS, que son
// POR ORIGEN: todas las pestañas de hola-mako.com comparten las mismas bases.
// El super admin mira varios clientes en el mismo navegador (`?ws=N`, una
// pestaña por cliente): sin separar por workspace, vería los proyectos de
// todos mezclados y uno le «heredaría» proyectos a otro.
//
// Por eso TODA base y carpeta del motor se abre con este prefijo. Se aplica en
// el único lugar por donde pasan (los dos adaptadores de services/storage), y
// se lee en CADA apertura —no en el constructor—: el `storageService` es un
// singleton creado al importar el módulo, y una pestaña que cambia de cliente
// sin recargar tiene que pasar a abrir las bases del cliente nuevo.
//
// El número sale del server (getWorkspaceActual → prop de la página), nunca
// de la URL: el `?ws=` lo valida el proxy, y leerlo a mano para decidir datos
// es el IDOR que AGENTS.md describe en «Una cosa, un lugar».

let espacio = 'mako-ws0';

/** Lo fija la raíz del editor antes de montar el motor. */
export function fijarEspacio(ws: number | null): void {
  espacio = ws && Number.isInteger(ws) && ws > 0 ? `mako-ws${ws}` : 'mako-ws0';
}

/** `video-editor-projects` → `mako-ws3-video-editor-projects`. */
export function conEspacio(nombre: string): string {
  return `${espacio}-${nombre}`;
}
