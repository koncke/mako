// =============================================================================
// Prospectos (Leads Scraper): qué se busca, qué vuelve, cuánto vale y por dónde entra al CRM
// =============================================================================
// docs/diseno-leads-scraper.md §4 y §7. Lo puro se EJECUTA (lib/prospectos-reglas.ts); el cableado
// se lee del fuente (los módulos con server-only no se importan bajo `npm test`).
//
// Los resultados de abajo tienen la forma de la página de cada actor de Apify (consultadas el
// 15/10/2026: compass/crawler-google-places y apify/instagram-search-scraper), con datos inventados.
//
// Probado rompiéndolo (15/10/2026), una rotura por vez y restaurando desde memoria (nunca con
// `git checkout --`). Cada una dio 12 pasan / 1 falla: el teléfono pesando menos que el tamaño; Maps
// sin `scrapeContacts`; un lugar cerrado entrando; `ignoreDuplicates: false`; sin el compare-and-set
// de `lista` (la primera versión del guard dio 13 / 0: su regex llegaba hasta la función de al lado);
// cualquier rol buscando; el aviso sin la prueba de la clave; y las tablas fuera de TENANT_TABLES.
// Restaurado: 13 / 0.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  contactable, inputDelActor, leerResultados, parametrosDeBusqueda, prospectoDeGoogleMaps, prospectoDeInstagram,
  puntuar, rotuloDeBusqueda, techoUsd, usuarioDeInstagram, type ProspectoNuevo,
} from '../lib/prospectos-reglas';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const LUGAR = {
  title: 'Inmobiliaria Pérez', categoryName: 'Agencia inmobiliaria', address: 'Av. Revolución 100', city: 'Tijuana',
  countryCode: 'MX', phone: '+52 664 123 4567', phoneUnformatted: '+526641234567', website: 'https://inmoperez.example.com/',
  totalScore: 4.6, reviewsCount: 87, placeId: 'ChIJ_ejemplo_1', url: 'https://www.google.com/maps/place/?q=place_id:ChIJ_ejemplo_1',
  permanentlyClosed: false, emails: ['contacto@inmoperez.example.com'], instagrams: ['https://www.instagram.com/inmoperez/'],
};

const PERFIL = {
  username: 'Coach.Ana', fullName: 'Ana Coach de Negocios', biography: 'Ayudo a dueños a escalar. ✉️ ana@example.com · WhatsApp +52 664 765 4321',
  externalUrl: 'https://ana.example.com', followersCount: 12500, postsCount: 340, isBusinessAccount: true,
  businessCategoryName: 'Coach', private: false, verified: false,
};

test('los parámetros: qué, dónde (sólo en Maps) y una cantidad de la lista', () => {
  assert.deepEqual(parametrosDeBusqueda({ fuente: 'google_maps', que: ' inmobiliarias ', donde: 'Tijuana', cuantos: '100' }),
    { fuente: 'google_maps', que: 'inmobiliarias', donde: 'Tijuana', cuantos: 100 });
  assert.ok('error' in parametrosDeBusqueda({ fuente: 'google_maps', que: 'inmobiliarias', cuantos: 100 }), 'Maps sin «dónde» no busca');
  assert.deepEqual(parametrosDeBusqueda({ fuente: 'instagram', que: 'coach', donde: 'Tijuana', cuantos: 50 }),
    { fuente: 'instagram', que: 'coach', donde: null, cuantos: 50 }, 'Instagram no usa «dónde»');
  for (const malo of [{ fuente: 'linkedin', que: 'x', cuantos: 50 }, { fuente: 'instagram', que: 'x', cuantos: 50 }, { fuente: 'instagram', que: 'coach', cuantos: 77 }, null]) {
    assert.ok('error' in parametrosDeBusqueda(malo), `aceptó ${JSON.stringify(malo)}`);
  }
});

test('el techo de plata sube con la cantidad y nunca es cero', () => {
  assert.equal(techoUsd({ fuente: 'google_maps', cuantos: 100 }), 0.4);
  assert.equal(techoUsd({ fuente: 'google_maps', cuantos: 500 }), 2);
  assert.ok(techoUsd({ fuente: 'instagram', cuantos: 25 }) >= 0.1);
  assert.equal(rotuloDeBusqueda({ fuente: 'google_maps', que: 'inmobiliarias', donde: 'Tijuana', cuantos: 100 }), 'Google Maps · inmobiliarias en Tijuana · 100');
});

test('el input de cada actor: Maps con contactos de la web; Instagram por perfiles, topeado en 250', () => {
  const maps = inputDelActor({ fuente: 'google_maps', que: 'dentistas', donde: 'Monterrey', cuantos: 250 });
  assert.deepEqual(maps.searchStringsArray, ['dentistas']);
  assert.equal(maps.locationQuery, 'Monterrey');
  assert.equal(maps.maxCrawledPlacesPerSearch, 250);
  assert.equal(maps.scrapeContacts, true, 'sin los contactos de la web, un negocio local casi nunca trae email');
  const ig = inputDelActor({ fuente: 'instagram', que: 'coach', donde: null, cuantos: 500 });
  assert.equal(ig.searchType, 'user');
  assert.equal(ig.searchLimit, 250);
});

test('un lugar de Google Maps: contacto, web, Instagram y tamaño', () => {
  const p = prospectoDeGoogleMaps(LUGAR)!;
  assert.equal(p.id_externo, 'ChIJ_ejemplo_1');
  assert.equal(p.nombre, 'Inmobiliaria Pérez');
  assert.equal(p.telefono, '+526641234567');
  assert.equal(p.email, 'contacto@inmoperez.example.com');
  assert.equal(p.instagram, 'inmoperez');
  assert.equal(p.rubro, 'Agencia inmobiliaria');
  assert.deepEqual({ resenas: p.datos.resenas, rating: p.datos.rating }, { resenas: 87, rating: 4.6 });
  assert.equal(prospectoDeGoogleMaps({ ...LUGAR, permanentlyClosed: true }), null, 'un lugar cerrado no es un prospecto');
  assert.equal(prospectoDeGoogleMaps({ ...LUGAR, placeId: '' }), null, 'sin id no se puede deduplicar');
  // El email puede venir como objetos `{ value }` (el `impressum`), no sólo como textos.
  assert.equal(prospectoDeGoogleMaps({ ...LUGAR, emails: undefined, impressum: { emails: [{ value: 'hola@x.example.com', type: 'email' }] } })!.email, 'hola@x.example.com');
});

test('un perfil de Instagram: el contacto sólo sale de la bio, y el @ se normaliza', () => {
  const p = prospectoDeInstagram(PERFIL)!;
  assert.equal(p.id_externo, 'coach.ana');
  assert.equal(p.instagram, 'coach.ana');
  assert.equal(p.email, 'ana@example.com');
  assert.equal(p.telefono, '+526647654321');
  assert.equal(p.datos.seguidores, 12500);
  assert.equal(prospectoDeInstagram({ ...PERFIL, biography: 'Sin contacto acá' })!.email, null);
  assert.equal(usuarioDeInstagram('https://www.instagram.com/p/AbC123/'), null, 'un link a un post no es un usuario');
  assert.equal(usuarioDeInstagram('@Ana_Coach'), 'ana_coach');
});

test('el dataset entero: lo que no sirve se CUENTA, y un repetido no entra dos veces', () => {
  const r = leerResultados('google_maps', [LUGAR, { ...LUGAR }, { ...LUGAR, permanentlyClosed: true }, 'basura', null]);
  assert.equal(r.prospectos.length, 1);
  assert.equal(r.descartados, 4);
});

test('el puntaje: el contacto MANDA, y cada punto dice por qué', () => {
  const lugar = prospectoDeGoogleMaps(LUGAR)!;
  const r = puntuar(lugar);
  assert.equal(r.puntaje, 100, 'teléfono 35 + email 35 + web 10 + Instagram 5 + 87 reseñas 10 + 4,6 estrellas 5');
  assert.equal(r.razon, 'Tiene teléfono, tiene email, tiene web, tiene Instagram, 87 reseñas, 4,6 estrellas.');
  // El peor contactable (sólo un email, nada más) le gana al mejor NO contactable (todo menos el contacto).
  const peorContactable: ProspectoNuevo = { ...lugar, telefono: null, web: null, instagram: null, datos: {} };
  const mejorSinContacto: ProspectoNuevo = { ...lugar, telefono: null, email: null };
  assert.ok(puntuar(peorContactable).puntaje > puntuar(mejorSinContacto).puntaje,
    `uno sin contacto (${puntuar(mejorSinContacto).puntaje}) quedó arriba de uno que se puede llamar (${puntuar(peorContactable).puntaje})`);
  const igSinContacto = prospectoDeInstagram({ ...PERFIL, biography: 'Sin contacto' })!;
  assert.ok(puntuar(peorContactable).puntaje > puntuar(igSinContacto).puntaje, 'lo mismo en Instagram');
  assert.equal(puntuar({ ...lugar, datos: {}, telefono: null, email: null, web: null, instagram: null }).puntaje, 0);
  const privado = prospectoDeInstagram({ ...PERFIL, private: true })!;
  assert.ok(puntuar(privado).puntaje < puntuar(prospectoDeInstagram(PERFIL)!).puntaje, 'una cuenta privada vale menos');
  assert.ok(puntuar(prospectoDeInstagram(PERFIL)!).puntaje <= 100);
});

test('se puede pasar al CRM sólo con email o teléfono (la regla del importador)', () => {
  assert.equal(contactable({ email: 'a@b.co', telefono: null }), true);
  assert.equal(contactable({ email: null, telefono: '123' }), true);
  assert.equal(contactable({ email: null, telefono: null }), false);
});

// ── El cableado ──────────────────────────────────────────────────────────────

test('pasar al CRM entra por el importador: no hay una segunda puerta de leads', () => {
  const lib = sinComentarios(leer('../lib/prospectos.ts'));
  assert.ok(!/\.from\(['"]leads['"]\)/.test(lib), 'lib/prospectos.ts escribe leads por su cuenta');
  assert.ok(!/createLead\(/.test(lib), 'lib/prospectos.ts da de alta por fuera del importador');
  assert.match(lib, /const r = await importar\(filas, funnelId\)/);
  const acciones = sinComentarios(leer('../app/crm/prospectos/actions.ts'));
  assert.match(acciones, /pasarAlCrm\([^;]*?, importarLeadsRevisadosAction\)/, 'la acción tiene que inyectar la MISMA puerta del CSV');
  for (const prohibido of ['setPipelineStage(', 'enrolarPorEvento(', 'sendText', 'sendEmail(', 'dispararEvento(']) {
    assert.ok(!lib.includes(prohibido), `lib/prospectos.ts llama a ${prohibido}: el scraper termina cuando el lead entra (§6)`);
  }
});

test('buscar cuesta plata: sólo un admin, con techo, y la key del negocio', () => {
  const acciones = sinComentarios(leer('../app/crm/prospectos/actions.ts'));
  assert.match(acciones, /if \(rol !== 'admin'\) return \{ ok: false/);
  const lib = sinComentarios(leer('../lib/prospectos.ts'));
  assert.match(lib, /credWs\('APIFY_TOKEN', ws\)/);
  assert.match(lib, /\{ maxItems: p\.cuantos, maxUsd: techo \}/, 'sin el techo, una corrida puede cobrar de más en la cuenta del negocio');
  assert.match(lib, /clave_hash: hashDeRuteo\(clave\)/, 'la búsqueda guarda el hash de la clave, nunca la clave');
});

test('traer los resultados dos veces no duplica ni pisa el conteo', () => {
  const lib = sinComentarios(leer('../lib/prospectos.ts'));
  assert.match(lib, /onConflict: 'workspace_id,fuente,id_externo', ignoreDuplicates: true/);
  // El bloque es la escritura de `lista` hasta su `return`: con la regex suelta, el `.eq` de la
  // función de al lado (revisarPendientes) la dejaba en verde sin el compare-and-set (medido).
  const ini = lib.indexOf(".update({ estado: 'lista'");
  const bloque = lib.slice(ini, lib.indexOf("return { estado: 'lista'", ini));
  assert.ok(ini > 0 && bloque.length < 300, `el recorte de la escritura de «lista» mide ${bloque.length}: mira otra cosa`);
  assert.match(bloque, /\.eq\('estado', 'corriendo'\)/, 'sin el compare-and-set, el segundo pisa «nuevos» con 0');
});

test('el aviso de Apify: búsqueda estricta, el hash de la clave, y adentro de su workspace', () => {
  const src = sinComentarios(leer('../app/api/webhooks/apify/route.ts'));
  assert.match(src, /if \(error\) return fallo\('ruteo'/, '«no pude leer» la búsqueda no es «no existe»');
  assert.match(src, /if \(!fila \|\| !claveCoincide\(clave, fila\.clave_hash\)\)/);
  assert.match(src, /timingSafeEqual\(/);
  assert.match(src, /credWsEstricta\('APIFY_TOKEN', ws\)/);
  assert.match(src, /runWithWorkspace\(ws, \(\) => procesarBusqueda\(fila, key\)\)/);
});

test('las tablas nuevas son de inquilino en los dos registros', () => {
  const ws = leer('../lib/workspace.ts');
  const inquilino = leer('../lib/tablas-de-inquilino.ts');
  for (const t of ['prospeccion_busquedas', 'prospectos']) {
    assert.match(ws, new RegExp(`'${t}'`), `${t} falta en TENANT_TABLES: getTenantDb sería PASSTHROUGH`);
    assert.match(inquilino, new RegExp(`'${t}'`), `${t} falta en TABLAS_DE_INQUILINO: el reset no la vacía`);
  }
  const mig = leer('../supabase/migrations/0289_prospectos.sql');
  assert.match(mig, /revoke all on prospeccion_busquedas from anon, authenticated;/);
  assert.match(mig, /revoke all on prospectos from anon, authenticated;/);
  assert.match(mig, /create unique index if not exists prospectos_uk on prospectos \(workspace_id, fuente, id_externo\);/);
});
