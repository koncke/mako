// /m/crm/<id> — la ficha del lead mientras se lee (1,5-2,8 s medidos): la forma de sus filas.

import { SkeletonFilas } from '@/app/m/_ui';

export default function FichaCargando() {
  return <SkeletonFilas filas={6} />;
}
