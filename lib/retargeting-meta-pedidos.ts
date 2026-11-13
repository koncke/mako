// =============================================================================
// Los pedidos a Meta de los públicos del retargeting (13/11/2026). PURO: arma el pedido, no lo manda (lib/retargeting-meta.ts).
// =============================================================================
// Dos caminos, el que tenga el negocio (lib/meta-via.ts, `canalMeta`):
//   · ZERNIO (OpenAPI 1.608.0): `POST /ads/audiences` con `type: customer_list`, y `POST`/`DELETE /ads/audiences/{id}/users` con
//     `{ users: [{ phone, email }] }`. El hash lo hace Zernio. ⚠️ El `{id}` de `/users` es el de ZERNIO, no el de Meta: el de Meta
//     (`platformAudienceId`) es el que va en la segmentación de un anuncio.
//   · EL TOKEN (Graph API): `POST act_X/customaudiences` con `subtype: CUSTOM`, y `POST`/`DELETE {id}/users` con el `payload` en
//     SHA-256 que pide Meta (`schema: [PHONE, EMAIL]`). El hash lo hacemos acá.
// Hasta 10.000 personas por pedido en los dos.
// =============================================================================

import { createHash } from 'node:crypto';
import { PUBLICOS, type CualPublico, type Persona } from './retargeting-reglas';

export type Pedido = { url: string; init: { method: 'POST' | 'DELETE'; headers: Record<string, string>; body: string } };
export type CanalZernio = { clave: string; accountId: string; adAccountId: string };
export type CanalToken = { token: string; adAccountId: string };

const ZERNIO = 'https://zernio.com/api/v1';
const GRAPH = 'https://graph.facebook.com';
/** De dónde viene la lista, lo que pide Meta para una de clientes: la dieron las personas al negocio. */
const ORIGEN = 'USER_PROVIDED_ONLY';
const sha = (x: string) => createHash('sha256').update(x).digest('hex');

export function crearPorZernio(c: CanalZernio, cual: CualPublico): Pedido {
  return {
    url: `${ZERNIO}/ads/audiences`,
    init: {
      method: 'POST', headers: { authorization: `Bearer ${c.clave}`, 'content-type': 'application/json' },
      body: JSON.stringify({ accountId: c.accountId, adAccountId: c.adAccountId, name: PUBLICOS[cual].nombre, description: PUBLICOS[cual].descripcion, type: 'customer_list', customerFileSource: ORIGEN }),
    },
  };
}

export function personasPorZernio(c: CanalZernio, zernioId: string, personas: readonly Persona[], quitar: boolean): Pedido {
  return {
    url: `${ZERNIO}/ads/audiences/${encodeURIComponent(zernioId)}/users`,
    init: { method: quitar ? 'DELETE' : 'POST', headers: { authorization: `Bearer ${c.clave}`, 'content-type': 'application/json' }, body: JSON.stringify({ users: personas }) },
  };
}

/** Los ids que devuelve Zernio al crear: el suyo (para `/users`) y el de Meta (para los anuncios). null si no vino alguno. */
export function idsDeZernio(body: unknown): { zernioId: string | null; metaId: string | null } {
  const a = ((body ?? {}) as { audience?: Record<string, unknown> }).audience ?? (body as Record<string, unknown> | null) ?? {};
  const s = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : typeof x === 'number' ? String(x) : null);
  return { zernioId: s(a._id) ?? s(a.id), metaId: s(a.platformAudienceId) };
}

const version = () => process.env.META_API_VERSION || 'v21.0';
const forma = (campos: Record<string, string>) => new URLSearchParams(campos).toString();

export function crearPorToken(c: CanalToken, cual: CualPublico): Pedido {
  return {
    url: `${GRAPH}/${version()}/${c.adAccountId}/customaudiences`,
    init: {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: forma({ name: PUBLICOS[cual].nombre, description: PUBLICOS[cual].descripcion, subtype: 'CUSTOM', customer_file_source: ORIGEN, access_token: c.token }),
    },
  };
}

export function personasPorToken(c: CanalToken, metaId: string, personas: readonly Persona[], quitar: boolean): Pedido {
  const data = personas.map((p) => [p.phone ? sha(p.phone) : '', p.email ? sha(p.email) : '']);
  return {
    url: `${GRAPH}/${version()}/${encodeURIComponent(metaId)}/users`,
    init: {
      method: quitar ? 'DELETE' : 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: forma({ payload: JSON.stringify({ schema: ['PHONE', 'EMAIL'], data }), access_token: c.token }),
    },
  };
}
