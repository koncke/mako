// =============================================================================
// OF2 · El lector de afuera no le manda credenciales a r.jina.ai (22/10/2026)
// =============================================================================
// Offer pide una página que nuestro servidor no puede abrir (un antibots, una página armada con JavaScript) al lector de
// afuera, r.jina.ai (lib/offer-lector-externo.ts). Una URL con un token en sus parámetros (un link de vista previa, un
// acceso firmado de S3, una página privada compartida) le llegaba tal cual: un tercero con el acceso del dueño (el riesgo
// anotado en 8610c5122). Ahora un link con algo que parece un acceso no sale, y se le pide al dueño el .zip o el texto.
// La landing del Sprint de Mauricio (pública, con sus parámetros de seguimiento) se sigue leyendo.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-of2.mjs en el scratchpad de la sesión). Los números,
// al lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { credencialEnLaUrl, linkParaLeer, PIDE_ACCESO } from '../lib/offer-reglas';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** Lo que el lector recibe: el link como lo deja `linkParaLeer` (sin los de seguimiento ni el fragmento). */
const comoSale = (url: string) => { const l = linkParaLeer(url); assert.ok(l.ok, url); return l.leida; };

const SPRINT = 'https://sprint.mauriciobustos.com/?utm_source=ig&fbclid=IwAR3xY9kq2LmN8vB7cX1zQ4wE5rT6yU0iO3pA2sD';

// rotura (sin mirar el nombre del parámetro): 1 fallo. rotura (sin mirar el valor): 1 fallo. rotura (sin usuario y
// clave): 1 fallo. rotura (los de seguimiento cuentan): 1 fallo. rotura (sin los links para compartir): 1 fallo.
test('credencialEnLaUrl: por el nombre, por un valor que parece un código, y por usuario y clave; lo público pasa', () => {
  assert.equal(credencialEnLaUrl(comoSale(SPRINT)), null, 'la landing del Sprint, con su utm y su fbclid largo');
  assert.equal(credencialEnLaUrl(SPRINT), null, 'y aunque llegara con el fbclid: es largo pero no abre nada');
  assert.equal(credencialEnLaUrl(comoSale('https://tusitio.com/?page_id=245')), null, 'un `?page_id=` ES la página');
  assert.equal(credencialEnLaUrl(comoSale('https://tusitio.com/blog?keyword=marketing&p=2')), null, '«keyword» no es «key»');
  assert.equal(credencialEnLaUrl(comoSale('https://tusitio.com/webinar-gratuito-octubre-2026-registro')), null, 'un slug largo con números es una landing');
  assert.equal(credencialEnLaUrl(comoSale('https://docs.google.com/document/d/1AbCdEfGh/edit?usp=sharing')), 'un link para compartir', 'el acceso va en la ruta');
  assert.equal(credencialEnLaUrl(comoSale('https://www.dropbox.com/scl/fi/abc/landing.zip')), 'un link para compartir');
  assert.equal(credencialEnLaUrl(comoSale('https://tusitio.com/preview?token=abc')), 'token');
  assert.equal(credencialEnLaUrl(comoSale('https://tusitio.com/?api_key=1')), 'api_key');
  assert.equal(credencialEnLaUrl(comoSale('https://tusitio.com/?monkey=1&code=XYZ')), 'code');
  assert.equal(credencialEnLaUrl(comoSale('https://b.s3.amazonaws.com/l.html?X-Amz-Expires=300&X-Amz-Signature=ab12')), 'X-Amz-Expires');
  assert.equal(credencialEnLaUrl(comoSale('https://tusitio.com/p?id=a8f3k29dk3l2m4n5b6v7c8x9z0q1w2e3')), 'id', 'un código largo, se llame como se llame');
  assert.equal(credencialEnLaUrl('https://ana:secreta@tusitio.com/'), 'usuario y clave');
  assert.equal(credencialEnLaUrl(comoSale('https://tusitio.com/#access_token=zzz')), null, 'el fragmento ni siquiera sale: linkParaLeer lo saca');
  assert.equal(credencialEnLaUrl('https://tusitio.com/#access_token=zzz'), 'access_token', 'y si llegara, se ve');
});

// rotura (el lector manda igual): 1 fallo.
test('el lector REAL no llama a r.jina.ai con un link con acceso, y con la landing del Sprint sí', () => {
  const conToken = comoSale('https://tusitio.com/preview?token=abc123');
  const sprint = comoSale(SPRINT);
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_lector-externo-hijo.ts'), JSON.stringify([conToken, sprint])], {
    cwd: RAIZ, encoding: 'utf8', timeout: 60_000,
  });
  const r = JSON.parse(salida.trim().split('\n').pop() ?? '{}') as { pedidos: string[]; leidos: Record<string, boolean> };
  assert.equal(r.pedidos.some((p) => p.includes('token=')), false, `ningún pedido con el token: ${r.pedidos.join(' | ')}`);
  assert.equal(r.leidos[conToken], false);
  assert.deepEqual(r.pedidos, [`https://r.jina.ai/${sprint}`], 'la landing del Sprint se sigue leyendo');
  assert.equal(r.leidos[sprint], true);
});

// rotura (la ruta no frena en el 403): 1 fallo. rotura (no frena en la página sin texto): 1 fallo.
test('la ruta frena ANTES de pedirlo y le pide al dueño el .zip o el texto', () => {
  assert.equal(PIDE_ACCESO, 'Esa página pide acceso: súbela en .zip o copia su texto y pégalo aquí.');
  const r = sinComentarios(leer('app/api/offer/route.ts'));
  const f = r.slice(r.indexOf('async function leerLink('), r.indexOf('async function leerLink(') + 4_000);
  const bloqueo = f.indexOf('if (bloqueaLaLectura(e) && credencialEnLaUrl(link.leida)) return no(422, PIDE_ACCESO);');
  assert.ok(bloqueo > 0 && bloqueo < f.indexOf('await leerConLectorExterno(link.leida) : null'), 'en el 403, antes del lector');
  const sinTexto = f.indexOf('if (credencialEnLaUrl(link.leida)) return no(422, PIDE_ACCESO);');
  assert.ok(sinTexto > 0 && sinTexto < f.lastIndexOf('await leerConLectorExterno(link.leida)'), 'en la página sin texto, antes del lector');
});
