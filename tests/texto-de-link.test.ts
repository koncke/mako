// =============================================================================
// De un link pegado al texto que hay detrás
// =============================================================================
// El caso que decide todo: un link de Google Docs copiado de la barra devuelve
// el HTML del EDITOR, no el documento. Y falla contestando 200 con kilobytes de
// texto — o sea, con cara de haber funcionado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverLink, htmlATexto, pareceLogin } from '../lib/texto-de-link';

test('un Google Docs se pide por su endpoint de exportación, no por la URL de la barra', () => {
  const r = resolverLink('https://docs.google.com/document/d/1AbC_dEf-123/edit?tab=t.0#heading=h.xyz');
  assert.equal(r.tipo, 'google-docs');
  assert.equal(r.url, 'https://docs.google.com/document/d/1AbC_dEf-123/export?format=txt');
  assert.match(r.nota ?? '', /cualquiera con el enlace/);
});

test('el id se extrae aunque el link traiga basura después', () => {
  // Los links que la gente copia vienen con /edit, ?usp=sharing, #gid, todo junto.
  for (const cola of ['/edit', '/edit?usp=sharing', '/view#gid=0', '?usp=drive_link', '/']) {
    const r = resolverLink(`https://docs.google.com/document/d/XYZ789/${cola}`.replace('//', '/').replace('https:/', 'https://'));
    assert.equal(r.tipo, 'google-docs', cola);
    assert.match(r.url, /\/XYZ789\/export\?format=txt$/, cola);
  }
});

test('un archivo de Drive se pide como descarga', () => {
  const a = resolverLink('https://drive.google.com/file/d/FILE123/view?usp=sharing');
  assert.equal(a.tipo, 'google-drive');
  assert.match(a.url, /uc\?export=download&id=FILE123/);

  const b = resolverLink('https://drive.google.com/open?id=FILE456');
  assert.equal(b.tipo, 'google-drive');
  assert.match(b.url, /id=FILE456/);
});

test('un .md o un raw de GitHub se piden TAL CUAL', () => {
  // Ya vienen en texto: sacarles etiquetas los rompería.
  for (const u of [
    'https://ejemplo.com/guiones.md',
    'https://ejemplo.com/notas.txt',
    'https://raw.githubusercontent.com/user/repo/main/guion.md',
  ]) {
    const r = resolverLink(u);
    assert.equal(r.tipo, 'texto-plano', u);
    assert.equal(r.url, u, 'la url no se toca');
  }
});

test('cualquier otra cosa es una web y se pide como vino', () => {
  const r = resolverLink('https://ejemplo.com/blog/mi-guion');
  assert.equal(r.tipo, 'web');
  assert.equal(r.url, 'https://ejemplo.com/blog/mi-guion');
  assert.equal(r.nota, undefined);
});

test('htmlATexto borra el script ENTERO, no solo sus etiquetas', () => {
  // Al revés, el JavaScript de la página quedaría como texto del documento.
  const html = '<p>Hola</p><script>var x = "esto no es del guion";</script><p>Chau</p>';
  const t = htmlATexto(html);
  assert.doesNotMatch(t, /esto no es del guion/);
  assert.doesNotMatch(t, /var x/);
  assert.match(t, /Hola/);
  assert.match(t, /Chau/);
});

test('htmlATexto conserva los saltos de párrafo', () => {
  // Sin esto, los párrafos de un guion se pegan en una línea y el separador
  // pierde toda la estructura que necesita para partirlo.
  const t = htmlATexto('<p>Primer párrafo.</p><p>Segundo párrafo.</p>');
  assert.match(t, /Primer párrafo\.\s*\n\s*Segundo párrafo\./);
});

test('htmlATexto decodifica las entidades', () => {
  const t = htmlATexto('<p>Caf&eacute;? No: &quot;t&eacute;&quot; &amp; nada m&aacute;s</p>');
  assert.match(t, /&/);
  assert.doesNotMatch(t, /&amp;/, 'no puede quedar una entidad sin decodificar');
});

test('una pantalla de login se detecta: un Doc privado devuelve 200, no 403', () => {
  // Es el modo de falla silencioso. Sin esto, el usuario vería «cargué tu
  // documento» sobre el HTML de un formulario de acceso, y el error aparecería
  // recién al mirar los guiones.
  assert.equal(pareceLogin('Iniciar sesión con Google para continuar', 'google-docs'), true);
  assert.equal(pareceLogin('You need access. Request access or switch accounts.', 'google-docs'), true);
  assert.equal(pareceLogin('Un empresario me dijo algo que me dio risa', 'google-docs'), false);
});

test('en una web cualquiera NO se busca login: «iniciar sesión» es texto normal', () => {
  // Un blog puede tener «iniciar sesión» en su menú y su contenido ser válido.
  // El chequeo solo aplica donde la pantalla de acceso sustituye al documento.
  assert.equal(pareceLogin('Iniciar sesión · Blog · Contacto · Mi guion empieza acá', 'web'), false);
});
