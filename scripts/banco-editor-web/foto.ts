// @ts-nocheck: es un banco, no entra en la app.
// El banco de las fotos: lo que arma el chat (aplicarOperaciones) pasa por el cargador REAL del motor y se dibuja.
import { StaticCanvas } from 'fabric';
import '@/app/image-editor/_doory/editor/engine/objects/builtinKinds';
import { deserializeObjects, serializeObject } from '@/app/image-editor/_doory/editor/engine/serialization';
import { buildBackground } from '@/app/image-editor/_doory/editor/engine/objects/background';
import { aplicarOperaciones } from '@/lib/image-editor/chat/aplicar';
import { validarOperaciones } from '@/lib/image-editor/chat/catalogo';

const lienzo = document.createElement('canvas');
lienzo.width = 2000; lienzo.height = 1000;
const c = lienzo.getContext('2d')!;
const g = c.createLinearGradient(0, 0, 2000, 0);
g.addColorStop(0, '#d7263d'); g.addColorStop(0.5, '#1b998b'); g.addColorStop(1, '#2e294e');
c.fillStyle = g; c.fillRect(0, 0, 2000, 1000);
c.fillStyle = '#fff';
c.beginPath(); c.arc(1000, 500, 300, 0, Math.PI * 2); c.fill();
c.fillStyle = '#000'; c.font = '200px sans-serif'; c.fillText('IZQ', 40, 200); c.fillText('DER', 1540, 900);
const url = lienzo.toDataURL('image/jpeg', 0.8);

const fotos = new Map([['o1', { id: 'sub-1', url, nombre: 'prueba.jpg', ancho: 2000, alto: 1000 }]]);
const doc = { width: 1080, height: 1080, pages: [{ id: 'p1', background: { type: 'solid', color: '#ffffff' }, objects: [] as unknown[] }, { id: 'p2', background: { type: 'solid', color: '#ffffff' }, objects: [] as unknown[] }, { id: 'p3', background: { type: 'solid', color: '#ffffff' }, objects: [] as unknown[] }] };
const vistaPaginas = new Map([['pa1', 'p1'], ['pa2', 'p2'], ['pa3', 'p3']]);
let n = 0;
const { operaciones, descartes: d0 } = validarOperaciones([
  { op: 'agregar_foto', foto: 'o1', pagina: 'pa1', x: 40, y: 40, ancho: 1000, alto: 1000 },
  { op: 'agregar_foto', foto: 'o1', pagina: 'pa2', x: 0, y: 0, ancho: 1080, alto: 1080, cubrir: true },
  { op: 'fondo_foto', foto: 'o1', pagina: 'pa3' },
]);
const r = aplicarOperaciones({ doc, operaciones, vista: { elementos: new Map(), paginas: vistaPaginas }, nuevoId: () => `o${++n}`, activePageId: 'p1', fotos });

const salida: Record<string, unknown> = { d0, descartes: r.descartes, aplicadas: r.aplicadas };
const ctx = { resolveSrc: async (s: string) => s, ensureFonts: async () => {} };
const paginas = (r.doc as unknown as { pages: Array<{ id: string; objects: never[]; background: never }> }).pages;
for (const pg of paginas) {
  const el = document.createElement('canvas');
  document.getElementById('app')!.appendChild(el);
  el.style.cssText = 'border:1px solid #888;margin:6px';
  const can = new StaticCanvas(el, { width: 360, height: 360, backgroundColor: '#fff' });
  can.setZoom(360 / 1080);
  const objs = await deserializeObjects(pg.objects, ctx as never);
  const bg = await buildBackground(pg.background, 1080, 1080, ctx.resolveSrc);
  can.add(bg.object);
  for (const o of objs) can.add(o);
  can.requestRenderAll();
  const tipo = objs.map((o) => {
    const v = o as unknown as Record<string, number> & { type: string };
    const vuelta = serializeObject(o) as Record<string, unknown>;
    return {
      tipo: v.type, cls: o.constructor.name, w: Math.round(o.getScaledWidth()), h: Math.round(o.getScaledHeight()), cropX: v.cropX, cropY: v.cropY, left: Math.round(v.left), top: Math.round(v.top),
      vueltaSrcIgual: vuelta.src === url, vueltaAsset: vuelta.assetId, vueltaCross: vuelta.crossOrigin ?? null, vueltaWidth: vuelta.width, vueltaCrop: vuelta.cropX,
    };
  });
  salida[pg.id] = tipo.length ? tipo : { fondo: (pg.background as { type: string }).type, fondoCls: bg.object.constructor.name };
}
(window as unknown as { __salida: unknown }).__salida = salida;
document.title = 'listo';
