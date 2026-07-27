// Vista de solo lectura de un curso compartido. Server component: el visitante
// no tiene sesión, así que no se le da nada interactivo ni el chrome de la app.

import type { Curso } from '@/app/conocimientos/curso';

export default function CursoLectura({ curso, invitado }: { curso: Curso; invitado: string | null }) {
  const grupos = curso.clases.reduce<Map<string, typeof curso.clases>>((m, c) => {
    const g = c.grupo || '';
    if (!m.has(g)) m.set(g, []);
    m.get(g)!.push(c);
    return m;
  }, new Map());

  return (
    <main style={S.root}>
      <header style={S.hd}>
        <div style={S.brand}>
          <span style={S.mark}>
            <svg width="19" height="19" viewBox="-12 -12 24 24" aria-hidden="true">
              <path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" />
            </svg>
          </span>
          <span style={S.word}>MaKo</span>
        </div>
        <p style={S.eyebrow}>{curso.eyebrow}</p>
        <h1 style={S.h1}>{curso.titulo}</h1>
        <p style={S.sub}>{curso.subtitulo}</p>
        <p style={S.meta}>
          {curso.clases.length} {curso.clases.length === 1 ? 'clase' : 'clases'} · {curso.volumen}
          {invitado && <> · compartido con <b>{invitado}</b></>}
        </p>
      </header>

      {[...grupos.entries()].map(([grupo, clases]) => (
        <section key={grupo || 'sin-grupo'} style={S.sec}>
          {grupo && <h2 style={S.h2}>{grupo}</h2>}
          {clases.map((c) => (
            <article key={c.n} style={S.clase}>
              <p style={S.claseN}>Clase {c.n}</p>
              <h3 style={S.claseT}>{c.titulo}</h3>
              {c.cardDesc && <p style={S.claseD}>{c.cardDesc}</p>}
              {c.resumen && <div style={S.texto}>{c.resumen}</div>}
            </article>
          ))}
        </section>
      ))}

      <footer style={S.ft}>Material de MaKo · enlace privado</footer>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#fafbfd', color: '#171A21', padding: '40px 24px 60px', fontFamily: "'Geist', system-ui, -apple-system, sans-serif" },
  hd: { maxWidth: 820, margin: '0 auto 30px' },
  brand: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 },
  mark: { width: 32, height: 32, borderRadius: 9, background: '#1A1712', display: 'grid', placeItems: 'center' },
  word: { fontWeight: 700, fontSize: 21, letterSpacing: '-.02em' },
  eyebrow: { margin: '0 0 6px', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8a94a6', fontWeight: 600 },
  h1: { fontSize: 32, fontWeight: 700, letterSpacing: '-.02em', margin: '0 0 10px', lineHeight: 1.15 },
  sub: { margin: '0 0 10px', color: '#48505E', fontSize: 16, lineHeight: 1.55 },
  meta: { margin: 0, color: '#8a94a6', fontSize: 13.5 },
  sec: { maxWidth: 820, margin: '0 auto 8px' },
  h2: { fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a94a6', margin: '26px 0 12px', fontWeight: 700 },
  clase: { background: '#fff', border: '1px solid #e9edf4', borderRadius: 13, padding: '20px 22px', marginBottom: 14, boxShadow: '0 2px 12px -9px rgba(20,24,40,.3)' },
  claseN: { margin: '0 0 4px', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9aa3b4', fontWeight: 700 },
  claseT: { margin: '0 0 6px', fontSize: 19, fontWeight: 700, letterSpacing: '-.01em' },
  claseD: { margin: '0 0 12px', color: '#6b7488', fontSize: 14.5, lineHeight: 1.5 },
  texto: { whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.7, color: '#333b49' },
  ft: { maxWidth: 820, margin: '40px auto 0', color: '#9aa3b4', fontSize: 12.5, textAlign: 'center' },
};
