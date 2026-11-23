import { useCallback, useEffect, useState } from "react";
import { cargar, guardar } from "../almacen";
import { esCancion } from "../types";
import type { Cancion } from "../types";

const CLAVE = "swimly:recientes";
const VERSION = 1;
const MAX_RECIENTES = 20;

function leerInicial(): Cancion[] {
  const datos = cargar<unknown>(CLAVE, VERSION, []);
  return Array.isArray(datos) ? datos.filter(esCancion).slice(0, MAX_RECIENTES) : [];
}

export function useRecientes() {

  const [recientes, setRecientes] = useState<Cancion[]>(leerInicial);

  useEffect(() => {
    guardar(CLAVE, VERSION, recientes);
  }, [recientes]);

  const agregar = useCallback((cancion: Cancion) => {
    setRecientes((previas) => {
      if (previas[0]?.id === cancion.id) return previas;
      return [cancion, ...previas.filter((c) => c.id !== cancion.id)].slice(0, MAX_RECIENTES);
    });
  }, []);

  const limpiar = useCallback(() => setRecientes([]), []);

  return { recientes, agregar, limpiar };
}