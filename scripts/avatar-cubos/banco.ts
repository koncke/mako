// El banco de prueba de la réplica (scripts/avatar-cubos/replica.mjs lo empaqueta con esbuild y lo abre en Playwright).
// Hace lo MISMO que la pantalla de AI Avatar (app/ai-avatar/cubos/EstudioCubos.tsx): deja los datos en window.__CUBOS, abre
// la plantilla en un iframe de 1080×1920 en modo captura, prepara la voz y arma el MP4 con app/ai-avatar/cubos/mp4.ts.
import { armarMp4, esperarPlantilla, prepararVoz } from '../../app/ai-avatar/cubos/mp4';
import { formatoCubos } from '../../lib/ai-avatar/cubos-formatos';
import { resolverPersonaje, normalizarPersonaje, PERSONAJE_MARTIN } from '../../lib/ai-avatar/cubos-personaje';
import type { Tiempos } from '../../lib/ai-avatar/cubos-tiempos';

type W = Window & { __CUBOS?: Record<string, unknown>; BANCO?: unknown };

const aBase64 = async (b: Blob): Promise<string> => {
  const u = new Uint8Array(await b.arrayBuffer()); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

(window as W).BANCO = async (o: { id: string; tiempos: Tiempos; voz: string; personaje?: unknown; segundos?: number }) => {
  const f = formatoCubos(o.id);
  if (!f) throw new Error('formato desconocido ' + o.id);
  const t0 = performance.now();
  const voz = await prepararVoz(o.voz, []);
  const clave = 'banco-' + Date.now();
  (window as W).__CUBOS = { [clave]: {
    tiempos: o.tiempos,
    datos: f.ejemplo.datos,
    personaje: resolverPersonaje(normalizarPersonaje(o.personaje ?? PERSONAJE_MARTIN)),
    voz: URL.createObjectURL(voz.wav),
  } };
  const ifr = document.createElement('iframe');
  ifr.style.cssText = 'position:fixed;left:0;top:0;width:1080px;height:1920px;border:0;opacity:0;pointer-events:none';
  ifr.src = f.pagina + '?cap#' + clave;
  document.body.appendChild(ifr);
  const ventana = await esperarPlantilla(ifr);
  const dur = o.segundos ?? ventana.__dur ?? o.tiempos.anchors.end;
  const t1 = performance.now();
  const mp4 = await armarMp4({ ventana, dur, voz: voz.buffer });
  const t2 = performance.now();
  return { mp4: await aBase64(mp4!), ms: { cargar: Math.round(t1 - t0), armar: Math.round(t2 - t1), porCuadro: Math.round((t2 - t1) / Math.round(dur * 30)) } };
};
