// =============================================================================
// El instalador con el diseño de MaKo (25/10/2026)
// =============================================================================
// Martín: «el instalador de MaKo debe estar personalizado con el diseño de mako». Hasta la 0.4.2 el asistente de Inno Setup
// salía con la caja azul de fábrica, en «usted», y el programa con el ícono genérico. Lo que fija este test:
//   1. las imágenes salen de la marca (scripts/ia-pc/marca.mjs: el logo de MakoBrand y la criatura de Muneco) y están en el
//      repo en TODOS los tamaños que pide Inno 6.7, y el .ico y el .icns son archivos válidos con esos tamaños;
//   2. el asistente usa esas imágenes (la estructura de VS Code), son DOS toques (la bienvenida dice «Instalar») y los textos
//      que se ven están en tú y cortos (ni «Haga clic», ni «su sistema», ni «Por favor»);
//   3. la vista previa (/DVista) no instala NADA: lo que toca la PC queda fuera (se mira en esta PC, donde corre la del ws1).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  COLORES, TAMANOS_CHICA, TAMANOS_GRANDE, TAMANOS_ICO, TIPOS_ICNS, archivoChica, archivoGrande, armarIcns, armarIco, grupoCriatura, svgAsistente, svgLogo,
} from '../scripts/ia-pc/marca.mjs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bytes = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url));
/** Ancho y alto de un PNG (la cabecera IHDR). */
const medidaPng = (b: Buffer) => ({ ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20), png: b.subarray(1, 4).toString('ascii') === 'PNG' });

test('1. las imágenes salen de la marca, en todos los tamaños de Inno, y el .ico y el .icns son válidos', () => {
  // La marca: el oro y el fondo del logo (MakoBrand.tsx), y la cara de la criatura (Muneco.tsx: ojos, brillo y sonrisa).
  assert.equal(COLORES.oro, '#F2B01E');
  assert.match(leer('app/globals.css'), /--mako: #F2B01E;/, 'el oro de la marca cambió: correr de nuevo scripts/ia-pc/marca.mjs');
  assert.match(svgLogo(48), /<rect x="1\.5" y="1\.5" width="45" height="45" rx="13"/);
  const c = grupoCriatura();
  assert.match(c, /M20 3\.5C22\.2 13 27 17\.8 36\.5 20/, 'el cuerpo no es la estrella de MaKo');
  assert.equal((c.match(/<ellipse /g) ?? []).length, 3, 'el brillo y los dos ojos');
  assert.match(svgAsistente(202, 386), /<tspan fill="#F2B01E">M<\/tspan><tspan fill="#F3F0E7">a<\/tspan><tspan fill="#F2B01E">K<\/tspan>/);
  // Los archivos del repo, con su medida (los de Inno 6.7, de 100 % a 250 %).
  TAMANOS_GRANDE.forEach(([ancho, alto], i) => {
    const m = medidaPng(bytes(`installer/marca/${archivoGrande(i)}`));
    assert.deepEqual(m, { ancho, alto, png: true }, archivoGrande(i));
  });
  TAMANOS_CHICA.forEach((lado, i) => assert.deepEqual(medidaPng(bytes(`installer/marca/${archivoChica(i)}`)), { ancho: lado, alto: lado, png: true }, archivoChica(i)));
  // El .ico: cabecera (0, 1, n) y una entrada por tamaño, con el de 256 escrito como 0; cada imagen, un PNG donde dice.
  const ico = bytes('installer/marca/mako.ico');
  assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)], [0, 1, TAMANOS_ICO.length]);
  TAMANOS_ICO.forEach((lado, i) => {
    const e = 6 + 16 * i;
    assert.equal(ico.readUInt8(e), lado >= 256 ? 0 : lado);
    const donde = ico.readUInt32LE(e + 12);
    const m = medidaPng(ico.subarray(donde, donde + ico.readUInt32LE(e + 8)));
    assert.deepEqual(m, { ancho: lado, alto: lado, png: true }, `ico ${lado}`);
  });
  // El .icns: «icns» + el largo total, y cada tipo con su PNG.
  const icns = bytes('installer/marca/MaKo.icns');
  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns');
  assert.equal(icns.readUInt32BE(4), icns.length);
  let i = 8;
  for (const [tipo, lado] of TIPOS_ICNS) {
    assert.equal(icns.subarray(i, i + 4).toString('ascii'), tipo);
    const largo = icns.readUInt32BE(i + 4);
    assert.deepEqual(medidaPng(icns.subarray(i + 8, i + largo)), { ancho: lado, alto: lado, png: true }, `icns ${tipo}`);
    i += largo;
  }
  assert.equal(i, icns.length);
  // Las funciones que los arman, con datos chicos (rota: un largo mal escrito → falla acá antes que en una Mac).
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const ico2 = armarIco([{ lado: 16, png }, { lado: 256, png }]);
  assert.equal(ico2.readUInt32LE(6 + 12), 6 + 32);
  assert.equal(ico2.readUInt32LE(6 + 16 + 12), 6 + 32 + png.length);
  assert.equal(armarIcns([{ tipo: 'ic07', png }]).readUInt32BE(4), 8 + 8 + png.length);
});

test('2. el asistente usa la marca, son dos toques, y lo que se ve está en tú y corto', () => {
  const iss = leer('installer/windows/mako.iss');
  const lista = (directiva: string) => (new RegExp(`^${directiva}=(.+)$`, 'm').exec(iss)?.[1] ?? '').split(',').map((x) => x.replace('{#Marca}\\', 'installer/marca/'));
  assert.deepEqual(lista('WizardImageFile'), TAMANOS_GRANDE.map((_, i) => `installer/marca/${archivoGrande(i)}`));
  assert.deepEqual(lista('WizardSmallImageFile'), TAMANOS_CHICA.map((_, i) => `installer/marca/${archivoChica(i)}`));
  assert.match(iss, /^#define Marca "\.\.\\marca"$/m);
  assert.match(iss, /^SetupIconFile=\{#Marca\}\\mako\.ico$/m);
  assert.match(iss, /^UninstallDisplayIcon=\{app\}\\mako\.ico$/m);
  for (const f of ['mako.ico', 'MaKo.icns']) assert.ok(existsSync(new URL(`../installer/marca/${f}`, import.meta.url)), f);
  assert.match(iss, /^ {2}#define Estilo "modern dynamic"$/m, 'claro u oscuro según Windows');
  assert.match(iss, /^WizardStyle=\{#Estilo\}$/m);
  // Dos toques: la bienvenida (la página de la imagen grande) con «Instalar», sin «Listo para instalar», y el final.
  assert.match(iss, /^DisableWelcomePage=no$/m);
  assert.match(iss, /^DisableReadyPage=yes$/m);
  assert.match(iss, /if CurPageID = wpWelcome then\s*WizardForm\.NextButton\.Caption := SetupMessage\(msgButtonInstall\);/, 'la bienvenida dice «Siguiente» e instala igual');
  // Los accesos con el ícono de MaKo (el programa de Bun trae el genérico).
  for (const l of iss.split('\n').filter((x) => x.startsWith('Name: "{user'))) assert.match(l, /IconFilename: "\{app\}\\mako\.ico"/, l);
  // Lo que se ve: en tú, sin la paja de fábrica, y corto.
  const mensajes = iss.split('\n').filter((l) => l.startsWith('es.'));
  assert.ok(mensajes.length >= 15, 'faltan textos propios');
  for (const m of mensajes) {
    const texto = m.slice(m.indexOf('=') + 1);
    assert.doesNotMatch(texto, /\b(Haga|haga|usted|Usted|su sistema|su equipo|Por favor|desea|Desea|Está seguro)\b/, `de usted: ${m}`);
    assert.ok(texto.length <= 120, `largo: ${m}`);
  }
  for (const clave of ['WelcomeLabel1', 'WelcomeLabel2', 'FinishedHeadingLabel', 'FinishedLabel', 'ClickNext', 'ClickFinish', 'ExitSetupMessage', 'ConfirmUninstall']) {
    assert.ok(mensajes.some((m) => m.startsWith(`es.${clave}=`)), `queda el de fábrica: ${clave}`);
  }
  // Al terminar, «Conectar con MaKo» (marcado: es lo que sigue).
  assert.match(iss, /Description: "Conectar con MaKo"; Flags: postinstall shellexec nowait$/m);
});

test('3. la vista previa no instala nada: archivos, registro, accesos y programas quedan fuera', () => {
  const iss = leer('installer/windows/mako.iss');
  assert.match(iss, /#ifdef Vista\nCreateAppDir=no\nUninstallable=no\n#endif/);
  // Todo lo que toca la PC está entre un `#ifndef Vista` y su `#endif`.
  const fuera = iss.replace(/#ifndef Vista\n[\s\S]*?\n#endif/g, '');
  for (const peligro of [/^\[Files\]/m, /^\[Registry\]/m, /^\[Icons\]/m, /^\[UninstallRun\]/m, /^Root: HKCU/m, /^Filename: "\{app\}\\mako-pc\.exe"/m, /^Filename: "powershell\.exe"/m, /^Source: /m]) {
    assert.doesNotMatch(fuera, peligro, `la vista previa haría esto: ${peligro}`);
  }
  // El script que la mira la arma con /DVista y la cierra sin «Finalizar».
  const ps = leer('scripts/ia-pc/vista-instalador.ps1');
  assert.match(ps, /& \$iscc \/Q \/DVista /);
  assert.doesNotMatch(ps, /Boton\(\$h, 'Finalizar'\) -ne|BM_CLICK[^\n]*Finalizar/, 'toca «Finalizar»');
});
