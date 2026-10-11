// =============================================================================
// Autores — qué concluyó MaKo de cada curso (pestaña «Autores» de Offer Playbook)
// =============================================================================
// Lee lib/offer-autores.ts. Cada «lo tomó MaKo» linkea a la regla en el marco:
// la sección (§N.N) se resuelve contra el documento con `indiceDeSecciones`, que
// usa la misma ancla que MarkdownDoc le pone al título. Una referencia que no
// resuelve se muestra como texto (y el test la caza).
//
// Sin 'use client': se dibuja en el servidor.
// =============================================================================

import Link from '@/app/_ui/Link';
import { Tag, MONO } from '@/app/_ui';
import { AUTORES_OFERTA, TEMAS_OFERTA, type AutorOferta } from '@/lib/offer-autores';
import { claveDeReferencia, type indiceDeSecciones } from './secciones';

type Indice = ReturnType<typeof indiceDeSecciones>;

const fuente: React.CSSProperties = { fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap' };

/** El ancla de un autor, para el índice de arriba. */
const idAutor = (a: AutorOferta) => `autor-${a.autor.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}`;

function Referencia({ seccion, indice }: { seccion: string; indice: Indice }) {
  const clave = claveDeReferencia(seccion);
  const destino = clave ? indice.get(clave) : undefined;
  if (!destino) return <span style={fuente}>{seccion}</span>;
  const href = `${destino.tab === 'criterio' ? '/admin/offer-playbook' : `/admin/offer-playbook?tab=${destino.tab}`}#${destino.id}`;
  return <Link href={href} title={destino.titulo} style={{ ...fuente, color: 'var(--primary)' }}>§{clave}</Link>;
}

function FichaAutor({ a, indice }: { a: AutorOferta; indice: Indice }) {
  const temas = TEMAS_OFERTA.filter((t) => a.conclusiones.some((c) => c.tema === t.id));
  const verificadas = a.conclusiones.filter((c) => c.verificada).length;
  return (
    <section id={idAutor(a)} style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 14, scrollMarginTop: 16,
    }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ fontSize: 'var(--fs-card)', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{a.autor}</h2>
        <span style={{ color: 'var(--dim)', fontSize: 'var(--fs-sm)' }}>{a.curso}</span>
      </header>

      <p style={{ margin: 0, color: 'var(--ink)', lineHeight: 1.55 }}>{a.tesis}</p>
      {a.cita && (
        <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: '2px solid var(--border-strong)', color: 'var(--dim)', fontStyle: 'italic' }}>
          «{a.cita}»
        </blockquote>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ ...fuente, marginBottom: 6 }}>{a.conclusiones.length} conclusiones · {verificadas} verificadas en la clase</span>
        {temas.map((t) => (
          <div key={t.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span><Tag>{t.label}</Tag></span>
            {a.conclusiones.filter((c) => c.tema === t.id).map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'baseline' }}>
                <span style={{ lineHeight: 1.5, color: 'var(--ink)' }}>{c.texto}</span>
                <span style={fuente} title={c.verificada ? 'Verificada en la fuente' : 'Sale de la investigación; la fuente no se reabrió'}>
                  {c.fuente}{c.verificada ? ' ✓' : ''}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {a.adopta.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Lo que tomó MaKo</h3>
          {a.adopta.map((x, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'baseline' }}>
              <span style={{ lineHeight: 1.5 }}>{x.que}</span>
              <Referencia seccion={x.seccion} indice={indice} />
            </div>
          ))}
        </div>
      )}

      {a.descarta.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Lo que no tomó</h3>
          {a.descarta.map((x, i) => (
            <div key={i} style={{ lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 600 }}>{x.que}.</strong> <span style={{ color: 'var(--dim)' }}>{x.porque}</span>
            </div>
          ))}
        </div>
      )}

      <span style={fuente}>{a.carpeta}</span>
    </section>
  );
}

export function Autores({ indice }: { indice: Indice }) {
  if (!AUTORES_OFERTA.length) {
    return <p style={{ color: 'var(--dim)' }}>Todavía no hay conclusiones por autor cargadas.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <nav aria-label="Autores" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {AUTORES_OFERTA.map((a) => (
          <a key={a.autor} href={`#${idAutor(a)}`} className="mk-tag" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
            {a.autor} <span style={{ color: 'var(--faint)' }}>{a.conclusiones.length}</span>
          </a>
        ))}
      </nav>
      {AUTORES_OFERTA.map((a) => <FichaAutor key={a.autor} a={a} indice={indice} />)}
    </div>
  );
}
