// =============================================================================
// El error de un preparar ES una guarda, salvo que sea una falla nuestra (28/10/2026, la verificación de 692368a60)
// =============================================================================
// Con la marca explícita (574107963), una guarda era guarda sólo si su runner la marcaba, y ninguna área de lib/api-mako/areas
// la ponía: unas 734 reglas («Sólo se reembolsa un cobro pagado», «es un pago único», «No encuentro la tarea») abrían ticket
// si MaKo decía «no pude», y en el grupo del CLIENTE salía «Quedó el ticket #N para el equipo de MaKo.». Lo mismo con lo que no
// se confirma («No hay ninguna acción pendiente vigente»), que sale de un control que «salió bien». Lo que fija este test:
//   1. confirmar_accion y cancelar_accion REALES (tests/_guarda-control-hijo.ts): lo que no se confirma lleva la marca;
//   2. lib/api-mako/ejecutar.ts: el error de un preparar o de un proponer es guarda salvo `falla`; lo que falta conectar en una
//      lectura, también; lo que revienta sigue siendo una falla;
//   3. todo `return { error: 'No pude…' }` de un preparar, un proponer o su envoltorio lleva `falla: true` (las pasarelas que
//      no se pudieron leer siguen abriendo ticket: la verificación de 2cb1cf67e, D4), y ninguna regla la lleva;
//   4. la acción confirmada que falla: con su ticket ya abierto (o sin falla tragada) es guarda; sin ticket y tragada, no.
//
// Probado rompiéndolo (28/10/2026, una rotura por vez, restaurada): ver el pie. El caso de punta a punta con los runners reales
// y los dos turnos es el del Cerebro (C:/dev/revisiones/scratch-6923/A-refuta/caso.cts): T1, T2, T3 y T5 sin ticket; T4 con uno.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_guarda-control-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@GUARDA@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@GUARDA@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}

test('1. lo que no se confirma (el «sí» tardío, recién propuesta, otro id) es una REGLA: lleva la marca', () => {
  const r = correr();
  for (const caso of ['confirmarSinNada', 'cancelarSinNada', 'recienPropuesta', 'otroId']) {
    assert.equal(r[caso].guarda, true, `${caso} sin la marca: ${r[caso].out}`);
  }
  assert.match(r.confirmarSinNada.out, /No hay ninguna acción pendiente vigente para confirmar\./);
});

test('2. ejecutar.ts: el error de un preparar o un proponer es guarda salvo `falla`; lo que revienta, falla', () => {
  const ej = sinComentarios(leer('lib/api-mako/ejecutar.ts'));
  assert.match(ej, /if \('error' in prep\) \{\n\s*const guarda = prep\.falla \? \{\} : \{ guarda: true as const \};/, 'el preparar volvió a pedir la marca');
  assert.match(ej, /if \('error' in p\) return \{ ok: false, status: 400, error: p\.error, \.\.\.\(p\.falla \? \{\} : \{ guarda: true as const \}\) \};/, 'el proponer de pantalla perdió la marca');
  assert.match(ej, /if \(cruda\.isError\) return \{ ok: false, status: 400, error: cruda\.content, \.\.\.\(cruda\.falta \? \{ falta: cruda\.falta, guarda: true as const \} : \{\}\) \};/, 'lo que falta conectar en una lectura no es guarda');
  // Lo que revienta y la pendiente que no entró siguen siendo fallas.
  assert.match(ej, /if \(!esNuestro\(msg\)\) return \{ ok: false, status: 400, error: msg \};/);
  assert.match(ej, /if \('error' in c\) return \{ ok: false, status: 500, error: c\.error, \.\.\.\(c\.motivo \? \{ motivo: c\.motivo \} : \{\}\), noCorrio: true \};/);
  assert.match(ej, /if \(r\.guarda\) cuerpo\.guarda = true;/, 'la marca no viaja al modelo ni al turno');
});

/** Cada `return { error: 'No pude…' }` de lib/api-mako/areas y la función donde vive (como tests/no-pude: por la fuente). */
function fallasLiterales(): Array<{ donde: string; dueno: string; linea: string }> {
  const D = new URL('../lib/api-mako/areas/', import.meta.url);
  const out: Array<{ donde: string; dueno: string; linea: string }> = [];
  for (const f of readdirSync(D).filter((x) => x.endsWith('.ts'))) {
    const ls = readFileSync(new URL(f, D), 'utf8').split(/\r?\n/);
    ls.forEach((l, i) => {
      if (!/return \{ error: [`'"]No (pude|se pudo)\b/.test(l)) return;
      let dueno = '?';
      for (let j = i; j >= 0 && j > i - 400; j--) {
        const m = /^\s{2,6}(preparar|proponer|leer|correr|ejecutar|faltaParaConfirmar|proponerLegado)\s*[:(]/.exec(ls[j])
          ?? /^(?:export )?(?:async )?function (\w+)/.exec(ls[j]) ?? /^(?:export )?const (\w+)\s*=\s*(?:async\s*)?\(/.exec(ls[j]) ?? /^ {2}(\w+): \{\s*$/.exec(ls[j]);
        if (m) { dueno = m[1]; break; }
      }
      out.push({ donde: `${f}:${i + 1}`, dueno, linea: l });
    });
  }
  return out;
}

test('3. todo «No pude…» de un preparar, un proponer o su envoltorio lleva `falla: true`; ninguna regla la lleva', () => {
  const todas = fallasLiterales();
  const deUnPreparar = todas.filter((x) => ['preparar', 'proponer', 'revisando', 'seguro'].includes(x.dueno));
  assert.ok(deUnPreparar.length >= 40, `se encontraron sólo ${deUnPreparar.length}: cambió la forma de la fuente`);
  const sin = deUnPreparar.filter((x) => !/falla: true/.test(x.linea)).map((x) => x.donde);
  assert.deepEqual(sin, [], `una falla nuestra sin la marca: se tomaría por regla y no abriría ticket (${sin.join(', ')})`);
  // Las de D4 (la verificación de 2cb1cf67e), con su nombre.
  const cobros = leer('lib/api-mako/areas/cobros.run.ts');
  assert.equal((cobros.match(/return \{ error: 'No pude leer las pasarelas conectadas\. Prueba de nuevo en un rato\.', falla: true \};/g) ?? []).length, 3, 'crear_link_pago, crear_link_cuota y `conPasarelaConectada`');
  // Y las de los helpers de cobros, que el preparar devuelve enteras (la verificación de 692368a60, R6 y R7): las pasarelas
  // ilegibles de reembolsar y cancelar, y la base caída al leer el cobro, que antes salía «No existe el cobro».
  assert.match(cobros, /if \(!conectadas\) return \{ error: 'No pude leer las pasarelas conectadas\. Prueba de nuevo en un rato\.', falla: true \};\n\s*return conectadas\.includes\(c\.proveedor\) \? null : \{ error:/);
  assert.equal((cobros.match(/if \(sinPasarela\) return sinPasarela;/g) ?? []).length, 2);
  assert.match(cobros, /try \{ return await getCobro\(ws, x\); \} catch \{ return \{ error: 'No pude leer el cobro\. Prueba de nuevo en un rato\.', falla: true \}; \}/, 'la base caída vuelve a ser «No existe el cobro»');
  assert.equal((cobros.match(/if \(!c\) return \{ error: noExisteCobro\(input\.cobroId\) \};\n\s*if \('falla' in c\) return c;/g) ?? []).length, 3);
  // Una regla nunca lleva la marca de falla.
  for (const regla of ['Sólo se reembolsa un cobro pagado', 'es un pago único, no una suscripción']) {
    const l = cobros.split('\n').find((x) => x.includes(regla));
    assert.ok(l && !/falla: true/.test(l), `«${regla}» marcada como falla`);
  }
  // Los envoltorios que convierten lo que revienta en un `error`: eso es una falla.
  for (const [f, frase] of [['comunidad', 'No pude revisar la comunidad'], ['cs', 'No pude revisarlo'], ['curso', 'No pude revisar el curso'], ['negocio', 'No pude revisar la propuesta contra la base']]) {
    assert.match(leer(`lib/api-mako/areas/${f}.run.ts`), new RegExp(`catch \\(e\\) \\{ return \\{ error: \`${frase} \\(\\$\\{[^}]+\\}\\)[^\`]*\`, falla: true \\}; \\}`), `${f}: lo que revienta se toma por regla`);
  }
});

test('4. la acción confirmada que falla: con su ticket (o sin falla tragada) es guarda; sin ticket y tragada, no', () => {
  const m = sinComentarios(leer('lib/api-mako/areas/mako.run.ts'));
  assert.match(m, /if \('error' in r\) return JSON\.stringify\(\{ ok: false, error: r\.error, \.\.\.\(r\.vigentes \? \{ vigentes: r\.vigentes \} : \{\}\), guarda: true \}\);\n\s*if \(r\.ok\) return `✅ Hecho: \$\{r\.resumen\}`;/);
  assert.match(m, /const yaAvisada = 'ticket' in r && r\.ticket != null;\n\s*return JSON\.stringify\(\{ ok: false, error: `No se pudo: \$\{r\.resumen\}`, \.\.\.\(yaAvisada \|\| !esFallaTragada\(r\.resumen\) \? \{ guarda: true \} : \{\}\) \}\);/,
    'la confirmada que revienta abre un segundo ticket, o la que no tiene ticket no abre ninguno');
  // cancelar_accion, igual.
  assert.equal((m.match(/\.\.\.\(r\.vigentes \? \{ vigentes: r\.vigentes \} : \{\}\), guarda: true \}\);/g) ?? []).length, 2);
});

// ── Probado rompiéndolo (28/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   G1 el preparar vuelve a pedir la marca (`prep.guarda || prep.faltan…`)                → falla el 2 (y T1/T2 de caso.cts)
//   G2 el proponer de pantalla sin la marca                                               → falla el 2 (y T5)
//   G3 la lectura con `falta` sin la marca                                                → falla el 2
//   G4 «No pude leer las pasarelas» sin `falla: true`                                     → falla el 3
//   G5 un envoltorio (`revisando` de comunidad) sin `falla: true`                         → falla el 3
//   G6 una regla marcada como falla                                                       → falla el 3
//   G7 confirmar_accion sin la marca en lo que no se confirma                             → falla el 1 (y T3)
//   G8 cancelar_accion sin la marca                                                       → falla el 1
//   G9 la confirmada con su ticket, sin la marca                                          → falla el 4 (y T4: dos tickets)
