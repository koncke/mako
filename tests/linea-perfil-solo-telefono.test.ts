// FOTO, NOMBRE Y PRIVACIDAD DE UNA LÍNEA: SÓLO DESDE EL TELÉFONO (19/11/2026).
//
// A las ~20:44 UTC se cambió la foto de perfil de la voz de MaKo con `POST /chat/updateProfilePicture`. En Evolution 2.3.7 esa ruta llama a
// `reloadConnection()`, que abre un socket nuevo SIN cerrar el viejo (whatsapp.baileys.service.ts:4092; lo mismo `updatePrivacySettings`
// en :4003 y `removeProfilePicture` en :4104). La línea siguió recibiendo por uno y dejó de contestar consultas por el otro: la sonda la
// dio por muerta, Martín la reconectó y quedaron dos instancias del mismo número. ⚠️ El diagnóstico obvio —«sorda otra vez, se perdió el
// parche del 14/11»— era el equivocado: recibía, y el parche seguía haciendo efecto. docs/hallazgos-comunicacion.md.
//
// La regla no puede depender de acordarse: este test falla si cualquier código del repo llama a una de esas rutas (o a la del nombre, que
// la regla de AGENTS.md también manda al teléfono).
//
// PROBADO ROMPIÉNDOLO (19/11/2026): P1 una llamada a `/chat/updateProfilePicture/` en lib/ → falla; P2 una a `/chat/updatePrivacySettings/` en
// scripts/ → falla. Vuelta atrás, verde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROHIBIDAS = /\/chat\/(updateProfilePicture|removeProfilePicture|updatePrivacySettings|updateProfileName)\b/;
const CARPETAS = ['lib', 'app', 'scripts', 'extension', 'plugin', 'tmp-medir'];
const ESTE = 'tests/linea-perfil-solo-telefono.test.ts';

test('ningún código del repo cambia foto, nombre ni privacidad de una línea por Evolution', () => {
  const archivos = execFileSync('git', ['ls-files', '--', ...CARPETAS], { encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx|mts|mjs|js|cjs)$/.test(f) && f !== ESTE);
  assert.ok(archivos.length > 100, 'no encontré el código: el test no estaría mirando nada');
  const hallados: string[] = [];
  for (const f of archivos) {
    let src: string;
    try { src = readFileSync(f, 'utf8'); } catch { continue; }
    src.split('\n').forEach((l, i) => { if (PROHIBIDAS.test(l)) hallados.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`); });
  }
  assert.deepEqual(hallados, [], `Evolution 2.3.7 deja dos sockets con estas rutas: se hace desde el teléfono.\n${hallados.join('\n')}`);
});
