'use client';

// =============================================================================
// /api-mako — la pantalla de la API de MaKo: operaciones, tokens, uso y cómo se usa
// =============================================================================
// Cuatro vistas hermanas, cortadas por PREGUNTA: ¿qué se puede pedir? · ¿con qué
// credencial? · ¿qué se pidió? · ¿cómo arranco? La vista viaja en `?tab=` (leída en
// el server, page.tsx) y la operación abierta en `?op=`, escritas de vuelta con el
// router de app/_ui/Link, que preserva el `?ws=`: el link que se copia es lo que se
// está viendo.
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button, PageHeader, Pagina, Status, Tabs, type Tab } from '@/app/_ui';
import type { TokensDelWorkspace } from '@/lib/api-mako/tokens';
import type { AreaIndice, OpIndice, UsoApi } from './datos';
import { Operaciones } from './Operaciones';
import { Tokens } from './Tokens';
import { Uso } from './Uso';
import { ComoSeUsa } from './ComoSeUsa';

export type TabApi = 'operaciones' | 'tokens' | 'uso' | 'como';

export function ApiMako({ tabInicial, opInicial, areas, operaciones, tokens: tokensIniciales, uso, base }: {
  tabInicial: TabApi;
  opInicial?: string;
  areas: AreaIndice[];
  operaciones: OpIndice[];
  tokens: TokensDelWorkspace | null;
  uso: UsoApi | { error: string };
  base: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabApi>(tabInicial);
  const [tokens, setTokens] = useState(tokensIniciales);
  const [formAbierto, setFormAbierto] = useState(false);

  const activos = tokens ? tokens.tokens.length + (tokens.principal ? 1 : 0) : 0;

  const TABS: Tab[] = [
    { id: 'operaciones', label: 'Operaciones' },
    { id: 'tokens', label: 'Tokens', badge: activos },
    { id: 'uso', label: 'Uso' },
    { id: 'como', label: 'Cómo se usa' },
  ];

  const irA = (id: string, op?: string | null) => {
    setTab(id as TabApi);
    const q = new URLSearchParams({ tab: id });
    if (op) q.set('op', op);
    router.replace(`/api-mako?${q}`, { scroll: false });
  };

  const nuevoToken = () => { setFormAbierto(true); irA('tokens'); };

  return (
    <Pagina>
      <PageHeader
        titulo="API"
        proposito="Lo que un agente o una integración puede leer y hacer en tu MaKo."
        estado={<Status tono={activos ? 'good' : 'neutral'}>{activos ? `${activos} ${activos === 1 ? 'token' : 'tokens'}` : 'Sin tokens'}</Status>}
        accion={<Button onClick={nuevoToken}>Nuevo token</Button>}
        tabs={<Tabs tabs={TABS} activa={tab} onCambio={(id) => irA(id)} />}
      />

      {tab === 'operaciones' && (
        <Operaciones areas={areas} operaciones={operaciones} opInicial={opInicial} onAbrir={(id) => irA('operaciones', id)} />
      )}
      {tab === 'tokens' && (
        <Tokens tokens={tokens} onCambio={setTokens} formAbierto={formAbierto} setFormAbierto={setFormAbierto} />
      )}
      {tab === 'uso' && <Uso uso={uso} irATokens={() => irA('tokens')} />}
      {tab === 'como' && <ComoSeUsa base={base} hayToken={activos > 0} irATokens={() => irA('tokens')} />}
    </Pagina>
  );
}
