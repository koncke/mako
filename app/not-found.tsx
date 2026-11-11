'use client';

// =============================================================================
// not-found.tsx — cuando la dirección no existe (7/11/2026)
// =============================================================================
// Hasta acá no había ninguna, y eso NO era «falta una pantalla bonita»: lo que se veía era **el 404 por defecto
// de Next, en inglés** —«404 · This page could not be found»— adentro del layout de MaKo, en una app que está
// entera en español. Medido en producción el 7/11 contra `hola-mako.com/esta-ruta-no-existe-7nov`.
//
// ── POR QUÉ ESTA NO ES COMO `error.tsx`, aunque se le parezca ──────────────────────────────────────────────
//
// `app/error.tsx` se mantiene deliberadamente TONTO —estilos en línea, cero imports— porque un boundary que
// depende del código que puede estar roto no es un boundary. **Acá ese razonamiento NO aplica: un 404 no es
// una falla.** La app anda perfecto; lo único que no existe es la dirección.
//
// Igual van estilos en línea, por otro motivo: esta pantalla se dibuja adentro del layout que toque —el de
// escritorio, el de `/m`, o ninguno si la persona no entró— y un componente con su CSS propio se vería
// distinto en cada uno. Un card con `var(--token, fallback)` se ve igual en los tres y sobrevive al tema
// oscuro y a que el CSS de la app todavía no haya cargado.
//
// ── LO QUE SE OFRECE, Y POR QUÉ NO ES UNA LISTA DE LINKS ───────────────────────────────────────────────────
//
// Adentro de la app la sidebar YA está a la vista: repetir sus links acá no agrega nada. Lo que la persona no
// tiene es (a) saber qué pasó, (b) la dirección que falló para poder contarla, y (c) que existe un buscador
// de pantallas por nombre con **Ctrl K** (`app/_components/BuscadorNav.tsx` + `lib/buscador-nav.ts`), que es
// justo lo que sirve cuando no sabés cómo se llama lo que buscás. Eso es lo que hay acá.
//
// ⚠️ EL `?ws=` SE CONSERVA A MANO. `rutaConWs` (lib/workspace.ts) es de SERVIDOR —lee cookies— y esto es un
// componente cliente. Sin conservarlo, a alguien que está mirando el negocio de un cliente el botón lo sacaría
// de ese negocio y lo mandaría al suyo, que es un salto que no pidió.
//
// ✅ EL TÍTULO DE LA PESTAÑA — ARREGLADO EL 9/11/2026, y así (lo de abajo quedó como estaba el 7/11). Hoy una URL inexistente titula
// «MaKo - Esta ruta no existe 7nov»: `tituloDe` (lib/titulo-tab.ts:78, `desdeLaRuta`) titula a partir del
// slug como red de seguridad para rutas sin entrada en el nav, y no sabe que la ruta no existe. Escribir
// `document.title` desde acá NO alcanza: `TituloTab` (app/_components/TituloTab.tsx:36) monta un
// `MutationObserver` sobre el `<head>` que **reafirma su título cada vez que alguien lo pisa**, así que lo
// revierte en el acto. Arreglarlo pide que `TituloTab` sepa que está en un 404, y eso es un cambio en el
// camino de TODAS las rutas: va aparte, no colgado de esta pantalla.
//
// Se hizo aparte, el 9/11: esta pantalla AVISA (`marcarNoEncontrado`, lib/no-encontrado.ts) y `TituloTab` lee
// ese aviso con `useSyncExternalStore` y titula `TITULO_NO_ENCONTRADO` en vez de derivarlo del slug. El
// diagnóstico de arriba era correcto y por eso no se intentó el atajo de escribir `document.title`.
// =============================================================================

import { useEffect, useState } from 'react';
import { INICIO, inicioDesde, atajoBuscador, marcarNoEncontrado } from '@/lib/no-encontrado';

export default function NoEncontrado() {
  // En el servidor no hay `window`: se completa al montar. Hasta entonces la pantalla se dibuja igual, sin la
  // dirección — nunca en blanco esperando un dato.
  const [donde, setDonde] = useState('');
  const [inicio, setInicio] = useState(INICIO);
  const [hayAtras, setHayAtras] = useState(false);
  const [atajo, setAtajo] = useState<string | null>('Ctrl K');

  useEffect(() => {
    setDonde(`${window.location.pathname}${window.location.search}`);
    // El negocio que se está mirando viaja en `?ws=`: si no se conserva, el botón saca de ese negocio.
    setInicio(inicioDesde(window.location.search));
    // `history.length > 1` no garantiza que el anterior sea NUESTRO, pero sí que hay algo atrás: ofrecer
    // «Volver» sin nada a dónde volver es un botón que no hace nada, que es peor que no tenerlo.
    setHayAtras(window.history.length > 1);
    setAtajo(atajoBuscador(navigator.userAgent || ''));
    // Le avisa a `TituloTab` que la pestaña está en un 404 (lib/no-encontrado.ts explica por qué es un aviso
    // y no un `document.title`). ⚠️ El apagado NO es opcional: sin él el título queda diciendo «Esta dirección
    // no existe» en la pantalla siguiente, que es peor que el nombre inventado que vinimos a arreglar.
    marcarNoEncontrado(true);
    return () => { marcarNoEncontrado(false); };
  }, []);

  const secundario: React.CSSProperties = {
    padding: '11px 20px', borderRadius: 11, border: '1px solid var(--border-strong, #cfd4dc)',
    background: 'var(--surface, #fff)', color: 'var(--dim, #5b6472)', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block',
  };

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Geist', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 16, padding: 24, color: 'var(--ink, #12151b)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Esta dirección no existe</div>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--dim, #5b6472)', margin: '0 0 16px' }}>
          No es que algo se haya roto: tus datos están donde los dejaste. La dirección a la que llegaste no
          corresponde a ninguna pantalla, así que el enlace puede estar viejo o tener algo de más.
        </p>
        {donde && (
          <pre style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2, #f4f5f7)', border: '1px solid var(--border, #e5e7eb)', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{donde}</pre>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <a href={inicio}
            style={{ padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--primary, #2F6FED)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block' }}>
            Ir al Dashboard
          </a>
          {hayAtras && (
            <button type="button" onClick={() => window.history.back()} style={secundario}>
              Volver a donde estaba
            </button>
          )}
        </div>
        {atajo && <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim, #5b6472)', margin: 0 }}>
          Si buscas una pantalla y no recuerdas cómo se llama, presiona{' '}
          <kbd style={{ padding: '2px 7px', borderRadius: 6, border: '1px solid var(--border-strong, #cfd4dc)', background: 'var(--surface-2, #f4f5f7)', fontSize: 12, fontFamily: "'Geist Mono', ui-monospace, monospace" }}>
            {atajo}
          </kbd>{' '}
          y escribe lo que quieres hacer: el buscador entiende también los nombres viejos.
        </p>}
      </div>
    </main>
  );
}
