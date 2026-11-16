// =============================================================================
// Los funnels que se OFRECEN (16/11/2026): sin LinkedIn, Dos reuniones ni DM funnel, y nada que diga «recurso gratis»
// =============================================================================
// Martín, mirando el catálogo de funnels del CRM en el Funnel Coach de la maqueta del onboarding (16/11/2026): «de esos
// funnel, por ahora, elimina LinkedIn. Nosotros no hacemos LinkedIn. También elimina el funnel de 2 reuniones, no tiene
// sentido. O sea, es llamada de venta directamente. Elimina el funnel de DM funnel, para eso ya tenemos conversaciones por
// chat… Recurso gratis, cámbialo en toda la app y en todas las landings. Si sale algo como eso, debería decir Lead Magnet. Y
// en ese caso Lead Magnet Funnel. Y luego el funnel de carrito debería ser Venta Directa».
//
// Lo que se fija:
//   1. lo que se OFRECE no tiene los tres: el catálogo (`TIPOS_CRM`), el modal «Nuevo CRM», la API de MaKo (`tipos_de_crm` y
//      el enum de `crear_crm`), la lista del onboarding («Ver los 9»), los candidatos del CRM a medida y `recomendarFunnel`
//      con TODAS las combinaciones de lo que se contesta;
//   2. lo GUARDADO se sigue leyendo igual (lib/pipeline.ts → `TIPOS_CRM_HEREDADOS`): `tipoCrmPorId` y `siembraDeCrm` dan lo de
//      antes, y quien eligió uno en el onboarding lo sigue viendo como su respuesta (medido en producción ese día: «Cliente de
//      Prueba», con dos reuniones). Un CRM ya creado no depende del id: `funnels` guarda sus etapas, no el tipo;
//   3. los nombres nuevos, con los ids de siempre: «Lead Magnet Funnel» (`recurso_gratis`) y «Venta Directa» (`carrito`);
//   4. ningún texto de la app dice «recurso gratis» (ni «recurso gratuito» ni «regalo gratis»): el código de app/, lib/,
//      extension/ y nativo/ y las páginas de public/, sin los comentarios. Las landings (app/vsl/*) entran en el barrido.
//
// Correr: node --import tsx --test tests/funnels-que-se-ofrecen.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TIPOS_CRM, TIPOS_CRM_HEREDADOS, TIPO_CRM_OTRO, esTipoCrm, siembraDeCrm, tipoCrmOfrecido, tipoCrmPorId,
  type TipoCrmHeredadoId,
} from '../lib/pipeline';
import { CUANTOS_FUNNELS, nombreDelFunnel, recomendarFunnel } from '../lib/funnel-recomendado';
import { candidatosCrm } from '../lib/onboarding-crm';
import { VER_OTROS_TIPOS, mensajesDeArranque, tiposOfrecidos, type EstadoArranque, type HechosArranque } from '../lib/onboarding-arranque';
import { DEFS as DEFS_CRM } from '../lib/api-mako/areas/crm.def';
import { PLANTILLAS_FICHA } from '../lib/ficha/plantillas';
import { CANALES } from '../lib/fase-diagnostico';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const HEREDADOS: readonly TipoCrmHeredadoId[] = ['dos_reuniones', 'dm_funnel', 'linkedin'];
const NOMBRES_DE_ANTES = ['LinkedIn', 'Dos reuniones', 'DM funnel'];
const CANALES_O_NINGUNO = [null, ...CANALES.map((c) => c.id)];

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: '', nombreWorkspace: '', faseGuardada: true, canalNegocio: 'llamadas', loQueVende: true,
  conCrm: true, conTelefono: false, terminado: false, faseNegocio: { respuestas: [0, 1, 0, 0, 0, 0], fase: 0 },
};
const ANA: EstadoArranque = { nombre: 'Ana', negocio: 'Cierre Consultivo', origen: 'Instagram', interes: 'ventas', pdfOk: 'si', entrada: 'agenda_sola' };

test('1. lo que se OFRECE no tiene LinkedIn, Dos reuniones ni DM funnel', () => {
  assert.deepEqual(TIPOS_CRM.map((t) => t.id),
    ['llamada', 'webinar', 'presencial', 'conversaciones', 'instagram', 'formulario_meta', 'recurso_gratis', 'youtube', 'carrito']);
  assert.equal(CUANTOS_FUNNELS, 9);
  assert.equal(VER_OTROS_TIPOS, 'Ver los 9');
  for (const id of HEREDADOS) assert.equal(tipoCrmOfrecido(id), null, `«${id}» se ofrece`);

  // La API de MaKo: el enum de `crear_crm` (validarInput lo corta antes de preparar) y la lista de `tipos_de_crm`.
  const crear = DEFS_CRM.find((d) => d.id === 'crear_crm');
  const enumTipo = crear?.parametros?.find((p) => p.nombre === 'tipo')?.enum ?? [];
  assert.deepEqual([...enumTipo], [...TIPOS_CRM.map((t) => t.id), TIPO_CRM_OTRO]);
  assert.match(sinComentarios(leer('lib/api-mako/areas/crm.run.ts')), /tipos: TIPOS_CRM\.map\(\(t\) => \(\{/, 'tipos_de_crm lista otra cosa');
  const desc = DEFS_CRM.find((d) => d.id === 'tipos_de_crm')?.descripcion ?? '';
  assert.match(desc, /LinkedIn, DM funnel y dos reuniones ya no se ofrecen/, 'MaKo no sabe que se fueron');

  // El modal «Nuevo CRM»: dibuja `TIPOS_CRM`, y sus íconos son sólo los de lo que se ofrece.
  const toolbar = sinComentarios(leer('app/crm/CrmToolbar.tsx'));
  assert.match(toolbar, /\{TIPOS_CRM\.map\(\(t\) => \(/);
  const iconos = /const ICONO_TIPO_CRM[^=]*= \{([\s\S]*?)\};/.exec(toolbar)?.[1] ?? '';
  assert.ok(iconos.includes('recurso_gratis') && !/dos_reuniones|dm_funnel|linkedin/.test(iconos), 'el modal tiene ícono de uno que no se ofrece');

  // El onboarding: la lista entera («Ver los 9»), por canal y sin canal, y los candidatos que recibe la IA.
  for (const canal of CANALES_O_NINGUNO) {
    for (const t of tiposOfrecidos(canal, true).tipos) assert.ok(tipoCrmOfrecido(t.id), `${canal}: la lista ofrece «${t.label}»`);
    for (const t of candidatosCrm(canal)) assert.ok(tipoCrmOfrecido(t.id), `${canal}: la IA puede proponer «${t.label}»`);
  }
  const lista = mensajesDeArranque({ ...ANA, crmVerTodos: true }, H).despues.find((m) => m.id === 'arr-crm')?.opciones ?? [];
  assert.equal(lista.length, 9, `la lista abierta tiene ${lista.length}`);
  for (const n of NOMBRES_DE_ANTES) assert.ok(!lista.includes(n), `la lista abierta ofrece «${n}»`);

  // La recomendación, con TODO lo que se puede contestar: nunca uno heredado, y siempre de su canal.
  const entradas = [null, 'landing', 'agenda_sola', 'chat_entrante', 'chat_saliente', 'formulario_anuncio', 'carrito'] as const;
  const tramos = [null, 0, 1, 2, 3, 4];
  let combinaciones = 0;
  for (const canal of CANALES_O_NINGUNO) for (const entrada of entradas) for (const inversion of tramos) for (const funnelHoy of tramos)
    for (const creativos of tramos) for (const fase of tramos) {
      const r = recomendarFunnel({ canal, entrada, inversion, funnelHoy, creativos, fase });
      const t = tipoCrmOfrecido(r.tipo);
      assert.ok(t, `${canal}/${entrada}/${inversion}/${funnelHoy}/${creativos}/${fase}: recomendó «${r.tipo}», que no se ofrece`);
      if (canal) assert.equal(t.canal, canal, `${canal}/${entrada}: recomendó «${r.tipo}», de otro canal`);
      combinaciones++;
    }
  assert.ok(combinaciones > 40000, `se probaron ${combinaciones}`);
});

test('2. lo GUARDADO se sigue leyendo y sembrando igual: los tres quedaron heredados', () => {
  assert.deepEqual(TIPOS_CRM_HEREDADOS.map((t) => [t.id, t.label]), [['dos_reuniones', 'Dos reuniones'], ['dm_funnel', 'DM funnel'], ['linkedin', 'LinkedIn']]);
  const ANTES: Record<TipoCrmHeredadoId, { canal: string; entradas: string[]; etapas: string }> = {
    dos_reuniones: { canal: 'llamadas', entradas: ['landing'], etapas: 'lead,agenda,agendaj2,facturando,ganado' },
    dm_funnel: { canal: 'conversaciones', entradas: ['chat_entrante'], etapas: 'lead,conversando,facturando,ganado' },
    linkedin: { canal: 'llamadas', entradas: ['chat_saliente'], etapas: 'lead,conversando,agenda,ganado' },
  };
  for (const id of HEREDADOS) {
    assert.ok(esTipoCrm(id) && tipoCrmPorId(id)?.id === id, `«${id}» guardado ya no se lee`);
    const s = siembraDeCrm({ tipo: id });
    assert.ok(!('error' in s), `«${id}» ya no siembra`);
    assert.deepEqual({ canal: s.canal, entradas: s.entradas, etapas: s.pipeline.map((x) => x.key).join(',') }, ANTES[id], id);
  }
  const dm = siembraDeCrm({ tipo: 'dm_funnel' });
  assert.ok(!('error' in dm) && dm.pipeline[0].label === 'Lead entrante (comentó)', 'el DM funnel guardado cambió de nombres');
  assert.equal(nombreDelFunnel('linkedin'), 'LinkedIn');
  // Quien eligió uno en el onboarding lo sigue viendo como SU respuesta, y la pregunta no se vuelve a abrir.
  for (const id of HEREDADOS) {
    const e: EstadoArranque = { ...ANA, crmTipo: id };
    const m = mensajesDeArranque(e, H).despues;
    const resp = m.find((x) => x.id === 'arr-crm-r');
    assert.equal(resp?.texto, tipoCrmPorId(id)!.label, `«${id}»: su respuesta se borró del historial`);
    assert.equal(m.find((x) => x.id === 'arr-crm')?.opciones, undefined, `«${id}»: la pregunta del CRM volvió a abrirse`);
  }
});

test('3. los nombres nuevos, con los ids de siempre: «Lead Magnet Funnel» y «Venta Directa»', () => {
  const lm = tipoCrmPorId('recurso_gratis')!;
  assert.equal(lm.label, 'Lead Magnet Funnel');
  assert.equal(lm.pipeline[0].label, 'Pidió el lead magnet');
  assert.deepEqual([lm.canal, ...lm.entradas], ['conversaciones', 'landing']);
  const vd = tipoCrmPorId('carrito')!;
  assert.equal(vd.label, 'Venta Directa');
  assert.deepEqual([vd.canal, ...vd.entradas], ['carrito', 'carrito'], 'el canal y la entrada `carrito` no cambian: se guardan');
  for (const t of TIPOS_CRM) assert.doesNotMatch(t.label, /recurso|^carrito$/i, `«${t.label}»`);
  // La plantilla de la ficha del lead se llama como el funnel; su id se guarda en `funnels.data.ficha`.
  assert.equal(PLANTILLAS_FICHA.find((p) => p.id === 'carrito')?.nombre, 'Venta Directa');
  const desc = DEFS_CRM.find((d) => d.id === 'tipos_de_crm')?.descripcion ?? '';
  assert.match(desc, /Lead Magnet Funnel/);
  assert.match(desc, /Venta Directa/);
});

/**
 * Lo que puede decir «recurso gratis» A PROPÓSITO, con su porqué. Un archivo nuevo acá es una decisión, no un arreglo.
 */
const PUEDEN_DECIRLO: ReadonlyArray<[RegExp, string]> = [
  [/^app\/conocimientos\//, 'los cursos de terceros con SUS palabras: «7 Recursos Gratuitos» es el título de una clase de Sell Your Knowledge'],
  [/^app\/admin\/dev\//, 'las bitácoras del super admin: citan lo que pidió Martín, tal cual'],
  [/^lib\/spy-catalogo-datos\.ts$/, 'lo que dicen las páginas de la COMPETENCIA, para reconocerlo (generado de docs/catalogo-funnels-y-formatos.md)'],
];
const DICE_RECURSO_GRATIS = /recursos?\s+(?:gratis|gratuitos?)|regalos?\s+(?:gratis|gratuitos?)|recursos?\s+que\s+regal/i;

test('4. ningún texto de la app dice «recurso gratis»: dice «lead magnet» (landings incluidas)', () => {
  // `git ls-files -co` (lo que está en git y lo nuevo sin ignorar) con los patrones como ARGUMENTOS: entre comillas en una
  // línea de comandos, la consola de Windows se los pasaba a git tal cual y no listaba nada (tests/admin-polar-arreglos.test.ts).
  const archivos = execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'app', 'lib', 'extension', 'nativo', 'public'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').map((f) => f.trim())
    .filter((f) => (f.startsWith('public/') ? /\.html?$/.test(f) : /\.(tsx?|m?js|cjs|html?)$/.test(f)))
    .filter((f) => !PUEDEN_DECIRLO.some(([re]) => re.test(f)) && existsSync(join(RAIZ, f)));
  assert.ok(archivos.length > 3000, `se revisaron ${archivos.length} archivos: el listado está mal`);
  assert.ok(archivos.some((f) => f.startsWith('app/vsl/')), 'las landings no entraron al barrido');
  const hallazgos: string[] = [];
  for (const f of archivos) {
    sinComentarios(leer(f)).split('\n').forEach((l, i) => {
      if (DICE_RECURSO_GRATIS.test(l)) hallazgos.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(hallazgos, [], 'dice «recurso gratis» (o «recurso gratuito», «regalo gratis»): debería decir «lead magnet»');
});

// PROBADO ROMPIÉNDOLO (16/11/2026, base 4/0), con un arnés que restaura de memoria, cada rotura antes de la siguiente:
//   · la regla 7 de `recomendarFunnel` vuelve a devolver `linkedin`          → 3/1 (1); onboarding-funnel-recomendado 3/1
//   · `crear_crm` con `linkedin` en el enum                                  → 3/1 (1)
//   · `tipoCrmPorId` deja de leer los heredados                              → 3/1 (2); tipos-crm 5/3
//   · el historial del onboarding busca lo elegido en `TIPOS_CRM`            → 3/1 (2): «LinkedIn» se borraba de su respuesta
//   · el funnel vuelve a llamarse «Recurso gratis»                           → 2/2 (3 y 4)
//   · el funnel vuelve a llamarse «Carrito»                                  → 3/1 (3)
//   · «¿Qué recurso gratuito das…?» en el Copywriter                         → 3/1 (4)
//   · CONTROL: «recurso gratis» en un comentario `//`                        → 4/0 (los comentarios no cuentan)
// La propuesta guardada que vuelve a ofrecerse (lib/onboarding-arranque.ts y la tarjeta de app/onboarding/ChatArranque.tsx) la
// cuida tests/onboarding-crm-a-medida.test.ts: 5/1 cada una. Restaurado: 4/0, y los otros tres en su base.
