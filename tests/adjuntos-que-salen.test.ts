// =============================================================================
// El archivo que nadie puso: no vuelve en otra automatización, y cada adjunto se nombra antes de mandar (14/11/2026)
// =============================================================================
// La llamada de Martín con Julio (13/11, min 00:43): al probar el envío de WhatsApp de una automatización salió un archivo
// que Martín no reconocía («¿qué te estoy mandando? Debe ser un guion de algo»).
//
// REPRODUCIDO ACÁ: una plantilla crea SIEMPRE las mismas tarjetas con los mismos ids (`pasosDePlantilla`). La barra del
// editor guarda lo que quedó sin enviar —el archivo incluido— con la clave «negocio | id | orden» y la «firma» del mensaje
// (lib/borrador-barra.ts). Dos automatizaciones hechas con la misma plantilla tienen la MISMA clave y la MISMA firma: el
// archivo que quedó en la barra de una vuelve en la de la otra, y al salir del editor entra al mensaje como una burbuja más.
// Ahora la clave lleva la automatización (`claveDeTarjeta(ws, paso, secuenciaId)`, que pone el lienzo), y la tarjeta y
// «Probar» dicen el nombre de cada adjunto (lib/adjuntos-que-salen.ts).
//
// Correr: node --import tsx --test tests/adjuntos-que-salen.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { claveDeTarjeta } from '../app/automations/EditorMensajeWhatsApp';
import { borradorAGuardar, borradorALeer, claveLocalBarra, firmaDelMensaje } from '../lib/borrador-barra';
import { PLANTILLAS, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { adjuntosDePartes, adjuntosQueSalen, avisoDeAdjuntos, textoAdjuntos } from '../lib/adjuntos-que-salen';
import type { PasoConPartes } from '../lib/mensaje-partes';

const RAIZ = join(__dirname, '..');
const sinComentarios = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

/** Un mensaje de WhatsApp de una plantilla de la galería: el mismo id y el mismo texto en cada automatización que la usa. */
function mensajeDePlantilla(): { id: string; orden: number; paso: PasoConPartes } {
  for (const p of PLANTILLAS) {
    const m = pasosDePlantilla(p).find((x) => (x as { nodo?: unknown }).nodo == null && (x as { canal?: unknown }).canal === 'whatsapp');
    if (m) return { id: String((m as { id: unknown }).id), orden: Number((m as { orden?: unknown }).orden ?? 0), paso: m as unknown as PasoConPartes };
  }
  throw new Error('ninguna plantilla tiene un mensaje de WhatsApp');
}

test('⛔ REPRODUCIDO: el archivo de la barra de una automatización volvía en otra hecha con la misma plantilla; ya no', () => {
  const m = mensajeDePlantilla();
  const tarjeta = { id: m.id, orden: m.orden };
  const firma = firmaDelMensaje(m.paso);
  const ahora = Date.parse('2026-11-13T21:15:00Z');
  // En la automatización 77 quedó un archivo en la barra, sin enviar: la copia del navegador.
  const guardado = borradorAGuardar(firma, '', { tipo: 'media', media_id: 512 }, null, ahora);
  const almacen = new Map<string, string>([[claveLocalBarra(claveDeTarjeta(9, tarjeta, 77)), JSON.stringify(guardado)]]);
  // ANTES la clave era «9|id|orden» en las dos (sin la automatización), y la firma tampoco las distingue: la 78, con la
  // misma plantilla, leía esta copia y le restauraba el archivo.
  assert.deepEqual(borradorALeer(JSON.stringify(guardado), firma, ahora)?.adjunto, { tipo: 'media', media_id: 512 }, 'la firma no las distingue');
  // AHORA: la 78 busca con SU clave y no encuentra nada.
  assert.notEqual(claveDeTarjeta(9, tarjeta, 77), claveDeTarjeta(9, tarjeta, 78));
  const enLa78 = almacen.get(claveLocalBarra(claveDeTarjeta(9, tarjeta, 78))) ?? null;
  assert.equal(borradorALeer(enLa78, firma, ahora), null, 'el archivo de la 77 volvió en la 78');
  // Y en la misma automatización sigue volviendo (recargar no pierde lo de la barra).
  assert.deepEqual(borradorALeer(almacen.get(claveLocalBarra(claveDeTarjeta(9, tarjeta, 77))) ?? null, firma, ahora)?.adjunto, { tipo: 'media', media_id: 512 });
});

test('el lienzo pone la automatización, y el editor, las cabeceras y el DM la usan en la clave', () => {
  const lienzo = sinComentarios('app/automations/FlujoLienzo.tsx');
  assert.match(lienzo, /<AutomatizacionDeLaTarjeta\.Provider value=\{secuenciaId \?\? null\}>/);
  const wa = sinComentarios('app/automations/EditorMensajeWhatsApp.tsx');
  assert.match(wa, /const claveBorrador = claveDeTarjeta\(ws, paso, useContext\(AutomatizacionDeLaTarjeta\)\);/);
  assert.match(wa, /const clave = useClaveDeTarjeta\(paso\);/);
  assert.doesNotMatch(wa, /claveDeTarjeta\(ws, paso\)/, 'quedó una clave sin la automatización');
  const dm = sinComentarios('app/automations/EditorMensajeSocial.tsx');
  assert.doesNotMatch(dm, /claveDeTarjeta\(ws, paso\)/, 'quedó una clave sin la automatización');
});

test('cada adjunto con su nombre: el de la biblioteca, o «Archivo #id» si no se pudo leer; sin repetir', () => {
  const pasos: PasoConPartes[] = [
    { canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'texto', partes: [{ tipo: 'texto', cuerpo: 'Hola' }, { tipo: 'audio', audio_id: 3 }, { tipo: 'media', media_id: 512, cuerpo: 'Te dejo esto' }] },
    { canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'media', media_id: 512, cuerpo: '' },
    { canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'media', media_id: 600, cuerpo: '' },
  ];
  const lista = adjuntosQueSalen(pasos, [{ id: 512, nombre: 'guion-reel.pdf' }], [{ id: 3, titulo: 'Bienvenida' }]);
  assert.deepEqual(lista, [{ tipo: 'audio', nombre: 'Bienvenida' }, { tipo: 'archivo', nombre: 'guion-reel.pdf' }, { tipo: 'archivo', nombre: 'Archivo #600' }]);
  assert.equal(avisoDeAdjuntos(lista), 'Van 3 adjuntos: 🎤 Bienvenida · 📎 guion-reel.pdf · 📎 Archivo #600');
  assert.equal(avisoDeAdjuntos([]), null, 'sin adjuntos, «Probar» no dice nada');
  assert.equal(textoAdjuntos(adjuntosDePartes([{ tipo: 'media', media_id: 512 }], [{ id: 512, nombre: 'guion-reel.pdf' }], [])), '📎 guion-reel.pdf');
});

test('la tarjeta nombra lo escondido detrás de «+N mensajes…», y «Probar» lo dice antes de mandar', () => {
  const lienzo = sinComentarios('app/automations/FlujoLienzo.tsx');
  assert.match(lienzo, /const escondidos = resto > 0 \? textoAdjuntos\(adjuntosDePartes\(partes\.slice\(PARTES_EN_TARJETA\),/);
  assert.match(lienzo, /\{textoMasPartes\(resto\)\}\{escondidos \? ` · \$\{escondidos\}` : ''\}/);
  const probar = sinComentarios('app/automations/PanelProbar.tsx');
  assert.match(probar, /<PopoverWA ancla=\{btnProbar\} etiqueta=\{def\.probarEn\} onCerrar=\{cerrarMenu\}>\n\s*\{avisoAdjuntos && \(/);
  assert.match(probar, /avisoDeAdjuntos\(adjuntosQueSalen\(flujoVivo as unknown as PasoConPartes\[\], adjuntos, audios\)\)/);
});
