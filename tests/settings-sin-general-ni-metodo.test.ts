// =============================================================================
// Settings sin «General» ni «Método» (26/10/2026): se van las pantallas, no lo que hacían
// =============================================================================
// Martín, 26/10/2026, textual: «Elimina la tab "General" de configuraciones... El huso horario ya se configura en cada
// Automatización. La zona horaria, para el resto, ponlo dentro de "Perfil". y "Criterio de reuniones" eliminalo, no lo
// necesitamos... Elimina "Método" no entiendo eso... Si para eso ya tenemos "Integraciones"... Y fijate el icono de
// integraciones, no creo que sea el mejor... Parece un link.»
//
// DEPRECAR NO ES ROMPER. Medido antes en producción, sólo leyendo:
//   · la zona del negocio (`mako.timezone`) la tienen 13 negocios: pasa a una fila de Perfil, con la MISMA acción que la tuerca
//     de una automatización (`saveZonaHorarioAction` → `fijarZonaDelNegocio`);
//   · el horario de oficina del negocio lo tienen 2: sigue valiendo para las automatizaciones que lo usan; cada una lo cambia en
//     su tuerca, y la API de MaKo lo sigue leyendo y cambiando (`ver_horario_envio`, `configurar_horario_envio`);
//   · el criterio de reuniones lo tiene UNO (Mauricio, 9.823 letras): sin pantalla y sin API, pero la extracción de reuniones y
//     el Plan lo siguen leyendo con su valor (`criterioDelWorkspace`). Nadie tiene que tocar nada;
//   · cada credencial que se cargaba en Método tiene su tarjeta en Integraciones (las IA, en «Tus cuentas de IA»).
// Las rutas viejas redirigen (los avisos ya mandados dicen `/configuraciones?tab=…`).
//
// PROBADO ROMPIÉNDOLO (26/10/2026): ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rutaDeTabVieja, seccionesNegocio } from '../lib/ajustes-secciones';
import { DEFS } from '../lib/integraciones-catalogo';
import { NOMBRES_ICONO_MENU } from '../app/_ui/iconos-menu';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TODAS = { integraciones: true, plan: true };

test('1. el índice: sin General ni Método; Integraciones con el enchufe', () => {
  const keys = seccionesNegocio(TODAS).map((s) => s.key);
  // «Prompts» también salió el 26/10/2026 (tests/settings-movil-26-10.test.ts): su pantalla sigue, sin entrada en Settings.
  assert.deepEqual(keys, ['equipo', 'integraciones', 'fiscal', 'plan']);
  const integ = seccionesNegocio(TODAS).find((s) => s.key === 'integraciones')!;
  assert.equal(integ.icono, 'enchufe', 'Integraciones volvió al ícono del link');
  assert.ok(NOMBRES_ICONO_MENU.includes('enchufe'), 'el enchufe no está en el set de íconos');
  // El teléfono arma su lista con la MISMA (`seccionesNegocio`): sin las hojas «en la computadora» de las que se fueron.
  const m = sinComentarios(leer('app/m/configuraciones/page.tsx'));
  assert.match(m, /seccionesNegocio\(await disponiblesNegocio\(\)\)/);
  assert.doesNotMatch(m, /\b(general|metodo):/, 'el teléfono sigue explicando una sección que ya no está');
});

test('2. las rutas viejas redirigen: /configuraciones (con el ?tab= de los avisos) y /metodo (a Integraciones, con la query)', () => {
  const conf = sinComentarios(leer('app/configuraciones/page.tsx'));
  assert.doesNotMatch(conf, /<AjustesPagina|CriterioPanel|HorarioEnvioPanel/, '/configuraciones volvió a ser una pantalla');
  assert.match(conf, /if \(vieja\) redirect\(conLaQuery\(vieja, sp, \['tab'\]\)\);/);
  assert.equal(rutaDeTabVieja('horario'), '/perfil');
  assert.equal(rutaDeTabVieja('criterio'), '/perfil');
  assert.equal(rutaDeTabVieja('notif'), '/configuraciones/notificaciones', 'los 49 avisos ya mandados');
  const met = sinComentarios(leer('app/metodo/page.tsx'));
  assert.match(met, /redirect\(conLaQuery\('\/integraciones', await searchParams\)\);/, '/metodo no cae en Integraciones (o pierde el ?ws=)');
  for (const f of ['app/metodo/MetodoWizard.tsx', 'app/configuraciones/CriterioPanel.tsx', 'app/configuraciones/criterio-actions.ts']) {
    assert.equal(existsSync(join(RAIZ, f)), false, `volvió ${f}`);
  }
  assert.doesNotMatch(sinComentarios(leer('app/onboarding/OnboardingForm.tsx')), /href="\/metodo"/, 'el onboarding sigue mandando a /metodo');
});

test('3. la zona del negocio vive en Perfil, para quien administra, con la MISMA acción que la tuerca', () => {
  const p = sinComentarios(leer('app/perfil/InformacionPersonal.tsx'));
  assert.match(p, /import \{ getHorarioEnvioAction, saveZonaHorarioAction \} from '@\/app\/configuraciones\/horario-actions';/);
  assert.match(p, /\{conNegocio && zonaNegocio && \(\n\s*<FilaCampo titulo="Zona del negocio">/, 'la fila no está, o se ofrece a quien no administra');
  assert.match(p, /await saveZonaHorarioAction\(tz\)/, 'la zona del negocio se guarda con otra cosa que la tuerca');
  assert.match(p, /if \(!conNegocioArriba\) return;/, 'a un closer se le pregunta la zona del negocio');
  // Y la tuerca de cada automatización la sigue mostrando (el horario vive ahí).
  assert.match(sinComentarios(leer('app/automations/ConfigAutomatizacionPanel.tsx')), /return <HorarioEnvioPanel fuente=\{fuente\} onSucio=\{onSucio\} \/>;/);
});

test('4. el criterio: sin pantalla y sin API, pero quien lo tiene lo sigue usando', () => {
  const def = sinComentarios(leer('lib/api-mako/areas/equipo.def.ts'));
  const run = sinComentarios(leer('lib/api-mako/areas/equipo.run.ts'));
  assert.doesNotMatch(def + run + leer('lib/api-mako/rest.ts'), /criterio_reuniones|criterio-reuniones/, 'una operación del criterio volvió');
  // DEPRECAR NO ES ROMPER: los dos que lo leen lo siguen leyendo.
  assert.match(sinComentarios(leer('lib/reunion-auto.ts')), /await criterioDelWorkspace\(\)/, 'la extracción de reuniones dejó de leer el criterio');
  assert.match(sinComentarios(leer('lib/plan-propuesta.ts')), /!!\(await criterioDelWorkspace\(\)\)/, 'el Plan dejó de leer el criterio');
  // El horario del negocio sí sigue en la API: lo usan las automatizaciones que no tienen uno propio.
  assert.match(def, /id: 'ver_horario_envio'/);
  assert.match(def, /id: 'configurar_horario_envio'/);
  assert.doesNotMatch(def, /Settings › General/, 'la API manda a una pantalla que ya no existe');
});

test('5. nada de Método se pierde: cada credencial que cargaba tiene su tarjeta en Integraciones', () => {
  const metodo = sinComentarios(leer('lib/metodo-catalogo.ts'));
  const keys = [...metodo.matchAll(/^\s{4}key: '([a-z0-9_-]+)',/gm)].map((m) => m[1]);
  assert.ok(keys.length >= 15, `se leyeron ${keys.length} servicios del método: el patrón no está mirando`);
  const sinTarjeta = keys.filter((k) => !DEFS.some((d) => d.key === k));
  assert.deepEqual(sinTarjeta, [], 'un servicio del método se quedó sin tarjeta en Integraciones (Método era su único lugar)');
});

// ── ROTURAS (26/10/2026) ───────────────────────────────────────────────────────
// Una por vez, con un arnés que guarda el original en memoria, rompe, corre ESTE archivo y restaura comprobando el contenido.
// Base: 5 pasan / 0 fallan. Las 13 cazadas, cada una 4 / 1, por el test que la cuida:
//   B1. «General» de vuelta en el índice                       → 1. el índice
//   B2. Integraciones vuelve al ícono del link                 → 1.
//   B3. el teléfono explica «Método» otra vez                  → 1.
//   B4. /configuraciones vuelve a ser una pantalla             → 2. las rutas viejas redirigen
//   B5. el ?tab=horario vuelve a /configuraciones              → 2.
//   B6. /metodo pierde la query (el ?ws=)                      → 2.
//   B7. el onboarding manda a /metodo                          → 2.
//   B8. la zona del negocio a cualquiera (sin `conNegocio`)    → 3. la zona en Perfil
//   B9. la zona del negocio con otra acción que la tuerca      → 3.
//   B10. una ruta REST del criterio vuelve                     → 4. el criterio
//   B11. la extracción de reuniones deja de leer el criterio   → 4.
//   B12. la API vuelve a mandar a «Settings › General»         → 4.
//   B13. un servicio del método sin tarjeta en Integraciones   → 5. nada de Método se pierde
// Restaurado: 5 / 0.
