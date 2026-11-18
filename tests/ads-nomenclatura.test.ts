// =============================================================================
// La nomenclatura NNN.SS.x al AGREGAR un anuncio por la API de MaKo y al crear una campaña (18/11/2026, la revisión de O9)
// =============================================================================
// Martín, 31/07/2026 (docs/hallazgos-ads.md, «la nomenclatura se genera sola»): campaña `001.`, conjunto `001.02`, anuncio
// `001.02.a`, «también al agregar un ad a una campaña existente». O9 la trajo a «Subir creativos» (lib/media-buyer/subir.ts) y
// un revisor encontró que `proponer_agregar_anuncio` (lib/api-mako/areas/ads.run.ts) seguía creando el anuncio con el nombre
// que escribe el modelo, sin el código. Lo que fija este test:
//   1. el runner DE VERDAD (tests/_ads-nomenclatura-hijo.ts: `server-only`, el PostgREST de mentira, una Graph API y un Zernio
//      de mentira) le pone adelante el código que sigue a la mayor letra de SUS anuncios (no de los de otro conjunto), y el
//      nombre que mandó el modelo queda como la parte que lo describe; el resumen dice el nombre final;
//   2. lo que el nombre ya trae: el código del conjunto copiado se reemplaza, una letra libre del conjunto se respeta, una
//      letra tomada o el código de otro conjunto se cambian;
//   3. un conjunto sin código no recibe uno inventado, y ni siquiera se lee el árbol;
//   4. al confirmar en /mako/revisar (que vuelve a preparar), con la primera ya creada, la que sigue toma la letra siguiente;
//   5. por Zernio (sin token), el árbol se lee por Zernio y el anuncio llega a Meta con el nombre que dijo el resumen;
//   6. con la lectura de los anuncios caída no se elige una letra a ciegas: se dice, con `falla`;
//   7. «Nueva campaña» (lib/media-buyer/campana-reglas.ts): el código de campaña que sigue al mayor de la cuenta, sólo si la
//      cuenta ya está en la nomenclatura; el conjunto y el anuncio de la campaña nacen `NNN.01` y `NNN.01.a`; el público nunca
//      lee el código (título y texto de respaldo); y un nombre que es sólo el código no pasa.
//
// Probado rompiéndolo (18/11/2026, Node 24, una rotura por vez, restaurada; base en verde: 7 de 7):
//   · los hermanos = todos los anuncios de la cuenta (sin filtrar por conjunto) → 4 en rojo (el 1, el 2, el 4 y el 5: el
//     «001.02.k» del conjunto 5009 se cuela y la letra sale «l»);
//   · el nombre del modelo tal cual, sin el código (el bug del revisor) → 4 en rojo (el 1, el 2, el 4 y el 5);
//   · `getMetaHealth` (la caché de 120 s) en vez de la lectura en vivo → 4 en rojo (el 1, el 2, el 4 y el 5). ⚠️ Rojo porque
//     fuera de Next `unstable_cache` tira: el test NO puede mostrar que la caché vería un anuncio viejo; eso lo dice el código;
//   · sin cortar con el árbol `parcial` → 1 en rojo (el 6);
//   · respetar SIEMPRE el código que trae el nombre (sin mirar si la letra está tomada) → 1 en rojo (el 2);
//   · el código de campaña desde un conteo y no desde el mayor → 1 en rojo (el 7); el título del público con el código → 1 (el 7);
//     sin frenar un nombre que es sólo el código → 1 (el 7);
//   · y un cambio sin efecto (renombrar `hermanos` en el runner) → 7 en verde.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { codigoDeCampana, codigoDeCampanaNueva, cuerpoCampana, nombresDeLaCampana, validarCampana } from '../lib/media-buyer/campana-reglas';
import type { LugarZona } from '../lib/media-buyer/zona';

const RAIZ = join(__dirname, '..');
type Prep = { payload?: { nombre?: string }; resumen?: string; error?: string; falla?: boolean; tira?: string; red: string[] };
type Ejec = { ok?: boolean; resumen?: string; tira?: string; red: string[]; creados: Array<{ name: string; adSetId: string }> };
type Salida = Record<string, Prep> & { zernioEjecutar: Ejec; error?: string };
let S: Salida | null = null;
const salida = (): Salida => {
  if (S) return S;
  const crudo = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_ads-nomenclatura-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 180_000, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
  });
  S = JSON.parse(crudo.slice(crudo.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Salida;
  return S;
};
const nombre = (p: Prep, que: string) => {
  assert.equal(p.tira, undefined, `${que}: ${p.tira}`);
  assert.equal(p.error, undefined, `${que}: ${p.error}`);
  return p.payload?.nombre;
};

test('1. el anuncio nuevo de un conjunto con código lleva el que sigue a SUS anuncios, y el resumen dice el nombre final', () => {
  const s = salida();
  assert.equal(s.error, undefined, String(s.error));
  assert.equal(nombre(s.describe, 'describe'), '001.02.d Testimonio Juan', 'el código va adelante y lo del modelo lo describe; el «001.02.k» de otro conjunto no cuenta');
  assert.match(String(s.describe.resumen), /«001\.02\.d Testimonio Juan»/, 'la persona confirma el nombre que se va a crear');
});

test('2. lo que el nombre ya trae: el código del conjunto copiado, una letra libre, una tomada, el código de otro conjunto', () => {
  const s = salida();
  assert.equal(nombre(s.copiaElDelConjunto, 'copia'), '001.02.d Testimonio', 'el código del conjunto copiado de su nombre no es la descripción');
  assert.equal(nombre(s.letraLibre, 'libre'), '001.02.b Hook nuevo', 'una letra del conjunto que ningún hermano usa se respeta: la eligió alguien');
  assert.equal(nombre(s.letraTomada, 'tomada'), '001.02.d Hook', 'una letra que ya usa un hermano no se repite');
  assert.equal(nombre(s.otroConjunto, 'otro'), '001.02.d Copiado de otro', 'el código de otro conjunto no dice dónde vive el anuncio');
});

test('3. un conjunto sin código no recibe uno inventado, y no se lee el árbol de la cuenta', () => {
  const s = salida();
  assert.equal(nombre(s.sinCodigo, 'sin código'), 'Testimonio Juan');
  assert.deepEqual(s.sinCodigo.red, ['graph GET /5002'], 'sin código no hace falta leer los anuncios');
  assert.equal(nombre(s.sinCodigoConLecturaCaida, 'sin código, lectura caída'), 'Testimonio Juan', 'la lectura de los anuncios caída no frena a un conjunto sin código');
});

test('4. al confirmar con la primera ya creada (se vuelve a preparar), la que sigue toma la letra siguiente', () => {
  const s = salida();
  assert.equal(nombre(s.despuesDeAprobada, 'después'), '001.02.e Testimonio Juan', 'los anuncios se leen en vivo: el recién creado ya cuenta');
  assert.ok(s.despuesDeAprobada.red.includes('graph GET /act_1313/ads'), 'la lista de anuncios se pidió a Meta en este pedido');
});

test('5. por Zernio (sin token): el árbol por Zernio y el anuncio llega a Meta con el nombre del resumen', () => {
  const s = salida();
  assert.equal(nombre(s.zernio, 'zernio'), '001.02.d Testimonio Juan');
  assert.deepEqual(s.zernio.red.filter((x) => x.startsWith('graph ')), [], 'por Zernio no se le pide nada a la Graph API');
  assert.ok(s.zernio.red.includes('zernio GET /ads'), 'los anuncios del conjunto salen de la lista de Zernio');
  const e = s.zernioEjecutar;
  assert.equal(e.tira, undefined, String(e.tira));
  assert.equal(e.ok, true, String(e.resumen));
  assert.deepEqual(e.creados, [{ name: '001.02.d Testimonio Juan', adSetId: '5001' }], 'el nombre que dijo el resumen es el que va a Meta');
  assert.match(String(e.resumen), /«001\.02\.d Testimonio Juan» creado EN PAUSA/, 'lo creado se nombra');
  assert.equal(nombre(s.zernioDespuesDeAprobada, 'zernio después'), '001.02.e Testimonio Juan');
});

test('6. con la lectura de los anuncios caída no se elige una letra a ciegas', () => {
  const s = salida();
  for (const k of ['lecturaCaida', 'zernioLecturaCaida'] as const) {
    const p = s[k];
    assert.equal(p.payload, undefined, `${k}: no se propone nada`);
    assert.equal(p.falla, true, `${k}: es una falla nuestra (de la lectura), no una regla`);
    assert.match(String(p.error), /001\.02\.x/, `${k}: dice qué código no pudo calcular`);
  }
});

test('7. «Nueva campaña»: el código que sigue, el conjunto y el anuncio con el suyo, y el público no lee el código', () => {
  assert.equal(codigoDeCampanaNueva(['001. Leads', '001.02 Conjunto', '003.01.c Anuncio', '007. Otra', 'Sin código']), '008.', 'el que sigue al MAYOR, no al conteo');
  assert.equal(codigoDeCampanaNueva(['Leads mayo', 'Conversiones / Ganadores', '2026 Promo']), null, 'una cuenta sin nomenclatura no recibe un «001.» que nadie pidió');
  assert.equal(codigoDeCampanaNueva(['999. Última']), null, 'el código es de tres dígitos');
  assert.equal(codigoDeCampanaNueva(['000. La primera']), '001.');
  assert.equal(codigoDeCampana('004. Leads mayo'), '004.');
  assert.equal(codigoDeCampana('004.02 Conjunto'), null, 'NNN.SS es de un conjunto, no de una campaña');
  assert.deepEqual(nombresDeLaCampana('004. Leads mayo'), { campana: '004. Leads mayo', conjunto: '004.01 Leads mayo', anuncio: '004.01.a Leads mayo', descripcion: 'Leads mayo' });
  assert.deepEqual(nombresDeLaCampana('Leads mayo'), { campana: 'Leads mayo', conjunto: 'Leads mayo · Conjunto', anuncio: 'Leads mayo · Anuncio', descripcion: 'Leads mayo' }, 'sin código, como siempre');

  const lugar: LugarZona = { tipo: 'country', key: 'mx', nombre: 'México' };
  const entrada = { objetivo: 'trafico', presupuestoDia: 100, url: 'https://ejemplo.test/landing', creativo: { tipo: 'anuncio', adId: '71' }, texto: '' };
  const v = validarCampana({ ...entrada, nombre: '004. Leads mayo' }, [lugar]);
  assert.ok(v.ok, v.ok ? '' : v.error);
  const cuerpo = cuerpoCampana(v.valor, { conexion: { accountId: 'zacc', adAccountId: 'act_33333' }, hasta: null, creativoReusado: { id: 'cr-1', texto: null, link: null } });
  assert.equal(cuerpo.campaignName, '004. Leads mayo');
  assert.equal(cuerpo.adSetName, '004.01 Leads mayo');
  assert.equal(cuerpo.adName, '004.01.a Leads mayo');
  assert.equal(cuerpo.headline, 'Leads mayo', 'el título que lee el público no lleva el código interno');
  assert.equal(cuerpo.body, 'Leads mayo', 'el texto de respaldo tampoco');

  const soloCodigo = validarCampana({ ...entrada, nombre: '004.' }, [lugar]);
  assert.equal(soloCodigo.ok, false, 'sólo el código: el título del anuncio quedaría en «004.»');
  assert.deepEqual(soloCodigo.ok ? null : soloCodigo.faltan, ['nombre']);
});
