// Quién está detrás de MaKo, como lo dice el documento fiscal.
//
// SIN `server-only` y sin 'use client' a propósito: lo lee la landing (un client
// component que se renderiza en el server) y las páginas legales, y lo importa un test.
//
// ⚠️ SE ESCRIBE EXACTO COMO EN LA VERIFICACIÓN DEL NEGOCIO DE META, apellido primero
// como en la constancia de ARCA. El 08/10/2026 Meta rechazó la verificación del
// portafolio MaKo (493711571134922) con «la razón social de la empresa debe aparecer en
// el sitio web»: compara este texto contra el nombre legal que se le declaró. Un «Leandro
// Martín Tejado» se lee igual para una persona y puede no matchear para su chequeo.
//
// ⚠️ Y TIENE QUE ESTAR EN EL HTML QUE SIRVE EL SERVER, no en lo que agrega el navegador:
// el verificador de un tercero puede no ejecutar JavaScript. Lo fija
// tests/razon-social-sitio.test.ts renderizando la landing sin correr sus efectos.
export const RAZON_SOCIAL_MAKO = 'Tejado Gonzalvez Leandro Martin';

// Quién publica la app en cada tienda (4/11/2026; Martín: «Si, el responsable legal es Leandro»). En la App Store la cuenta
// es de Leandro, así que el vendedor que muestra Apple es RAZON_SOCIAL_MAKO. En Google Play la cuenta es de Martín, y Google
// muestra su nombre legal aunque el nombre público sea MaKo: sin esta línea, un revisor ve en la ficha a alguien que las
// páginas legales no nombran. El responsable del tratamiento y del servicio sigue siendo RAZON_SOCIAL_MAKO.
// Lo fija tests/tiendas-quien-publica.test.ts renderizando /privacidad y /terminos.
export const PUBLICA_EN_PLAY = 'Martín Carballo Koncke';
