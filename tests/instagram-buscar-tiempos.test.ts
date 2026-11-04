// El desplegable de Instagram no salía NUNCA al buscar por nombre (Martín, 3/11/2026: «cuando busco competidores no me sale
// el desplegable con opciones como en Instagram»). La búsqueda de Apify tarda ~20 s (medido el 3/11 con
// scripts/probar-busqueda-apify.mjs) y la ruta se cortaba a los 15 s: Vercel la mataba antes de contestar. Probar el actor
// suelto daba bien; lo que fallaba era el camino entero. Este test ata los tres tiempos: Apify, la ruta y el componente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8');
const numero = (s: string, re: RegExp, que: string): number => {
  const m = s.match(re);
  assert.ok(m, `no encontré ${que}`);
  return Number(m![1].replace(/_/g, ''));
};

const ruta = leer('app/api/crm/instagram-buscar/route.ts');
const componente = leer('app/crm/new/InstagramBuscador.tsx');
const apify = leer('lib/instagram-buscar-apify.ts');

const maxDurationMs = numero(ruta, /export const maxDuration = (\d+);/, 'el maxDuration de la ruta') * 1000;
const pedidoMs = numero(ruta, /const TOPE_PEDIDO_MS = ([\d_]+);/, 'el tope por pedido de la ruta');
const apifyMs = numero(apify, /const TOPE_MS = ([\d_]+);/, 'el tope de Apify');
const componenteMs = numero(componente, /const TOPE_MS = ([\d_]+);/, 'el tope del componente');

test('la ruta vive lo que tarda su peor caso: Meta, Google y después Apify', () => {
  assert.ok(maxDurationMs >= pedidoMs * 2 + apifyMs, `${maxDurationMs} ms no alcanzan para ${pedidoMs * 2 + apifyMs} ms`);
});

test('el componente espera a la ruta: si corta antes, la lista nunca se dibuja', () => {
  assert.ok(componenteMs > maxDurationMs, `el componente corta a ${componenteMs} ms y la ruta vive ${maxDurationMs} ms`);
});

test('una sola palabra también busca: «leila» y «@leila» no se quedan en el @ exacto', () => {
  const rama = ruta.slice(ruta.indexOf('if (usuarioDeTexto(texto) != null)'), ruta.indexOf('[meta, google] = await Promise.all'));
  assert.match(rama, /texto\.startsWith\('@'\) \? Promise\.resolve<PerfilIg\[\]>\(\[\]\) : buscarConApify\(u, ws\)/, 'con @ no espera la búsqueda; sin @, busca');
  assert.match(rama, /combinarPerfiles\(exacto, hallados\)/);
});

test('mientras espera, la lista dice que está buscando en Instagram', () => {
  assert.match(componente, /Buscando en Instagram…/);
});
