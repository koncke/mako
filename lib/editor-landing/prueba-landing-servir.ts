// =============================================================================
// prueba-landing-servir — qué versión de una landing publicada se le sirve a ESTE pedido (O18, L2; 18/11/2026)
// =============================================================================
// AGENTS.md, «Una prueba A/B la decide lib/pruebas/juez.ts»: servir es `servirRama` (lib/pruebas/store.ts → `ramaParaServir`),
// nunca un sorteo sin registro. Esto lo llama `responderPublico` (pagina-publica.ts, `dep.probar`) desde las rutas de una página
// publicada (/l/<slug>, /l/<slug>/<ruta> y el dominio propio), y SÓLO decide; la base entra por `dep` (los tests la reemplazan).
//
// El orden, y por qué:
//   1. SIN PRUEBA CORRIENDO en `landing:<doc>` → null: la página sale como siempre, con su caché. Una propuesta no se sirve
//      (la arranca una persona; la primera en público espera el sí de Martín, docs/diseno-pruebas-ab.md M1).
//   2. Con prueba, la respuesta es PRIVADA (`CABECERAS_CON_PRUEBA`) para TODO pedido, también los que van fijos a A: un A
//      guardado en el borde de Vercel se lo daría a todos durante 30 s sin repartir.
//   3. Fijo a A: lo de MaKo (`vaFijoEnA`), sin cookie ni asignación.
//   4. B se armó sobre una A: si lo publicado ya no es esa versión (`lugar.version_base`), o una rama no tiene la MISMA
//      estructura que A (`diferenciasDeEstructura`: pagos, formularios, enlaces, precios, HTML personalizado), se sirve A y NO
//      se asigna a nadie. Antes de asignar: una persona contada en B que vio A ensucia la prueba.
//   5. La unidad es el `visitor_id` (la cookie del Pixel; sin ella, una nueva que pone el servidor). La rama que ya vio va en
//      la cookie del servidor `mko_ab_<prueba>` y se respeta aunque el visitante sea nuevo (`preferida`).
//   6. `servirRama` escribe la asignación y, si no pudo, devuelve el CONTROL: nunca una rama que no quedó registrada.
// =============================================================================

import type { LecturaPublica } from './pagina-publica';
import { leerFoto, type FotoPublicada } from './server-reglas';
import { CABECERAS_CON_PRUEBA, cookieDePrueba, cookieDeVisitante, diferenciasDeEstructura, ramaDeCookie, vaFijoEnA, visitanteDeCookie, type FotoComparable } from './prueba-landing';
import type { PruebaGuardada } from '../pruebas/store';

/** La clave del lugar de una prueba de landing (diseño 2.2: `landing:<doc>`). */
export const claveLugarLanding = (docId: number): string => `landing:${docId}`;

/** Lo que la ruta leyó de lo publicado (`SitioPublico` de publicar.ts), en lo que esto mira. */
export type SitioServible = LecturaPublica & {
  docId: number;
  foto: LecturaPublica['foto'] & Pick<FotoPublicada, 'paginas' | 'config' | 'version'>;
  /** Lo que la foto guarda y `leerFoto` no copia (los productos de los botones de pago y el HTML personalizado), CRUDO. */
  estructura?: { pagos?: unknown; htmlLibre?: unknown };
};

/** Qué se sirve: la lectura de la rama, las cabeceras de caché que la reemplazan y las cookies a poner. */
export type PruebaServida = { lectura: LecturaPublica; cabeceras: Readonly<Record<string, string>>; setCookie: string[]; rama: string | null };

export type DepServir = {
  pruebaViva: (ws: number, claveLugar: string) => Promise<PruebaGuardada | null>;
  servirRama: (ws: number, p: PruebaGuardada, unidad: string, o: { at: string; preferida: string | null }) => Promise<string>;
  /** La config de una foto como la sanea la ruta al servir (`limpiarConfig`): A ya viene saneada, B se sanea igual. */
  normalizarConfig: (config: unknown) => unknown;
  nuevoVisitante: () => string;
  ahora?: () => Date;
  avisar?: (texto: string) => void;
};

const comparable = (paginas: FotoComparable['paginas'], config: unknown, crudo: { pagos?: unknown; htmlLibre?: unknown } | undefined): FotoComparable =>
  ({ paginas, config, pagos: crudo?.pagos, htmlLibre: crudo?.htmlLibre });

/** Las ramas que no son el control, con su foto leída, o el motivo por el que no se pueden servir. */
function fotosDeRamas(sitio: SitioServible, p: PruebaGuardada, dep: DepServir): { fotos: Map<string, FotoPublicada> } | { motivo: string } {
  const a = comparable(sitio.foto.paginas, sitio.foto.config, sitio.estructura);
  const fotos = new Map<string, FotoPublicada>();
  for (const r of p.ramas) {
    if (r.control || !r.activa) continue;
    const foto = leerFoto(r.contenido);
    if (!foto) return { motivo: `la rama ${r.clave} no tiene una foto publicable` };
    const crudo = r.contenido as { pagos?: unknown; htmlLibre?: unknown };
    const motivos = diferenciasDeEstructura(a, comparable(foto.paginas, dep.normalizarConfig(foto.config), crudo));
    if (motivos.length) return { motivo: `la rama ${r.clave} ${motivos[0]}` };
    fotos.set(r.clave, foto);
  }
  return { fotos };
}

/** La lectura de una rama: su HTML y su hoja (B se armó con las suyas); lo demás, lo de A (la estructura es la misma). */
function lecturaDeRama(sitio: SitioServible, foto: FotoPublicada, ruta: string): LecturaPublica | null {
  const pagina = foto.paginas.find((x) => x.ruta === ruta);
  if (!pagina) return null;
  return {
    ...sitio,
    foto: { ...sitio.foto, css: foto.css, cssDiseno: foto.cssDiseno ?? null, fuentes: foto.fuentes },
    pagina: { html: pagina.html, titulo: sitio.pagina.titulo, descripcion: sitio.pagina.descripcion },
  };
}

/**
 * Qué se le sirve a este pedido de la página `ruta` publicada, o null si la landing no tiene una prueba corriendo (entonces
 * la página sale como siempre). Nunca tira por la prueba: lo que no se puede decidir sirve A.
 */
export async function servirPruebaDeLanding(sitio: SitioServible, ruta: string, req: Request, dep: DepServir): Promise<PruebaServida | null> {
  const ws = sitio.workspaceId;
  const p = await dep.pruebaViva(ws, claveLugarLanding(sitio.docId));
  if (!p || p.estado !== 'corriendo') return null;
  const comoA = (setCookie: string[] = []): PruebaServida => ({ lectura: sitio, cabeceras: CABECERAS_CON_PRUEBA, setCookie, rama: null });
  const avisar = (t: string) => dep.avisar?.(`[pruebas] landing #${sitio.docId}, prueba #${p.id}: ${t}`);

  if (vaFijoEnA({ url: req.url, userAgent: req.headers.get('user-agent') })) return comoA();
  if (Number(p.lugar.version_base) !== sitio.foto.version) {
    avisar(`lo publicado es la versión ${sitio.foto.version} y la prueba se armó sobre la ${String(p.lugar.version_base ?? '(sin versión)')}: va A, sin asignar`);
    return comoA();
  }
  const ramas = fotosDeRamas(sitio, p, dep);
  if ('motivo' in ramas) { avisar(`${ramas.motivo}: va A, sin asignar`); return comoA(); }

  const segura = new URL(req.url).protocol === 'https:';
  const cookies = req.headers.get('cookie');
  const setCookie: string[] = [];
  let unidad = visitanteDeCookie(cookies);
  if (!unidad) {
    unidad = dep.nuevoVisitante();
    setCookie.push(cookieDeVisitante(unidad, segura));
  }
  const activas = p.ramas.filter((r) => r.activa).map((r) => r.clave);
  const preferida = ramaDeCookie(cookies, p.id, activas);
  const rama = await dep.servirRama(ws, p, unidad, { at: (dep.ahora?.() ?? new Date()).toISOString(), preferida });
  setCookie.push(cookieDePrueba(p.id, rama, segura));
  const control = p.ramas.find((r) => r.control)?.clave ?? 'A';
  if (rama === control) return { ...comoA(setCookie), rama };
  const foto = ramas.fotos.get(rama);
  const lectura = foto ? lecturaDeRama(sitio, foto, ruta) : null;
  if (!lectura) { avisar(`la rama ${rama} no tiene la página «${ruta || 'inicio'}»: va A`); return comoA(setCookie); }
  return { lectura, cabeceras: CABECERAS_CON_PRUEBA, setCookie, rama };
}
