// LA KPI INVERTIDA — la regla A4 de docs/diseno-dashboards-codeandchill.md
//
// `AGENTS.md` lista entre lo feo «cuatro bloques apilados del mismo peso sin jerarquía», y una fila de
// cuatro KPIs idénticas es justamente eso: cuatro cajas que piden la misma atención, así que no la pide
// ninguna. El truco más barato del catálogo de los 114 tableros: de cuatro tarjetas iguales, UNA se
// invierte, y es el ancla visual de la pantalla.
//
// La regla que este test blinda, y que es la mitad que de verdad importa: **nunca más de una por fila**.
// Dos invertidas en la misma fila no son dos anclas — son otra fila sin jerarquía, con más ruido. Y la
// elige la PLANTILLA, no quien diseña: `AGENTS.md`, «Una plantilla contesta UNA pregunta», y la
// invertida es la respuesta a esa pregunta.
//
// ⚠️ «Exactamente una» se exige sólo donde ya está decidido (Marketing y Comercial, las dos hojas de
// Mauricio). El documento pone «exactamente una» como regla para las plantillas NUEVAS; obligar a todas
// las que ya existen sería cambiar hojas que nadie pidió tocar en esta pasada.
//
// Correr: node --import tsx --test tests/graficos-kpi-invertida.test.ts
//
// Probados rompiéndolos (31/10/2026), con la base en 0 fallos (4 tests):
//   · poner `invertida: true` también en `mk-cac` (dos en la fila y=0 de Marketing)
//       → 2 pass / 2 fail («ninguna fila…» y «Marketing y Comercial…»)
//   · sacarle `invertida: true` a `mk-roas-cash` (la fila se queda sin ancla)
//       → 2 pass / 2 fail («ninguna fila…», por su guarda de «no estoy midiendo el vacío», y «Marketing…»)
//   · sacarle `if (o.invertida === true)` a `sanearGrafico` (el campo se pierde al sanear)
//       → 1 pass / 3 fail (sólo sobrevive el de la isla oscura, que lee la CSS)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esGrafico, sanearGrafico, tipoDe, type Grafico, type Hoja } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, instanciarPlantilla } from '../lib/graficos-plantillas';

const RAIZ = join(import.meta.dirname, '..');

/**
 * ¿Es una tarjeta de NÚMERO? La regla vive en `esTarjetaNumero` (app/dashboard/Grafico.tsx) y acá se
 * repite en vez de importarse: ese módulo es un componente de cliente y arrastra media app (termina en
 * `lib/landing-token.ts`, que no carga en un test de node). El tipo del catálogo sí es puro.
 */
const esTarjetaNumero = (tipo: string) => tipoDe(tipo)?.grupo === 'Cuadro de resultados' && tipo !== 'barra_proporcion' && tipo !== 'tramos';

/** Las KPIs (cuadros de resultados) de una hoja, que son las tarjetas que esta regla gobierna. */
const kpisDe = (h: Hoja): Grafico[] => h.componentes.filter((c): c is Grafico => esGrafico(c) && esTarjetaNumero(c.tipo));

/**
 * Las FILAS: las KPIs que arrancan en la misma `y`. Es la definición que usa la grilla
 * (react-grid-layout), y la que ve el ojo: una fila es lo que se lee de un barrido horizontal.
 */
function filasDe(kpis: Grafico[]): Map<number, Grafico[]> {
  const out = new Map<number, Grafico[]>();
  for (const k of kpis) out.set(k.y, [...(out.get(k.y) ?? []), k]);
  return out;
}

test('ninguna fila de ninguna plantilla lleva más de UNA invertida', () => {
  let filasConInvertida = 0;
  for (const p of PLANTILLAS_HOJA) {
    const hoja = instanciarPlantilla(p);
    for (const [y, fila] of filasDe(kpisDe(hoja))) {
      const invertidas = fila.filter((k) => k.invertida);
      assert.ok(
        invertidas.length <= 1,
        `«${p.nombre}», fila y=${y}: ${invertidas.length} invertidas (${invertidas.map((k) => k.titulo).join(', ')}). Dos anclas no son dos anclas: son ninguna.`,
      );
      if (invertidas.length === 1) filasConInvertida++;
    }
  }
  // Y que el test no esté midiendo el vacío: tiene que haber encontrado alguna.
  assert.ok(filasConInvertida >= 2, `esperaba al menos 2 filas con su ancla, encontré ${filasConInvertida}`);
});

test('Marketing y Comercial: sus cuatro primeros números tienen EXACTAMENTE una, y es la que contesta la hoja', () => {
  const esperado: Record<string, string> = {
    // Marketing pregunta «¿cuánto cuesta una agenda y de qué anuncio vino?» (4/11/2026, docs/templates-dashboard-propuesta.md §7.3).
    marketing: 'Costo por agenda',
    // Comercial pregunta «¿convierte, y a qué costo?» (4/11/2026): la tasa de cierre. Lo cobrado se mudó a Cobranza.
    comercial: 'Tasa de cierre',
  };
  for (const [idPlantilla, titulo] of Object.entries(esperado)) {
    const p = PLANTILLAS_HOJA.find((x) => x.id === idPlantilla);
    assert.ok(p, `no encontré la plantilla «${idPlantilla}»`);
    const kpis = kpisDe(instanciarPlantilla(p!));
    // De a 2 × 2 (1/11/2026, lib/graficos-portadas.ts): los cuatro primeros son dos filas de dos, y siguen siendo un solo grupo.
    const arriba = [...kpis].sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 4);
    assert.equal(arriba.length, 4, `«${idPlantilla}» tiene ${arriba.length} KPIs`);
    const invertidas = arriba.filter((k) => k.invertida);
    assert.equal(invertidas.length, 1, `«${idPlantilla}»: necesita UN ancla, tiene ${invertidas.length}`);
    assert.equal(invertidas[0].titulo, titulo);
  }
});

test('el saneo conserva `invertida` y sólo acepta `true` (nunca un string ni un false guardado)', () => {
  const base = { id: 'g1', fuente: 'negocio', tipo: 'numero', metricas: ['cobrado'] };
  assert.equal(sanearGrafico({ ...base, invertida: true })!.invertida, true);
  // Lo que no es `true` no se guarda: ausente es lo de siempre (no invertida).
  assert.equal(sanearGrafico({ ...base, invertida: false })!.invertida, undefined);
  assert.equal(sanearGrafico({ ...base, invertida: 'si' })!.invertida, undefined);
  assert.equal(sanearGrafico({ ...base, invertida: 1 })!.invertida, undefined);
  assert.equal(sanearGrafico(base)!.invertida, undefined);
});

test('la invertida es una ISLA OSCURA con los tokens del sidebar, no un modo oscuro', () => {
  const css = readFileSync(join(RAIZ, 'app/dashboard/editor-css.ts'), 'utf8').replace(/\r\n/g, '\n');
  const regla = css.split('\n').slice(css.split('\n').findIndex((l) => l.includes('.lk-comp--invertida'))).slice(0, 10).join('\n');
  assert.match(regla, /--ink:\s*var\(--on-sidebar\)/, 'la tinta de adentro tiene que darse vuelta, o el número queda negro sobre negro');
  assert.match(regla, /background:\s*var\(--sidebar\)/);
  // Lo que NO puede aparecer: un `prefers-color-scheme` (AGENTS.md: no hay modo oscuro global y no se
  // está agregando uno) ni un color en hex (los tokens se dan vuelta solos, un hex no).
  assert.doesNotMatch(regla, /prefers-color-scheme/);
  assert.doesNotMatch(regla, /#[0-9a-fA-F]{3,6}\b/, 'la isla oscura va con tokens, no con hex');
  // Y la pantalla tiene que ponerle la clase (si no, el campo del modelo no se ve en ninguna parte).
  const pantalla = readFileSync(join(RAIZ, 'app/dashboard/EditorInforme.tsx'), 'utf8');
  assert.match(pantalla, /c\.invertida && !portada && 'lk-comp--invertida'/);
});
