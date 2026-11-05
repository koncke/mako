// El lote del medidor de uso (./MedidorDeUso.tsx): suma pantallas y acciones por ruta hasta que se manda. Puro, con test
// (tests/actividad.test.ts). Las acciones se cosechan del contador (./contador-acciones.ts) y se le anotan a la pantalla
// donde estaba la persona cuando las hizo: por eso se cosechan ANTES de cambiar de pantalla y antes de mandar.

export type EntradaMedida = { ruta: string; pantallas: number; acciones: number };
export type Lote = { entrar: (ruta: string) => void; vaciar: () => EntradaMedida[] };

export function crearLote(tomarAcciones: () => number): Lote {
  const cuentas = new Map<string, { pantallas: number; acciones: number }>();
  let actual: string | null = null;
  const sumar = (r: string, pantallas: number, acciones: number) => {
    const c = cuentas.get(r) ?? { pantallas: 0, acciones: 0 };
    c.pantallas += pantallas;
    c.acciones += acciones;
    cuentas.set(r, c);
  };
  const cosechar = () => {
    const n = tomarAcciones();
    if (n > 0 && actual) sumar(actual, 0, n);
  };
  return {
    entrar(ruta) {
      cosechar();
      actual = ruta;
      sumar(ruta, 1, 0);
    },
    vaciar() {
      cosechar();
      const out = [...cuentas.entries()].map(([ruta, c]) => ({ ruta, ...c })).filter((e) => e.pantallas > 0 || e.acciones > 0);
      cuentas.clear();
      return out;
    },
  };
}
