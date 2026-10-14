// =============================================================================
// El contrato entre el Image Editor (navegador) y /api/image-editor/*
// =============================================================================
// Toda respuesta es `{ ok: true, … }` o `{ ok: false, error }`. Lo importan las rutas (server) y
// el adaptador de MaKo (app/image-editor/mako/nube.ts): sin `server-only` ni valores.

/** Lo que la lista del inicio y «Proyectos» necesitan de un diseño (sin el documento). */
export type ResumenDiseno = {
  id: string;
  titulo: string;
  ancho: number;
  alto: number;
  paginas: number;
  /** URL pública de la miniatura (con `?v=`), o null si todavía no se dibujó. */
  miniatura: string | null;
  creado: string;
  actualizado: string;
};

export type DisenoCompleto = ResumenDiseno & {
  /** El `DoryDocument`: el motor lo valida (y migra si es viejo) al abrirlo. */
  doc: unknown;
  version: number;
};

/** Un archivo de «Subidos». */
export type Subido = {
  id: string;
  nombre: string;
  tipo: string;
  ancho: number;
  alto: number;
  bytes: number;
  url: string;
  creado: string;
};

export type Falla = { ok: false; error: string; conflicto?: true; versionActual?: number };

export type RespLista = { ok: true; disenos: ResumenDiseno[] } | Falla;
export type RespDiseno = { ok: true; diseno: DisenoCompleto } | Falla;
export type RespCrear = { ok: true; id: string; version: number } | Falla;
export type RespGuardar = { ok: true; version: number; actualizado: string } | Falla;
export type RespMiniatura = { ok: true; miniatura: string } | Falla;
export type RespSubidos = { ok: true; subidos: Subido[] } | Falla;
export type RespFirmar = { ok: true; path: string; signedUrl: string; apikey: string | null } | Falla;
export type RespRegistrar = { ok: true; subido: Subido } | Falla;
export type RespOk = { ok: true } | Falla;

/** El cuerpo de POST /api/image-editor/disenos. `id` sólo al subir un diseño que estaba en el navegador. */
export type PedidoCrear = { titulo?: string; doc: unknown; id?: string };
/** El cuerpo de PATCH /api/image-editor/disenos/<id>: lo que no viene queda como estaba. */
export type PedidoGuardar = { version: number; titulo?: string; doc?: unknown };
export type PedidoSubidos =
  | { accion: 'firmar'; tipo: string; tamano: number }
  | { accion: 'registrar'; path: string; nombre?: string; ancho?: number; alto?: number };
