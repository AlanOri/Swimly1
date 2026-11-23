interface Envoltorio<T> {
  version: number;
  datos: T;
}

export function cargar<T>(clave: string, version: number, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return porDefecto;
    const guardado = JSON.parse(crudo) as Envoltorio<T>;
    if (guardado.version !== version) return porDefecto;
    return guardado.datos;
  } catch {
    return porDefecto;
  }
}

export function guardar<T>(clave: string, version: number, datos: T): void {
  try {
    const envoltorio: Envoltorio<T> = { version, datos };
    localStorage.setItem(clave, JSON.stringify(envoltorio));
  } catch (e) {
    console.log("No se pudo guardar:", e);
  }
}