// Los tutoriales de las pestañas (lib/tutoriales): la forma de los datos, y que CADA marca que pide un paso la ponga algún
// componente. Una marca que no existe no da error en ningún lado: el motor saltea el paso en silencio (lo midió el 18/11 la
// maqueta del onboarding, donde 11 tutoriales no mostraban ningún paso en el teléfono). Lee el código como texto: sin jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TUTORIALES, pasosPara, tutorialDeRuta } from '@/lib/tutoriales';
import { MARCA, marcaCrear, marcaIntegracion, marcaSettings } from '@/lib/tutoriales/marcas';
import { SECCIONES_CUENTA, seccionesNegocio } from '@/lib/ajustes-secciones';
import { DEFS } from '@/lib/integraciones-catalogo';

const RAIZ = join(__dirname, '..');
function fuentes(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) fuentes(p, acc);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) acc.push(p);
  }
  return acc;
}
const CODIGO = fuentes(join(RAIZ, 'app')).map((f) => ({ f, s: readFileSync(f, 'utf8') }));
const usa = (patron: RegExp) => CODIGO.some(({ s }) => patron.test(s));

/** Las marcas que pone el código: escritas (`data-recorrido="x"`, `ancla('x')`, `'data-recorrido': 'x'`) o con lib/tutoriales/marcas. */
function marcasDelCodigo(): Set<string> {
  const hay = new Set<string>();
  for (const { s } of CODIGO) {
    for (const m of s.matchAll(/data-recorrido="([^"]+)"|ancla\('([^']+)'\)|'data-recorrido':\s*'([^']+)'/g)) hay.add(m[1] ?? m[2] ?? m[3]);
    for (const m of s.matchAll(/MARCA\.(\w+)/g)) { const v = (MARCA as Record<string, string>)[m[1]]; if (v) hay.add(v); }
  }
  // Las que arma una función con la clave de cada sección / integración / tab: valen si la función se usa en un componente.
  if (usa(/marcaSettings\(s\.key\)/)) for (const s of [...SECCIONES_CUENTA, ...seccionesNegocio({ integraciones: true, plan: true })]) hay.add(marcaSettings(s.key));
  if (usa(/marcaIntegracion\(i\.key\)/)) for (const d of DEFS) if (!d.oculto) hay.add(marcaIntegracion(d.key));
  if (usa(/marcaCrear\(tab, 'charla'\)/) && usa(/marcaCrear\(tab, 'proyectos'\)/)) for (const t of ['Offer', 'Copywriting', 'Video', 'Image', 'AI Avatar']) { hay.add(marcaCrear(t, 'charla')); hay.add(marcaCrear(t, 'proyectos')); }
  return hay;
}

test('cada marca que pide un paso la pone algún componente', () => {
  const hay = marcasDelCodigo();
  const faltan: string[] = [];
  for (const t of TUTORIALES) {
    for (const [i, p] of t.pasos.entries()) {
      for (const m of p.sel.matchAll(/\[data-recorrido="([^"]+)"\]/g)) if (!hay.has(m[1])) faltan.push(`${t.pestana} paso ${i + 1}: ${m[1]}`);
    }
  }
  assert.deepEqual(faltan, []);
});

test('las marcas del teléfono: las de Offer y las de Settings también van en MaKo Mobile', () => {
  const de = (ruta: string) => CODIGO.filter(({ f }) => f.replace(/\\/g, '/').includes(ruta)).map(({ s }) => s).join('\n');
  assert.ok(/marcaCrear\('Offer', 'charla'\)/.test(de('app/m/offer/')), 'la charla de Offer en el teléfono');
  assert.ok(/marcaCrear\('Offer', 'proyectos'\)/.test(de('app/m/offer/')), 'el selector de Offer en el teléfono');
  assert.ok(/marcaSettings\(s\.key\)/.test(de('app/m/cuenta/')), 'las secciones de «Tu cuenta»');
  assert.ok(/marcaIntegracion\(i\.key\)/.test(de('app/m/configuraciones/integraciones/')), 'las integraciones del teléfono');
  assert.ok(/MARCA\.crmVerInfo/.test(de('app/m/crm/')) && /MARCA\.crmReuniones/.test(de('app/m/crm/')), 'las del CRM del teléfono');
});

test('la forma: pestañas y rutas únicas, el clic sólo en el último paso y con su «Haz clic»', () => {
  const vistas = new Set<string>();
  for (const t of TUTORIALES) {
    assert.ok(t.pasos.length > 0, `${t.pestana}: sin pasos`);
    assert.ok(t.intro.trim(), `${t.pestana}: sin intro`);
    for (const k of [t.pestana, t.ruta, t.rutaMovil].filter(Boolean) as string[]) {
      assert.ok(!vistas.has(k), `${t.pestana}: «${k}» repetido`);
      vistas.add(k);
    }
    t.pasos.forEach((p, i) => {
      if (p.clic) assert.equal(i, t.pasos.length - 1, `${t.pestana} paso ${i + 1}: el clic va en el último`);
      assert.equal(!!p.clic, !!p.haz, `${t.pestana} paso ${i + 1}: «clic» y «haz» van juntos`);
      assert.ok(p.titulo.trim() && p.texto.trim(), `${t.pestana} paso ${i + 1}: sin título o texto`);
      assert.ok(!/useId|_R_|co-msg-|_[a-z0-9]{4,}_/.test(p.sel), `${t.pestana} paso ${i + 1}: un selector que cambia en cada dibujo`);
    });
    if (t.rutaMovil) assert.ok(pasosPara(t, true).length > 0, `${t.pestana}: en el teléfono no queda ningún paso`);
  }
});

test('tutorialDeRuta encuentra por la ruta de escritorio y por la del teléfono, sin el ? ni el #', () => {
  assert.equal(tutorialDeRuta('/crm?funnel=2')?.pestana, 'crm');
  assert.equal(tutorialDeRuta('/m/cuenta')?.pestana, 'settings');
  assert.equal(tutorialDeRuta('/integraciones#saldo-ia')?.pestana, 'integraciones');
  assert.equal(tutorialDeRuta('/no-existe'), null);
});
