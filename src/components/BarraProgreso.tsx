import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { formatearTiempo } from "../utils.ts";

interface Props {
  audioRef: RefObject<HTMLAudioElement | null>;
}

export default function BarraProgreso({ audioRef }: Props) {
  const [tiempo, setTiempo] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [arrastre, setArrastre] = useState<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const sincronizar = () => {
      
      if (document.hidden) return;
      
      setTiempo(Math.floor(audio.currentTime));
      setDuracion(Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0);
    };

    const eventos = ["timeupdate", "durationchange", "loadstart", "seeked"] as const;
    eventos.forEach((e) => audio.addEventListener(e, sincronizar));
    document.addEventListener("visibilitychange", sincronizar);
    sincronizar();

    return () => {
      eventos.forEach((e) => audio.removeEventListener(e, sincronizar));
      document.removeEventListener("visibilitychange", sincronizar);
    };
  }, [audioRef]);

  const confirmar = () => {
    const audio = audioRef.current;
    if (audio && arrastre !== null) {
      audio.currentTime = arrastre;
      setTiempo(arrastre);
    }
    setArrastre(null);
  };

  const valor = arrastre ?? tiempo;
  const porcentaje = duracion ? (valor / duracion) * 100 : 0;

  return (
    <div className="barra-progreso">
      <span>{formatearTiempo(valor)}</span>
      <input
        type="range"
        className="barra-slider"
        min={0}
        max={duracion || 1}
        step={1}
        value={valor}
        disabled={!duracion}
        onChange={(e) => setArrastre(Number(e.target.value))}
        onPointerUp={confirmar}
        onPointerCancel={confirmar}
        onKeyUp={confirmar}
        style={{ "--progreso": `${porcentaje}%` } as CSSProperties}
        aria-label="Progreso de la canción"
      />
      <span>{formatearTiempo(duracion)}</span>
    </div>
  );
}