// El ZIP es lo único de MaKo que el cliente se lleva y abre en otro programa. Si un
// número está mal ahí, no hay pantalla donde corregirlo después.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirVault, readme, conteoPorArea, carpetaDe, nombreSeguro } from '../lib/vault-modelo';
import { AREAS, type AreaId, type Cerebro, type NodoCerebro } from '../lib/cerebro-modelo';

const nodo = (p: Partial<NodoCerebro> & { id: string; area: AreaId }): NodoCerebro => ({
  etiqueta: p.id, detalle: '', fuente: '', autoria: 'mako', ...p,
} as NodoCerebro);

/** Un cerebro con la misma FORMA que el real: una raíz, un nodo por área y hojas. Esa
 *  forma es justamente la que destapó el bug del conteo. */
const cerebro = (): Cerebro => ({
  negocio: 'Negocio de prueba',
  nodos: [
    nodo({ id: 'raiz', area: 'norte', etiqueta: 'Negocio de prueba' }),
    ...AREAS.map((a) => nodo({ id: `area:${a.id}`, area: a.id as AreaId, etiqueta: a.nombre })),
    nodo({ id: 'campo:a', area: 'norte', etiqueta: 'Dato uno' }),
    nodo({ id: 'campo:b', area: 'norte', etiqueta: 'Dato dos' }),
    nodo({ id: 'campo:c', area: 'oferta', etiqueta: 'Dato tres' }),
    nodo({ id: 'falta:x', area: 'voz', etiqueta: 'Todavía no', autoria: 'pendiente' }),
  ],
  aristas: [],
  posiciones: {}, encuadre: { x: 0, y: 0, lado: 100 },
  cuenta: { total: 3, mako: 3, usuario: 0, pendientes: 1 },
  vacias: [],
} as unknown as Cerebro);

const todas = AREAS.map((a) => a.id as AreaId);

test('el README cuenta lo MISMO que hay en cada carpeta', () => {
  // El bug real: `readme()` filtraba a mano solo por `autoria !== 'pendiente'`, así que
  // contaba también los nodos de ÁREA y la RAÍZ —que no son archivos—. En el ws 11
  // decía «5 archivos» en una carpeta con 3, y en Norte se iba de dos porque ahí vive
  // además la raíz. Se descubrió abriendo el ZIP, no leyendo el código.
  const c = cerebro();
  const archivos = construirVault(c, todas);
  const texto = readme(c, todas).texto;

  for (const a of AREAS) {
    const reales = archivos.filter((f) => f.ruta.startsWith(`${carpetaDe(a.id as AreaId)}/`)).length;
    const linea = texto.split('\n').find((l) => l.includes(`**${carpetaDe(a.id as AreaId)}**`));
    assert.ok(linea, `el README no menciona ${carpetaDe(a.id as AreaId)}`);
    const dice = Number(linea.match(/\((\d+) archivos?\)/)?.[1] ?? -1);
    assert.equal(dice, reales, `${carpetaDe(a.id as AreaId)}: el README dice ${dice} y hay ${reales}`);
  }
});

test('ni la raíz, ni los nodos de área, ni lo pendiente son archivos', () => {
  const archivos = construirVault(cerebro(), todas);
  const rutas = archivos.map((f) => f.ruta);
  assert.ok(!rutas.some((r) => r.includes('Todavía no')), 'se escribió un archivo de algo que no existe');
  for (const a of AREAS) {
    assert.ok(!rutas.some((r) => r.endsWith(`/${nombreSeguro(a.nombre)}.md`)), `el nodo de área ${a.nombre} quedó como archivo`);
  }
  // 3 datos + el README.
  assert.equal(archivos.length, 4);
});

test('el conteo del formulario es el de las carpetas, más el README', () => {
  // Es lo que el botón promete: «Descargar N archivos ↓». Si difiere, el usuario baja
  // otra cosa que la que le dijeron.
  const c = cerebro();
  const prometido = Object.values(conteoPorArea(c)).reduce((a, b) => a + b, 0);
  assert.equal(construirVault(c, todas).length, prometido + 1);
});

test('el nombre de cada área tiene su carpeta, y ninguna quedó sin renombrar', () => {
  // Renombrar un área toca DOS archivos: `AREAS` y el `CARPETA` de acá. Este test es lo
  // único que impide que la pantalla diga «Avatares» y el ZIP siga trayendo
  // «08 Segmentos» — que nadie ve hasta que un cliente abre el vault.
  for (const a of AREAS) {
    const carpeta = carpetaDe(a.id as AreaId);
    assert.notEqual(carpeta, '99 Otros', `${a.id} no tiene carpeta`);
    assert.ok(
      carpeta.endsWith(a.nombre),
      `la carpeta de «${a.nombre}» se llama «${carpeta}»: se renombró el área y no la carpeta`,
    );
  }
});
