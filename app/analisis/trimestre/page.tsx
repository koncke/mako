// =============================================================================
// /analisis/trimestre — el informe del trimestre junio–agosto 2026
// =============================================================================
// Vive colgado de /analisis y no en una tab propia a propósito. El análisis en
// vivo contesta «¿cómo venimos?» con la base de hoy; esto contesta «¿qué pasó en
// ESTE trimestre y qué hago con eso?» con los números congelados el 09/09/2026.
// Es la misma pregunta en dos escalas de tiempo, no dos módulos.
//
// El 11/10/2026 el análisis en vivo se mudó ADENTRO de Experiments (su cuarta
// tab, /experimentos?tab=analisis; /analisis redirige ahí) y esta ruta se QUEDÓ
// donde estaba, a propósito: tests/informe-congelado.test.ts fija /analisis/trimestre
// y el link ya salió por WhatsApp. Por eso el guard de capa es 'experimentos'
// (en las cuatro capas da exactamente lo mismo que 'analisis', y es la tab que
// la barra marca acá) y el link de vuelta va a la tab, no a la ruta vieja.
//
// ⚠️ EL GUARD VA EN POSITIVO: solo el workspace dueño. Los números están
// escritos en ./datos y son de Mauricio — un `ws !== otro` acá sería servirle
// la facturación de Meta de un cliente a cualquier cliente nuevo que entre.
// Escrito al revés («cualquiera menos aquél») se queda viejo solo: cada cliente
// que se da de alta entra en la lista de los que nadie contempló.
//
// Y contesta 404, no un cartel de «no tenés permiso»: para un cliente que no es
// el dueño esta pantalla no existe, y decirle que existe pero no es suya ya es
// contarle algo.
// =============================================================================

import { notFound } from 'next/navigation';
import { Pagina, PageHeader } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { requireRolWs } from '@/lib/tab-access';
import { esWorkspaceDueno } from '@/lib/workspace';
import { PERIODO } from './datos';
import { VistaTrimestre } from './VistaTrimestre';

/**
 * El título va acá y no en un `export const metadata` porque **los metadatos se
 * resuelven aunque el guard de abajo tire 404**: medido contra el ws13, la
 * respuesta no traía un solo dato del informe y el `<title>` decía «Trimestre
 * junio–agosto 2026» igual. Un título es poco, y aun así cuenta que la pantalla
 * existe y de qué trimestre habla — que es exactamente lo que el 404 viene a no
 * decir.
 */
export async function generateMetadata() {
  return (await esWorkspaceDueno()) ? { title: 'Trimestre junio–agosto 2026' } : {};
}

export default async function TrimestrePage() {
  await requireRolWs([], { nav: 'experimentos' });
  if (!(await esWorkspaceDueno())) notFound();

  return (
    <Pagina>
      <PageHeader
        titulo="Dónde se rompió el trimestre"
        proposito={`${PERIODO.etiqueta}. Todo el embudo pagado, desde la impresión en Meta hasta el dólar cobrado, reconstruido desde la base de MaKo.`}
        acciones={
          <Link href="/experimentos?tab=analisis" style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', textDecoration: 'none' }}>
            ← Análisis en vivo
          </Link>
        }
      />
      <VistaTrimestre />
    </Pagina>
  );
}
