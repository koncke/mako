// =============================================================================
// La tab Video es la pantalla de Create: «Nuevo video» con plantillas y el chat a la izquierda (29/10/2026)
// =============================================================================
// Martín, 29/10/2026: «para todas las secciones de "create" no quiero otras tabs... En todas las tabs el mismo diseño de la
// barra lateral del chat de MaKo SIEMPRE abierto a la izquierda, y que los diferentes proyectos sean todos como en "Web
// generator"... En "nueva"... TEMPLATES con la sección de ¿Qué vas a crear hoy?». «No quiero paja, prefiero deprecar antes
// que conservar». «En la computadora Y en el teléfono». Esto fija:
//   1. las tarjetas de «Nuevo video» (app/video-editor/plantillas-crear.ts, puro): los lienzos con su tamaño, «Generar con
//      IA» y las plantillas de anuncio con las sugeridas primero, y qué hace cada una;
//   2. el cableado de la computadora: PantallaCrear con esas tarjetas, el chat del editor a la IZQUIERDA y sin cerrar, sin
//      la portada de CapCut, sin la columna de la derecha ni el botón que la abría;
//   3. el teléfono: las MISMAS tarjetas, sin la barra de secciones y sin la capa oscura.
// ⚠️ PROBADO ROMPIENDOLO (29/10/2026, base 6/0, cada rotura da 5/1): ver las roturas al pie de cada test.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANTES_DE_LOS_LIENZOS, destinoDe, FORMATOS_VIDEO, GENERAR_CON_IA, GRUPO_REPLICAR, PERSONAJE_CON_IA, plantillasNuevoVideo, rutaDePlantilla, sinGuiadas, EJEMPLOS_NUEVO_VIDEO } from '@/app/video-editor/plantillas-crear';
import { PLANTILLAS_GUIADAS } from '@/lib/video-plantillas';
import { PLANTILLAS } from '@/lib/editor-video/plantillas';
import { proporcion } from '@/app/_crear/reglas';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. «Nuevo video»: lo guiado primero («Replicar un outlier»), los cuatro lienzos, «Generar con IA» y las plantillas de anuncio', () => {
  const todas = plantillasNuevoVideo(null);
  // 9/11/2026 (la tab Video): primero las plantillas GUIADAS y «Tu personaje con IA», en la sección «Replicar un outlier».
  const antes = todas.slice(0, ANTES_DE_LOS_LIENZOS);
  assert.deepEqual(antes.map((p) => p.id), [...PLANTILLAS_GUIADAS.map((p) => `guia:${p.id}`), 'personaje:nuevo']);
  for (const p of antes) assert.equal(p.grupo, GRUPO_REPLICAR, `${p.nombre}: fuera de «Replicar un outlier»`);
  assert.ok(todas.slice(ANTES_DE_LOS_LIENZOS).every((p) => !p.grupo), 'lo de siempre, sin sección: va debajo, como antes');
  const t = todas.slice(ANTES_DE_LOS_LIENZOS);
  assert.deepEqual(t.slice(0, 4).map((p) => [p.nombre, p.formato, p.rotulo]), [
    ['Reel o TikTok', '9 / 16', '1080 × 1920'],
    ['YouTube', '16 / 9', '1920 × 1080'],
    ['Cuadrado', '1 / 1', '1080 × 1080'],
    ['Post 4:5', '4 / 5', '1080 × 1350'],
  ]);
  assert.equal(t[4].nombre, 'Generar con IA');
  assert.deepEqual(t.slice(5).map((p) => p.nombre), PLANTILLAS.map((p) => p.nombre), 'sin señales, las plantillas en el orden del catálogo');
  assert.equal(new Set(t.map((p) => p.id)).size, t.length, 'ids repetidos: dos tarjetas harían lo mismo');
  // El marco de cada lienzo tiene SU proporción (la miniatura lo dibuja con `marcoDe`).
  for (const [i, f] of FORMATOS_VIDEO.entries()) assert.ok(Math.abs(proporcion(t[i].formato) - f.ancho / f.alto) < 1e-9, f.nombre);
  for (const f of FORMATOS_VIDEO) assert.ok(f.ancho % 2 === 0 && f.alto % 2 === 0, `${f.nombre}: el H.264 pide lados pares`);
  assert.ok(EJEMPLOS_NUEVO_VIDEO.length >= 3 && EJEMPLOS_NUEVO_VIDEO.length <= 4);
  // Roto: «Post 4:5» con 1080 × 1350 escrito como «1080 / 1350» (sin reducir) → 1 fallo.
});

test('2. con señales del negocio, las sugeridas primero y con «Sugerida» en el rótulo', () => {
  // Un negocio que cierra con llamadas y cuyo cuello es la conversión: «Testimonio» le sirve
  // (lib/editor-video/plantillas-etiquetas.ts).
  const senales = { canales: ['llamadas'], entradas: [], cobros: [], cuello: 'conversion' } as unknown as SenalesNegocio;
  const con = plantillasNuevoVideo(senales).slice(ANTES_DE_LOS_LIENZOS + 5);
  const sin = plantillasNuevoVideo(null).slice(ANTES_DE_LOS_LIENZOS + 5);
  assert.equal(con.length, sin.length, 'ordenar no saca ni agrega plantillas');
  assert.equal(con[0].id, 'plantilla:testimonio', 'la sugerida va primera');
  assert.match(con[0].rotulo ?? '', /^Sugerida · 15 s$/);
  const sugeridas = con.filter((p) => p.rotulo?.startsWith('Sugerida'));
  assert.deepEqual(con.slice(0, sugeridas.length).map((p) => p.id), sugeridas.map((p) => p.id), 'las sugeridas, todas arriba');
  for (const p of sin) assert.match(p.rotulo ?? '', /^\d+ s$/, 'sin señales, el rótulo es la duración');
  // Los lienzos y «Generar con IA» no se reordenan.
  assert.deepEqual(plantillasNuevoVideo(senales).slice(0, ANTES_DE_LOS_LIENZOS + 5).map((p) => p.id), plantillasNuevoVideo(null).slice(0, ANTES_DE_LOS_LIENZOS + 5).map((p) => p.id));
  // Roto: el rótulo sin «Sugerida» → 1 fallo; las señales ignoradas (`plantillasEnOrden(null)`) → 1.
});

test('3. qué hace cada tarjeta: el lienzo fija su proporción (el primer clip no lo pisa), la plantilla arma un proyecto, la IA va al generador', () => {
  const reel = destinoDe('lienzo:reel');
  assert.deepEqual(reel, { tipo: 'lienzo', lienzo: { canvasSize: { width: 1080, height: 1920 }, relacion: '9:16', canvasSizeMode: 'preset' } });
  // 4:5 no está en «Relación»: va como «personalizado» (lo que guarda «Detalles»), que también queda fijo.
  assert.deepEqual(destinoDe('lienzo:post'), {
    tipo: 'lienzo',
    lienzo: { canvasSize: { width: 1080, height: 1350 }, relacion: 'personalizado', canvasSizeMode: 'custom', lastCustomCanvasSize: { width: 1080, height: 1350 } },
  });
  // Fija = la regla de commands/timeline/element/insert-element.ts: con una relación que no es «original», el lienzo se queda.
  const insertar = leer('app/video-editor/_opencut/commands/timeline/element/insert-element.ts');
  assert.match(insertar, /const relacionFija = !!relacion && relacion !== "original";/, 'cambió cómo el primer clip decide el lienzo: revisar los lienzos de «Nuevo video»');
  for (const f of FORMATOS_VIDEO) {
    const d = destinoDe(`lienzo:${f.id}`);
    assert.ok(d?.tipo === 'lienzo' && d.lienzo.relacion !== 'original' && d.lienzo.relacion !== '', `${f.nombre}: un lienzo sin relación fija lo pisa el primer clip`);
  }
  assert.deepEqual(destinoDe('plantilla:testimonio'), { tipo: 'plantilla', id: 'testimonio' });
  assert.equal(destinoDe('plantilla:no-existe'), null);
  assert.equal(destinoDe('lienzo:no-existe'), null);
  assert.equal(destinoDe('cualquier-cosa'), null);
  assert.deepEqual(destinoDe('ia:generar'), { tipo: 'ia' });
  // La guiada arma un proyecto VERTICAL con su nombre; una que no existe, nada. «Tu personaje con IA» va al estudio.
  assert.deepEqual(destinoDe('guia:mensaje-para'), { tipo: 'guia', id: 'mensaje-para', nombre: 'Mensaje para…', lienzo: { canvasSize: { width: 1080, height: 1920 }, relacion: '9:16', canvasSizeMode: 'preset' } });
  assert.equal(destinoDe('guia:no-existe'), null);
  assert.deepEqual(destinoDe('personaje:nuevo'), { tipo: 'personaje' });
  assert.deepEqual(PERSONAJE_CON_IA, { escritorio: '/ai-avatar', movil: '/m/ai-avatar' });
  // El teléfono no ofrece las guiadas (su guía vive en el chat del editor de la computadora), y sí todo lo demás.
  const movil = sinGuiadas(plantillasNuevoVideo(null));
  assert.ok(movil.every((p) => destinoDe(p.id)?.tipo !== 'guia'));
  assert.equal(movil.length, plantillasNuevoVideo(null).length - PLANTILLAS_GUIADAS.length);
  assert.equal(rutaDePlantilla('antes-despues'), '/video-editor/nuevo?plantilla=antes-despues');
  assert.equal(rutaDePlantilla('antes-despues', true), '/m/video-editor/nuevo?plantilla=antes-despues');
  assert.deepEqual(GENERAR_CON_IA, { escritorio: '/video-generator', movil: '/m/video' });
  // Cada tarjeta lleva a algún lado.
  for (const p of plantillasNuevoVideo(null)) assert.ok(destinoDe(p.id), `«${p.nombre}» no hace nada`);
  // Roto: `relacion: 'original'` en Reel → 1 fallo.
});

test('4. la computadora: PantallaCrear con «Nuevo video», el chat del editor a la izquierda y sin la portada de CapCut', () => {
  const cli = vivo(leer('app/video-editor/VideoEditorCliente.tsx'));
  assert.match(cli, /import \{ PantallaCrear, [^}]*\} from '@\/app\/_crear\/PantallaCrear';/);
  assert.match(cli, /<PantallaCrear\s+tab="Video"\s+nuevo="Nuevo video"/);
  assert.match(cli, /plantillas=\{plantillas\}/);
  assert.match(cli, /const plantillas = useMemo\(\(\) => plantillasNuevoVideo\(senales\), \[senales\]\);/);
  assert.match(cli, /chat=\{editor \? \(volver\) => <PanelChat volver=\{volver\} \/> : undefined\}/, 'el chat del editor es la tarjeta izquierda');
  // Los tres caminos de un proyecto siguen: el editor, «Editar en el editor» (`?desde=`) y «Utilizar plantilla» (`?plantilla=`).
  assert.match(cli, /desde \? <ImportarDesde desde=\{desde\} \/>\n\s*: plantilla !== undefined \? <ArmarPlantilla id=\{plantilla\} \/>\n\s*: <EditorPage projectId=\{proyectoId\} propuesta=\{propuesta\} \/>/);
  // El «⋯» de cada proyecto: las operaciones del motor, y Eliminar en rojo y con confirmación.
  assert.match(cli, /rotulo: 'Cambiar nombre'/);
  assert.match(cli, /rotulo: 'Duplicar', hacer: \(\) => duplicar\(/);
  assert.match(cli, /rotulo: 'Eliminar',\n\s*peligro: true,\n\s*confirmar: /);
  assert.match(cli, /deleteProjects\(\{ ids: \[p\.id\] \}\)/);
  // La portada de CapCut se borró: nada la monta ni la deja en el árbol.
  assert.doesNotMatch(cli, /ProjectsPage|projects-page/);
  assert.ok(!existsSync(join(RAIZ, 'app/video-editor/_opencut/inicio/projects-page.tsx')), 'volvió la portada de CapCut');
  assert.ok(!existsSync(join(RAIZ, 'app/video-editor/_opencut/inicio/store.ts')), 'volvió el store que sólo usaba la portada de CapCut');
  // Roto: PantallaCrear sin `chat` (el Cerebro en vez del chat del editor) → 2 fallos (éste y video-editor-propuesta-link).
});

test('5. el chat no se cierra: ni columna a la derecha, ni botón que lo abre, ni ✕, ni `abierto`', () => {
  const page = vivo(leer('app/video-editor/_opencut/editor-page.tsx'));
  assert.doesNotMatch(page, /ColumnaChat|PanelChat|useChatAbierto/, 'el chat volvió a la derecha del editor');
  const cabecera = vivo(leer('app/video-editor/_opencut/components/editor/editor-header.tsx'));
  assert.doesNotMatch(cabecera, /BotonChat|useChatAbierto|Editar con IA/, 'volvió el botón que abría y cerraba el chat');
  const panel = vivo(leer('app/video-editor/_opencut/chat/PanelChat.tsx'));
  assert.match(panel, /export function PanelChat\(\{ volver = null \}/);
  assert.doesNotMatch(panel, /onCerrar|Cerrar el panel/, 'el chat volvió a tener ✕');
  // La cabecera de toda tarjeta de Create (29/10/2026): «MaKo» con su estrella y la «←» de la pantalla (`antes`).
  assert.match(panel, /<CabeceraDeChat [^>]*titulo="MaKo" criatura="MaKo" aspecto=\{ASPECTO_MAKO\}[\s\S]*?antes=\{volver\} \/>/, 'la cabecera del chat: «MaKo» con su estrella y la «←»');
  assert.doesNotMatch(vivo(leer('app/video-editor/_opencut/chat/estado.ts')), /abierto/);
  // Lo que pedía la portada al navegador (no borrar los proyectos) sigue, ahora en el editor.
  assert.match(page, /<StoragePersistenceDialog \/>/);
  // Roto: `<ColumnaChat />` de vuelta en editor-page → 1 fallo; el ✕ de vuelta en PanelChat → 1; `abierto` de vuelta en
  // chat/estado.ts → 1 (y 1 en tests/video-editor-propuesta-link.test.ts).
});

test('6. el teléfono: las MISMAS tarjetas, sin la barra de secciones y sin la capa oscura', () => {
  const inicio = vivo(leer('app/m/video-editor/InicioVideoM.tsx'));
  assert.match(inicio, /from '@\/app\/video-editor\/plantillas-crear';/, 'el teléfono arma sus tarjetas aparte: se van a separar');
  assert.match(inicio, /plantillasNuevoVideo\(senales\)/);
  assert.match(inicio, /<span>Nuevo video<\/span>/);
  assert.match(inicio, /titulo=\{TITULO_CAJA\}/, '«¿Qué vas a crear hoy?», el mismo título');
  assert.match(inicio, /router\.push\(GENERAR_CON_IA\.movil\)/);
  assert.match(inicio, /router\.push\(rutaDePlantilla\(d\.id, true\)\)/);
  const pagina = vivo(leer('app/m/video-editor/page.tsx'));
  assert.doesNotMatch(pagina, /SeccionesTabM/, 'volvió la barra de secciones (Editor · Create with AI · Reels)');
  assert.doesNotMatch(vivo(leer('app/m/video-editor/[proyecto]/page.tsx')), /<PantallaCompletaM[^>]*\boscura\b/);
  // Roto: las tarjetas del teléfono sin `plantillasNuevoVideo` → 1 fallo; `oscura` de vuelta → 1 (y 1 en
  // tests/video-editor-tema.test.ts); `<SeccionesTabM>` de vuelta → 1.
});
