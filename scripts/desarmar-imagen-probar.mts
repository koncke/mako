// =============================================================================
// Probar el desarme de un carrusel o una imagen de anuncio de Spy SIN la pantalla (ticket 97, 14/11/2026)
// =============================================================================
// Los mismos pasos que lib/imagen-desarmar-servidor.ts (las láminas como las trae la réplica de Image, la IA del negocio con
// visión, la lectura), pero NO guarda nada en la base. Lo que queda es el uso de IA del negocio (lo que se gastó de verdad).
//
//   npx tsx --conditions=react-server --env-file=<.env.local> scripts/desarmar-imagen-probar.mts <ws> <piezaId> <salida.json>
// =============================================================================

import { writeFileSync } from 'node:fs';
import { runWithWorkspace } from '../lib/workspace';
import { leerDocumentoIA } from '../lib/ai-cheap';
import { referenciaDelNegocio } from '../lib/carruseles/crear-servidor';
import { comoDataUrl } from '../lib/carruseles/replica-servidor';
import { imagenesDe } from '../lib/carruseles/explorar';
import { LAMINAS_A_MIRAR, instruccionDesarmeImagen, jsonDeTexto, leerDesarmeImagen, pedidoDeDesarmeImagen, type DesarmeImagen } from '../lib/imagen-desarmar';

const [wsTxt, piezaTxt, salida] = process.argv.slice(2);
const ws = Number(wsTxt);
const piezaId = Number(piezaTxt);
if (!Number.isInteger(ws) || !Number.isInteger(piezaId) || !salida) { console.error('Uso: <ws> <piezaId> <salida.json>'); process.exit(2); }

const t0 = Date.now();
await runWithWorkspace(ws, async () => {
  const c = await referenciaDelNegocio(piezaId);
  if (!c) { console.error('Esa pieza no está en el Spy de ese negocio.'); process.exit(1); }
  const clase: DesarmeImagen['clase'] = c.clase === 'anuncio' ? 'anuncio' : c.medio === 'carrusel' || (c.laminas ?? 0) > 1 ? 'carrusel' : 'imagen';
  const imagenes = (await Promise.all(imagenesDe(c).slice(0, clase === 'carrusel' ? LAMINAS_A_MIRAR : 1).map(comoDataUrl))).filter((x): x is string => !!x);
  console.log(`${clase}: ${imagenes.length} imágenes de ${imagenesDe(c).length}`);
  const cuenta = c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre;
  const r = await leerDocumentoIA({
    dataUrl: imagenes[0], dataUrls: imagenes, isPdf: false, nombreArchivo: 'lamina.jpg',
    prompt: instruccionDesarmeImagen({ laminas: imagenes.length, clase, cuenta }), json: true,
    feature: 'imagen-desarmar', motivo: `Probar el desarme de la pieza ${piezaId}`, maxTokens: 8000, timeoutMs: 150_000,
  });
  const leido = leerDesarmeImagen(jsonDeTexto(r.text), { laminas: imagenes.length, clase });
  if (!leido.ok) { console.error(leido.error, r.text.slice(0, 400)); process.exit(1); }
  writeFileSync(salida, JSON.stringify({ proveedor: r.provider, desarme: leido.desarme, pedido: pedidoDeDesarmeImagen(leido.desarme) }, null, 2));
  const d = leido.desarme;
  console.log(`OK en ${Math.round((Date.now() - t0) / 1000)} s con ${r.provider} · ${d.tipo} · ${d.laminas.length} láminas · ${d.laminas.reduce((a, l) => a + l.textos.length, 0)} textos · paleta ${d.paleta.join(' ')}`);
  console.log(`pedido: ${pedidoDeDesarmeImagen(d)}`);
});
