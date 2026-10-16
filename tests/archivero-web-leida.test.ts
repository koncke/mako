// =============================================================================
// Una web pegada cuenta como LEÍDA sólo si se aprendió algo de ella
// =============================================================================
// Tarea #201: pegar un Instagram dejaba un documento llamado «Instagram» marcado
// como leído, con cero campos adentro. No hay error, el paso del Archivero queda
// en verde, y el cliente cree que MaKo ya conoce su negocio — y encima el texto
// del muro («Instagram Log In Sign Up») entraba al panorama, que es el perfil del
// negocio.
//
// Las tres preguntas viven en lib/archivero-webs.ts (sin `server-only`, para que
// este test las EJECUTE y no sólo las lea).
//
// Correr: npx tsx --test tests/archivero-web-leida.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026), con la base en 7 pases / 0 fallos:
//   - sacar instagram.com de MUROS                              → 6 pases / 1 fallo
//   - que muroConocido no mire el subdominio (sin `dominio()`)   → 6 / 1
//   - agregar linkedin.com a MUROS                              → 6 / 1
//   - TEXTO_MINIMO_WEB = 0                                      → 5 / 2
//   - que sinDatosDelNegocio cuente las claves y no los valores → 6 / 1
//   - mover el muro DESPUÉS de docsIADisponible() en la ruta     → 6 / 1
//   - desactivar la rama que corta con cero campos              → 6 / 1
//
// ⚠️ Y la última NO se cazaba en el primer intento: el assert de orden era un
// `indexOf(...) < indexOf(...)`, y con la rama desactivada el primero devuelve -1,
// que es menor que cualquier cosa. Un orden se pregunta DESPUÉS de verificar que
// las dos piezas existan.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { muroConocido, textoInsuficiente, sinDatosDelNegocio, TEXTO_MINIMO_WEB } from '../lib/archivero-webs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\*.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Lo MEDIDO el 13/10/2026 contra cada sitio con nuestro propio User-Agent.
const MEDIDO = {
  instagram: 'Cristiano Ronaldo (@cristiano) • Instagram photos and videos Instagram Log In Sign Up cristiano Verified 680M followers 636 following Cristiano R',
  facebook: 'Nike',
  tiktok: 'Please wait...',
};

test('las redes que contestan un muro se cortan antes de gastar una llamada de IA', () => {
  for (const h of ['instagram.com', 'www.instagram.com', 'facebook.com', 'tiktok.com', 'x.com', 'twitter.com']) {
    const m = muroConocido(h);
    assert.ok(m, `${h} tendría que estar reconocido como muro`);
    // El mensaje dice QUÉ pasó y QUÉ HACER, y nombra al que dijo que no.
    assert.match(m!, /iniciar sesión/);
    assert.match(m!, /Pega tu página web, o sube un documento/);
  }
  // Un subdominio es el mismo muro.
  assert.ok(muroConocido('ayuda.instagram.com'));
});

test('LinkedIn NO es un muro: se midió y devuelve la página', () => {
  // 13.159 caracteres de contenido real en una página de empresa. Esta prueba
  // existe para que nadie lo agregue «por parecido» con las otras redes.
  assert.equal(muroConocido('linkedin.com'), null);
  assert.equal(muroConocido('www.linkedin.com'), null);
  assert.equal(muroConocido('tunegocio.com'), null);
});

test('lo que devuelve un muro no es una página, aunque sean 200 y traiga texto', () => {
  // Facebook: 4 caracteres. TikTok: 14. Los dos pasaban el `!texto.trim()` de antes.
  assert.ok(textoInsuficiente('facebook.com', MEDIDO.facebook));
  assert.ok(textoInsuficiente('tiktok.com', MEDIDO.tiktok));
  assert.ok(textoInsuficiente('x.com', ''));
  // Y el aviso dice qué hacer, no sólo que falló.
  assert.match(textoInsuficiente('facebook.com', MEDIDO.facebook)!, /Pega tu página web, o sube un documento/);
});

test('una página de verdad pasa el piso de texto', () => {
  assert.equal(textoInsuficiente('tunegocio.com', 'x'.repeat(TEXTO_MINIMO_WEB)), null);
  assert.ok(textoInsuficiente('tunegocio.com', 'x'.repeat(TEXTO_MINIMO_WEB - 1)));
  // El piso es un PISO, no un juicio: con 8x de margen sobre los muros medidos.
  assert.ok(TEXTO_MINIMO_WEB > MEDIDO.tiktok.length * 8);
  assert.ok(TEXTO_MINIMO_WEB < 400, 'un piso alto rechazaría una landing escueta');
});

test('cero datos del negocio no es una lectura — y es la capa que generaliza', () => {
  // El caso de Instagram: 991 caracteres (pasa el piso) y ni un campo.
  assert.ok(textoInsuficiente('instagram.com', MEDIDO.instagram) === null, 'el piso NO lo cubre: por eso hace falta esta capa');
  assert.ok(sinDatosDelNegocio('instagram.com', {}));
  assert.ok(sinDatosDelNegocio('instagram.com', null));
  assert.ok(sinDatosDelNegocio('instagram.com', undefined));

  // Un campo presente pero VACÍO tampoco es un dato: la IA devuelve las claves
  // que le pediste con el valor en blanco, así que contar claves no sirve.
  assert.ok(sinDatosDelNegocio('instagram.com', { oferta: '', promesa: '   ' }));

  assert.equal(sinDatosDelNegocio('tunegocio.com', { oferta: 'Clases de yoga' }), null);
});

test('la ruta pregunta por el muro ANTES de pedir la API key', () => {
  const src = leer('app/api/onboarding/archivero/route.ts');
  const ini = src.indexOf('async function procesarLink');
  const fin = src.indexOf('export async function GET', ini);
  assert.ok(ini > 0 && fin > ini, 'no pude acotar procesarLink');
  // El universo de la pregunta es la FUNCIÓN: `docsIADisponible()` también vive
  // en la ruta de archivos, 80 líneas más arriba, y medir el archivo entero da
  // la respuesta de la otra función.
  const fn = sinComentarios(src.slice(ini, fin));
  assert.ok(fn.length < 4000, 'el recorte salió enorme: está mirando otra cosa');

  assert.ok(fn.includes('muroConocido(host)'), 'la ruta no pregunta por el muro');
  // ⚠️ Desde el 16/10/2026 la ruta ya no corta por «no hay IA propia» (un cliente nuevo no trae una API
  // y la red de la plataforma lee por él: tests/onboarding-sin-api.test.ts). Lo que se fija ahora es que
  // el muro se pregunte antes de GASTAR IA: contra un Instagram, la llamada se gasta para nada.
  assert.ok(fn.includes('extraerDeArchivo('), 'no encuentro la lectura con IA de la web');
  assert.ok(
    fn.indexOf('muroConocido(host)') < fn.indexOf('extraerDeArchivo('),
    'la IA se gasta en un Instagram antes de preguntar por el muro',
  );
});

test('la ruta no guarda la web si no salió ningún dato', () => {
  const src = leer('app/api/onboarding/archivero/route.ts');
  const ini = src.indexOf('async function procesarLink');
  const fin = src.indexOf('export async function GET', ini);
  const fn = sinComentarios(src.slice(ini, fin));

  assert.ok(fn.includes('sinDatosDelNegocio(host, campos)'));
  // La rama vacía corta ANTES del insert, y el insert sigue siendo uno solo.
  // ⚠️ El orden NO se pregunta con indexOf pelado: si la rama desaparece (o la
  // desactiva un `false &&`), indexOf devuelve -1 y -1 < n pasa en verde. Medido
  // el 13/10/2026: la rotura no se cazaba. Primero EXISTE, despues va antes.
  const iVacia = fn.indexOf('else if (vacia) warnings.push(vacia);');
  assert.ok(iVacia > 0, 'no esta la rama que corta cuando la web no dio datos');
  assert.ok(iVacia < fn.indexOf('insertFile(ws'));
  assert.equal((fn.match(/insertFile\(ws/g) || []).length, 1);
  assert.ok(fn.includes('textoInsuficiente(host, texto)'));
});
