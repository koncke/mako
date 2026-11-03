// =============================================================================
// El Calendario a la medida del negocio: cuatro usos, la barra de MaKo y sin la cáscara de Google (29/10/2026)
// =============================================================================
// Martín: «que se vea también la sidebar típica de MaKo, como siempre… hay muchos botones que son innecesarios… Esa pestaña
// es principalmente para gestionar publicaciones, para recordatorios de deadlines del propio Plan, para reuniones de
// llamadas de ventas, reuniones de entrega de servicio». Lo que fija este archivo:
//   1. los cuatro usos: su color, sus capas, y que cada uno se crea en un clic (el Plan, en el Plan);
//   2. la entrega es un tipo propio, con su capa, su migración y su lugar en la API;
//   3. lo que se fue de la copia de Google no vuelve (la barra lateral, el mes chico, Año y 4 días, las plantillas);
//   4. los links viejos de Año y 4 días abren el Mes y la Semana;
//   5. la barra de MaKo no se pliega en el Calendario (ni nadie la saca de ahí).
//
// PROBADO ROMPIÉNDOLO (29/10/2026), cada rotura sola contra este archivo:
//   · el Plan vuelve a tener el mismo color que otro uso                        → 1 fallo (1)
//   · `capaDeTipo('entrega')` vuelve a los bloques                              → 1 fallo (2)
//   · el «+» de Entregas abre una Llamada                                       → 1 fallo (1)
//   · vuelve el <MiniMes> a CalendarioApp                                       → 1 fallo (3)
//   · page.tsx deja de llevar `?vista=anio` al Mes                              → 1 fallo (4)
//   · /calendario entra en RUTAS_QUE_PLIEGAN                                    → 1 fallo (5)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { USOS_CALENDARIO, COLOR_CAPA, TIPOS_RAPIDO, usoDeCapa, entradaPropia } from '../app/calendario/comun';
import { CAPAS_CALENDARIO, TIPOS_EVENTO, ROTULO_TIPO, capaDeTipo, filaDeEntrada } from '../lib/calendario-modelo';

const RAIZ = resolve(import.meta.dirname, '..');
const crudo = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: las líneas primero y los bloques después (AGENTS.md). */
const leer = (rel: string) => crudo(rel).replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. cuatro usos, cuatro colores, y cada capa de MaKo es de UN uso', () => {
  const cuatro = USOS_CALENDARIO.filter((u) => u.id !== 'otros');
  assert.deepEqual(cuatro.map((u) => u.nombre), ['Publicaciones', 'Plan', 'Ventas', 'Entregas']);
  assert.equal(new Set(cuatro.map((u) => u.color)).size, 4, 'dos usos con el mismo color no se distinguen');
  const otros = USOS_CALENDARIO.find((u) => u.id === 'otros')!;
  for (const u of cuatro) assert.notEqual(u.color, otros.color, `${u.nombre} se confunde con «Otros»`);
  // Cada capa está en un uso y en uno solo: nada se dibuja sin un filtro que lo esconda.
  for (const c of CAPAS_CALENDARIO) {
    const de = USOS_CALENDARIO.filter((u) => u.capas.includes(c.id));
    assert.equal(de.length, 1, `la capa ${c.id} está en ${de.length} usos`);
    assert.equal(usoDeCapa(c.id), de[0].id);
  }
  // El color de un uso es el de sus capas (la tarjeta y la leyenda dicen lo mismo).
  for (const u of USOS_CALENDARIO) for (const c of u.capas) assert.equal(COLOR_CAPA[c], u.color, `${c} no es del color de ${u.nombre}`);
  // Crear en un clic: Publicación y Entrega abren su modal; Ventas, la agenda del negocio (con «Anotarla aquí»); el Plan,
  // el Plan (un deadline es una tarea suya).
  assert.deepEqual(Object.fromEntries(USOS_CALENDARIO.map((u) => [u.id, u.crea])), { publicaciones: 'publicacion', plan: null, ventas: 'llamada', entregas: 'entrega', otros: null });
  const app = leer('app/calendario/CalendarioApp.tsx');
  assert.match(app, /if \(t === 'llamada'\) \{ setAbierto\(\{ t: 'agendar' \}\); return; \}/);
  assert.match(app, /\{u\.crea && \([\s\S]*?onClick=\{\(\) => crear\(u\.crea!\)\}/);
  assert.match(app, /\{u\.id === 'plan' && \([\s\S]*?<Link href="\/plan"/);
  assert.match(app, /onAnotar=\{\(\) => setAbierto\(\{ t: 'propio', inicial: \{ titulo: '', tipo: 'llamada'/);
  assert.match(leer('app/calendario/AgendarLlamada.tsx'), /onClick=\{onAnotar\}[^>]*>Anotarla aquí<\/Button>/);
  // La leyenda ES el filtro: el nombre prende o apaga TODAS las capas del uso.
  assert.match(app, /onClick=\{\(\) => alternar\(llaves\)\}/);
});

test('2. la reunión de entrega es un tipo propio: su capa, su texto, la migración que la deja guardar y la API', () => {
  assert.ok((TIPOS_EVENTO as readonly string[]).includes('entrega'));
  assert.equal(capaDeTipo('entrega'), 'entregas');
  assert.equal(capaDeTipo('llamada'), 'llamadas');
  assert.equal(ROTULO_TIPO.entrega, 'Reunión de entrega');
  assert.equal(entradaPropia({ tipo: 'entrega', titulo: ' ', fecha: '2026-10-30', hora: '10:00', horaFin: '11:00', formato: 'reel', calendarioId: null }).titulo, 'Reunión de entrega');
  const f = filaDeEntrada({ titulo: 'Sesión con Ana', tipo: 'entrega', fecha: '2026-10-30', hora: '10:00', duracionMin: 60 }, 'America/Argentina/Buenos_Aires');
  assert.ok(f.ok && f.fila.tipo === 'entrega' && f.fila.formato === null);
  // El CHECK de la base la deja pasar: la migración agranda la lista con TODOS los tipos del modelo.
  const sql = crudo('supabase/migrations/0352_calendario_entregas.sql');
  const lista = /check \(tipo in \(([^)]+)\)\)/.exec(sql)?.[1] ?? '';
  assert.deepEqual(lista.split(',').map((x) => x.trim().replace(/'/g, '')).sort(), [...TIPOS_EVENTO].sort());
  assert.match(sql, /ORDEN DE DESPLIEGUE: ANTES/);
  // Se crea desde el «crear» del lugar (computadora y teléfono) y el bloque ya no se ofrece para algo nuevo.
  assert.deepEqual(TIPOS_RAPIDO.map((t) => t.id), ['evento', 'publicacion', 'llamada', 'entrega']);
  assert.match(leer('app/calendario/EventoModal.tsx'), /const TIPOS_QUE_SE_OFRECEN: readonly TipoEvento\[\] = \['publicacion', 'llamada', 'entrega'\];/);
  assert.match(leer('app/calendario/EventoModal.tsx'), /TIPOS_EVENTO\.filter\(\(t\) => TIPOS_QUE_SE_OFRECEN\.includes\(t\) \|\| t === inicial\.tipo\)/, 'un bloque guardado tiene que poder editarse con su tipo');
  assert.match(crudo('lib/api-mako/areas/calendario.def.ts'), /entrega \(una reunión de entrega del servicio a un cliente\)/);
});

test('3. lo que se fue de la copia de Google no vuelve', () => {
  const app = leer('app/calendario/CalendarioApp.tsx');
  for (const [que, re] of [
    ['la barra lateral de Google', /className="gc-lado"/],
    ['el ☰ que la plegaba', /Ocultar el menú principal|setLado/],
    ['el logo con el día', /gc-logo/],
    ['«Crear» y su menú', /className="gc-crear"|MenuFlotante|menuCrear/],
    ['el mes chico', /<MiniMes|from '\.\/MiniMes'/],
    ['«Mis calendarios» con una casilla por calendario', /Mis calendarios|CasillaCalendario/],
    ['el desplegable de las seis vistas', /gc-vista-boton|menuVista/],
    ['la vista Año', /VistaAnio|vista === 'anio'/],
    ['las plantillas de semana', /PlantillasSemana|'plantillas'/],
    ['el Bloque de trabajo del menú', /tipo: 'bloque'/],
  ] as const) assert.doesNotMatch(app, re, `volvió ${que}`);
  assert.equal(existsSync(resolve(RAIZ, 'app/calendario/MiniMes.tsx')), false);
  assert.match(leer('app/calendario/Pestanas.tsx'), /\{ id: 'dia', nombre: 'Día' \},\s*\{ id: 'semana', nombre: 'Semana' \},\s*\{ id: 'mes', nombre: 'Mes' \},\s*\{ id: 'agenda', nombre: 'Agenda' \},\s*\];/);
  assert.match(leer('app/calendario/ListaLlamadas.tsx'), /<div className="gc-derecha"><PestanasCalendario activa="llamadas" \/><\/div>/);
  assert.doesNotMatch(leer('app/calendario/ListaLlamadas.tsx'), /gc-logo/);
  // Y la hoja no carga reglas de lo que ya no existe (un template literal largo esconde bien una regla muerta).
  assert.doesNotMatch(crudo('app/calendario/gc-css.ts').split('export const CSS_GC')[1], /\.gc-(lado|logo|crear|mini|grupo|casilla|anio|vista-boton)\b/);
});

test('4. un link viejo de Año o de 4 días abre el Mes o la Semana, no la semana de hoy sin avisar', () => {
  const pagina = leer('app/calendario/page.tsx');
  assert.match(pagina, /const vista = pedida === 'anio' \? 'mes' : pedida === '4dias' \? 'semana' : esVistaCalendario\(pedida\) \? pedida : 'semana';/);
  assert.doesNotMatch(pagina, /googleCalendarConectado/, 'la rama del Año que no leía nada');
});

test('5. la barra de MaKo está en el Calendario: la monta el layout raíz y el Calendario no está entre las que la pliegan', async () => {
  const { pliegaLaBarra } = await import('../app/_components/Sidebar');
  assert.equal(pliegaLaBarra('/calendario'), false);
  assert.match(leer('app/layout.tsx'), /<Sidebar inicial=/);
  // Y la estrella de MaKo, con su lugar (el chat al costado, como en el resto de las tabs).
  assert.match(leer('app/calendario/CalendarioApp.tsx'), /<MakoEnLaTab tab="Calendario" /);
});
