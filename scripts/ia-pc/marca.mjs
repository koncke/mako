// =============================================================================
// marca — las imágenes de «MaKo en tu computadora»: el asistente de Windows, sus íconos y el de MaKo.app (25/10/2026)
// =============================================================================
// Martín, 25/10/2026: «el instalador de MaKo debe estar personalizado con el diseño de mako». Hasta la 0.4.2 el asistente de
// Inno Setup salía con las imágenes de fábrica (la caja azul) y el programa con el ícono genérico de un .exe.
//
// La estructura es la de VS Code, que también se instala con Inno Setup (microsoft/vscode, build/win32/code.iss): la imagen
// GRANDE a la izquierda de la bienvenida y del final (WizardImageFile), la CHICA arriba a la derecha de las páginas del medio
// (WizardSmallImageFile), cada una en varios tamaños para que no se vea borrosa con la pantalla al 125, 150 o 200 %, y el ícono
// del instalador (SetupIconFile). Las medidas son las de la ayuda de Inno Setup 6.7 (las áreas desde la 6.6.0).
//
// Las piezas salen de la marca, no se dibujan de nuevo:
//   · el LOGO es el de app/_components/MakoBrand.tsx (MakoLogo): el cuadrado oscuro con la chispa dorada;
//   · la CRIATURA es la estrella de MaKo de app/admin/operaciones/Muneco.tsx (ASPECTO_MAKO: forma estrella, --mako, sonrisa),
//     con su cara (los ojos, el brillo y la boca), quieta: una imagen de Inno no se anima.
// Si la marca cambia, se cambia acá y se corre de nuevo: `node scripts/ia-pc/marca.mjs` (escribe installer/marca/, que va al repo:
// publicar-binarios no necesita sharp).
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Los colores de la marca (app/globals.css → --mako, --mako-lite; MakoBrand.tsx → el fondo del logo; --criatura-tinta). */
export const COLORES = {
  oro: '#F2B01E',
  oroClaro: '#F8CB63',
  fondoArriba: '#2A251C',
  fondoAbajo: '#171511',
  crema: '#F3F0E7',
  tinta: '#22262E',
};

/** La chispa de 4 puntas de MakoBrand.tsx (SPARK), centrada en 0,0 y de radio ~11. */
const CHISPA = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';

/** El logo (MakoLogo, viewBox 0 0 48 48). `id` separa los gradientes cuando van varios en un mismo SVG. */
export function svgLogo(lado, id = 'l') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 48 48">
<defs>
<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORES.fondoArriba}"/><stop offset="1" stop-color="${COLORES.fondoAbajo}"/></linearGradient>
<linearGradient id="${id}o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORES.oroClaro}"/><stop offset="1" stop-color="${COLORES.oro}"/></linearGradient>
</defs>
<rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="url(#${id}f)" stroke="${COLORES.oro}" stroke-opacity="0.35" stroke-width="1"/>
<g transform="translate(24 24) scale(1.55)"><path d="${CHISPA}" fill="url(#${id}o)"/></g>
</svg>`;
}

/**
 * La criatura de MaKo (Muneco.tsx, viewBox 0 0 40 40): el cuerpo de estrella con el trazo redondo, el brillo, los ojos con su
 * luz y la sonrisa. Va como un <g> para meterla en otra imagen.
 */
export function grupoCriatura() {
  const y = 19; const dx = 4.2; const b = y + 4.6; // GEO.estrella y la boca «sonrisa»
  return `<g>
<path d="M20 3.5C22.2 13 27 17.8 36.5 20C27 22.2 22.2 27 20 36.5C17.8 27 13 22.2 3.5 20C13 17.8 17.8 13 20 3.5Z" fill="${COLORES.oro}" stroke="${COLORES.oro}" stroke-width="5" stroke-linejoin="round"/>
<ellipse cx="15.5" cy="14.5" rx="4.2" ry="2.6" fill="#fff" opacity="0.38" transform="rotate(-28 15.5 14.5)"/>
<ellipse cx="${20 - dx}" cy="${y}" rx="2.5" ry="3.1" fill="${COLORES.tinta}"/>
<ellipse cx="${20 + dx}" cy="${y}" rx="2.5" ry="3.1" fill="${COLORES.tinta}"/>
<circle cx="${20 - dx + 0.9}" cy="${y - 1.2}" r="0.85" fill="#fff"/>
<circle cx="${20 + dx + 0.9}" cy="${y - 1.2}" r="0.85" fill="#fff"/>
<path d="M17.4 ${b}q2.6 2.2 5.2 0" fill="none" stroke="${COLORES.tinta}" stroke-width="1.6" stroke-linecap="round"/>
</g>`;
}

/**
 * La imagen GRANDE del asistente (bienvenida y final): el fondo oscuro del logo, un halo dorado, la criatura y «MaKo» abajo,
 * como el loader de bienvenida (MakoIntro: la M y la K doradas). En proporción 164:314, la que mantiene Inno; se dibuja en
 * 240×459 y se escala.
 */
export function svgAsistente(ancho, alto) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 240 459" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORES.fondoArriba}"/><stop offset="1" stop-color="${COLORES.fondoAbajo}"/></linearGradient>
<radialGradient id="h" cx="120" cy="190" r="150" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${COLORES.oro}" stop-opacity="0.30"/><stop offset="0.55" stop-color="${COLORES.oro}" stop-opacity="0.07"/><stop offset="1" stop-color="${COLORES.oro}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="240" height="459" fill="url(#f)"/>
<rect width="240" height="459" fill="url(#h)"/>
<circle cx="120" cy="190" r="78" fill="none" stroke="${COLORES.oro}" stroke-opacity="0.20" stroke-width="1.5"/>
<circle cx="120" cy="190" r="104" fill="none" stroke="${COLORES.oroClaro}" stroke-opacity="0.10" stroke-width="1.5"/>
<g transform="translate(184 92) scale(0.9)"><path d="${CHISPA}" fill="${COLORES.oroClaro}" opacity="0.55"/></g>
<g transform="translate(58 286) scale(0.55)"><path d="${CHISPA}" fill="${COLORES.oro}" opacity="0.45"/></g>
<g transform="translate(66 136) scale(2.7)">${grupoCriatura()}</g>
<text x="120" y="356" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="48"><tspan fill="${COLORES.oro}">M</tspan><tspan fill="${COLORES.crema}">a</tspan><tspan fill="${COLORES.oro}">K</tspan><tspan fill="${COLORES.crema}">o</tspan></text>
<text x="120" y="384" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="${COLORES.crema}" fill-opacity="0.62">en tu computadora</text>
</svg>`;
}

/** Las áreas de la ayuda de Inno Setup 6.7, de 100 % a 250 % (WizardImageFile y WizardSmallImageFile). */
export const TAMANOS_GRANDE = [[202, 386], [269, 515], [336, 643], [403, 772], [430, 824], [498, 953], [534, 1022]];
export const TAMANOS_CHICA = [58, 77, 97, 116, 124, 143, 159];
/** Los del .ico (Windows elige; el de 256 va en PNG, como pide desde Vista) y los del .icns (los de PNG: ic07 a ic10). */
export const TAMANOS_ICO = [16, 24, 32, 48, 64, 128, 256];
export const TIPOS_ICNS = [['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]];

/** Un .ico con PNG adentro: la cabecera (6), una entrada de 16 bytes por imagen y las imágenes. */
export function armarIco(imagenes) {
  const cab = Buffer.alloc(6 + 16 * imagenes.length);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(imagenes.length, 4);
  let donde = cab.length;
  imagenes.forEach(({ lado, png }, i) => {
    const e = 6 + 16 * i;
    cab.writeUInt8(lado >= 256 ? 0 : lado, e); cab.writeUInt8(lado >= 256 ? 0 : lado, e + 1);
    cab.writeUInt8(0, e + 2); cab.writeUInt8(0, e + 3);
    cab.writeUInt16LE(1, e + 4); cab.writeUInt16LE(32, e + 6);
    cab.writeUInt32LE(png.length, e + 8); cab.writeUInt32LE(donde, e + 12);
    donde += png.length;
  });
  return Buffer.concat([cab, ...imagenes.map((x) => x.png)]);
}

/** Un .icns: «icns» + el largo total, y cada imagen con su tipo de 4 letras y su largo (big-endian, cabeceras incluidas). */
export function armarIcns(imagenes) {
  const partes = imagenes.map(({ tipo, png }) => {
    const c = Buffer.alloc(8); c.write(tipo, 0, 'ascii'); c.writeUInt32BE(8 + png.length, 4);
    return Buffer.concat([c, png]);
  });
  const cab = Buffer.alloc(8); cab.write('icns', 0, 'ascii'); cab.writeUInt32BE(8 + partes.reduce((n, p) => n + p.length, 0), 4);
  return Buffer.concat([cab, ...partes]);
}

/** Los nombres de lo que escribe, en installer/marca/ (los usa installer/windows/mako.iss y publicar-binarios). */
export const archivoGrande = (i) => `asistente-${TAMANOS_GRANDE[i][0]}.png`;
export const archivoChica = (i) => `logo-${TAMANOS_CHICA[i]}.png`;

async function escribir() {
  const sharp = (await import('sharp')).default;
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = path.join(raiz, 'installer', 'marca');
  mkdirSync(dir, { recursive: true });
  const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  for (let i = 0; i < TAMANOS_GRANDE.length; i++) writeFileSync(path.join(dir, archivoGrande(i)), await png(svgAsistente(...TAMANOS_GRANDE[i])));
  for (let i = 0; i < TAMANOS_CHICA.length; i++) writeFileSync(path.join(dir, archivoChica(i)), await png(svgLogo(TAMANOS_CHICA[i])));
  writeFileSync(path.join(dir, 'mako.ico'), armarIco(await Promise.all(TAMANOS_ICO.map(async (lado) => ({ lado, png: await png(svgLogo(lado)) })))));
  writeFileSync(path.join(dir, 'MaKo.icns'), armarIcns(await Promise.all(TIPOS_ICNS.map(async ([tipo, lado]) => ({ tipo, png: await png(svgLogo(lado)) })))));
  console.log(`✓ ${TAMANOS_GRANDE.length + TAMANOS_CHICA.length + 2} archivos en ${dir}`);
}

// Sin `await` suelto: los tests importan este archivo con tsx, que lo pasa a CommonJS y ahí no hay await de primer nivel.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  escribir().catch((e) => { console.error(`⛔ ${e instanceof Error ? e.message : String(e)}`); process.exitCode = 1; });
}
