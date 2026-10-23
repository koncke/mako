// =============================================================================
// zip-unix — un .zip que GUARDA los permisos de Unix (MaKo.app para la Mac, 0.4.2)
// =============================================================================
// El ejecutable de una app de Mac tiene que ser ejecutable. Un .zip armado en Windows no guarda los permisos de Unix, y el
// Archive Utility de la Mac lo descomprime sin ellos: la app no abre. Esto arma el .zip «hecho en Unix», con el modo de cada
// archivo (0755 el lanzador y los programas). Sólo lo que hace falta: deflate, UTF-8, sin zip64 (todo entra en 50 MB).
// `leerZip` lo lee de vuelta (para los tests: nombres, modos y contenido).
// =============================================================================

import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

const fechaDos = (d) => ({
  hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  dia: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
});

/**
 * @param {Array<{ nombre: string; dir?: boolean; datos?: string | Uint8Array; modo?: number }>} entradas
 * @param {Date} [cuando]
 * @returns {Buffer}
 */
export function zipConPermisos(entradas, cuando = new Date()) {
  const f = fechaDos(cuando);
  const partes = [];
  const central = [];
  let offset = 0;
  for (const e of entradas) {
    const nombre = Buffer.from(e.dir && !e.nombre.endsWith('/') ? `${e.nombre}/` : e.nombre, 'utf8');
    const datos = e.dir ? Buffer.alloc(0) : Buffer.from(e.datos ?? '');
    const comprimido = e.dir ? datos : deflateRawSync(datos, { level: 9 });
    const metodo = e.dir ? 0 : 8;
    const crc = e.dir ? 0 : crc32(datos) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(f.hora, 10);
    local.writeUInt16LE(f.dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    partes.push(local, nombre, comprimido);
    const modo = (e.dir ? 0o040000 : 0o100000) | (e.modo ?? (e.dir ? 0o755 : 0o644));
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE((3 << 8) | 20, 4); // hecho en Unix: así se leen los permisos
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(metodo, 10);
    cd.writeUInt16LE(f.hora, 12);
    cd.writeUInt16LE(f.dia, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comprimido.length, 20);
    cd.writeUInt32LE(datos.length, 24);
    cd.writeUInt16LE(nombre.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(((modo * 0x10000) + (e.dir ? 0x10 : 0)) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nombre);
    offset += 30 + nombre.length + comprimido.length;
  }
  const dir = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(dir.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...partes, dir, fin]);
}

/** Lee un .zip de los de arriba: por entrada, su nombre, su modo de Unix y su contenido. */
export function leerZip(zip) {
  const b = Buffer.from(zip);
  const fin = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = b.readUInt16LE(fin + 10);
  let p = b.readUInt32LE(fin + 16);
  const out = [];
  for (let i = 0; i < n; i++) {
    const hechoEn = b.readUInt16LE(p + 4) >> 8;
    const metodo = b.readUInt16LE(p + 10);
    const tam = b.readUInt32LE(p + 20);
    const largoNombre = b.readUInt16LE(p + 28);
    const extra = b.readUInt16LE(p + 30);
    const comentario = b.readUInt16LE(p + 32);
    const externos = b.readUInt32LE(p + 38);
    const local = b.readUInt32LE(p + 42);
    const nombre = b.subarray(p + 46, p + 46 + largoNombre).toString('utf8');
    const ini = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const datos = b.subarray(ini, ini + tam);
    out.push({ nombre, hechoEnUnix: hechoEn === 3, modo: externos >>> 16, datos: metodo === 8 ? inflateRawSync(datos) : Buffer.from(datos) });
    p += 46 + largoNombre + extra + comentario;
  }
  return out;
}
