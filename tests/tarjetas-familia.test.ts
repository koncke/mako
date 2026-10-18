// =============================================================================
// UNA familia de tarjetas en CRM, Clients y Plan, en computadora y teléfono (17/10/2026)
// =============================================================================
// Martín, 17/10 22:40 (punto 8): «No me gustan las cards y cómo se ven... Quiero que tengan coherencia... si hacés esto
// del CRM también debe tener cierto sentido en diseño los otros kanban, como el PLAN y Clients». Prototipo:
// docs/prototipos/coherencia-1710.html. Lo puro está en tests/tarjeta-kanban.test.ts; acá se fija el CABLEADO y la
// regla del aviso de un cliente, EJECUTÁNDOLA:
//   1. el tablero del CRM dibuja la tarjeta de la familia SIN perder el arrastre ni el clic derecho, y «Mover a…» de la
//      ficha rápida va por `handleDrop` (el mismo camino que soltar la tarjeta en la columna);
//   2. el teléfono del CRM: tocar abre la ficha rápida en su SheetM, y «Mover a…» le pide a KanbanM SU sheet (no otro);
//   3. Clients: la barra de la etapa y el aviso, el más urgente primero (sin entrar al curso, días sin moverse);
//   4. Plan: el círculo de prioridad completa la tarea, en la computadora y en el teléfono;
//   5. KanbanM: las etapas con su NOMBRE y contador (pestañas píldora), y el pedido de afuera abre su «Mover a…»;
//   6. toda pieza del kit lleva sus variables, aunque se use fuera de una tarjeta `.tk` (18/10: el círculo del Plan era
//      invisible y la cara del teléfono salía sin color, en producción, con todo lo de arriba en verde);
//   7. cada componente del kit monta SUS estilos, y quien usa clases `tk-*` sueltas también (18/10: Clients de la
//      computadora no los montaba y la tarjeta salió sin estilos para todos los negocios);
//   8. la columna con su bloque de fondo (el mismo en los tres tableros) y «Próximo» plegado, abierto por el ícono del
//      calendario (18/10, Martín, pt 8).
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 5 / 0, una rotura por vez y restaurada:
//   · la ficha rápida del CRM moviendo sin `handleDrop`                              → 4 / 1
//   · el teléfono abriendo un «Mover a…» propio en vez de `pedirMover`               → 4 / 1
//   · el aviso de un cliente sin mirar «sin entrar al curso»                         → 4 / 1
//   · el círculo del Plan sin completar (`board.toggleDone`)                         → 4 / 1
//   · KanbanM sin el nombre de la etapa en la pestaña                                → 4 / 1
// Y el 6 (18/10/2026), con el archivo en 6 / 0: las variables otra vez en las cinco raíces de antes
//   (`.tk-raiz, .tk, .tk-ptabs, .tk-feat, .tk-sheet`, luz y oscuro)                    → 5 / 1, nombrando 20 piezas
//   sueltas sin color (tk-pr--0..4, tk-c-*, tk-insignia, tk-medidor, tk-sub, tk-ptab…).
// Y el 7 (18/10/2026), con el archivo en 7 / 0: el kit como estaba en producción (sólo la ficha rápida montaba los
//   estilos) → 6 / 1, nombrando CaraTarjeta y PestanasPildora (las tarjetas pasan porque dibujan una CaraTarjeta); y
//   VistaSelector del CRM sin el suyo → 6 / 1, nombrando app/crm/CrmToolbar.tsx. Sacarlo SÓLO de TarjetaPersona da
//   7 / 0, y está bien: su CaraTarjeta lo monta igual (una rotura que no cambia la pantalla no prueba nada).
// Y el 8 (18/10/2026), con el archivo en 8 / 0: el CrmBoard de antes (columna al 55 % y «Próximo» siempre abierto)
//   → 7 / 1; y KanbanEntrega de antes (su columna al 55 %) → 7 / 1.
// Correr: node --import tsx --test tests/tarjetas-familia.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avanceDeCliente } from '../app/customer-success/aviso-tarjeta';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('CRM en la computadora: la tarjeta de la familia con el arrastre y el clic derecho, y «Mover a…» por handleDrop', () => {
  const b = leer('app/crm/CrmBoard.tsx');
  assert.match(b, /<TarjetaPersona\s+data-leadcard\s+\/\*[^*]*\*\/\s+data-lead-id=\{l\.id\}/, 'la tarjeta perdió el dato del clic derecho');
  const t = b.slice(b.indexOf('<TarjetaPersona'), b.indexOf('<TarjetaPersona') + 4000);
  assert.match(t, /draggable\s+onDragStart=/, 'la tarjeta dejó de arrastrarse');
  assert.match(t, /onDragEnd=\{limpiarArrastreTarjeta\}/);
  assert.match(t, /pildora=\{\{ texto: 'Ver info'/);
  assert.match(t, /className="mk-sel-tarjeta"/, 'sin la casilla de selección');
  assert.match(b, /onMover=\{\(key\) => \{ cerrar\(\); idASoltar\.current = l\.id; handleDrop\(key\); \}\}/, '«Mover a…» tiene que ir por el mismo camino que soltar');
  assert.match(b, /<TarjetaDestacada ancha sobre="Próximo"/);
});

test('CRM en el teléfono: tocar abre la ficha rápida y «Mover a…» usa el sheet de KanbanM', () => {
  const m = leer('app/m/crm/TableroCrm.tsx');
  assert.match(m, /onTocar=\{\(id\) => setRapida\(/);
  assert.match(m, /pedirMover=\{pedirMover\}/);
  assert.match(m, /setPedirMover\(\(p\) => \(\{ id, vez: \(p\?\.vez \?\? 0\) \+ 1 \}\)\)/, 'el «Mover a…» de la ficha rápida tiene que pedirle a KanbanM el suyo');
  assert.doesNotMatch(m, /moverEtapaAction\(Number\(r\.id\)/, 'la ficha rápida no mueve por su cuenta: duplicaría el toast y el deshacer');
  const k = leer('app/m/_ui/KanbanM.tsx');
  assert.match(k, /useEffect\(\(\) => \{ if \(p\.pedirMover\) setMoviendo\(p\.pedirMover\.id\); \}, \[vezPedida\]\);/);
});

test('Clients: la barra de la etapa y el aviso, el más urgente primero', () => {
  const ahora = Date.parse('2026-10-17T12:00:00Z');
  const base = { etapa: 1, etapas: 4, ahoraMs: ahora };
  const sinEntrar = avanceDeCliente({ ...base, enEtapa: { frase: 'hace 30 días', trabado: true }, acceso: { existe: true, revocado: false, ingresos: 0, ultimoIngresoAt: null, invitacionEnviadaAt: '2026-10-01T00:00:00Z' } });
  assert.equal(sinEntrar.pct, 50);
  assert.deepEqual(sinEntrar.aviso, { texto: 'Sin entrar al curso', tono: 'mal' }, 'nunca entró: le gana a los días sin moverse');
  const viejo = avanceDeCliente({ ...base, enEtapa: null, acceso: { existe: true, revocado: false, ingresos: 3, ultimoIngresoAt: '2026-09-20T12:00:00Z' } });
  assert.deepEqual(viejo.aviso, { texto: 'Sin entrar · 27 d', tono: 'riesgo' });
  const trabado = avanceDeCliente({ ...base, enEtapa: { frase: 'hace 21 días', trabado: true }, acceso: null });
  assert.deepEqual(trabado.aviso, { texto: '21 días sin moverse', tono: 'mal' });
  const bien = avanceDeCliente({ ...base, enEtapa: { frase: 'hace 3 días', trabado: false }, acceso: { existe: true, revocado: false, ingresos: 2, ultimoIngresoAt: '2026-10-15T12:00:00Z' } });
  assert.equal(bien.aviso, null);
  assert.equal(bien.texto, 'Etapa 2 de 4 · hace 3 días');
  assert.match(leer('app/customer-success/KanbanEntrega.tsx'), /avance=\{avanceDeCliente\(\{ etapa: iCol, etapas: visibles\.length,/);
  assert.match(leer('app/m/cs/CustomerSuccessM.tsx'), /avanceDeCliente\(\{ etapa: iCol, etapas: grupos\.length,/, 'el teléfono tiene que usar la MISMA regla');
});

test('Plan: el círculo de prioridad completa la tarea, en la computadora y en el teléfono', () => {
  const b = leer('app/plan/board/BoardShell.tsx');
  const card = b.slice(b.indexOf('function CardTile('), b.indexOf('function CardTile(') + 12000);
  assert.match(card, /className=\{`tk-pr tk-pr--\$\{prio\}`\}[\s\S]{0,200}onClick=\{\(e\) => \{ e\.stopPropagation\(\); board\.toggleDone\(t\.id\); \}\}/);
  assert.match(leer('app/m/plan/ListaPlan.tsx'), /if \(!hecha\) completar\(it, 'check'\);/, 'el teléfono completa por el mismo camino que el sheet');
});

test('KanbanM: las etapas con su nombre y contador', () => {
  const k = leer('app/m/_ui/KanbanM.tsx');
  assert.match(k, /<span>\{c\.titulo\}<\/span>\s*<b key=/, 'la pestaña tiene que decir qué etapa es');
  assert.doesNotMatch(k, /gridTemplateColumns: `repeat\(\$\{cols\.length\}/, 'volvieron las rayitas en grilla');
});

// ── 6. Las variables del kit en TODA pieza ──────────────────────────────────────────────────────────────────────────
// Se lee el CSS del kit y, por cada regla que USA una variable `--tk-*`, se pregunta si un elemento con sólo esa clase
// (la pieza suelta, como la usa el Plan o el teléfono) cae en la regla que las DECLARA, en claro y en oscuro.
const CSS_KIT = (() => {
  const s = leer('app/_ui/TarjetaKanban.tsx');
  const i = s.indexOf('export const CSS_TARJETAS = `') + 'export const CSS_TARJETAS = `'.length;
  // Sin comentarios: una coma adentro de uno cortaba el selector que lo sigue.
  return s.slice(i, s.indexOf('`;', i)).replace(/\/\*[\s\S]*?\*\//g, '');
})();
const reglas = [...CSS_KIT.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), cuerpo: m[2] }));
/** Corta una lista de selectores por las comas de afuera (no las de adentro de `:where(...)`). */
const partes = (lista: string) => {
  const out: string[] = []; let hondo = 0; let cur = '';
  for (const ch of lista) {
    if (ch === '(') hondo++; if (ch === ')') hondo--;
    if (ch === ',' && hondo === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  return [...out, cur.trim()].filter(Boolean);
};
/** ¿Un elemento con estas clases cae en este selector simple? (`.x`, `[class^="v"]`, `[class*="v"]`, `:where(...)`). */
function cae(sel: string, clases: string): boolean {
  const w = sel.match(/^:where\((.*)\)$/);
  if (w) return partes(w[1]).some((x) => cae(x, clases));
  const pre = sel.match(/^\[class\^="([^"]+)"\]$/); if (pre) return clases.startsWith(pre[1]);
  const sub = sel.match(/^\[class\*="([^"]+)"\]$/); if (sub) return clases.includes(sub[1]);
  const cls = sel.match(/^\.([\w-]+)$/); if (cls) return clases.split(' ').includes(cls[1]);
  return false;
}
const declara = (marca: string) => {
  const r = reglas.find((x) => x.cuerpo.includes(marca));
  assert.ok(r, `no encontré la regla que declara ${marca}`);
  return partes(r.sel).map((x) => x.replace(/^\[data-tema="oscuro"\]\s+/, ''));
};

test('toda pieza del kit lleva sus variables, aunque se use fuera de una tarjeta .tk', () => {
  const claro = declara('--tk-p1: #BF616A');
  const oscuro = declara('--tk-p1: #E699A6');
  const sinColor = new Set<string>();
  for (const r of reglas) {
    if (!/var\(--tk-/.test(r.cuerpo)) continue;
    for (const sel of partes(r.sel)) {
      // La última pieza del selector, sin pseudoclases: `.tk-scab h3` hereda de su padre y no cuenta.
      const ult = sel.split(/\s+|>/).filter(Boolean).pop()!.replace(/:[\w-]+(\([^)]*\))?/g, '');
      const clase = ult.match(/^\.([\w-]+)/)?.[1];
      if (!clase) continue;
      if (!claro.some((d) => cae(d, clase)) || !oscuro.some((d) => cae(d, clase))) sinColor.add(clase);
    }
  }
  assert.deepEqual([...sinColor], [], `piezas que usadas sueltas salen sin color: ${[...sinColor].join(', ')}`);
  // Y las que hoy se usan sueltas, nombradas: el círculo del Plan y la cara del teléfono.
  for (const c of ['tk-pr tk-pr--0', 'tk-cara', 'tk-ini tk-c-blue', 'tk-medidor']) assert.ok(claro.some((d) => cae(d, c)), c);
});

// ── 7. Los estilos los monta cada pieza, no el tablero ──────────────────────────────────────────────────────────────
test('cada componente del kit monta sus estilos, y quien usa clases tk-* sueltas también', () => {
  const kit = leer('app/_ui/TarjetaKanban.tsx');
  // Cada componente exportado que dibuja (menos EstiloTarjetas y los dos que envuelven a otro del kit).
  const nombres = [...kit.matchAll(/^export (?:function (\w+)|const (\w+) = forwardRef)/gm)].map((m) => m[1] ?? m[2])
    .filter((n) => /^[A-Z]/.test(n) && n !== 'EstiloTarjetas');
  assert.ok(nombres.length >= 7, `encontré ${nombres.length} componentes`);
  const sinEstilo = nombres.filter((n) => {
    const i = kit.search(new RegExp(`^export (?:function ${n}\\b|const ${n} = forwardRef)`, 'm'));
    const j = kit.slice(i + 1).search(/^export /m);
    const cuerpo = kit.slice(i, j < 0 ? undefined : i + 1 + j);
    return !cuerpo.includes('<EstiloTarjetas />') && !/<(CuerpoFichaRapida|TarjetaPersona|TarjetaTarea|CaraTarjeta)\b/.test(cuerpo);
  });
  assert.deepEqual(sinEstilo, [], `componentes del kit que dependen de que otro monte los estilos: ${sinEstilo.join(', ')}`);
  // Quien escribe clases del kit a mano (sin un componente del kit en el mismo archivo) monta los estilos él mismo.
  const conClases = ['app/crm/CrmBoard.tsx', 'app/crm/CrmToolbar.tsx', 'app/customer-success/ClienteCard.tsx', 'app/m/crm/TableroCrm.tsx',
    'app/m/cs/CustomerSuccessM.tsx', 'app/m/plan/ListaPlan.tsx', 'app/plan/board/BoardShell.tsx'];
  const huerfanos = conClases.filter((f) => {
    const t = leer(f);
    return !t.includes('<EstiloTarjetas />') && !/<(TarjetaPersona|TarjetaTarea|CaraTarjeta|PestanasPildora|TarjetaDestacada|CuerpoFichaRapida|FichaRapida)\b/.test(t);
  });
  assert.deepEqual(huerfanos, [], `usan clases tk-* sin montar los estilos: ${huerfanos.join(', ')}`);
});

// ── 8. La columna con su bloque de fondo, y «Próximo» plegado ───────────────────────────────────────────────────────
test('la columna con su bloque de fondo en los tres tableros, y «Próximo» plegado detrás del calendario', () => {
  const tk = leer('lib/tarjeta-kanban.ts');
  assert.match(tk, /export const FONDO_COLUMNA = 'var\(--surface-2\)';/);
  const crm = leer('app/crm/CrmBoard.tsx');
  for (const [f, t] of [['app/crm/CrmBoard.tsx', crm], ['app/plan/board/BoardShell.tsx', leer('app/plan/board/BoardShell.tsx')],
    ['app/customer-success/KanbanEntrega.tsx', leer('app/customer-success/KanbanEntrega.tsx')]] as const) {
    assert.doesNotMatch(t, /var\(--surface-2\) 55%/, `${f}: la columna volvió al fondo que no se ve`);
    assert.match(t, /FONDO_COLUMNA/, `${f}: la columna no usa el fondo común`);
  }
  assert.match(crm, /const \[verProximo, setVerProximo\] = useState\(false\);/, '«Próximo» tiene que arrancar plegado');
  assert.match(crm, /if \(!verProximo\) return null;/, '«Próximo» se dibuja sólo desplegado');
  assert.match(crm, /onAlternar=\{hayProxima \? \(\) => setVerProximo\(\(v\) => !v\) : null\}/, 'el calendario lo despliega');
  assert.match(leer('app/crm/ReunionesProximas.tsx'), /onClick=\{onAlternar \?\? \(\(\) => setAbierto\(true\)\)\}/, 'con próxima reunión, el calendario no abre el pop-up');
});
