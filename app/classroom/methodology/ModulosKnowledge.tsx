// =============================================================================
// ModulosKnowledge — Knowledge: el método de los cursos por MÓDULO, arriba del editor (31/10/2026)
// =============================================================================
// Knowledge NO es una tab nueva. Martín la sacó el 25/10/2026 (punto 13): «Elimina "hola-mako.com/contexto", lo de
// "Conocimientos" lo puedes llevar a esa tab, donde está el curso, y que solo yo como super admin vea esas
// anotaciones». El análisis del 21/07 decía «renombrar /conocimiento», y este pedido es POSTERIOR: manda éste. Así que
// Knowledge se ve ACÁ, arriba de las fichas que ya se editan en esta pantalla.
//
// Lo que agrega: la clasificación POR TEMA que pidió Martín («este curso trata de generación de imágenes y vídeos con
// IA… luego meta otros cursos de oferta, o nutrición, etc. Entonces podríamos clasificarlos»), con lo único que no se
// puede deducir leyendo las fichas: de qué secciones del portal sale cada módulo, en qué tabs se usa, y CUÁNTO tiene
// cargado hoy.
//
// ⚠️ Un módulo en cero dice «sin destilar», no «falta»: es la regla de «sin falta si no hay dato». Lo que falta es
// trabajo de curación, y el número lo dice sin adjetivos.
//
// Server component y sin estado: el dato lo mide `estadoDeLosModulos()` (lib/knowledge.ts) en la página.
// =============================================================================

import type { CSSProperties } from 'react';
import { moduloDeKey, type CargaDeModulo } from '@/lib/knowledge-modulos';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 };
const fila: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 12, alignItems: 'baseline', padding: '11px 0', borderTop: '1px solid var(--border)' };
const chico: CSSProperties = { fontFamily: SANS, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, minWidth: 0 };

const pastilla = (bg: string, fg: string): CSSProperties => ({
  fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap', background: bg, color: fg,
});

/**
 * Cuántas fichas tiene el módulo y cuántas se le prestan a los demás negocios.
 *
 * ⚠️ Las dos, y no sólo la primera: las fichas cargadas desde esta pantalla salen con `fuente: 'manual'`, que NO se
 * presta (lib/rag-prestamo.ts), así que un módulo puede verse cargado y no llegarle a ningún negocio. Con el número al
 * lado, eso se ve; sin él, se descubre cuando un cliente pregunta por qué MaKo no sabe nada del método.
 */
function Fichas({ n, prestables }: { n: number; prestables: number }) {
  if (n === 0) return <span style={pastilla('var(--surface-2)', 'var(--dim)')}>sin destilar</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 6, whiteSpace: 'nowrap' }}>
      <span style={pastilla('var(--good-bg)', 'var(--good)')}>{n} {n === 1 ? 'ficha' : 'fichas'}</span>
      <span
        style={pastilla(prestables ? 'var(--surface-2)' : 'var(--warn-bg)', prestables ? 'var(--dim)' : 'var(--warn)')}
        title={prestables ? 'Fichas con fuente «mako»: las ve la IA de todos los negocios.' : 'Ninguna se presta: con fuente «manual» quedan sólo en este workspace y ningún negocio las lee.'}
      >
        {prestables ? `${prestables} se ${prestables === 1 ? 'presta' : 'prestan'}` : 'no se prestan'}
      </span>
    </span>
  );
}

export function ModulosKnowledge({ modulos }: { modulos: readonly CargaDeModulo[] }) {
  const conMetodo = modulos.filter((m) => m.fichas > 0).length;
  return (
    <section style={{ ...card, marginBottom: 20 }}>
      <div style={rotulo}>Knowledge · el método de los cursos, por módulo</div>
      <p style={{ fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
        Cada módulo es un tema del portal de cursos destilado en fichas, y se enchufa en las tabs que lo usan: lo pide
        MaKo con <code style={{ fontFamily: MONO, fontSize: 12 }}>leer_modulo_knowledge</code> y cada tab con su propia
        key. {conMetodo} de {modulos.length} módulos tienen método cargado. Las fichas de abajo son las de todos los
        módulos juntas: el área de cada una es la que la manda a su módulo.
      </p>
      <div>
        {modulos.map((m) => (
          <div key={m.key} style={fila}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{m.nombre}</div>
              <div style={{ ...chico, marginTop: 2 }}>{moduloDeKey(m.key)?.que ?? ''}</div>
            </div>
            <div style={chico}>
              <div style={{ ...rotulo, marginBottom: 2 }}>De qué cursos</div>
              {m.secciones.join(' · ')}
            </div>
            <div style={chico}>
              <div style={{ ...rotulo, marginBottom: 2 }}>Dónde se usa</div>
              {m.tabs.length ? m.tabs.join(', ') : 'Sólo la plataforma'}
            </div>
            <Fichas n={m.fichas} prestables={m.prestables} />
          </div>
        ))}
      </div>
    </section>
  );
}
