// =============================================================================
// El recorrido de Automations espera a que MaKo TERMINE de armar el flujo (punto 9 del feedback del 13/10/2026)
// =============================================================================
// Martín, reunión del 13/10 (Fathom 858545195 @64:00): el pop-up del recorrido tiene que aparecer «únicamente después
// de que la IA termine de generar el flujo completo». La tab lo abría apenas la fila existía (`creando` vuelve a null)
// y MaKo seguía escribiendo las tarjetas en el lienzo. Ahora la señal del chat de MaKo (`chatTrabajando`,
// SecuenciaPerfil) sube a la tab (`onMakoTrabajando`) y el recorrido —y su reapertura desde el CRON— la esperan.
// Son componentes de cliente: el test mira el fuente.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 el recorrido sin `!makoTrabajando`                                                → 2 / 1
//   R2 SimuladorWhatsApp sin pasarle `onMakoTrabajando` al perfil                         → 2 / 1
//
// Correr: node --import tsx --test tests/automations-recorrido-espera-ia.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const APP = leer('../app/automations/ChatAgentApp.tsx');
const LISTA = leer('../app/automations/SimuladorWhatsApp.tsx');
const PERFIL = leer('../app/automations/SecuenciaPerfil.tsx');

test('la tab no abre el recorrido mientras MaKo arma el flujo (ni lo reabre desde el CRON)', () => {
  assert.match(APP, /useRecorridoAutomations\(rolAdmin && visibles !== null && !error && creando === null && !galeria && !makoTrabajando\)/);
  assert.match(APP, /const conLienzo = visibles !== null && visibles\.length > 0 && creando === null && !galeria && !makoTrabajando;/);
});

test('la señal sube del perfil a la tab, pasando por la lista', () => {
  assert.match(APP, /onMakoTrabajando=\{setMakoTrabajando\}/);
  assert.match(LISTA, /onMakoTrabajando=\{onMakoTrabajando\}/);
});

test('el perfil avisa cuando el chat de MaKo trabaja, y al desmontarse deja de trabajar', () => {
  assert.match(PERFIL, /useEffect\(\(\) => \{ onMakoTrabajandoRef\.current\?\.\(chatTrabajando\); \}, \[chatTrabajando\]\);/);
  assert.match(PERFIL, /useEffect\(\(\) => \(\) => \{ onMakoTrabajandoRef\.current\?\.\(false\); \}, \[\]\);/);
});
