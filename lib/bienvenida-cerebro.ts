// =============================================================================
// bienvenida-cerebro — el mapa de la portada: datos de FICCIÓN, forma REAL
// =============================================================================
// ⚠️ NINGÚN módulo con 'use client' puede importar este archivo: llama a
// `layoutCerebro`, que trae d3-force. El typecheck NO lo ve (misma trampa que avisa la
// cabecera de lib/cerebro-layout.ts). Lo importa `app/onboarding/page.tsx`, que es
// server component, y las posiciones bajan como números.
//
// POR QUÉ FICCIÓN, que ya está decidido y no se vuelve a discutir: el cliente que ve esta
// pantalla NO TIENE DATOS. Medido contra un workspace reseteado, su cerebro real son 25
// nodos y casi todos son etapas de un funnel que él no armó — mostrarle eso es mostrarle
// el negocio de otro. Textual del dueño: «justamente esto es ficción, es un grafo sin
// info».
//
// POR QUÉ LA FORMA SÍ ES REAL, que es el pedido nuevo: «que como están armados los nodos,
// sea como hoy se arman… tipo cerebro, no como un árbol». Antes esta pantalla dibujaba
// anillos concéntricos calculados con trigonometría: eso ES un árbol radial, y se nota.
// Ahora los nodos salen por el mismo camino que los de verdad —`layoutCerebro`, d3-force—
// así que la nube es la misma nube.
//
// ⚠️⚠️ Y LA PARTE QUE PARECE DECORACIÓN Y ES EL MOTOR: LAS ARISTAS LATERALES.
// `lib/cerebro-layout.ts` lo dice con todas las letras: «el problema nunca fue el motor de
// dibujo. Los datos eran un ÁRBOL —una arista entrante por nodo, todo colgando de la
// raíz— y sobre un árbol ninguna simulación da la nube de Obsidian». O sea: si acá se
// arma un árbol y se lo pasa por d3, sale un diente de león, no un cerebro. El layout no
// puede inventar una forma que los datos no tienen.
//
// El patrón que hay que copiar de `cerebro-grafo.ts` es **muchos → UNO desde ramas
// distintas**: varios nodos de ramas separadas apuntando al mismo destino. Eso cierra
// triángulos, y los triángulos son lo que un force layout convierte en nube. Acá son las
// razones compartiendo formato, los avatares compartiendo razón, y el funnel tocando la
// oferta y al cliente.
//
// Y la otra regla medida que se hereda: **los padres no se cuelgan de la raíz, se cuelgan
// de sus hijos** (cerebro-grafo.ts lo midió: colgarlos del centro deja el hub en 4,8-5,1×
// contra un techo de 4,5×).
// =============================================================================

import { layoutCerebro } from './cerebro-layout';
import type { AreaId, Cerebro, NodoCerebro, AristaCerebro } from './cerebro-modelo';

/** El nodo de ficción más barato que tipa. Mismo molde que usa tests/cerebro-layout. */
const nodo = (id: string, area: AreaId, etiqueta: string, extra: Partial<NodoCerebro> = {}): NodoCerebro => ({
  id, area, etiqueta,
  detalle: '', fuente: '', autoria: 'mako',
  ...extra,
});

/**
 * Los cinco pilares, en SEGUNDA PERSONA. No son los nombres del catálogo a propósito:
 * acá son una promesa («vas a tener esto»), no un dato que ya exista. Los nombres reales
 * de las áreas sí aparecen en el tercer nivel, para que cuando llegue a su Second Brain
 * reconozca lo que vio el primer día.
 */
const PILARES: Array<{ id: string; et: string; area: AreaId }> = [
  { id: 'n1:negocio', et: 'Tu Negocio', area: 'norte' },
  { id: 'n1:oferta', et: 'Tu Oferta', area: 'oferta' },
  { id: 'n1:mercado', et: 'Tu Avatar', area: 'cliente' },
  { id: 'n1:mensaje', et: 'Tu Mensaje', area: 'razones' },
  { id: 'n1:funnel', et: 'Tu Funnel', area: 'funnel' },
];

/** Las hojas de cada pilar. Nombres de ficción, plausibles y CORTOS: son etiquetas. */
const HOJAS: Array<{ padre: string; area: AreaId; ets: string[] }> = [
  { padre: 'n1:negocio', area: 'panorama', ets: ['Qué vendes', 'En qué fase estás', 'Tu cuello de botella'] },
  { padre: 'n1:negocio', area: 'documentos', ets: ['Tus documentos', 'Tus reuniones'] },
  { padre: 'n1:oferta', area: 'oferta', ets: ['Tu promesa', 'Tu precio', 'Tu garantía'] },
  { padre: 'n1:oferta', area: 'productos', ets: ['Tu catálogo'] },
  { padre: 'n1:oferta', area: 'entregables', ets: ['Tu lead magnet'] },
  { padre: 'n1:mercado', area: 'cliente', ets: ['Qué le duele', 'Qué quiere', 'Qué objeta'] },
  { padre: 'n1:mercado', area: 'avatares', ets: ['Avatar 1', 'Avatar 2', 'Avatar 3'] },
  { padre: 'n1:mensaje', area: 'razones', ets: ['Por qué te compran', 'Tus ángulos'] },
  { padre: 'n1:mensaje', area: 'voz', ets: ['Tu voz', 'Tu cara de marca'] },
  { padre: 'n1:funnel', area: 'funnel', ets: ['Lead', 'Agendó', 'Asistió', 'Cerró'] },
];

/**
 * Los formatos: el destino COMPARTIDO. Son la pieza que rompe el árbol — varias razones
 * de ramas distintas apuntan al mismo formato, igual que en el mapa de verdad, donde «dos
 * avatares distintos pueden elegir el MISMO formato» es, textual, «la que más hace por
 * sacar al grafo de la forma de estrella».
 */
const FORMATOS = ['Video ad', 'Carrusel', 'Testimonio'];

/** El grafo de ficción, SIN posiciones. Puro y testeable. */
export function grafoBienvenida(): { nodos: NodoCerebro[]; aristas: AristaCerebro[] } {
  const nodos: NodoCerebro[] = [];
  const aristas: AristaCerebro[] = [];
  const unir = (de: string, a: string, motivo: string) => { aristas.push({ de, a, motivo }); };

  // El centro. Es lo único que se ve en el primer tiempo del revelado.
  nodos.push(nodo('raiz', 'norte', 'Tus anuncios', { destacado: true }));

  for (const p of PILARES) nodos.push(nodo(p.id, p.area, p.et));

  const hojasDe = new Map<string, string[]>();
  HOJAS.forEach((g, gi) => {
    g.ets.forEach((et, i) => {
      const id = `h:${gi}:${i}`;
      nodos.push(nodo(id, g.area, et));
      // El pilar se cuelga de SU HOJA, no al revés y no del centro: es la regla medida.
      unir(id, g.padre, 'Esto es parte de esto');
      const lista = hojasDe.get(g.padre) ?? [];
      lista.push(id);
      hojasDe.set(g.padre, lista);
    });
  });

  for (const f of FORMATOS) nodos.push(nodo(`fmt:${f}`, 'voz', f));

  // ── LAS ARISTAS LATERALES ──────────────────────────────────────────────────
  // Sin esto, todo lo de arriba es un árbol y d3 lo dibuja como un diente de león.
  // Cada una cierra un triángulo entre ramas que de otro modo no se tocarían.

  // 1. Cada avatar elige razones, y VARIOS avatares comparten la misma. Es el mismo
  //    «muchos → uno» del mapa real.
  const avatares = (hojasDe.get('n1:mercado') ?? []).slice(3);
  const razones = hojasDe.get('n1:mensaje') ?? [];
  avatares.forEach((a, i) => {
    razones.forEach((r) => unir(a, r, 'Este avatar compra por esta razón'));
    // 2. Y cada avatar cae en un formato distinto, que también comparten entre sí.
    unir(a, `fmt:${FORMATOS[i % FORMATOS.length]}`, 'A este avatar le habla este formato');
  });
  razones.forEach((r, i) => unir(r, `fmt:${FORMATOS[(i + 1) % FORMATOS.length]}`, 'Esta razón se cuenta con este formato'));

  // 3. El funnel toca la oferta y al cliente: una etapa no es un compartimento. Y las
  //    etapas van ENCADENADAS entre sí, que es lo que un funnel es de verdad — de paso,
  //    una cadena entre hermanos que ya cuelgan del mismo pilar cierra un triángulo por
  //    cada par, y eso es exactamente lo que sube el clustering.
  const etapas = hojasDe.get('n1:funnel') ?? [];
  const oferta = (hojasDe.get('n1:oferta') ?? [])[0];
  const mercado = hojasDe.get('n1:mercado') ?? [];
  const dolor = mercado[0];
  for (let i = 1; i < etapas.length; i++) unir(etapas[i - 1], etapas[i], 'Y de aquí pasa a aquí');
  if (etapas[0] && dolor) unir(etapas[0], dolor, 'El lead entra por lo que le duele');
  if (etapas[etapas.length - 1] && oferta) unir(etapas[etapas.length - 1], oferta, 'Cierra comprando tu oferta');

  // 3.b Cada avatar se define por el dolor, el deseo y la objeción — los tres nodos del
  //      cliente. Es la lateral más honesta del mapa: un avatar NO es una caja aparte,
  //      es una combinación de esas tres cosas. Y es la que más triángulos cierra.
  const cliente = mercado.slice(0, 3);
  avatares.forEach((a, i) => {
    unir(a, cliente[i % cliente.length], 'Este avatar se define por esto');
    unir(a, cliente[(i + 1) % cliente.length], 'Y también por esto');
  });
  // Y los tres del cliente se tocan entre sí: el deseo es el reverso del dolor, y la
  // objeción es lo que se interpone. No son tres campos sueltos de un formulario.
  for (let i = 1; i < cliente.length; i++) unir(cliente[i - 1], cliente[i], 'Una cosa explica la otra');

  // 3.c La oferta: la promesa, el precio y la garantía se sostienen entre sí — una
  //      garantía sin promesa no dice nada, y el precio se justifica con las dos.
  const ofertaNodos = (hojasDe.get('n1:oferta') ?? []).slice(0, 3);
  for (let i = 1; i < ofertaNodos.length; i++) unir(ofertaNodos[i - 1], ofertaNodos[i], 'Esto sostiene a esto');
  if (ofertaNodos[0] && ofertaNodos[2]) unir(ofertaNodos[2], ofertaNodos[0], 'La garantía respalda la promesa');

  // 3.d El lead magnet es lo que ENTRA gente al funnel, y los documentos son de donde
  //      MaKo saca el panorama. Dos cruces entre pilares distintos.
  const magnet = (hojasDe.get('n1:oferta') ?? []).slice(-1)[0];
  if (magnet && etapas[0]) unir(magnet, etapas[0], 'Esto es lo que trae al lead');
  const docs = (hojasDe.get('n1:negocio') ?? []).slice(3);
  const negocio = (hojasDe.get('n1:negocio') ?? []).slice(0, 3);
  docs.forEach((d, i) => {
    unir(d, negocio[i % negocio.length], 'De aquí salió esto');
    unir(d, negocio[(i + 2) % negocio.length], 'Y también esto');
  });
  for (let i = 1; i < negocio.length; i++) unir(negocio[i - 1], negocio[i], 'Una cosa lleva a la otra');

  // 4. El panorama apunta a los campos que resume — la otra lateral del mapa real.
  const panorama = hojasDe.get('n1:negocio') ?? [];
  if (panorama[0] && oferta) unir(panorama[0], oferta, 'Esto resume tu oferta');
  if (panorama[1] && dolor) unir(panorama[1], dolor, 'Esto resume a tu cliente');

  // 5. Y la raíz: los anuncios salen de la voz, la oferta y el avatar A LA VEZ. Es lo que
  //    hace que el centro sea un cruce y no la punta de un abanico.
  for (const f of FORMATOS) unir('raiz', `fmt:${f}`, 'Tus anuncios se hacen así');
  if (oferta) unir('raiz', oferta, 'Tus anuncios venden esto');
  if (avatares[0]) unir('raiz', avatares[0], 'Tus anuncios le hablan a esto');

  return { nodos, aristas };
}

/** El `Cerebro` completo, ya con las posiciones de d3. Lo llama el server. */
export function cerebroBienvenida(): Cerebro {
  const { nodos, aristas } = grafoBienvenida();
  const { posiciones, encuadre } = layoutCerebro(nodos, aristas);
  return {
    negocio: 'Tu negocio',
    nodos,
    aristas,
    // El chip de conteos lee esto. Todo `mako` porque el mapa es lo que MaKo va a
    // entender; `pendientes: 0` porque acá no hay huecos que reclamar — es una promesa,
    // no un inventario.
    cuenta: { total: nodos.length, mako: nodos.length, usuario: 0, pendientes: 0 },
    vacias: [],
    posiciones,
    encuadre,
  };
}
