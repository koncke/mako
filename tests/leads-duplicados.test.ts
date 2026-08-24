// =============================================================================
// Anti-duplicado de leads: comparar bien, avisar siempre, no decidir por nadie
// =============================================================================
// Tres reglas del pedido, y el repo no cumplía ninguna pareja: `createLead()` no
// chequeaba nada, los webhooks mergeaban en silencio, el importador descartaba
// el duplicado AUNQUE lo tildaras, y nadie comparaba por nombre.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarDuplicados, emailComparable, esLeadDuplicado, LeadDuplicadoError,
  nombreComparable, telefonoComparable, textoDuplicado, type LeadExistente,
} from '../lib/leads-duplicados';

const L = (id: number, nombre: string | null, email: string | null, tel: string | null): LeadExistente =>
  ({ id, nombre, email, telefono_normalizado: tel });

test('el mismo número escrito distinto es el mismo número', () => {
  // La forma más común de que un duplicado se cuele: uno lo carga desde WhatsApp
  // con código de país y el otro lo tipea sin él.
  for (const v of ['+52 998 136 1529', '9981361529', '52-998-136-1529', '(998) 136 1529']) {
    assert.equal(telefonoComparable(v), '9981361529', `«${v}» tendría que comparar igual`);
  }
  assert.equal(telefonoComparable('123'), null, 'demasiado corto para ser un teléfono');
  assert.equal(telefonoComparable(null), null);
});

test('el nombre compara sin acentos y SIN IMPORTAR EL ORDEN', () => {
  // «Hurtado Gabriela» y «Gabriela Hurtado» son la misma persona, y así es como
  // llega el mismo contacto desde un formulario y desde una agenda.
  assert.equal(nombreComparable('Gabriela Hurtado'), nombreComparable('Hurtado Gabriela'));
  assert.equal(nombreComparable('José Pérez'), nombreComparable('jose perez'));
  assert.equal(nombreComparable('Ana  María   López'), nombreComparable('lopez ana maria'));
  // Las partículas aparecen y desaparecen según quién escriba.
  assert.equal(nombreComparable('Juan de la Cruz'), nombreComparable('Juan Cruz'));
  assert.equal(nombreComparable('  '), null);
  assert.notEqual(nombreComparable('Ana López'), nombreComparable('Ana Pérez'));
});

test('el email compara en minúsculas, y el +alias NO se toca', () => {
  assert.equal(emailComparable('  Hola@Mail.COM '), 'hola@mail.com');
  assert.equal(emailComparable('no-es-un-email'), null, 'sin arroba no es un email');
  // Para Gmail `a+x@` y `a@` son la misma casilla, pero para otros proveedores NO
  // lo son. Fundirlos uniría dos personas distintas, que es el error caro.
  assert.notEqual(emailComparable('a+uno@dominio.com'), emailComparable('a@dominio.com'));
});

test('encuentra por email, por teléfono y por nombre', () => {
  const base = [L(1, 'Ana López', 'ana@x.com', '9981361529'), L(2, 'Otro', 'otro@x.com', '1112223333')];
  assert.equal(buscarDuplicados({ email: 'ANA@x.com' }, base)[0]?.motivo, 'email');
  assert.equal(buscarDuplicados({ telefono: '+52 998 136 1529' }, base)[0]?.motivo, 'telefono');
  assert.equal(buscarDuplicados({ nombre: 'lopez ana' }, base)[0]?.motivo, 'nombre');
  assert.deepEqual(buscarDuplicados({ email: 'nadie@x.com', telefono: '5550000000' }, base), []);
});

// ⚠️ LA REGLA QUE MÁS FALSOS POSITIVOS EVITA. Dos «Juan Pérez» son dos personas
// distintas mucho más seguido que dos veces el mismo teléfono. Si hay un dato
// fuerte, ese manda; el nombre solo entra cuando no hay con qué comparar mejor.
test('el nombre solo cuenta si NO hay email ni teléfono', () => {
  const base = [L(1, 'Juan Pérez', 'juan1@x.com', '1111111111')];
  // Con teléfono propio y distinto: es OTRO Juan Pérez, y no se avisa.
  assert.deepEqual(buscarDuplicados({ nombre: 'Juan Perez', telefono: '9999999999' }, base), []);
  assert.deepEqual(buscarDuplicados({ nombre: 'Juan Perez', email: 'juan2@x.com' }, base), []);
  // Sin ningún dato fuerte, el nombre es lo único que hay.
  assert.equal(buscarDuplicados({ nombre: 'Juan Perez' }, base).length, 1);
});

test('devuelve TODAS las coincidencias, no la primera', () => {
  // Con dos parecidos, decir «hay uno» y mostrar uno hace que la persona confirme
  // creyendo que revisó todo.
  const base = [L(1, 'Ana', 'ana@x.com', '1111111111'), L(2, 'Ana B', 'ana@x.com', '2222222222')];
  assert.equal(buscarDuplicados({ email: 'ana@x.com' }, base).length, 2);
  // Y un mismo lead no se cuenta dos veces aunque coincida por email Y teléfono.
  const uno = [L(1, 'Ana', 'ana@x.com', '1111111111')];
  assert.equal(buscarDuplicados({ email: 'ana@x.com', telefono: '1111111111' }, uno).length, 1);
});

test('el aviso lo escribe el CÓDIGO y nombra a quién ya tenés', () => {
  // Acá viajan un nombre y un teléfono exactos; un dato exacto que pasa por un
  // modelo deja de serlo.
  const cs = buscarDuplicados({ email: 'ana@x.com' }, [L(1, 'Ana López', 'ana@x.com', null)]);
  assert.match(textoDuplicado(cs), /Ana López/);
  assert.match(textoDuplicado(cs), /email/);
  assert.equal(textoDuplicado([]), '', 'sin coincidencias no hay nada que decir');
  const dos = buscarDuplicados({ email: 'a@x.com' }, [L(1, 'A', 'a@x.com', null), L(2, 'B', 'a@x.com', null)]);
  assert.match(textoDuplicado(dos), /y 1 más/);
});

test('el error lleva las coincidencias, no solo un mensaje', () => {
  // Sin los ids, la pantalla no puede ofrecer «abrí el que ya tenés», que es lo
  // primero que uno quiere hacer.
  const cs = buscarDuplicados({ email: 'ana@x.com' }, [L(7, 'Ana', 'ana@x.com', null)]);
  const e = new LeadDuplicadoError(cs);
  assert.ok(esLeadDuplicado(e));
  assert.equal(e.coincidencias[0].lead.id, 7);
  assert.match(e.message, /Ana/);
  assert.ok(!esLeadDuplicado(new Error('otra cosa')));
});

// =============================================================================
// CABLEADO — que el chequeo exista no es que alguien lo llame
// =============================================================================
import { readFileSync } from 'node:fs';
const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('CABLEADO: createLead avisa en vez de insertar a ciegas', () => {
  // Era el agujero más grande del mapa: `createLead()` no chequeaba NADA, y por
  // ahí pasan el alta manual de /crm/new, el alta desde una conversación de
  // WhatsApp, la importación de archivos y la confirmación de propuestas.
  const leads = leer('../lib/leads.ts');
  assert.ok(/if \(!input\.permitirDuplicado\)/.test(leads), 'el alta tiene que poder frenarse ante un duplicado');
  assert.ok(/throw new LeadDuplicadoError\(dup\)/.test(leads), 'tiene que AVISAR con las coincidencias, no devolver un booleano');
  assert.ok(/export async function duplicadosDeLead/.test(leads), 'falta el buscador contra la base');
  // ⚠️ Si no se puede comprobar, NO se bloquea el alta. Degradar hacia «no dejo
  // entrar a nadie» por una consulta caída pierde clientes reales — es el
  // fallback más fuerte que el camino feliz, que este repo ya pagó una vez.
  const i = leads.indexOf('export async function duplicadosDeLead');
  assert.ok(/catch \(e\) \{[\s\S]{0,400}return \[\]/.test(leads.slice(i, i + 2200)), 'una consulta caída no puede bloquear el alta');

  // Y tildar un duplicado en el importador ahora SIRVE: antes se descartaba
  // igual, o sea que la pantalla ofrecía un tilde que no hacía nada.
  const acciones = leer('../app/crm/actions.ts');
  assert.ok(/permitirDuplicado: duplicado/.test(acciones), 'el tilde de la persona es la autorización');
  assert.ok(!/if \(!f\.incluir \|\| f\.motivo \|\| chocaAcá\)/.test(acciones), 'volvió el descarte del duplicado tildado');
});

test('CABLEADO: un webhook que FUSIONA dos contactos lo avisa', () => {
  // ⚠️ Meta y Calendly matchean por teléfono o email y hacen `update` sobre el
  // lead que ya estaba. Eso está BIEN —es la misma persona volviendo, y crear una
  // tarjeta nueva partiría su historial en dos— pero pasaba en absoluto SILENCIO.
  // Y un match por teléfono puede equivocarse: dos personas de la misma empresa
  // con el número de la recepción, o un número que la operadora recicló. Ahí el
  // segundo se escribe ENCIMA del primero y no queda rastro.
  const leads = leer('../lib/leads.ts');
  assert.ok(/async function avisarFusion/.test(leads), 'una fusión silenciosa no se puede revisar');
  assert.ok(/avisarFusion\('Meta'/.test(leads), 'el webhook de Meta fusiona sin avisar');
  // ⚠️ El canal ya no es un literal: desde que hay DOS agendas (Calendly y
  // Cal.com) el aviso nombra la que de verdad trajo al lead — decirle «Calendly»
  // a quien usa Cal.com es contarle una fusión que nunca ocurrió en esa
  // herramienta. Lo que este test cuida es que la fusión NO SEA SILENCIOSA, y
  // eso se prueba en el punto donde se hace, no en la forma del argumento.
  const upsertAgenda = leads.slice(leads.indexOf('export async function upsertLeadFromCalendly'));
  assert.ok(/avisarFusion\(/.test(upsertAgenda), 'el webhook de agenda fusiona sin avisar');
  assert.ok(/'Cal\.com' : 'Calendly'/.test(leads), 'el aviso tiene que nombrar la agenda real, no siempre Calendly');
  // NO se frena la fusión: frenarla convertiría un webhook —que corre sin nadie
  // mirando— en una cola de decisiones, y el resultado sería el de los ocho leads
  // esperando. Se hace, y se cuenta.
  assert.ok(/dedupTtlMin: 60/.test(leads), 'diez avisos por el mismo patrón se leen como ruido y se silencian');
  const i = leads.indexOf('async function avisarFusion');
  assert.ok(/catch \(e\)/.test(leads.slice(i, i + 1800)), 'el aviso no puede tumbar la ingesta');
  const cat = leer('../lib/avisos-catalogo.ts');
  assert.ok(/id: 'lead-fusionado'/.test(cat), 'falta la ficha del aviso');
  assert.ok(/'lead-fusionado': 'lead'/.test(cat), 'habla de un contacto, no del sistema');
});

test('CABLEADO: el lead de landing nace ATADO a su visita', () => {
  // ⚠️ `visitor_id` estaba en `LeadCreateInput` y NO llegaba al insert. Un lead
  // creado desde la landing nacía sin el identificador de la visita, así que la
  // tab Tracking de su ficha —que se busca POR visitor_id— quedaba vacía: toda la
  // medición existía en la base y no se podía atar a la persona, que es
  // exactamente lo que el tracking existe para hacer.
  const leads = leer('../lib/leads.ts');
  assert.ok(/visitor_id: input\.visitor_id\?\.trim\(\) \|\| null/.test(leads), 'createLead vuelve a tirar el visitor_id');
  assert.ok(/origen_lead: input\.origen_lead\?\.trim\(\) \|\| null/.test(leads), 'sin origen, un lead de landing es indistinguible de uno manual');
  const optin = leer('../app/api/track/optin/route.ts');
  assert.ok(/visitor_id: txt\(body\.visitor_id\)/.test(optin), 'el opt-in tiene el visitor_id y no lo pasa');
});
