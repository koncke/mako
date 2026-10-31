// =============================================================================
// /admin/estrategia/cobrar — la investigación financiera, para leerla (30/10/2026)
// =============================================================================
// Martín (24/10): «La investigación financiera ponme en una ruta de MaKo para leerla». Ya se abría en
// /admin/docs?d=estrategia-financiera-mako, pero ahí es uno de 177 documentos y nadie lo encuentra. Tiene su entrada
// desde Strategy, que es donde se busca.
// LA FUENTE ÚNICA SIGUE SIENDO EL ARCHIVO (docs/estrategia-financiera-mako.md), como en /admin/docs: esta pantalla lo
// renderiza, sin copia. El .md viaja al deploy por `outputFileTracingIncludes` (next.config.ts): sin eso anda en local y
// en producción no encuentra el archivo. Acá ese fallo se MUESTRA.
// ⚠️ EL GUARD ES EL MISMO DE /admin/estrategia: el rol de AGENCIA (getSesionAdmin), no `rol_ws`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { MarkdownDoc, sumario } from '@/app/_components/MarkdownDoc';
import { ErrorState, Pagina, PageHeader } from '@/app/_ui';

export const dynamic = 'force-dynamic';

const ARCHIVO = 'docs/estrategia-financiera-mako.md';

function leerDocumento(): { texto: string } | { error: string } {
  try {
    return { texto: readFileSync(join(process.cwd(), ARCHIVO), 'utf8') };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function CobrarPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  const doc = leerDocumento();
  if ('error' in doc) {
    return (
      <Pagina>
        <PageHeader titulo="Cómo cobrar MaKo" />
        <ErrorState
          titulo="No se pudo leer la investigación"
          detalle={`Si esto pasa en producción y no en local, falta ${ARCHIVO} en outputFileTracingIncludes de next.config.ts.`}
          detalleTecnico={doc.error}
        />
      </Pagina>
    );
  }

  // Sólo los títulos grandes y las líneas de investigación: el documento tiene 1.400 líneas.
  const indice = sumario(doc.texto).slice(1);

  return (
    <Pagina>
      <PageHeader titulo="Cómo cobrar MaKo" />
      <article style={{ maxWidth: 760, margin: '0 auto', minWidth: 0 }}>
        <details style={{ margin: '0 0 22px', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)' }}>Índice ({indice.length})</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0 4px' }}>
            {indice.map((h) => (
              <a key={h.id} href={`#${h.id}`} style={{ fontSize: 13, color: 'var(--accent)', marginLeft: (h.nivel - 1) * 14, textDecoration: 'none' }}>
                {h.texto}
              </a>
            ))}
          </div>
        </details>
        <MarkdownDoc texto={doc.texto} hrefDoc={(slug) => `/admin/docs?d=${encodeURIComponent(slug)}`} />
      </article>
    </Pagina>
  );
}
