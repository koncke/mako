// Las dos vistas de la Ticketera: el mazo (la de entrada) y la lista (la secundaria). Dos links,
// no un estado: cada vista tiene su URL y el link que se copia es la vista que se está viendo.
// ⚠️ Su hoja (./vistas.css) la importan las PÁGINAS, no este archivo: un import de CSS acá rompe
// los tests que dibujan la lista o el mazo con node (no sabe leer un .css).
import Link from '@/app/_ui/Link';
import { TICKETERA, TICKETERA_LISTA } from './reglas';

export function CambioVista({ actual }: { actual: 'tarjetas' | 'lista' }) {
  return (
    <nav className="ticketera-vistas" aria-label="Vista de la Ticketera">
      <Link href={TICKETERA} aria-current={actual === 'tarjetas' ? 'page' : undefined}>Tarjetas</Link>
      <Link href={TICKETERA_LISTA} aria-current={actual === 'lista' ? 'page' : undefined}>Lista</Link>
    </nav>
  );
}
