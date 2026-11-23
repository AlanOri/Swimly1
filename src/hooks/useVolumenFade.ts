import { useState, useRef, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import { cargar, guardar } from "../almacen";

const CLAVE_VOLUMEN = "swimly_volumen";
const VERSION_VOLUMEN = 1;
const VOLUMEN_INICIAL = 25;
const VOLUMEN_MAX_AL_ABRIR = 35;

export const FADE_IN_MS = 650;
export const FADE_OUT_MS = 280;
export const FADE_PAUSA_MS = 180;

export function useVolumenFade(audioRef: RefObject<HTMLAudioElement | null>) {
  const [volumen, setVolumen] = useState<number>(() => {
    const guardado = cargar<number>(CLAVE_VOLUMEN, VERSION_VOLUMEN, VOLUMEN_INICIAL);
    const valido =
      typeof guardado === "number" && !Number.isNaN(guardado)
        ? Math.max(0, Math.min(100, guardado))
        : VOLUMEN_INICIAL;
    return Math.min(valido, VOLUMEN_MAX_AL_ABRIR);
  });

  const volumenObjetivoRef = useRef(volumen / 100);
  const fadeRafRef = useRef<number | null>(null);

  const cancelarFade = useCallback(() => {
    if (fadeRafRef.current !== null) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
  }, []);

  const animarVolumen = useCallback(
    (destino: number, duracionMs: number): Promise<void> => {
      cancelarFade();
      const audio = audioRef.current;
      if (!audio) return Promise.resolve();

      const inicio = audio.volume;
      const delta = destino - inicio;
      if (duracionMs <= 0 || Math.abs(delta) < 0.005) {
        audio.volume = Math.max(0, Math.min(1, destino));
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const t0 = performance.now();

        const paso = (ahora: number) => {
          const progreso = Math.min((ahora - t0) / duracionMs, 1);
          // Curva ease-out cuadrática para que el oído perciba una subida/bajada natural
          const suavizado = 1 - (1 - progreso) * (1 - progreso);
          audio.volume = Math.max(0, Math.min(1, inicio + delta * suavizado));

          if (progreso < 1) {
            fadeRafRef.current = requestAnimationFrame(paso);
          } else {
            fadeRafRef.current = null;
            resolve();
          }
        };

        fadeRafRef.current = requestAnimationFrame(paso);
      });
    },
    [audioRef, cancelarFade]
  );

  // Cuando el usuario mueve el slider manualmente, se aplica directo y se guarda
  useEffect(() => {
    volumenObjetivoRef.current = volumen / 100;
    cancelarFade();
    if (audioRef.current) {
      audioRef.current.volume = volumen / 100;
    }
    guardar(CLAVE_VOLUMEN, VERSION_VOLUMEN, volumen);
  }, [volumen, audioRef, cancelarFade]);

  useEffect(() => () => cancelarFade(), [cancelarFade]);

  const fadeIn = useCallback(
    (duracionMs = FADE_IN_MS) => animarVolumen(volumenObjetivoRef.current, duracionMs),
    [animarVolumen]
  );

  const fadeOut = useCallback(
    (duracionMs = FADE_OUT_MS) => animarVolumen(0, duracionMs),
    [animarVolumen]
  );

  const restaurarVolumen = useCallback(() => {
    cancelarFade();
    if (audioRef.current) {
      audioRef.current.volume = volumenObjetivoRef.current;
    }
  }, [audioRef, cancelarFade]);

  return {
    volumen,
    setVolumen,
    fadeIn,
    fadeOut,
    restaurarVolumen,
  };
}