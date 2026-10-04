// =============================================================================
// Conectar una integración de webhook tiene que DEJAR UNA FILA DE RUTEO
// =============================================================================
// «Calendly: el cliente conecta, no entra nada y no hay ningún error» — Martín, el
// 01/10/2026 (00:50:03), y su hipótesis en vivo fue «está configurado el Calendly de
// Mauricio y los clientes conectan el suyo y no pasa nada». No era eso.
//
// Un webhook entrante llega SIN sesión, así que lo único que dice de quién es el evento es
// `webhook_routing` (mig 0090), y la fila la escribe el guardado de UNA credencial: las que
// están en `ROUTING_CREDS` (lib/webhook-routing.ts). Los webhooks son fail-CLOSED a
// propósito —sin mapeo no se toca un solo dato, para que la reserva de un cliente no caiga
// en el CRM del dueño—, así que un servicio cuyas claves de ruteo son TODAS opcionales
// deja conectar «bien» y no recibir nada, con un 200 y un `console.warn` que no lee nadie.
//
// Medido contra producción el 04/10/2026: de los 2 workspaces con Calendly conectado, UNO
// (el ws 4) tenía token y signing key y CERO filas de ruteo. El precedente de la casa es
// `FATHOM_HOST_EMAIL`, que dejó de ser opcional exactamente por esto y lo dice en su
// comentario; Calendly y Cal.com se habían quedado atrás.
//
// La regla, EN POSITIVO: cada servicio de ruteo tiene al menos UNA clave que el cliente no
// puede dejar vacía — obligatoria, o `auto` (la completa MaKo, como `META_PAGE_ID` al
// pegar el token).
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ⚠️ SE LEEN COMO TEXTO Y NO SE IMPORTAN: los dos módulos llevan `import 'server-only'`,
// que bajo `npm test` tira. Es la misma razón por la que los otros guards del repo leen
// fuente.
const RUTEO = readFileSync('lib/webhook-routing.ts', 'utf8').replace(/\r\n/g, '\n');
const CATALOGO = readFileSync('lib/metodo-catalogo.ts', 'utf8').replace(/\r\n/g, '\n');

/** Las claves que escriben una fila de ruteo, con su servicio. Sale del BLOQUE, no del archivo. */
function routingCreds(): Array<{ env: string; servicio: string }> {
  const ini = RUTEO.indexOf('export const ROUTING_CREDS');
  assert.ok(ini > 0, 'desapareció ROUTING_CREDS: si el índice de ruteo cambió, este guard hay que reescribirlo');
  const bloque = RUTEO.slice(ini, RUTEO.indexOf('};', ini));
  return bloque
    .split('\n')
    .map((l) => l.trim())
    // Las líneas comentadas explican por qué algo NO está acá (zernio): no son claves.
    .filter((l) => !l.startsWith('//'))
    .map((l) => /^([A-Z0-9_]+):\s*'([a-z]+)'/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ env: m[1], servicio: m[2] }));
}

/** Cómo declara el catálogo ese campo. `null` = no está declarado en ningún lado. */
function campoDelCatalogo(env: string): { opcional: boolean; auto: boolean } | null {
  const linea = CATALOGO.split('\n').find((l) => l.includes(`{ env: '${env}'`));
  if (!linea) return null;
  return { opcional: /\bopcional:\s*true/.test(linea), auto: /\bauto:\s*true/.test(linea) };
}

test('cada clave de ruteo existe en el catálogo: un guard que no encuentra nada no cubre nada', () => {
  const creds = routingCreds();
  assert.ok(creds.length >= 5, `esperaba las claves de ruteo y encontré ${creds.length}`);
  const huerfanas = creds.filter((c) => campoDelCatalogo(c.env) === null).map((c) => c.env);
  assert.deepEqual(huerfanas, [], 'hay claves de ruteo que ninguna pantalla pide: nadie las va a llenar nunca');
});

test('CADA SERVICIO DE RUTEO TIENE UNA CLAVE QUE NO SE PUEDE DEJAR VACÍA', () => {
  const porServicio = new Map<string, string[]>();
  for (const c of routingCreds()) porServicio.set(c.servicio, [...(porServicio.get(c.servicio) ?? []), c.env]);

  const rotos: string[] = [];
  for (const [servicio, envs] of porServicio) {
    const firmes = envs.filter((e) => {
      const d = campoDelCatalogo(e);
      // Obligatoria, o la completa MaKo sola: las dos formas de que no quede vacía.
      return !!d && (!d.opcional || d.auto);
    });
    if (!firmes.length) rotos.push(`${servicio} (${envs.join(', ')})`);
  }
  assert.deepEqual(rotos, [],
    'estos servicios dejan conectar sin una sola fila de ruteo: sus webhooks se ignoran con un 200 y nadie se entera');
});

test('el campo que rutea Calendly dice en su propio texto que sin él no entra nada', () => {
  // La mitad que el `opcional: false` no cubre: quien lo lee tiene que entender QUÉ pierde.
  // El texto viejo decía «Opcional… si usas uno solo, déjalo vacío y no te falta nada», que
  // es literalmente la instrucción que dejó al ws 4 sin recibir ninguna reserva.
  for (const env of ['CALENDLY_EVENT_TYPE_J1', 'CALCOM_EVENT_TYPE_J1']) {
    const linea = CATALOGO.split('\n').find((l) => l.includes(`{ env: '${env}'`));
    assert.ok(linea, `no encontré ${env}`);
    assert.doesNotMatch(linea, /nota: 'Opcional/, `${env} se volvió a anunciar como opcional`);
    assert.match(linea, /no entran a tu CRM/, `${env} no dice qué se pierde si se deja vacío`);
  }
});

// ── Verificado rompiéndolo (04/10/2026), con los números ───────────────────────
// · sin romper nada                                                → 3 pases, 0 fallos
// · devolviéndole `opcional: true` a `CALENDLY_EVENT_TYPE_J1`      → 2 pases, 1 fallo
// · devolviéndole `opcional: true` a `CALCOM_EVENT_TYPE_J1`        → 2 pases, 1 fallo
// · sacándole `auto: true` a `META_PAGE_ID`                        → 2 pases, 1 fallo
// · agregando a ROUTING_CREDS una clave que el catálogo no pide    → 2 pases, 1 fallo
//
// ⚠️ El tercero es el que vale la pena mirar: `META_PAGE_ID` ES `opcional: true` y aun así
// está bien, porque lo completa MaKo al pegar el token. Sin la excepción de `auto`, este
// guard habría pedido hacer obligatorio un campo que el cliente no tiene de dónde sacar.
//
// ⚠️ Y LOS DOS PRIMEROS FALLAN POR **UN** TEST, NO POR DOS. El del texto mira que la nota
// no vuelva a empezar con «Opcional», y restaurar sólo la bandera deja la nota nueva: son
// dos capas distintas (la bandera y lo que la persona LEE) y por eso van separadas.
