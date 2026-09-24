import { cn } from "@/lib/utils";

export type MascotState = "idle" | "coverEyes" | "peek";

const INK = "#4a2a14";
const SKIN = "#f1c5a0";

// Panadero dibujado a mano en SVG. Las animaciones viven en src/index.css
// (clases .mascot / .m-*), controladas por el atributo data-state, para no
// agregar librerías de animación.
export function BakerMascot({ state, className }: { state: MascotState; className?: string }) {
  return (
    <svg
      viewBox="0 0 260 280"
      role="img"
      aria-label="Panadero animado"
      className={cn("mascot h-auto w-full", className)}
      data-testid="baker-mascot"
      data-state={state}
    >
      <ellipse cx="130" cy="272" rx="80" ry="7" fill="currentColor" opacity="0.12" />

      <g className="m-body">
        {/* Torso: camisa + delantal marrón */}
        <path d="M52 280 C52 218 84 192 130 192 C176 192 208 218 208 280 Z" fill="#f7efe2" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M90 200 L170 200 L182 280 L78 280 Z" fill="#8a5230" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M104 198 L118 232 M156 198 L142 232" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <rect x="108" y="240" width="44" height="26" rx="6" fill="#a2673f" stroke={INK} strokeWidth="2.5" />
        {/* Cuello */}
        <rect x="116" y="176" width="28" height="22" rx="8" fill={SKIN} stroke={INK} strokeWidth="3" />

        {/* Sombrero de chef */}
        <path d="M84 96 C56 92 52 52 84 46 C86 22 118 14 130 26 C142 14 176 22 178 46 C210 52 204 92 176 96 Z" fill="#fffaf0" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M108 40 C110 56 108 72 106 90 M152 40 C150 56 152 72 154 90" stroke="#e5d8c2" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* Cara */}
        <ellipse cx="130" cy="130" rx="52" ry="48" fill={SKIN} stroke={INK} strokeWidth="3" />
        <rect x="76" y="92" width="108" height="16" rx="8" fill="#fffaf0" stroke={INK} strokeWidth="3" />
        <ellipse cx="96" cy="146" rx="9" ry="6" fill="#f08a7a" opacity="0.65" />
        <ellipse cx="164" cy="146" rx="9" ry="6" fill="#f08a7a" opacity="0.65" />

        {/* Ojos con párpados */}
        {[110, 150].map((x) => (
          <g key={x}>
            <circle cx={x} cy="130" r="9" fill="#fff" opacity="0" />
            <circle className="m-pupil" cx={x} cy="130" r="5" fill={INK} />
            <ellipse className="m-lid" cx={x} cy="130" rx="8" ry="8" fill={SKIN} />
          </g>
        ))}
        <path d="M100 118 Q110 112 120 118 M140 118 Q150 112 160 118" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Sonrisa */}
        <path d="M116 152 Q130 168 144 152" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </g>

      {/* Mano izquierda (del espectador): brazo hacia abajo + palma con dedos */}
      <g className="m-hand m-hand-l">
        <rect x="-12" y="10" width="24" height="150" rx="12" fill="#f7efe2" stroke={INK} strokeWidth="3" />
        <Hand />
      </g>

      {/* Mano derecha: sostiene la hogaza */}
      <g className="m-hand m-hand-r">
        <rect x="-12" y="10" width="24" height="150" rx="12" fill="#f7efe2" stroke={INK} strokeWidth="3" />
        <g className="m-loaf" style={{ transformOrigin: "0 0" }}>
          <g className="m-loaf-inner">
            <ellipse cx="0" cy="-24" rx="34" ry="19" fill="#dc9a3a" stroke={INK} strokeWidth="3" />
            <path d="M-16 -36 L-8 -20 M-2 -40 L6 -22 M12 -37 L20 -21" stroke="#f7d28a" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        </g>
        <Hand />
      </g>
    </svg>
  );
}

function Hand() {
  return (
    <g>
      <rect x="-24" y="-20" width="48" height="36" rx="16" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M-8 -18 L-8 -4 M8 -18 L8 -4" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </g>
  );
}
