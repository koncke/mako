// =============================================================================
// La lista de /automations marca lo SIN PUBLICAR (app/automations/SimuladorWhatsApp.tsx, `sinPublicarDe`)
// =============================================================================
// Restos de versiones anteriores, grupo «lista» (10/10/2026). En Configuraciones › Notificaciones la fila
// de un mensaje de MaKo en WhatsApp con borrador llevaba un punto ámbar (PlantillasView), y el detalle
// (`TemplateDetalleModal`) sacó su «¿Publicar los cambios?» de salida contando con esa marca. Cuando la
// lista se mudó a /automations (quinta tanda, punto 5) la marca no vino: un mensaje a medio editar se veía
// igual que uno publicado, y MaKo seguía mandando el texto de antes sin que nada lo dijera. Va también en
// las automatizaciones, que guardan su borrador desde la mig 0240.
//
// PROBADO ROMPIÉNDOLO (10/10/2026, restaurando de memoria; base 3 pases / 0 fallos):
//   · la fila sin dibujar el punto (`{false && (`)                      → 2 fallos, 1 pase;
//   · las filas de MaKo en WhatsApp sin pasarle `sinPublicar`           → 1 fallo, 2 pases;
//   · `sinPublicarDe` sin mirar el borrador (sólo `abierta`)            → 3 fallos, 0 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimuladorWhatsApp, sinPublicarDe } from '../app/automations/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import type { PlantillaVista } from '../lib/plantillas';

const sec = (id: number, nombre: string, borrador: SecuenciaDto['borrador']): SecuenciaDto => ({
  id, clave: `s${id}`, nombre, etapa: 'nuevo', trigger_tipo: 'etapa_actual', activa: true, pasos: [], inscriptos: 0,
  enviados: 0, estrategia: null, metricas: {}, borrador,
} as unknown as SecuenciaDto);

const aviso = (id: string, titulo: string, borrador: string | null): PlantillaVista => ({
  id, titulo, categoria: 'aviso', prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
  disparador: 'Cuando pasa algo', ejemplo: `Texto de ${titulo}`,
  enabled: true, esCustom: false, fijo: false, canales: { wa: true, email: false }, frecuenciaMin: 0, posiciones: {}, borrador, asunto: '',
} as PlantillaVista);

const dibujar = (extra: Record<string, unknown>) => renderToStaticMarkup(createElement(SimuladorWhatsApp, {
  objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
  rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
  productos: [], disparadores: [], tz: null,
  secuencias: [],
  ...extra,
} as Parameters<typeof SimuladorWhatsApp>[0]));

/**
 * ¿La fila que dice `nombre` lleva el punto? Cada fila es un `chb-fila`. El primer pedazo es lo de antes
 * de la primera fila —el lienzo abierto, que también dibuja el nombre en su título—: no es una fila.
 */
function marcada(html: string, nombre: string): boolean {
  const fila = html.split('class="chb-fila').slice(1).find((f) => f.includes(`>${nombre}<`));
  assert.ok(fila, `no está la fila «${nombre}»`);
  return fila.includes('data-sin-publicar');
}

test('sinPublicarDe: hay borrador (aunque sea un texto vacío) o el lienzo abierto tiene cambios', () => {
  assert.equal(sinPublicarDe({ borrador: null }), false);
  assert.equal(sinPublicarDe({}), false, 'ausente = no se pudo leer: no se afirma nada');
  assert.equal(sinPublicarDe({ borrador: '' }), true, 'borrar todo el texto también es un cambio sin publicar');
  assert.equal(sinPublicarDe({ borrador: { pasos: [], guardado_at: '2026-10-10T10:00:00Z' } }), true);
  assert.equal(sinPublicarDe({ borrador: null }, true), true, 'lo que el lienzo abierto tiene sin publicar, aunque no esté guardado');
});

test('las filas de MaKo en WhatsApp con borrador llevan el punto, y las demás no', () => {
  const html = dibujar({
    secuencias: [sec(7, 'Bienvenida', null)],
    avisos: [aviso('reporte-semanal', 'Reporte semanal', 'Lo nuevo'), aviso('cuota-vencida', 'Cuota vencida', null)],
  });
  assert.equal(marcada(html, 'Reporte semanal'), true, 'el mensaje a medio editar se ve igual que uno publicado');
  assert.equal(marcada(html, 'Cuota vencida'), false);
});

test('una automatización con borrador guardado también lo dice en su fila', () => {
  const html = dibujar({
    secuencias: [sec(7, 'Bienvenida', { pasos: [], guardado_at: '2026-10-10T10:00:00Z' }), sec(8, 'Post-agenda', null)],
  });
  assert.equal(marcada(html, 'Bienvenida'), true);
  assert.equal(marcada(html, 'Post-agenda'), false);
});
