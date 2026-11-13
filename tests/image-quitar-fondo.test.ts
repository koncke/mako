// «Quitar fondo» prendido con MODNet desde Hugging Face, y la persona de una miniatura recortada al abrir (12/11/2026).
//
// El Cerebro, mirando la réplica de la miniatura de Dan Martell: «persona recortada, sin fondo y grande». El sí, con condiciones:
// el navegador baja el modelo de Hugging Face (`Xenova/modnet`, Apache-2.0) con la URL FIJADA a un commit y el sha256 verificado
// (sin alojarlo nosotros), primero el cuantizado, y si no carga la miniatura sale igual (la persona grande, con su fondo).
//
// Esto fija:
//   1. el descriptor pasa la validación del motor (app/image-editor/_doory/editor/engine/bgRemoval/model.ts) desde hola-mako.com;
//      una rama (`main`) o cualquier otro sitio, no: un modelo que puede cambiar debajo no entra;
//   2. la marca de la foto a recortar es la MISMA en la réplica (lib) y en el editor (app), y sólo la encuentra en imágenes;
//   3. la réplica marca la persona de una miniatura, y la de un carrusel no;
//   4. el editor prende el motor y monta el recorte siempre (no sólo cuando el chat tiene su ranura).
//
// Verificado rompiéndolo (12/11/2026), cada rotura sola y restaurada: ver el pie.
//
// Correr: node --import tsx --test tests/image-quitar-fondo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseModelDescriptor } from '../app/image-editor/_doory/editor/engine/bgRemoval/model';
import { FOTO_A_RECORTAR, MODNET, encuadreDeLaPersona, fotosARecortar } from '../app/image-editor/mako/modelo-modnet';
import { FOTO_A_RECORTAR as MARCA_DE_LA_REPLICA, documentoDeReplica, type Replica } from '../lib/carruseles/replica';

const ORIGEN = 'https://hola-mako.com';

test('1 · el modelo fijado a un commit pasa la validación del motor; una rama u otro sitio, no', () => {
  const d = parseModelDescriptor(MODNET, ORIGEN);
  assert.ok(d, 'el descriptor de MODNet no pasa: «Quitar fondo» quedaría apagado');
  assert.equal(d!.url, MODNET.url);
  assert.match(d!.sha256, /^[0-9a-f]{64}$/);
  assert.equal(d!.input.name, 'input');
  assert.equal(d!.output, 'output');
  assert.equal(parseModelDescriptor({ ...MODNET, url: 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx' }, ORIGEN), null, 'una rama puede cambiar debajo');
  assert.equal(parseModelDescriptor({ ...MODNET, url: `https://evil.example/Xenova/modnet/resolve/${'a'.repeat(40)}/onnx/m.onnx` }, ORIGEN), null);
  assert.equal(parseModelDescriptor({ ...MODNET, url: `https://huggingface.co/Xenova/modnet/resolve/${'a'.repeat(40)}/../x.onnx` }, ORIGEN), null);
  assert.ok(parseModelDescriptor({ ...MODNET, url: '/modelos/modnet.onnx' }, ORIGEN), 'el mismo origen sigue valiendo');
});

test('2 · la marca es la misma en la réplica y en el editor, y sólo marca imágenes', () => {
  assert.equal(MARCA_DE_LA_REPLICA, FOTO_A_RECORTAR, 'la réplica marca con un nombre que el editor no busca');
  const doc = { pages: [{ id: 'p1', objects: [
    { id: 'a', type: 'image', name: FOTO_A_RECORTAR }, { id: 'b', type: 'image', name: 'Foto: la tuya' }, { id: 'c', type: 'textbox', name: FOTO_A_RECORTAR },
  ] }] };
  assert.deepEqual(fotosARecortar(doc), [{ pagina: 'p1', id: 'a' }]);
});

test('3 · la réplica marca la persona de una miniatura; la de un carrusel, no', () => {
  const foto = { id: 'f1', url: 'https://x.supabase.co/storage/v1/object/public/image-editor/9/cara.jpg', ancho: 1080, alto: 1440 };
  const estilo = { titular: { familia: 'Montserrat', respaldo: 'sans-serif' as const, peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif' as const, peso: 400 } } as never;
  let n = 0;
  const nuevoId = () => `id${++n}`;
  const lamina = { fondo: '#F2F2F2', foto: null, textos: [{ rol: 'titulo' as const, texto: 'UPGRADE', x: 0.05, y: 0.1, ancho: 0.5, tamano: 0.1, color: '#111111', negrita: true, alinear: 'left' as const, mayus: true, letra: 'gruesa' as const }],
    cuadros: [{ x: 0.5, y: 0, ancho: 0.5, alto: 1, tipo: 'retrato' as const, persona: true, descripcion: 'él', busqueda: '', forma: 'rect' as const }] };
  const mini: Replica = { proporcion: '16:9', titulo: 'M', laminas: [lamina] };
  const img = ((documentoDeReplica({ replica: mini, estilo, marca: { nombre: 'X', usuario: null }, foto, nuevoId }).pages as Array<{ objects: Array<Record<string, unknown>> }>)[0].objects).find((o) => o.type === 'image')!;
  assert.equal(img.name, FOTO_A_RECORTAR, 'la persona de la miniatura no se marca para recortar');
  const carrusel: Replica = { proporcion: '4:5', titulo: 'C', laminas: [lamina] };
  const img2 = ((documentoDeReplica({ replica: carrusel, estilo, marca: { nombre: 'X', usuario: null }, foto, nuevoId }).pages as Array<{ objects: Array<Record<string, unknown>> }>)[0].objects).find((o) => o.type === 'image')!;
  assert.notEqual(img2.name, FOTO_A_RECORTAR, 'un carrusel no pidió el recorte');
});

test('4 · el editor prende el motor y monta el recorte siempre', () => {
  const pantalla = readFileSync(new URL('../app/image-editor/editor/PantallaEditor.tsx', import.meta.url), 'utf8');
  assert.match(pantalla, /useEffect\(\(\) => \{ prenderQuitarFondo\(\); \}, \[\]\)/, '«Quitar fondo» sigue apagado');
  // El chat en la tarjeta, la línea tal cual (tests/image-editor-chat.test.ts, 24): el recorte no se cuelga de ella (13/11/2026,
  // la punta cayó en rojo por eso) y lo monta el panel de MaKo, que ya está adentro del editor.
  assert.match(pantalla, /dentro=\{ranuraChat \? createPortal\(<PanelMakoIA \/>, ranuraChat\) : null\}/, 'se tocó la línea del chat en la tarjeta');
  const panel = readFileSync(new URL('../app/image-editor/mako/chat/PanelMakoIA.tsx', import.meta.url), 'utf8');
  assert.match(panel, /<div className=\{styles\.panel\}>[\s\S]{0,400}?<RecortarAlAbrir \/>/, 'nadie monta el recorte: la persona queda con fondo');
  const motor = readFileSync(new URL('../app/image-editor/mako/quitar-fondo.ts', import.meta.url), 'utf8');
  assert.match(motor, /editor\.arrange\.rename\(resto\.id, FOTO_RECORTADA\)/, 'la marca no se saca: se reintentaría en cada apertura');
});

test('5 · la persona sin fondo se encuadra desde la cabeza al tamaño del cuadro (si no, el editor la centra chica)', () => {
  // Medido con la foto de Martín (1080 × 1440): sin fondo, lo que no es transparente va de (0, 464) a (992, 1438), brazos abiertos.
  const r = encuadreDeLaPersona({ x: 0, y: 464, ancho: 993, alto: 975 }, { ancho: 1080, alto: 1440 }, { ancho: 563, alto: 720 });
  assert.ok(Math.abs(r.ancho / r.alto - 563 / 720) < 0.01, `el encuadre no tiene la forma del cuadro: ${r.ancho} × ${r.alto}`);
  assert.ok(r.y <= 464 && r.y >= 464 - 975 * 0.1, `la cabeza queda cortada o con aire de más (empieza en ${r.y})`);
  assert.ok(r.x >= 0 && r.x + r.ancho <= 1080 && r.y + r.alto <= 1440, 'el encuadre se sale de la foto');
  // Una cara de cerca (una selfie): el encuadre es casi toda la foto, sin achicarla de más.
  const selfie = encuadreDeLaPersona({ x: 100, y: 80, ancho: 880, alto: 1360 }, { ancho: 1080, alto: 1440 }, { ancho: 563, alto: 720 });
  assert.ok(selfie.ancho >= 1000, `una selfie se recortó de más: ${selfie.ancho}`);
});

// ── Probado rompiéndolo (12/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   Q1 model.ts sin la excepción de Hugging Face fijado                 → falla el 1
//   Q2 la excepción aceptando cualquier `resolve/<algo>`                 → falla el 1 (la rama `main`)
//   Q3 la réplica sin marcar la persona de la miniatura                  → falla el 3
//   Q4 PantallaEditor sin `prenderQuitarFondo`                           → falla el 4
//   Q6 el panel de MaKo sin `<RecortarAlAbrir />` (13/11)                 → falla el 4
//   Q5 el encuadre centrado en la persona y no desde su cabeza           → falla el 5
