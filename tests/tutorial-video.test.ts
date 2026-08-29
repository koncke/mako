// =============================================================================
// «decime cómo agregar mi pixel de meta a mi landing page»
// =============================================================================
// 25/08/2026. A esa pregunta MaKo contestó con SESENTA líneas: bloques de código,
// un id de píxel inventado (1234567890123456) y pasos de Vercel que no hacen nada.
//
// El pedido del dueño, y la distinción que faltaba: «cuando un lead pide un
// tutorial de algo, sería bueno que se busque un vídeo de YouTube y se le diga
// "aquí tienes el tutorial"». Y sobre todo: **la landing del cliente NO es MaKo.**
// Mandarlo a /integraciones contesta otra pregunta (ahí se pega el token DENTRO
// de MaKo); escribirle el paso a paso termina en un <script> inventado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textoTutorial } from '../lib/tutorial-video-texto';
import { hechosMako } from '../lib/hechos-mako';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const VIDEO = [{ titulo: 'Como instalar el Pixel de Meta en la Landing Page', canal: 'Andres Moreno', publicado: '2025-07-04', url: 'https://youtu.be/LVzKCFD170s' }];

test('El mensaje trae el link, el canal y el año', () => {
  const t = textoTutorial(VIDEO, 'pixel de meta');
  assert.ok(t.includes('https://youtu.be/LVzKCFD170s'), 'se perdió el link');
  // ⚠️ Canal y año NO son decoración: MaKo no vio ese video y no puede
  // presentarlo como oficial. Decir de quién es y de cuándo le deja a la persona
  // con qué juzgarlo — un tutorial de 2021 manda a buscar un botón que ya no está.
  assert.ok(t.includes('Andres Moreno'), 'no dice de quién es el video');
  assert.ok(t.includes('2025'), 'no dice de cuándo es');
  assert.ok(!/oficial|garantiz/i.test(t), 'presenta un video ajeno como si MaKo lo avalara');
});

test('Sin resultados no se inventa nada', () => {
  const t = textoTutorial([], 'algo rarísimo');
  assert.ok(!/youtu/.test(t), 'devolvió un link cuando no encontró nada');
  assert.match(t, /cont[aá]me|dec[ií]me|cu[eé]ntame|d[ií]me/i, 'no ofrece la salida de seguir por chat');
});

test('El link lo manda el CÓDIGO, no el modelo', () => {
  // En la primera prueba el modelo llamó bien a la tool y después escribió «ahí
  // tenés el video paso a paso» SIN EL LINK: se comió los 11 caracteres del id.
  // Mismo patrón que el mensaje del borrador, misma razón.
  const doer = leer('../lib/mako-doer-in.ts');
  assert.match(doer, /textoTutorialSalida/, 'el doer dejó de capturar la salida de la tool');
  assert.match(doer, /name === 'buscar_tutorial'/, 'no se detecta cuándo corrió la tool');
  // Y si el modelo YA pegó el link, no se duplica.
  assert.match(doer, /yaTieneLink/, 'se perdió el chequeo de que el link no salga dos veces');
});

test('La regla distingue "en MaKo" de "en mi propio sitio"', () => {
  const H = hechosMako('https://hola-mako.com');
  assert.match(H, /La landing del cliente NO es MaKo/i,
    'se perdió la distinción que causó el manual inventado');
  assert.match(H, /buscar_tutorial/, 'la regla no manda a buscar el video');
  // La tool existe y se describe como de TERCEROS, no de MaKo.
  const tools = leer('../lib/mako-tools.ts');
  assert.match(tools, /name: 'buscar_tutorial'/, 'no existe la tool');
  assert.match(tools, /FUERA de MaKo/i, 'la tool no aclara que es para cosas de terceros');
});

test('Un tutorial viejo es peor que ninguno: se filtra por fecha', () => {
  // Las pantallas de Meta y Vercel cambian. Un video de 2021 manda a buscar un
  // botón que ya no existe, y el que lo mira cree que está haciendo algo mal.
  const src = leer('../lib/tutorial-video.ts');
  assert.match(src, /publishedAfter/, 'se perdió el filtro por antigüedad');
  assert.match(src, /desdeHace\(3\)/, 'cambió la ventana de recencia sin dejar rastro');
  // Pero si no hay nada reciente, se afloja antes que quedarse mudo.
  assert.match(src, /if \(recientes\.length\) return/, 'el filtro dejó de ser un preferir y pasó a ser un exigir');
});
