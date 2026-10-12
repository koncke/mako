// =============================================================================
// El borrador del alta de un lead: lo que se tipeó y no se creó, en el navegador
// =============================================================================
// Pedido de Martín (12/10/2026, segundo feedback del CRM, punto 2): «Si le doy a nuevo lead
// siempre debería quedar el borrador, por más que salga del modal o incluso de refrescar la
// pagina». Los cuatro campos del alta (nombre, email, teléfono con su país e Instagram) se
// guardan en `localStorage` mientras se escriben, y vuelven al abrir el modal otra vez. Se
// borran al crear (o al agregar al lead que ya existía), y con «Vaciar».
//
// Módulo PURO (sin 'use client' ni `window`) para que tenga test: la clave, el saneo de lo
// guardado y la pregunta «¿hay algo que guardar?».
//
// ⚠️ LA CLAVE LLEVA EL WORKSPACE DE LA PESTAÑA (AGENTS.md → «Lo que se guarda en el NAVEGADOR
// lleva el workspace en la clave»): el super admin abre varios clientes a la vez y el borrador
// de uno no puede aparecer en el alta de otro. Es una conveniencia por persona, no un dato: si
// el navegador no deja leer o escribir, el alta funciona igual, vacía.

export type PerfilBorrador = { usuario: string; nombre: string | null; foto: string | null };

export type BorradorAlta = {
  nombre: string;
  email: string;
  /** El código de país elegido (`52`, `54`…). Sólo cuenta si hay número. */
  lada: string;
  numero: string;
  /** Lo escrito en el buscador de Instagram. */
  ig: string;
  /** El perfil elegido de la lista, si se eligió uno. */
  perfil: PerfilBorrador | null;
};

export function claveBorradorAlta(ws: number | null): string {
  return `mako.crm.alta.${ws ?? 'propio'}`;
}

/** ¿Hay algo que valga la pena guardar? La lada sola no: es el default de un campo vacío. */
export function hayBorrador(b: BorradorAlta): boolean {
  return !!(b.nombre.trim() || b.email.trim() || b.numero.replace(/\D/g, '') || b.ig.trim() || b.perfil);
}

const txt = (v: unknown, tope: number): string => (typeof v === 'string' ? v.slice(0, tope) : '');

/** Lo guardado, saneado. Sin nada, roto o vacío: null (el alta arranca limpia). */
export function leerBorradorAlta(texto: string | null): BorradorAlta | null {
  if (!texto) return null;
  let crudo: unknown;
  try { crudo = JSON.parse(texto); } catch { return null; }
  if (!crudo || typeof crudo !== 'object') return null;
  const o = crudo as Record<string, unknown>;
  const p = o.perfil as Record<string, unknown> | null | undefined;
  const perfil = p && typeof p === 'object' && typeof p.usuario === 'string' && p.usuario
    ? { usuario: txt(p.usuario, 60), nombre: typeof p.nombre === 'string' ? txt(p.nombre, 200) : null, foto: typeof p.foto === 'string' ? txt(p.foto, 2000) : null }
    : null;
  const b: BorradorAlta = {
    nombre: txt(o.nombre, 300),
    email: txt(o.email, 300),
    lada: txt(o.lada, 6).replace(/\D/g, ''),
    numero: txt(o.numero, 40),
    ig: txt(o.ig, 120),
    perfil,
  };
  return hayBorrador(b) ? b : null;
}
