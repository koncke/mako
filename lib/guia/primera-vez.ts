// =============================================================================
// La guía: la primera vez de cada persona en cada pestaña (PURO; 29/10/2026)
// =============================================================================
// docs/mako-iniciativa/guia.md §3.1. La marca es `guia-<key de nav.ts>` en `usuarios.perfil.recorridos`, por /api/recorridos
// (la de los recorridos de siempre: por PERSONA, no por negocio, con su respaldo en el navegador). Aprender una pestaña es de la
// persona: a propósito sin el workspace (las aperturas sí lo llevan, lib/aperturas/reglas.ts).
//   · quien ya vio el recorrido viejo de una tab no recibe la pregunta (`YA_VISTO_POR`);
//   · tres «Ya sé usarla» (en tres tabs) → `guia-ninguna`: ya sabe moverse, no pregunta en ninguna. /api/recorridos guarda ids
//     con su fecha, no respuestas: por eso «Ya sé usarla» marca además `guia-sabe-<key>`, y se cuentan esas;
//   · el super admin «viendo como cliente» marca SU fila (como los recorridos).
// =============================================================================

export const PREFIJO_GUIA = 'guia-';
export const ID_NINGUNA = 'guia-ninguna';
export const PREFIJO_SABE = 'guia-sabe-';
/** Cuántos «Ya sé usarla» apagan la pregunta en todas las tabs. */
export const SABE_PARA_NINGUNA = 3;

export const idGuia = (key: string): string => `${PREFIJO_GUIA}${key}`;
export const idSabe = (key: string): string => `${PREFIJO_SABE}${key}`;

/** Los recorridos de antes que ya enseñaron una tab: quien los vio no recibe su pregunta. */
export const YA_VISTO_POR: Readonly<Record<string, readonly string[]>> = {
  mako: ['sb-inicio'],
  graphics: ['dashboard', 'dashboard-edicion'],
  setting: ['automations'],
  'customer-success': ['cs-curso', 'cs-curso-leccion'],
  crm: ['crm-ficha-edicion'],
};

/** ¿Ya no se le pregunta en esta tab? null = todavía no se sabe (y con null NO se pregunta: aparecería un instante). */
export function yaLaVio(vistos: ReadonlySet<string> | null, key: string): boolean | null {
  if (!vistos) return null;
  if (vistos.has(ID_NINGUNA) || vistos.has(idGuia(key))) return true;
  return (YA_VISTO_POR[key] ?? []).some((id) => vistos.has(id));
}

/** Lo que se marca con una respuesta a la pregunta: siempre la tab; con «Ya sé usarla», su `sabe` y, al tercero, `ninguna`. */
export function marcasAlContestar(vistos: ReadonlySet<string>, key: string, yaSabe: boolean): string[] {
  const out = [idGuia(key)];
  if (!yaSabe) return out;
  out.push(idSabe(key));
  const sabe = new Set([...vistos].filter((id) => id.startsWith(PREFIJO_SABE)));
  sabe.add(idSabe(key));
  if (sabe.size >= SABE_PARA_NINGUNA) out.push(ID_NINGUNA);
  return out;
}
