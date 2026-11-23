import { getCurrentWindow } from "@tauri-apps/api/window";

const ventana = getCurrentWindow();

export default function ControlesVentana() {
  return (
    <div className="window-controls">
      <button
        type="button"
        className="win-btn"
        onClick={() => ventana.minimize()}
        title="Minimizar"
        aria-label="Minimizar"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5.5" width="8" height="1.2" fill="currentColor" />
        </svg>
      </button>

      <button
        type="button"
        className="win-btn"
        onClick={() => ventana.toggleMaximize()}
        title="Maximizar / Restaurar"
        aria-label="Maximizar"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect
            x="2.2"
            y="2.2"
            width="7.6"
            height="7.6"
            rx="1.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </button>

      <button
        type="button"
        className="win-btn win-close"
        onClick={() => ventana.close()}
        title="Cerrar"
        aria-label="Cerrar"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}