// =============================================================================
// Qué apretó la persona en la landing, leído del `detalle` del evento
// =============================================================================
// Vive aparte de TrackingTimelineCard —y sin 'use client' ni 'server-only'— para
// que la decisión tenga test: adentro del componente, ningún test la puede
// importar, y termina siendo lo único sin red justo en la parte que se rompe sola
// (un separador y un prefijo dentro de un string libre que escribe el snippet).
//
// ⚠️ HAY UN SEGUNDO LUGAR QUE PINTA ESTE MISMO CAMPO, y NO está unificado acá a
// propósito: `app/integraciones/ProbarTracking.tsx` escribe «Hizo clic en: » con
// el `detalle` CRUDO. Es el panel con el que el cliente prueba el Pixel de su
// landing, o sea diagnóstico, y ahí el crudo es lo correcto —se quiere ver el
// href tal cual llegó—; esto es copy de la ficha de una persona. Son dos trabajos
// y por eso no comparten función. Si algún día el panel quiere la frase, importa
// `textoDeClic` en vez de escribir la suya: el guard de ese panel está en
// tests/landing-optin.test.ts:631.

/**
 * El destino de un clic, acortado para que entre en un renglón: `#registro` para
 * un ancla y `host/ruta` para un link. Si no se puede leer como URL (un href
 * relativo, un esquema raro), se muestra el crudo recortado — nunca se esconde:
 * el destino es lo único que distingue dos botones que dicen lo mismo.
 */
export function destinoCorto(d: string): string {
  if (d.startsWith('ancla ')) return d.slice('ancla '.length).trim() || d;
  try {
    const u = new URL(d);
    // `tel:` y `mailto:` no tienen host: ahí el pathname ES el número o el mail.
    return (u.host + u.pathname).replace(/\/+$/, '') || d.slice(0, 60);
  } catch { return d.slice(0, 60); }
}

/**
 * Qué apretó la persona, leído del `detalle` que guarda el snippet (mig 0133).
 * Los tres formatos que escribe, y son todos los que escribe:
 *   · `boton: Agendar ahora`            — el elemento no tiene href
 *   · `ancla #registro — Ver precios`   — un ancla de la misma página
 *   · `https://wa.me/52… — Escríbenos`  — un link, con su texto si lo había
 *
 * ⚠️ En el DATO el destino manda sobre el texto (se guarda primero, a propósito:
 * «Confirmar por WhatsApp» y «Escribinos» pueden ser el mismo link, y lo que ese
 * panel quiere contar es adónde va la gente). En el RENGLÓN de la ficha es al
 * revés: lo que distingue esta fila de las otras es la frase que la persona leyó
 * antes de apretar, y el destino va al lado como detalle.
 *
 * El separador es la PRIMERA aparición de ` — `: ni una URL ni `ancla #x` pueden
 * tener espacios, así que lo que venga después es el texto del botón —que sí
 * puede traer su propio guion largo, y entonces viaja entero.
 */
export function textoDeClic(detalle: string | null | undefined): { que: string; adonde: string | null } {
  const raw = detalle?.trim();
  // Sin detalle no se inventa nada: hubo un clic y no sabemos en qué. Los eventos
  // anteriores a la mig 0133 están así, y son mediciones reales.
  if (!raw) return { que: 'Hizo clic en la landing', adonde: null };
  // ⚠️ El prefijo se busca SIN el espacio, y no es un detalle de estilo: el snippet
  // manda `'boton: ' + texto`, así que con un botón sin texto (un ícono, el caso
  // que `esDeW` ya documenta) el detalle es `boton: ` pelado — y el `.trim()` de
  // arriba se come ese espacio. Buscando `'boton: '` ese caso no matchea el
  // prefijo, se va por el camino del link y el renglón sale «Hizo clic en boton:».
  if (raw.startsWith('boton:')) {
    const t = raw.slice('boton:'.length).trim();
    return { que: t ? `Hizo clic en «${t}»` : 'Hizo clic en un botón', adonde: null };
  }
  const corte = raw.indexOf(' — ');
  const destino = (corte === -1 ? raw : raw.slice(0, corte)).trim();
  const texto = corte === -1 ? '' : raw.slice(corte + ' — '.length).trim();
  const corto = destinoCorto(destino);
  return texto
    ? { que: `Hizo clic en «${texto}»`, adonde: corto }
    : { que: `Hizo clic en ${corto}`, adonde: null };
}
