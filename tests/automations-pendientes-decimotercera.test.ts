// =============================================================================
// Lo que dejó abierto la decimotercera tanda (docs/hallazgos-chatbot.md → «SIN HACER»), cerrado el 13/10/2026
// =============================================================================
//   1. Crear con MaKo sobre una fila con el borrador vaciado a mano pero con tarjetas PUBLICADAS daba 409 («ya tiene
//      tarjetas: pídele un cambio») en el chat: MaKo decidía «crear» mirando sólo el borrador. Con algo publicado, edita
//      sobre el borrador vacío (lo que arma queda en el borrador hasta Publicar): el server no pisa un flujo publicado.
//   2. Los rearranques de «Probar» (↻, «Cambió · ↻», «Probar en WhatsApp») miraban sólo la forma del flujo: desconectar un
//      medio con el panel abierto no frenaba hasta cerrarlo. El freno que viaja al panel suma el medio sin conectar (la
//      MISMA cuenta que el botón «Probar» y Publicar: `medioQueFrena`), y frenar abre el modal de ese medio.
//
// Lee el fuente sin comentarios (las dos decisiones viven en componentes que no se pueden montar acá sin el server).
//
// PROBADO ROMPIÉNDOLO (13/10/2026), cada rotura de a una y restaurada de memoria. Pasan / fallan:
//   R1 `crea` vuelve a mirar sólo el borrador                                       → 2 / 1
//   R2 SecuenciaPerfil no le pasa `publicadas` al chat                              → 2 / 1
//   R3 el freno del panel vuelve a ser sólo la forma (`freno: frenoLocal`)          → 2 / 1
//   R4 frenar con un medio abre una tarjeta en vez del modal del medio              → 2 / 1
//
// Correr: node --import tsx --test tests/automations-pendientes-decimotercera.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const CHAT = sinComentarios(leer('app/automations/ChatMako.tsx'));
const PERFIL = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));

test('MaKo no CREA sobre una automatización con tarjetas publicadas, aunque el borrador esté vacío', () => {
  assert.match(CHAT, /const crea = p\.pasos\.length === 0 && !\(p\.publicadas \?\? 0\);/);
  assert.match(PERFIL, /<ChatMako secuenciaId=\{secuencia\.id\} pasos=\{pasos\} publicadas=\{secuencia\.pasos\?\.length \?\? 0\}/);
});

test('los rearranques de «Probar» frenan también por un medio sin conectar', () => {
  const memo = PERFIL.slice(PERFIL.indexOf('const frenoProbar = useMemo'), PERFIL.indexOf('const frenoProbar = useMemo') + 500);
  assert.match(memo, /if \(frenoLocal\) return frenoLocal;/);
  assert.match(memo, /const falta = medioQueFrena\(pasos, lineaSec, crons\.lista, estadoMedios\);/);
  assert.match(PERFIL, /freno: frenoProbar, frenar: frenarDesdeProbar,/);
  // Y se calcula ANTES de mandarlo: los medios se leen arriba del efecto que manda la edición local.
  assert.ok(PERFIL.indexOf('const estadoMedios = useEstadoMedios') < PERFIL.indexOf('freno: frenoProbar'), 'el estado de los medios se lee después de mandarlo');
});

test('frenar con un medio abre el modal de ese medio, no una tarjeta', () => {
  const f = PERFIL.slice(PERFIL.indexOf('const frenarDesdeProbar = useCallback'), PERFIL.indexOf('const frenarDesdeProbar = useCallback') + 400);
  assert.match(f, /if \(f\.medio\) \{ setErr\(null\); setLineaAConectar\(f\.linea \?\? null\); setConectarMedio\(f\.medio\); return; \}/);
});
