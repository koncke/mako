import 'server-only';

// =============================================================================
// imagen-desarmar-servidor — un carrusel o una imagen de anuncio de Spy, desarmado por la IA del negocio con visión (ticket 97)
// =============================================================================
// Las láminas salen de donde las saca la réplica de Image (`referenciaDelNegocio` + `imagenesDe` + `comoDataUrl`: nuestro bucket
// o un CDN permitido, con su techo de peso). Las mira `leerDocumentoIA`, la cascada de visión del NEGOCIO (su Claude, su Gemini,
// su GPT; nunca la de la plataforma), adentro de `conSuIADelNegocio` (lo prende la ruta). Lo desarmado se guarda una vez por pieza
// y por negocio (`imagen.desarme.<pieza>`): no se vuelve a pagar.
// =============================================================================

import { getSettingEstricto, setSetting } from './settings';
import { leerDocumentoIA } from './ai-cheap';
import { referenciaDelNegocio } from './carruseles/crear-servidor';
import { comoDataUrl } from './carruseles/replica-servidor';
import { imagenesDe } from './carruseles/explorar';
import {
  LAMINAS_A_MIRAR, VERSION_DESARME_IMAGEN, instruccionDesarmeImagen, jsonDeTexto, leerDesarmeImagen, settingDeDesarmeImagen,
  type DesarmeImagen, type DesarmeImagenGuardado,
} from './imagen-desarmar';

export async function desarmeImagenGuardado(piezaId: number): Promise<DesarmeImagenGuardado | null> {
  const crudo = await getSettingEstricto(settingDeDesarmeImagen(piezaId));
  if (!crudo) return null;
  try {
    const g = JSON.parse(crudo) as DesarmeImagenGuardado;
    return g?.version === VERSION_DESARME_IMAGEN && g.desarme?.laminas?.length ? g : null;
  } catch { return null; }
}

export type ResultadoDesarmeImagen = { ok: true; guardado: DesarmeImagenGuardado; nuevo: boolean } | { ok: false; error: string };

/** Desarma la pieza `piezaId` de Spy (o devuelve lo guardado). Nunca tira por un error del proveedor. */
export async function desarmarImagenDeSpy(piezaId: number): Promise<ResultadoDesarmeImagen> {
  const ya = await desarmeImagenGuardado(piezaId);
  if (ya) return { ok: true, guardado: ya, nuevo: false };
  const c = await referenciaDelNegocio(piezaId).catch(() => null);
  if (!c) return { ok: false, error: 'Esa pieza ya no está en tu Competitors Spy.' };
  const clase: DesarmeImagen['clase'] = c.clase === 'anuncio' ? 'anuncio' : c.medio === 'carrusel' || (c.laminas ?? 0) > 1 ? 'carrusel' : 'imagen';
  const urls = imagenesDe(c).slice(0, clase === 'carrusel' ? LAMINAS_A_MIRAR : 1);
  const imagenes = (await Promise.all(urls.map(comoDataUrl))).filter((x): x is string => !!x);
  if (!imagenes.length) return { ok: false, error: 'No pude traer sus imágenes (la red no las dejó bajar).' };
  const cuenta = c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre;
  let texto: string;
  let modelo: string;
  try {
    const r = await leerDocumentoIA({
      dataUrl: imagenes[0],
      dataUrls: imagenes,
      isPdf: false,
      nombreArchivo: 'lamina.jpg',
      prompt: instruccionDesarmeImagen({ laminas: imagenes.length, clase, cuenta }),
      json: true,
      feature: 'imagen-desarmar',
      motivo: `Desarmar ${clase === 'carrusel' ? 'el carrusel' : 'la imagen'} de ${cuenta}`,
      maxTokens: 8000,
      timeoutMs: 150_000,
    });
    texto = r.text;
    modelo = r.provider;
  } catch (e) {
    return { ok: false, error: `Tu IA no pudo mirarlo (${(e instanceof Error ? e.message : String(e)).slice(0, 160)}).` };
  }
  const leido = leerDesarmeImagen(jsonDeTexto(texto), { laminas: imagenes.length, clase });
  if (!leido.ok) return { ok: false, error: `La respuesta no sirvió: ${leido.error}` };
  // ⚠️ SPY GUARDA SÓLO LA PORTADA de un carrusel (medido el 14/11/2026: `laminas_imagenes` existe en la biblioteca de ejemplos, no
  // en `spy_piezas`). Lo que no se miró se dice; no se adivinan las demás láminas.
  if (clase === 'carrusel' && (c.laminas ?? 0) > imagenes.length) {
    leido.desarme.dudas.unshift(`Sólo vi ${imagenes.length === 1 ? 'la portada' : `${imagenes.length} láminas`} de ${c.laminas}: Competitors Spy no guarda las demás.`);
  }
  const guardado: DesarmeImagenGuardado = { version: VERSION_DESARME_IMAGEN, piezaId, cuenta, cuando: new Date().toISOString(), modelo, desarme: leido.desarme };
  await setSetting(settingDeDesarmeImagen(piezaId), JSON.stringify(guardado));
  return { ok: true, guardado, nuevo: true };
}
