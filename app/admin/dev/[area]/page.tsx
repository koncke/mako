import { notFound, redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader, Section, EmptyState, MONO } from '@/app/_ui';
import { areaDe } from '../areas';

export default async function AreaDevPage({ params }: { params: Promise<{ area: string }> }) {
  // El mismo guard que el resto de /admin: rol de AGENCIA, re-chequeado contra
  // la base en cada request. requireRolWs([]) no sirve acá — `rol_ws` vale
  // 'admin' para el dueño de CADA workspace.
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  const { area: slug } = await params;
  const area = areaDe(slug);
  if (!area) notFound();

  return (
    <Pagina>
      <PageHeader titulo={area.titulo} proposito={area.alcance} />

      <Section titulo="Todavía no hay registro">
        <EmptyState
          titulo="Este registro se llena trabajando"
          detalle={
            <>
              Mientras se trabaje esta tab, acá va quedando qué se decidió, qué se rompió y
              qué falta — con el mismo molde que <a href="/admin/ui" style={{ color: 'var(--accent)' }}>MaKo UX/UI</a>:
              catálogo de piezas arriba y Change History abajo.
              {area.hallazgos ? (
                <>
                  {' '}Lo que ya se aprendió de esta área vive mientras tanto en{' '}
                  <a href={`/admin/docs?d=${area.hallazgos}`} style={{ color: 'var(--accent)' }}>{area.hallazgos}</a>.
                </>
              ) : null}
            </>
          }
        />
      </Section>

      <Section titulo="Dónde vive el código">
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {area.vive.map((v) => (
            <li key={v} style={{ fontFamily: MONO, fontSize: 13, color: 'var(--dim)' }}>{v}</li>
          ))}
        </ul>
      </Section>
    </Pagina>
  );
}
