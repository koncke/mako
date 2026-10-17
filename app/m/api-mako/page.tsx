// =============================================================================
// /m/api-mako — la API de MaKo en el teléfono (17/10/2026). En la URL, /api-mako (y `?tab=`, como la computadora).
// =============================================================================
// La computadora copia GitHub tal cual (Docs · Tokens · Registro). El teléfono copia lo que GitHub y Stripe hacen en el
// celular: la sección «Developers» de la app de Stripe y los ajustes de GitHub en el navegador del teléfono. Son las
// mismas tres pestañas con un segmentado, listas en vez de tablas, y el detalle de cada cosa en una hoja. Lee lo MISMO y
// con las mismas funciones que app/api-mako/page.tsx: `vistaDeLaTab`/`indiceDocs` para el catálogo, `listarTokens` (sin
// secretos) y `usoDe` para el registro.
//
// Lo que queda en la computadora, dicho en su fila: CREAR o regenerar un token. Su valor se ve UNA sola vez y se copia a
// la integración, que vive en la computadora. Probar un endpoint y la referencia para bajar también quedan allá.
// Eliminar un token sí se puede, con su confirmación (`revocarTokenApi`, la acción de escritorio).
//
// ⚠️ La puerta es la de escritorio: la key `api-mako`, sólo el admin (acá se acuñan credenciales). Cada acción la vuelve
// a preguntar (`puerta()` de app/api-mako/actions.ts).
// =============================================================================

import './api-mako.css';
import { requireMovil } from '@/lib/movil-guard';
import { APP_BASE_URL } from '@/lib/app-url';
import { listarTokens } from '@/lib/api-mako/tokens';
import { VERSION_API } from '@/lib/api-mako/version';
import { indiceDocs, usoDe, vistaDeLaTab } from '@/app/api-mako/datos';
import { PantallaM, SegmentadoM, VacioM } from '@/app/m/_ui';
import { ApiMakoM, type AreaM, type LlamadaM, type TokenM } from './ApiMakoM';

export const dynamic = 'force-dynamic';

const TABS = [{ id: 'docs', label: 'Docs' }, { id: 'tokens', label: 'Tokens' }, { id: 'registro', label: 'Registro' }] as const;
type Tab = (typeof TABS)[number]['id'];
const esTab = (x: unknown): x is Tab => TABS.some((t) => t.id === x);

export default async function ApiMakoMovil({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireMovil({ navKey: 'api-mako' });
  if (ctx.ws == null) return <PantallaM><VacioM frase="La API es de cada negocio: entra a uno para ver la suya." /></PantallaM>;
  const sp = await searchParams;
  const tab: Tab = esTab(sp.tab) ? sp.tab : 'docs';

  const segmentado = (
    <div className="m-api-mako-tabs">
      <SegmentadoM etiqueta="Sección" valor={tab} opciones={TABS.map((t) => ({ id: t.id, label: t.label, href: `/m/api-mako?tab=${t.id}` }))} />
    </div>
  );

  if (tab === 'docs') {
    const indice = indiceDocs(await vistaDeLaTab(ctx.ws));
    const areas: AreaM[] = indice.map((a) => ({
      area: a.area, titulo: a.titulo,
      recursos: a.recursos.map((r) => ({ titulo: r.titulo, endpoints: r.endpoints.map((e) => ({ id: e.id, titulo: e.titulo, metodo: e.metodo, ruta: e.ruta, nivel: e.nivel })) })),
    }));
    return (
      <PantallaM>
        {segmentado}
        <ApiMakoM tab="docs" base={APP_BASE_URL.replace(/\/+$/, '')} version={VERSION_API} areas={areas} />
      </PantallaM>
    );
  }
  if (tab === 'tokens') {
    const t = await listarTokens(ctx.ws).catch(() => null);
    const tokens: TokenM[] | null = t ? t.tokens.map((x) => ({
      id: x.id, nombre: x.nombre, descripcion: x.descripcion, pista: x.pista, creado: x.creado, expira: x.expira,
      ultimoUso: x.ultimoUso, vencido: x.vencido, areas: Object.keys(x.permisos).length,
    })) : null;
    return (
      <PantallaM>
        {segmentado}
        <ApiMakoM tab="tokens" tokens={tokens} principal={t?.principal ?? null} />
      </PantallaM>
    );
  }
  const uso = await usoDe(ctx.ws, null);
  const llamadas: LlamadaM[] | null = 'error' in uso ? null : uso.ultimas.slice(0, 50).map((l) => ({ cuando: l.cuando, operacion: l.operacion, status: l.status, ms: l.ms }));
  return (
    <PantallaM>
      {segmentado}
      <ApiMakoM tab="registro" llamadas={llamadas} total={'error' in uso ? 0 : uso.total} errores={'error' in uso ? 0 : uso.errores} />
    </PantallaM>
  );
}
