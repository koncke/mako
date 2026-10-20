// =============================================================================
// Chats sin esperar a todo: la primera vista y el sondeo leen lo reciente (20/10/2026)
// =============================================================================
// Martín, llamada con Leila del 19/10 (minuto 55:12): «abrir Chats tarda mucho». Medido en el ws1: la lista entera
// eran 19 páginas del espejo de WhatsApp, 17 s, y la computadora la RELEÍA entera cada 15 s (el teléfono ya la
// acotaba a 3 páginas). Ahora:
//   1. `/api/chats?paginas=N` acota el espejo a las N páginas más nuevas;
//   2. la pantalla dibuja con la lectura rápida, después lee todo una vez, y el sondeo es rápido salvo cada
//      `COMPLETA_CADA` vueltas;
//   3. lo rápido se FUSIONA con lo que hay (`fusionarRecientes`): reemplaza lo que trae, deja lo que no trae, suma
//      canales.
// El paralelo del espejo está en tests/paginado-paralelo.test.ts; los números, en docs/hallazgos-comunicacion.md.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 3 / 0, de a una rotura y restaurada:
//   · `fusionarRecientes` devolviendo sólo lo reciente (la lista se achicaba a lo nuevo)  → 2 / 1
//   · app/chats/ChatsApp.tsx de antes (todo entero al abrir y en cada sondeo)            → 2 / 1
// Correr: node --import tsx --test tests/chats-lista-rapida.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatResumen } from '../lib/chats-tipos';
import { fusionarRecientes } from '../app/chats/lista-reglas';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

const chat = (clave: string, extra: Partial<ChatResumen> = {}): ChatResumen => ({
  clave, leadId: null, nombre: clave, empresa: null, avatarTel: null,
  canales: [{ canal: 'whatsapp', cuenta: 'ventas', rotulo: 'WhatsApp', destino: null, ref: `${clave}@s.whatsapp.net`, telefono: null } as ChatResumen['canales'][number]],
  canalUltimo: 'whatsapp', ultimoTexto: 'hola', ultimoTipo: null, ultimaFecha: '2026-10-19T10:00:00Z', ultimoEntrante: true,
  etapaKey: null, etapaLabel: null, asignado: null, closer: null, estado: 'abierta' as ChatResumen['estado'],
  pospuestaHasta: null, sinLeer: false, borrador: false, bloqueado: false, ...extra,
});

test('lo reciente reemplaza lo que trae, deja lo que no trae y suma canales', () => {
  const enPantalla = [
    chat('a', { ultimoTexto: 'viejo' }),
    chat('b'),
    chat('c', { canales: [...chat('c').canales, { canal: 'whatsapp', cuenta: 'soporte', rotulo: 'WhatsApp (Soporte)', destino: null, ref: 'c@soporte', telefono: null } as ChatResumen['canales'][number]] }),
  ];
  const recientes = [chat('a', { ultimoTexto: 'nuevo', sinLeer: true }), chat('c'), chat('d')];
  const r = fusionarRecientes(enPantalla, recientes);
  assert.deepEqual(r.map((x) => x.clave), ['a', 'c', 'd', 'b'], 'lo reciente primero; lo que no vino se queda');
  assert.equal(r[0].ultimoTexto, 'nuevo');
  assert.equal(r[0].sinLeer, true);
  assert.deepEqual(r[1].canales.map((x) => x.cuenta), ['ventas', 'soporte'], 'la línea vieja no se pierde');
  assert.equal(r.find((x) => x.clave === 'b')?.ultimoTexto, 'hola', 'una lectura acotada no borra lo que no trajo');
});

test('la pantalla dibuja con lo reciente, lee todo una vez y sondea liviano', () => {
  const app = leer('app/chats/ChatsApp.tsx');
  assert.match(app, /fetch\(modo === 'rapida' \? `\/api\/chats\?paginas=\$\{PAGINAS_RAPIDA\}` : '\/api\/chats'/);
  assert.match(app, /const cargarTodo = useCallback\(\(\) => cargarLista\('rapida'\)\.then\(\(\) => cargarLista\('completa'\)\)/, 'al abrir: rápida y después completa');
  assert.match(app, /void cargarTodo\(\);\n\s+const visible/, 'al abrir se usa cargarTodo');
  assert.match(app, /void cargarLista\(sondeos % COMPLETA_CADA === 0 \? 'completa' : 'rapida'\);/, 'el sondeo es rápido salvo cada COMPLETA_CADA');
  assert.match(app, /modo === 'rapida' && d \? \{ \.\.\.nuevos, chats: fusionarRecientes\(d\.chats, nuevos\.chats\) \} : nuevos/, 'lo rápido se fusiona, no reemplaza');
  assert.match(app, /const PAGINAS_RAPIDA = 3;/);
});

test('la API acota el espejo con ?paginas, entre 1 y 20', () => {
  const api = leer('app/api/chats/route.ts');
  assert.match(api, /paginas >= 1 && paginas <= 20 \? paginas : undefined/);
  assert.match(api, /listarChats\(\{ usuario: puerta\.yo, paginasWhatsapp \}\)/);
});
