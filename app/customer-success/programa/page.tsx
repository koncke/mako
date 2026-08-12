// =============================================================================
// /customer-success/programa — Program: el temario y el formulario de cada clase
// =============================================================================
// Contesta «¿qué le estamos pidiendo a cada cliente?», que hasta hoy solo se
// podía contestar abriendo dos archivos de código y dos documentos de Word.
//
// Muestra los 12 módulos, sus 44 clases y sus 118 preguntas de verdad —las de
// los dos Cuestionarios Maestros—, con qué está cargado en Whop y qué no.

import { PROGRAMA, TOTAL_CLASES, CLASES_QUE_DESTRABAN } from '@/lib/programa-catalogo';
import { CAMPOS, TOTAL_CAMPOS } from '@/lib/programa-campos';
import { getMapaLecciones } from '@/lib/cs-avance';
import { whopConfigurado } from '@/lib/whop';
import { esWorkspaceDueno } from '@/lib/workspace';
import { ComingSoon } from '@/app/_components/ComingSoon';
import { ProgramaApp } from './ProgramaApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Program · Customer Success' };

export default async function ProgramaPage() {
  // Mismo guard que la cartera, y por el mismo motivo: acá se ve el temario
  // COMPLETO de Mauricio. Ver el comentario largo en ../page.tsx.
  if (!(await esWorkspaceDueno())) return <ComingSoon title="Customer Success" icon="cs" />;

  const [mapa, whop] = await Promise.all([
    getMapaLecciones().catch(() => ({})),
    whopConfigurado().catch(() => false),
  ]);

  // Qué clases están cargadas en Whop. Se manda el CONJUNTO de claseIds, no el
  // mapa entero: los ids de lección de Whop no le sirven a la pantalla y son
  // ruido en el payload que viaja al cliente.
  const enWhop = new Set(Object.values(mapa));

  return (
    <ProgramaApp
      modulos={PROGRAMA.map(m => ({
        id: m.id, numero: m.numero, titulo: m.titulo, fase: m.fase,
        quien: m.quien, porArea: Boolean(m.porArea),
        clases: m.clases.map((c, i) => ({
          id: c.id,
          rotulo: `${m.numero}.${i + 1}`,
          titulo: c.titulo,
          pregunta: c.pregunta,
          atoro: c.atoro ?? null,
          campos: CAMPOS[c.id] ?? [],
          enWhop: enWhop.has(c.id),
          destraba: (CLASES_QUE_DESTRABAN as readonly string[]).includes(c.id),
        })),
      }))}
      totales={{ clases: TOTAL_CLASES, campos: TOTAL_CAMPOS, enWhop: enWhop.size }}
      whopConectado={whop}
    />
  );
}
