#!/usr/bin/env node
// =============================================================================
// gen-iconos-tiendas — el ícono y la pantalla de arranque de la app de iPhone (nativo/ios), desde el ícono de MaKo (23/10/2026)
// =============================================================================
// Apple pide el ícono de 1024×1024 SIN transparencia y a sangre (la máscara redondeada la pone iOS): public/icon-512.png es de
// 512 con las esquinas transparentes, y agrandarlo lo deja borroso. Por eso se DIBUJA de nuevo: el mismo fondo oscuro y la
// misma estrella dorada, con las medidas tomadas del de 512 (las puntas a 118 px del borde, la curva que pasa por 16 px del
// centro; los colores, leídos de sus píxeles). Android no lo necesita: Bubblewrap arma sus íconos desde el manifiesto.
// Correr: node scripts/gen-iconos-tiendas.mjs
// =============================================================================

import sharp from 'sharp';

const SALIDA = 'nativo/ios/ios/App/App/Assets.xcassets';

/** La estrella de MaKo en una caja de 512 (las cuatro puntas y las curvas que se meten hacia el centro). */
const ESTRELLA = 'M256 118 Q272 240 394 256 Q272 272 256 394 Q240 272 118 256 Q240 240 256 118 Z';
const dorado = `<linearGradient id="d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4C453"/><stop offset="1" stop-color="#F1AD37"/></linearGradient>`;

const icono = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  <defs>${dorado}<linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#28231B"/><stop offset="1" stop-color="#191712"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#f)"/><path d="${ESTRELLA}" fill="url(#d)"/></svg>`;

// La pantalla de arranque: el fondo de la app (--bg de app/globals.css) y la estrella chica al centro, como se ve al abrir.
const arranque = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>${dorado}</defs><rect width="2732" height="2732" fill="#F4F6F9"/>
  <g transform="translate(1366 1366) scale(1.4) translate(-256 -256)"><path d="${ESTRELLA}" fill="url(#d)"/></g></svg>`;

await sharp(Buffer.from(icono)).flatten({ background: '#191712' }).removeAlpha().png().toFile(`${SALIDA}/AppIcon.appiconset/AppIcon-512@2x.png`);
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await sharp(Buffer.from(arranque)).flatten({ background: '#F4F6F9' }).removeAlpha().png().toFile(`${SALIDA}/Splash.imageset/${f}`);
}

// El feature graphic de Play (3/11/2026): 1024×500 sin transparencia, con el fondo y la estrella del ícono. Play lo tapa con un botón de
// «play» si hay video, y lo recorta en algunos lados: lo importante va al centro, sin letra chica.
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>${dorado}<linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#28231B"/><stop offset="1" stop-color="#191712"/></linearGradient></defs>
  <rect width="1024" height="500" fill="url(#f)"/>
  <g transform="translate(250 250) scale(0.86) translate(-256 -256)"><path d="${ESTRELLA}" fill="url(#d)"/></g>
  <text x="390" y="262" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="108" font-weight="700" fill="#F7F4EC">MaKo</text>
  <text x="394" y="322" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="34" fill="#CFC8B8">CRM, chats e IA en un solo lugar</text>
</svg>`;
await sharp(Buffer.from(feature)).flatten({ background: '#191712' }).removeAlpha().png().toFile('nativo/android/feature-graphic.png');

console.log('Listo: el ícono de 1024 y las tres pantallas de arranque en', SALIDA, ', y el feature graphic en nativo/android');
