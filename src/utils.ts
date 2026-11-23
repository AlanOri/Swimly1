export const limpiarArtista = (nombre: string) => nombre.replace(/ - Topic$/, "");

export const formatearTiempo = (segundos: number) => {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};