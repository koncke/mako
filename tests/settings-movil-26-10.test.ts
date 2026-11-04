// =============================================================================
// Settings en el teléfono (26/10/2026): lo que pidió Martín desde su Android, y el bug de los desplegables
// =============================================================================
// Martín, desde el Centro, 26/10 09:14, textual: «El modo oscuro lo quiero arriba en la topbar, donde dice "settings" con el
// botón del sol y la luna, y sin texto. Y las configuraciones de "tu negocio" sin un desplegable, directamente allí. Y "cerrar
// sesión" en rojo y aparte del texto, un icono. Luego, dentro de "perfil", no puedo apretar ningún desplegable, se abre y se
// cierra automáticamente. Y no quiero otra vez el modo oscuro allí. Y la foto de perfil, elimina los 2 botones, hazla más
// grande y que se pueda clickear en la foto para eliminarla o cambiarla, que funcione como las demás fotos de perfil que
// tenemos en la app, incluso que se pueda poner un emoji. Y en cargo, no pongas "Fundadora" en femenino, pon CEO... y sobra
// la de "prompts" en super admin».
//
// ⚠️ EL BUG DE LOS DESPLEGABLES NO ERA UN DOBLE TOQUE NI UN CLIC QUE SE PROPAGA. Reproducido en el banco con toques de verdad
// (CDP `Input.dispatchTouchEvent`) y el teclado simulado: /m declara `interactive-widget: resizes-content` (app/m/layout.tsx),
// así que el TECLADO achica la ventana y manda `resize`, y el Dropdown cerraba en todo `resize`. El que tiene buscador lo
// enfocaba al abrir → teclado → resize → cerrado en el mismo gesto; y tocar cualquiera con el teclado abierto (venías de
// escribir en «Cargo») lo cerraba igual. Ahora un `resize` reubica, y en una pantalla táctil el buscador no se enfoca solo.
//
// PROBADO ROMPIÉNDOLO (26/10/2026): ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seccionesNegocio } from '../lib/ajustes-secciones';
import { emojiDeFoto, fotoDeCambio, fotoDeEmoji } from '../lib/foto-perfil';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. el desplegable: un resize (el teclado) REUBICA, no cierra; y al tacto el buscador no se enfoca solo', () => {
  const d = sinComentarios(leer('app/components/Dropdown.tsx'));
  assert.match(d, /window\.addEventListener\('resize', onResize\);/);
  const onResize = d.slice(d.indexOf('const onResize ='), d.indexOf('\n', d.indexOf('const onResize =')));
  assert.match(onResize, /place\(/, 'un resize tiene que volver a ubicar el menú contra su botón');
  assert.doesNotMatch(onResize, /setOpen\(false\)/, 'un resize vuelve a cerrar el menú: el teclado del teléfono lo cierra al abrirlo');
  // El scroll AFUERA del menú sigue cerrando (el menú fijo se despegaría del botón).
  assert.match(d, /const onScroll = \(e: Event\) => \{\s*if \(e\.target instanceof Node && menuRef\.current\?\.contains\(e\.target\)\) return;\s*setOpen\(false\);/);
  assert.match(d, /const tactil = typeof window !== 'undefined' && window\.matchMedia\?\.\('\(pointer: coarse\)'\)\.matches;\s*if \(tactil\) return;\s*const t = setTimeout\(\(\) => searchRef\.current\?\.focus\(\), 0\);/,
    'al tacto, el buscador se enfoca solo y abre el teclado');
  // Y la causa sigue ahí: si /m deja de achicar con el teclado, esto se puede revisar.
  assert.match(leer('app/m/layout.tsx'), /interactive-widget/);
});

test('2. Settings del teléfono: el sol/luna en la cabecera, «Tu negocio» directo, «Cerrar sesión» sola en rojo', () => {
  const c = sinComentarios(leer('app/m/cuenta/CuentaM.tsx'));
  assert.match(c, /const modo = useMemo\(\(\) => <InterruptorModo variante="cabecera" \/>, \[\]\);/);
  assert.match(c, /<CabeceraM accion=\{modo\} \/>/, 'el modo oscuro no está en la cabecera');
  assert.doesNotMatch(c, /titulo="Modo oscuro"|function ModoOscuro/, 'volvió la fila «Modo oscuro»');
  assert.match(c, /\{datos\.negocio\.map\(\(s\) => \(s\.enComputadora/, '«Tu negocio» volvió a ser una fila que abre otra pantalla');
  assert.doesNotMatch(c, /href="\/m\/configuraciones"/, '«Tu negocio» volvió a ser un desplegable');
  assert.match(c, /<ListaM>\s*<CerrarSesion variante="fila" \/>\s*<\/ListaM>/, '«Cerrar sesión» no está sola en su lista');
  const salir = sinComentarios(leer('app/m/_ui/CerrarSesion.tsx'));
  assert.match(salir, /<Icon name="logout" size=\{18\} \/>/, '«Cerrar sesión» sin su ícono');
  assert.match(leer('app/m/m.css'), /\.m-salir \{ color: var\(--bad\); \}/, '«Cerrar sesión» no está en rojo');
  // El interruptor de la cabecera es el MISMO de la barra (una preferencia, un botón).
  assert.match(sinComentarios(leer('app/_components/InterruptorModo.tsx')), /if \(variante === 'cabecera'\) \{[\s\S]{0,200}className="m-cabecera__accion"/);
  // Las secciones las arma el server con la lista de la computadora, cada una con su pantalla del teléfono.
  const p = sinComentarios(leer('app/m/cuenta/page.tsx'));
  assert.match(p, /seccionesNegocio\(await disponiblesNegocio\(\)\)\]\.map/);
  assert.match(p, /const enTelefono = s\.key in SECCIONES_NEGOCIO_M;/);
  assert.match(p, /const verNegocio = puedeVerKey\('configuraciones', ctx\.rol, ctx\.capa\);/, '«Tu negocio» se le muestra a quien no administra');
});

test('3. Perfil: la foto grande abre el selector de la app, sin «Tema», y «CEO» de ejemplo', () => {
  const p = sinComentarios(leer('app/perfil/InformacionPersonal.tsx'));
  assert.match(p, /className="aj-foto aj-foto--grande"/);
  assert.match(p, /<IdentidadPicker titulo="Foto de perfil" ancla=\{fotoAncla\} conEncuadre=\{false\} subirA="\/api\/perfil\/avatar"/,
    'la foto no abre el selector de la app (o sube al bucket de portadas, o muestra un encuadre que no se guarda)');
  assert.doesNotMatch(p, />Quitar<|'Cambiar' : 'Subir'/, 'volvieron los dos botones de la foto');
  assert.doesNotMatch(p, /titulo="Tema"|aplicarModo/, 'volvió el modo oscuro adentro de Perfil');
  assert.match(p, /cargo: 'CEO'/);
  for (const f of ['app/perfil/InformacionPersonal.tsx', 'lib/api-mako/areas/equipo.def.ts']) assert.doesNotMatch(leer(f), /Fundadora'/, `${f}: «Fundadora»`);
  const picker = sinComentarios(leer('app/_components/IdentidadPicker.tsx'));
  assert.match(picker, /<Subir foto=\{conEncuadre \? urlPortada\(icono\) : null\}/);
  assert.match(picker, /const r = await fetch\(subirA, \{ method: 'POST', body: fd \}\);/);
});

test('4. la foto de una persona es SIEMPRE una imagen: el emoji ida y vuelta, el ícono, quitar y el encuadre', () => {
  const f = fotoDeEmoji('🦊');
  assert.ok(f.startsWith('data:image/svg+xml,'), 'el emoji tiene que ser una imagen: los avatares lo dibujan con <img>');
  assert.equal(emojiDeFoto(f), '🦊');
  assert.equal(emojiDeFoto('https://x.supabase.co/avatars/u1.png'), null, 'una foto no es un emoji');
  assert.equal(emojiDeFoto('data:image/svg+xml,%3Csvg%3E%3Ctext%3E%F0%9F%A6%8A%3C%2Ftext%3E%3C%2Fsvg%3E'), null, 'un SVG cualquiera (sin la marca) no se lee como emoji');
  assert.equal(emojiDeFoto(''), null);
  assert.equal(fotoDeCambio({ emoji: '🦊', icono: null, y: null }), f);
  assert.equal(fotoDeCambio({ emoji: '', icono: null, y: null }), '', '«Quitar» deja la foto vacía');
  assert.equal(fotoDeCambio({ icono: 'https://x.supabase.co/avatars/u1.png', y: null }), 'https://x.supabase.co/avatars/u1.png');
  assert.match(fotoDeCambio({ icono: 'icon:lucide:rocket', y: null }) ?? '', /^https:\/\/.+\/lucide\/rocket\.svg\?/, 'un ícono va como su URL de imagen');
  assert.equal(fotoDeCambio({ y: 30 }), null, 'un encuadre no toca la foto');
  // Lo que se escribe adentro del SVG no puede cerrar la etiqueta.
  assert.doesNotMatch(decodeURIComponent(fotoDeEmoji('<b>"x"</b>')), /<b>/);
});

test('5. «Prompts» sale de Settings, y su pantalla sigue con su puerta', () => {
  assert.equal(seccionesNegocio({ integraciones: true, plan: true }).some((s) => s.key === 'prompts'), false, 'volvió Settings › Prompts');
  assert.match(sinComentarios(leer('app/configuraciones/prompts/page.tsx')), /if \(!\(await getSesionAdmin\(\)\)\) redirect\(/);
});

// ── ROTURAS (26/10/2026) ───────────────────────────────────────────────────────
// Una por vez, con un arnés que guarda el original en memoria, rompe, corre ESTE archivo y restaura comprobando el contenido.
// Base: 5 pasan / 0 fallan. Las 14 cazadas, cada una 4 / 1, por el test que la cuida:
//   M1. un resize vuelve a cerrar el desplegable                → 1. el desplegable
//   M2. al tacto el buscador se enfoca solo                     → 1.
//   M3. el sol/luna fuera de la cabecera                        → 2. Settings del teléfono
//   M4. «Tu negocio» vuelve a ser una fila a /m/configuraciones → 2.
//   M5. «Cerrar sesión» sin rojo                                → 2.
//   M6. «Cerrar sesión» sin su ícono                            → 2.
//   M7. «Tu negocio» a quien no administra                      → 2.
//   M8. el encuadre que no se guarda, de vuelta                 → 3. Perfil
//   M9. «Tema» de vuelta en Perfil                              → 3.
//   M10. «Fundadora» de vuelta en Cargo                         → 3.
//   M11. la foto sube al bucket de portadas                     → 3.
//   M12. el emoji se guarda como texto                          → 4. la foto siempre como imagen
//   M13. cualquier SVG se lee como emoji (sin la marca)         → 4.
//   M14. «Prompts» de vuelta en el índice                       → 5.
// Restaurado: 5 / 0.
