// =============================================================================
// El login a pantalla completa, con las animaciones de la portada en bucle (15/11/2026)
// =============================================================================
// Martín, mirando la primera versión del rediseño: «el logo de MaKo debería estar arriba de entrar a tu cuenta… arriba a
// la izquierda del todo. Y evidentemente el login debería ser completo… en lugar de poner el mejor software para vender
// High Ticket, ahí yo pondría los videos que hicimos de las animaciones… en bucle». Y «falta el botoncito de la luna y el
// sol».
//
// Se lee el FUENTE y no se dibuja: TarjetaLogin importa su hoja de estilos, y el runner de tests no carga CSS.
//
// Correr: node --import tsx --test tests/login-vitrina-animaciones.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TARJETAS_PORTADA } from '../app/vsl/_sitio/datos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('los clips del login SON los de la portada: se derivan de TARJETAS_PORTADA, no se copian', () => {
  const tarjeta = leer('app/_components/clips-portada.ts');
  assert.match(tarjeta, /CLIPS_VITRINA[^=]*=\s*TARJETAS_PORTADA\.flatMap/, 'una lista a mano se separa de la portada el primer día que cambie una grabación');
  // Y hay de dónde sacarlos: si la portada se quedara sin grabaciones, el panel quedaría vacío sin que nadie lo note.
  const conVideo = TARJETAS_PORTADA.filter((t) => typeof t.visual === 'object' && 'video' in t.visual);
  assert.ok(conVideo.length >= 5, `la portada tiene ${conVideo.length} grabaciones`);
});

test('cada grabación tiene su corte medido: si no, se ve la vuelta a su arranque antes del siguiente', () => {
  // Las grabaciones de la portada terminan volviendo a su primer cuadro (allá se repiten solas). En el login eso se veía
  // como que «por un segundo se reinicia la animación original» (Martín, 15/11). Un clip nuevo en la portada entra solo
  // al login, pero su corte hay que mirarlo: este test es el que avisa.
  const fuente = leer('app/_components/clips-portada.ts');
  const conVideo = TARJETAS_PORTADA.flatMap((t) => (typeof t.visual === 'object' && 'video' in t.visual ? [t.visual.video] : []));
  const sinMedir = conVideo.filter((v) => !fuente.includes(`'${v}':`));
  assert.deepEqual(sinMedir, [], `sin corte medido en HASTA_DONDE (app/_components/clips-portada.ts): ${sinMedir.join(', ')}`);
});

test('en el teléfono no se baja ningún video: el corte del componente y el de la hoja son el MISMO', () => {
  // El panel se esconde con CSS por debajo de 1025 px, pero un <video> con src se descarga igual aunque no se vea.
  // El componente pone el src sólo desde 1025: si alguien mueve uno de los dos números, el 4G paga 12 MB por entrar.
  const comp = leer('app/login/_ui/VitrinaVideos.tsx');
  const css = leer('app/login/_ui/login.css');
  const desde = Number(/\(min-width:\s*(\d+)px\)/.exec(comp)?.[1]);
  const hasta = Number(/@media \(max-width:\s*(\d+)px\)\s*\{\s*\.lg-vitrina \{ display: none; \}/.exec(css)?.[1]);
  assert.ok(desde > 0 && hasta > 0, 'no encontré uno de los dos cortes');
  assert.equal(desde, hasta + 1, `el video se baja desde ${desde} px y el panel se ve desde ${hasta + 1} px`);
});

test('el alumno no ve el comercial de MaKo, pero sí el logo y el sol y la luna', () => {
  const pagina = leer('app/login/page.tsx');
  assert.ok(pagina.includes("vitrina={esDelAlumno ? 'muda' : 'videos'}"), 'el cliente de otro negocio entrando a su curso no es un comprador de MaKo');
  const tarjeta = leer('app/login/_ui/TarjetaLogin.tsx');
  assert.match(tarjeta, /\{vitrina === 'videos' && <VitrinaVideos/, 'los videos dependen de la vitrina');
  // Lo que NO depende de la vitrina: quién sirve la pantalla y cómo se ve.
  assert.ok(tarjeta.includes('<MakoLogo') && tarjeta.includes('<InterruptorModo'), 'el logo y el botón de sol y luna van en las dos');
  // Y la frase vieja ya no se DIBUJA: la reemplazaron las animaciones. Se busca su USO (la constante y la clase que la
  // pintaba), no el texto: el comentario que explica el cambio la cita, y buscar la frase suelta pescaría al comentario.
  assert.ok(!/const FRASE\s*=/.test(tarjeta), 'la constante de la frase volvió');
  assert.ok(!tarjeta.includes('lg-vitrina__frase') && !leer('app/login/_ui/login.css').includes('.lg-vitrina__frase'),
    'la frase del panel la reemplazaron las animaciones');
});
