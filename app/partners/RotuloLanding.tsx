// La línea de arriba de la landing cuando la mira alguien que no la necesita (el super admin, o quien ya es partner), con
// la vuelta a su panel (25/10/2026, Martín: «un botón arriba para ver la landing nuevamente por si quieren»).

import Link from '@/app/_ui/Link';
import { RUTA_PARTNERS } from '@/lib/partners-reglas';

export function RotuloLanding({ texto, volver }: { texto: string; volver: string }) {
  return (
    <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--dim)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <span>{texto}</span>
      <Link href={RUTA_PARTNERS} style={{ color: 'var(--primary)', fontWeight: 700 }}>← {volver}</Link>
    </p>
  );
}
