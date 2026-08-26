// =============================================================================
// navegador — ¿este navegador puede instalar la extensión de MaKo?
// =============================================================================
// SIN `server-only`: lo lee el Video Generator, que es un client component, y
// sobre todo lo leen los tests. La condición de un guard vive en un módulo que
// se pueda importar sin montar la pantalla (AGENTS.md, «un guard sobre algo
// destructivo se escribe en POSITIVO»).
//
// ⚠️ NO EXISTE NINGUNA API QUE CONTESTE ESTA PREGUNTA. `chrome.webstore.install()`
// y `chrome.app.isInstalled` murieron con el inline install en 2018. Todo lo que
// se puede hacer es INFERIR el motor y el formato del dispositivo — así que esto
// es una corazonada, no un hecho, y el llamador tiene que tratarla como tal.
//
// El HECHO equivalente es el atributo `data-mako-puente` que el content script
// pone en el <html>: si está, la extensión ESTÁ instalada, contradiga lo que
// contradiga esta función. La corazonada nunca le gana al hecho.
//
// ── Por qué la condición mira el MOTOR y no la marca ────────────────────────
// La trampa fácil es una lista de nombres: `['Google Chrome','Edge','Brave',…]`.
// Rompe justo lo que quiere proteger, porque **Brave y Arc no ponen su nombre en
// `brands` a propósito** —Brave por anti-fingerprinting, Arc por ser un Chromium
// re-skinneado—: los dos dicen «Google Chrome». Una lista de marcas le negaría
// la extensión a dos navegadores que la instalan perfecto.
//
// Y tampoco puede ser una lista de exclusión («todos menos Safari y Firefox»):
// esa forma crece sola con cada navegador nuevo y crece en silencio. Va en
// positivo y por motor: todo build de Chromium emite `Chromium` en `brands`.
//
// ── Por qué tres estados y no un booleano ───────────────────────────────────
// `navigator.userAgentData` es **secure-context-only**: en `http://` que no sea
// localhost es `undefined` incluso en un Chrome de verdad. Abrir el dev server
// por IP de LAN (`http://192.168.x.x:3000`, probar desde el celular) es
// exactamente ese caso — y es donde más se prueba esta pantalla. Con un booleano,
// ahí le diríamos «tu navegador no sirve» a un Chrome.
//
// Por eso hay un tercer valor. Y por eso «no se sabe» NO muestra el aviso: los
// dos errores no cuestan lo mismo. No avisarle a un Safari le cuesta medio minuto
// y es lo que ya pasa hoy; avisarle de más a un Chrome le niega la feature, no
// tiene recuperación dentro de la pantalla, y es una regresión.

/** Una entrada de `navigator.userAgentData.brands`. */
type MarcaUA = { brand: string; version: string };

/**
 * Lo que usamos de `navigator.userAgentData`, declarado a mano: TypeScript no
 * tipa esa API (no está en lib.dom.d.ts), y `@ts-ignore` taparía también los
 * errores reales de esta función.
 */
type UADataMin = { brands?: MarcaUA[]; mobile?: boolean };

/** Lo mínimo que esta función necesita de un `navigator`, para poder testearla. */
export type NavegadorMin = { userAgentData?: UADataMin; userAgent?: string };

export type PuedeInstalar = 'si' | 'no' | 'no-se-sabe';

/**
 * ¿Este navegador puede instalar una extensión de la Chrome Web Store?
 *
 * Que NO es lo mismo que «¿es Chrome?»: Edge, Brave, Opera, Vivaldi y Arc
 * también instalan de la CWS.
 */
export function puedeInstalarExtension(nav: NavegadorMin): PuedeInstalar {
  const ua = nav.userAgentData;

  if (ua && Array.isArray(ua.brands)) {
    // `userAgentData` SOLO existe en Chromium: Safari y Firefox se opusieron a
    // la spec y no lo implementan. Que esté ya acota el universo.

    // El móvil va ANTES que la marca: Chrome para Android no soporta
    // extensiones, y Chrome para iOS es WebKit disfrazado. Ninguno instala.
    if (ua.mobile === true) return 'no';

    // Positivo y por motor. Ojo con `brands`: Chromium le inyecta una entrada
    // BASURA a propósito, con un nombre que cambia entre versiones («Not)A;Brand»,
    // «Not_A Brand», «Not.A/Brand»…) y en orden aleatorio, justamente para romper
    // al que asuma una lista fija. Por eso se busca por nombre exacto y nunca se
    // indexa por posición ni se mira el largo.
    return ua.brands.some((b) => b.brand === 'Chromium') ? 'si' : 'no-se-sabe';
  }

  // Sin `userAgentData` puede ser Safari o Firefox… o un Chrome servido por
  // http:// no-localhost, donde la API no existe. `window.chrome` desempata
  // hacia «no sé», NUNCA hacia «sí»: es un objeto plano que cualquiera puede
  // escribir, y los WebViews de Chromium lo exponen sin poder instalar nada
  // (el navegador in-app de Instagram es exactamente eso, y es una puerta de
  // entrada real para un cliente que llega por un link).
  if (typeof window !== 'undefined' && typeof (window as { chrome?: unknown }).chrome === 'object') {
    return 'no-se-sabe';
  }

  // Último recurso, y SOLO para confirmar un «no». La cadena de user-agent no
  // dice qué navegador es: dice cómo quiere que lo traten. Chrome, Edge, Brave y
  // Opera meten `Safari/537.36` en la suya, así que buscar «Safari» a secas
  // matchea Chrome — el bug de sniffing más viejo que hay.
  const s = nav.userAgent ?? '';
  const esGecko = /Firefox\/|Gecko\/20100101/.test(s);

  // ⚠️ Los tokens de iOS —`CriOS/` (Chrome), `EdgiOS/`, `OPiOS/`, `FxiOS/`— NO van
  // en esta lista, y es el detalle que hay que entender: Apple obliga a todos los
  // navegadores de iPhone a usar WebKit, así que «Chrome» en iOS es Safari con
  // otro ícono y no instala nada de la Chrome Web Store. Excluirlos acá los
  // dejaría en «no se sabe» cuando son un «no» seguro.
  const esChromiumDeVerdad = /(Chrome|Chromium|Edg|OPR|SamsungBrowser)\//.test(s);
  const esWebKitDeApple = /AppleWebKit/.test(s) && !esChromiumDeVerdad;

  return esGecko || esWebKitDeApple ? 'no' : 'no-se-sabe';
}
