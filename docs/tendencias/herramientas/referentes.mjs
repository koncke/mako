// La lista de referentes por sector (21/11/2026). Fuente única: de acá salen referentes.json (para el chat Spy) y la tabla de
// docs/tendencias/referentes.md. datos: 'bajado' = ya en C:/dev/referentes-videos · 'spy-prod' = spy_piezas de producción con
// vistas y comentarios de los últimos 90 días · 'bajar' = falta todo. fuente: k = curso de Knowledge · m = los 32 de MaKo ·
// l = tus links · s = Spy · w = web (agentes, 21/11).
import fs from 'node:fs';
const R = {
  ramiro: ['Ramiro Cubría', 'ramiro.cubria', null, 'bajado', 'm k', 'su @RamiroCubria de YouTube está parado desde 2022'],
  otalora: ['Julián Otálora', 'marketing.julian', null, 'bajar', 'm k', 'YouTube parado desde 06/2025; @julianotalora es un homónimo'],
  sere: ['Gonzalo Seré', 'gonzalosere', '@gonzalosere', 'bajar', 'm k', ''],
  fukuda: ['Ximena Fukuda', 'ximenafukuda', null, 'bajar', 'm k', 'YouTube sin @ confirmado'],
  denborg: ['Den Borg', 'den.borgg', '@DenBorgMarketing', 'spy-prod', 's', 'la web dice que la principal es denborg.marketing (~68 mil)'],
  landa: ['Andy Landa', 'instacoachandy', null, 'bajar', 'm k', 'YouTube parado desde 07/2026'],
  clavellinas: ['Ana Clavellinas', 'unbuenmarketing', null, 'bajar', 'k', ''],
  vilma: ['Vilma Núñez', 'vilmanunez', '@vilmanunez', 'spy-prod', 'm k s', 'también vilma.ai'],
  melisa: ['Melisa Escobar', 'melisaescobart', '@melisaescobart', 'bajar', 'k', ''],
  puigrredon: ['Emilio Puigrredón', null, '@EmilioPuigrredon', 'bajar', 'm k', 'Instagram sin encontrar'],
  collado: ['Guille Collado', 'guille.colladomk', null, 'bajado', 'm k', 'YouTube parado desde 03/2025'],
  victor: ['Víctor Heras / Heras Media', 'victorherasemprendedor', '@Victorherasmedia', 'bajado', 'm k s', 'y herasmedia (también en el Spy de producción)'],
  alborna: ['Julián Alborná', 'julianealborna', null, 'bajar', 'm k', '~3 M; ojo con revendedores de su curso'],
  segues: ['Jordi Segués', 'thejordisegues', '@JordiSegues', 'bajar', 'm k', 'jordi.segues y jordisegues son otros'],
  maffia: ['Mateo Maffia', 'mateomaffia', '@mateomaffia', 'bajar', 'm k', ''],
  begueria: ['Sergio Beguería', 'sergiobegueria', null, 'bajar', 'm k', 'YouTube de 2,46 M sin @ confirmado'],
  iero: ['Julio Iero', 'julioiero', null, 'spy-prod', 's', ''],
  zapater: ['Manuel Zapater', 'manuelzapater', null, 'bajar', 'l', 'animado viral de tus links'],
  doglio: ['Francisco Doglio', 'franciscodoglio', '@FranciscoDoglio', 'bajado', 'm k', ''],
  juanads: ['Juan ADS (Juan Osorio)', 'juan_adss', '@JuanADS', 'bajar', 'm k', 'instagram.com/juanads es otro (privado)'],
  vergara: ['Felipe Vergara', 'felipeverce', '@FelipeVergara', 'bajar', 'm k', ''],
  netlab: ['The Net Lab', 'thenet.lab', '@the.netlab', 'bajar', 'k l', ''],
  conde: ['Claudio Conde (100ads)', 'condeclaudioad', '@condeclaudioad', 'bajar', 'k', ''],
  carodubi: ['Caro Dubi', 'carodubi', '@carolinadubi', 'bajar', 'w', 'el vínculo IG–YouTube sale del nombre'],
  barbosa: ['Camilo Barbosa (Master Ads)', 'camilobarbosatv', '@Camilobarbosatv', 'bajar', 'w', ''],
  saleads: ['SaleADS', 'saleads.ai', null, 'bajar', 'l', 'competidor directo de MaKo'],
  agenciatech: ['Agencia Tech', 'agenciatech__', null, 'bajar', 'l', ''],
  dakota: ['Dakota Hermes (inglés)', 'dakota.hermes', null, 'bajado', 'l', ''],
  nievas: ['Agustín Nievas', 'agus.nievas', null, 'bajar', 'm k', 'y growing.setters; YouTube parado desde 03/2025'],
  alba: ['Samuel Alba', 'samuelalbaa', '@SamuelAlbaa', 'bajar', 'm k', ''],
  bianchi: ['Augusto Bianchi', 'soyaugustobianchi', null, 'bajar', 'm k', 'y academiafivestars'],
  mossu: ['Tino Mossu', 'tino_.mossu', null, 'bajar', 'm k', 'tino.mossu02 NO es él'],
  alfonsochristian: ['Alfonso y Christian', null, '@AlfonsoyChristian', 'bajar', 'k', 'Instagram por buscar'],
  klaric: ['Jürgen Klaric', 'jurgenklaric', null, 'bajar', 'w', 'neuroventas'],
  cole: ['Cole Gordon (inglés)', 'colethomasgordon', '@colethomasgordon', 'spy-prod', 's', 'sólo YouTube en el Spy'],
  miner: ['Jeremy Miner (inglés)', 'jeremyleeminer', '@jeremyminer', 'spy-prod', 's', 'sólo YouTube en el Spy'],
  sola: ['Adrià Solà Pastor', 'adriasolapastor', null, 'bajar', 'm k', 'comunicación'],
  jasp: ['Raúl Ordóñez', 'jaspeante', '@jasp', 'bajar', 'w', ''],
  arca: ['Arca Artificial (Lordwind Enrique)', 'arcaartificial', '@ArcaArtificial', 'bajar', 'w', ''],
  nafta: ['Jan Nafta', 'jannafta', '@JanNafta', 'bajar', 'k', 'YouTube casi parado (1 en 90 días)'],
  tiago: ['Tiago Lemos', 'tiagolemosx', null, 'bajar', 'l', ''],
  siciliano: ['Santi Siciliano', 'santi.siciliano', null, 'bajar', 'l', ''],
  fabricantes: ['Fabricantes Chinos (EDIT IA PRO)', 'fabricanteschinos', null, 'bajar', 'l', ''],
  nxt: ['Diego NXT', 'diego.nxt', '@diegonxt', 'bajar', 'k l', ''],
  saisanti: ['Sai & Santi', null, '@SaiSantiMarketing', 'bajar', 'w', 'IA para coaches; Instagram por buscar'],
  greggi: ['Mariano Greggi', null, '@marianogreggi', 'bajar', 'w', 'Instagram por buscar'],
  cherry: ['Cherry Studio', 'cherrystudio.app', null, 'bajar', 'l', ''],
  samuauren: ['Samu Auren', 'samuauren', null, 'bajar', 'l', ''],
  growithalex: ['Grow with Alex (inglés)', 'growithalex', null, 'bajar', 'l', 'y doagenticly'],
  gorriz: ['Eric Górriz', 'ericgorriz_', null, 'bajar', 'l', 'YouTube sin videos recientes'],
  cordero: ['Benjamín Cordero', 'bencorde', '@bencord', 'bajar', 'l w', ''],
  medina: ['Agustín Medina', 'agustinmedinaia', '@agustinmedinaIA', 'bajar', 'k', ''],
  josema: ['Josema Fernández', null, '@josemafernandezia', 'bajar', 'k', 'Instagram por buscar'],
  ayesa: ['Valentín Ayesa (VA360)', 'valentin_ayesa', '@va360-valen', 'bajar', 'w', ''],
  santaia: ['Santa IA', 'santaia.lab', null, 'bajar', 'l', '«los CRM murieron»'],
  curiosfer: ['curiosfer', 'curiosfer', null, 'bajar', 'l', ''],
  vazquez: ['Eduardo Vázquez', 'eduardovazquez.ia', '@eduardovazquez-ia', 'bajar', 'k', ''],
  portilla: ['Roco de la Portilla', 'rocodelaportilla', null, 'bajar', 'k', '~1 M'],
  jonh: ['Jon Hernández', 'jonhernandezia', null, 'bajar', 'w', 'más noticias que agentes'],
  eloisa: ['Eloisa Wolf', 'eloisawolfmarketing', '@EloisaWolf', 'bajar', 'k', ''],
  cabrera: ['Diego Cabrera', 'diegocabrera22___', '@diegocabrera22', 'bajar', 'w', ''],
  veloz: ['Veloz Redes', null, '@VelozRedes', 'bajar', 'k', 'Instagram por buscar'],
  mari: ['Mari Fuentes', 'mari.rfuentes', '@MariFuentes', 'bajar', 'k', ''],
  carlotta: ['Carlotta Sabina', 'carlotta_sabina', null, 'bajar', 'k w', 'hay 4 cuentas parecidas: confirmar la oficial'],
  chamizo: ['Derek Chamizo', 'youtubemillonario', '@derekchamizo', 'bajar', 'm k', 'YouTube casi parado (2 en 90 días)'],
  fons: ['Romuald Fons', 'romualdfons', '@RomualdFonsTV', 'bajar', 'm k', ''],
  basi: ['Marc Basi (MasterTube)', 'marcbasi_', null, 'bajar', 'w', ''],
  higuera: ['Jaime Higuera', 'jaimehigueraes', '@JaimeHigueraEspanol', 'bajar', 'm k', ''],
  carrizo: ['Juan Carrizo', 'juanxcarrizo', '@Juan_carrizo', 'bajado', 'm k', ''],
  razzetti: ['Marcos Razzetti', 'marcosrazzetti', '@MarcosRazzettii', 'bajar', 'm k', 'IG restringido; empresa bluehackmediagroup'],
  sofia: ['Sofía Contreras', 'soysofiacontreras', '@SofiaContreras', 'spy-prod', 'm k s', 'el IG del Spy (sofiacontreras, 529) es un homónimo: falta su IG'],
  cristofari: ['Federico Cristofari', 'fedecristofari', '@federicocristofari', 'spy-prod', 's', ''],
  hormozi: ['Alex Hormozi (inglés)', 'hormozi', '@AlexHormozi', 'bajado', 'm k s', ''],
  leila: ['Leila Hormozi (inglés)', 'leilahormozi', '@leilahormozi', 'spy-prod', 's', ''],
  iman: ['Iman Gadzhi (inglés)', 'imangadzhi', '@ImanGadzhi', 'bajar', 'm k', ''],
  turu: ['David Turu', 'davituru', null, 'bajar', 'm k', 'davidturu es otro; YouTube parado desde 05/2026'],
  luque: ['Álvaro Luque', 'alvaroluque.co', '@AlvaroLuque', 'bajar', 'm k', ''],
  spisso: ['Sebas Spisso', 'sebasspisso', null, 'bajar', 'w', ''],
  araujo: ['Marcos Araujo', 'marcosaraujocu', null, 'bajar', 'w', 'Hotmart'],
  lenieil: ['Lenieil Arana', 'lenieil', '@lenieil', 'bajar', 'w', ''],
  ironback: ['Christopher Ironback', 'christopher.ironback', null, 'bajar', 'l', '8 cursos a 1 dólar'],
  atom: ['Proyecto Atom', 'proyecto_atom', null, 'bajar', 'l', ''],
  espiad: ['Espiad', 'espiad.app', null, 'bajar', 'l', ''],
  wendt: ['Maria Wendt (inglés)', 'maria.wendt', '@mariawendt', 'spy-prod', 's l', 'sólo YouTube en el Spy'],
  titto: ['Titto Gálvez', 'tittogalvez', '@tittogalvez', 'spy-prod', 's', ''],
  serratos: ['Jorge Serratos', 'jorgeserratosf', null, 'bajar', 'w', ''],
  iriondo: ['Javier Iriondo', 'jiriondo1', null, 'bajar', 'w', ''],
  valentina: ['Valentina Ortiz', 'academiamav', '@Valentinaortizf', 'bajar', 'k', ''],
  peer: ['Marisa Peer (inglés)', 'marisapeertherapy', '@marisapeer', 'spy-prod', 's', 'sólo YouTube en el Spy'],
};
const SECTORES = {
  'Orgánico de nicho': ['ramiro', 'otalora', 'sere', 'fukuda', 'denborg', 'landa', 'clavellinas', 'vilma', 'melisa', 'puigrredon'],
  'Orgánico viral': ['collado', 'victor', 'alborna', 'segues', 'maffia', 'begueria', 'iero', 'zapater', 'doglio'],
  'Anuncios': ['juanads', 'vergara', 'netlab', 'conde', 'carodubi', 'barbosa', 'saleads', 'agenciatech', 'dakota', 'ramiro'],
  'Closing y ventas': ['nievas', 'alba', 'bianchi', 'mossu', 'alfonsochristian', 'doglio', 'klaric', 'sola', 'cole', 'miner'],
  'IA · Edición con IA': ['jasp', 'arca', 'nafta', 'tiago', 'siciliano', 'fabricantes', 'nxt'],
  'IA · Carruseles con IA': ['saisanti', 'greggi', 'cherry', 'samuauren', 'growithalex'],
  'IA · Agentes y setters con IA': ['gorriz', 'cordero', 'medina', 'josema', 'ayesa', 'santaia', 'curiosfer', 'vazquez', 'portilla', 'jonh'],
  'YouTube': ['eloisa', 'cabrera', 'veloz', 'mari', 'carlotta', 'chamizo', 'fons', 'basi', 'higuera'],
  'High ticket': ['ramiro', 'carrizo', 'doglio', 'razzetti', 'higuera', 'sofia', 'cristofari', 'hormozi', 'leila', 'iman'],
  'Low ticket': ['turu', 'luque', 'spisso', 'araujo', 'lenieil', 'ironback', 'atom', 'espiad', 'wendt'],
  // Operaciones y Lifestyle (Martín, 21/11): los de la lista que ya hablan de esto; los nuevos llegan por referentes-extra.json.
  'Operaciones': ['leila', 'sofia', 'carrizo', 'doglio', 'hormozi'],
  'Lifestyle': ['carrizo', 'titto', 'iero', 'iman', 'collado'],
  'Mentalidad y coaching': ['sofia', 'titto', 'serratos', 'klaric', 'iriondo', 'sola', 'valentina', 'peer'],
};
// La ronda 2 (21/11, agentes por sector): C:/dev/tendencias/referentes-extra.json, [{clave, nombre, instagram, youtube, sectores, nota}].
const EXTRA = 'C:/dev/tendencias/referentes-extra.json';
if (fs.existsSync(EXTRA)) for (const x of JSON.parse(fs.readFileSync(EXTRA, 'utf8'))) {
  if (R[x.clave]) continue;
  R[x.clave] = [x.nombre, x.instagram || null, x.youtube || null, 'bajar', 'w', x.nota || ''];
  for (const s of x.sectores) (SECTORES[s] ||= []).push(x.clave);
}
const sectoresDe = (k) => Object.entries(SECTORES).filter(([, L]) => L.includes(k)).map(([s]) => s);
const lista = Object.entries(R).map(([k, [nombre, ig, yt, datos, fuente, nota]]) => ({ clave: k, nombre, instagram: ig, youtube: yt, datos, fuente, nota, sectores: sectoresDe(k) }));
for (const r of lista) if (!r.sectores.length) throw new Error('sin sector: ' + r.clave);
for (const [s, L] of Object.entries(SECTORES)) for (const k of L) if (!R[k]) throw new Error(`${s}: ${k} no existe`);
fs.writeFileSync('C:/dev/tendencias/referentes.json', JSON.stringify({ fecha: '2026-11-21', sectores: SECTORES, referentes: lista }, null, 1));
const F = { k: 'Knowledge', m: 'MaKo', l: 'tus links', s: 'Spy', w: 'web' };
const D = { bajado: 'ya bajado', 'spy-prod': 'Spy de producción', bajar: 'falta' };
let md = '';
for (const [s, L] of Object.entries(SECTORES)) {
  md += `\n### ${s} (${L.length})\n\n| Referente | Instagram | YouTube | Datos | De dónde | Nota |\n|---|---|---|---|---|---|\n`;
  for (const k of L) {
    const r = lista.find((x) => x.clave === k);
    md += `| ${r.nombre} | ${r.instagram ? '@' + r.instagram : '—'} | ${r.youtube || '—'} | ${D[r.datos]} | ${r.fuente.split(' ').map((x) => F[x]).join(', ')} | ${r.nota} |\n`;
  }
}
const cuenta = (d) => lista.filter((r) => r.datos === d).length;
const resumen = {
  total: lista.length, bajado: cuenta('bajado'), spyProd: cuenta('spy-prod'), bajar: cuenta('bajar'),
  igABajar: lista.filter((r) => r.datos === 'bajar' && r.instagram).length, ytABajar: lista.filter((r) => r.datos === 'bajar' && r.youtube).length,
  sinIg: lista.filter((r) => !r.instagram).map((r) => r.nombre), ingles: lista.filter((r) => /inglés/.test(r.nombre)).length,
};
fs.writeFileSync('C:/dev/tendencias/referentes-tabla.md', md);
console.log(JSON.stringify(resumen, null, 1));
