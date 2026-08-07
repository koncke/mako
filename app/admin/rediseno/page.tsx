// El registro del rediseño se mudó adentro del sistema de diseño: son la misma
// cosa mirada de dos maneras (las piezas y por qué quedaron así), y tenerlas en
// dos tabs distintas obligaba a saltar de una a otra para entender una decisión.
// Queda el redirect porque el link circuló.
import { redirect } from 'next/navigation';

export default function RedisenoPage() {
  redirect('/admin/ui');
}
