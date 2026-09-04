// =============================================================================
// eslint-hooks — UNA sola regla, para que el pre-push la pueda pagar
// =============================================================================
//
// ⚠️ POR QUÉ NO ES `npm run lint`.
//
// El lint completo del repo tarda 3 min 19 s. Un chequeo que cuesta eso no entra
// en un hook de pre-push: o se saltea, o se saca. Esto corre `rules-of-hooks` y
// nada más, sobre los archivos que cambiaron, y son ~4 s.
//
// ── Qué caza, y por qué vale su lugar ─────────────────────────────────────
//
// El «Minified React error #300» —`didRenderTooFewHooks`— rompe la pantalla
// ENTERA: no es un componente que se ve mal, es una pantalla en blanco con un
// error que no dice ni el archivo. El 03/09/2026 llegó a producción por un
// `useExtensionVieja()` que había quedado DESPUÉS de un `return` temprano, o sea
// que en unos renders se llamaba y en otros no.
//
// El typecheck no lo ve —llamar un hook es una llamada a función perfectamente
// tipada— y el pre-push no corre los tests. Sin esto no lo caza nadie.
//
// ⚠️ Es un piso, no un techo: `exhaustive-deps` y el resto del lint siguen
// viviendo en `npm run lint`. Acá va SOLO lo que rompe la pantalla entera.
//
// ── Por qué se hereda la config del repo en vez de escribir una mínima ────
//
// ⚠️ Una config con un solo plugin ROMPE en todo archivo que tenga un
// `eslint-disable` de otro plugin: eslint contesta «Definition for rule
// '@next/next/no-img-element' was not found» y sale con error. O sea que el guard
// bloquearía el push por un comentario perfectamente válido, que es el candado
// sin llave que la regla de la casa prohíbe — el que empuja no lo puede arreglar.
//
// Pasó en la primera corrida, sobre `OnboardingVideoGen.tsx`.
//
// Así que se toma la config viva y se le VACÍAN las reglas: los plugins quedan
// cargados —que es lo que hace que los `disable` resuelvan— y la única regla
// encendida es la nuestra. Y hereda también los `ignores`, que si no habría que
// repetirlos acá y quedarían viejos.
import base from '../eslint.config.mjs';

const capas = (Array.isArray(base) ? base : [base]).map((capa) => {
  if (!capa || typeof capa !== 'object') return capa;
  // `rules: {}` y no `delete`: una capa sin `rules` es válida, y así queda
  // explícito que lo que se saca son las reglas y nada más.
  const lo = capa.languageOptions;
  return {
    ...capa,
    rules: {},
    // ⚠️ Y SE LE SACA EL PARSEO CON TIPOS, que es lo que cuesta la plata.
    //
    // `parserOptions.project` / `projectService` hacen que el parser levante el
    // programa entero de TypeScript: con eso puesto, estos siete archivos tardan
    // 64 s — o sea el costo que este chequeo venía a evitar. Sin eso, 4 s.
    //
    // `rules-of-hooks` no necesita tipos: mira la FORMA del código —quién llama a
    // qué y dentro de qué—, no de qué tipo es nada. Las reglas que sí los
    // necesitan viven en `npm run lint`, que es donde se pagan.
    ...(lo ? { languageOptions: { ...lo, parserOptions: sinTipos(lo.parserOptions) } } : {}),
  };
});

/** Las opciones del parser sin lo que dispara el análisis de tipos. */
function sinTipos(po) {
  if (!po) return po;
  const { project, projectService, EXPERIMENTAL_useProjectService, tsconfigRootDir, ...resto } = po;
  return resto;
}
export default [
  // Las 47 advertencias de «disable sin usar» son ruido: salen de reglas que
  // acá están apagadas a propósito, así que ninguna se puede accionar.
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  ...capas,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
];
