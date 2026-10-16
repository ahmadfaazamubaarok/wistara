import type { DestCategory, FacilityType } from "@/lib/categories";
import {
  CATEGORY_ICON_PATHS,
  FACILITY_ICON_PATHS,
  WEATHER_ICON_PATHS,
  weatherKind,
} from "@/lib/icon-data";

type IconProps = { size?: number; className?: string };

function Svg({ paths, size = 20, className }: IconProps & { paths: string[] }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function CategoryIcon({ category, ...props }: IconProps & { category: DestCategory }) {
  return <Svg paths={CATEGORY_ICON_PATHS[category]} {...props} />;
}

export function FacilityIcon({ type, ...props }: IconProps & { type: FacilityType }) {
  return <Svg paths={FACILITY_ICON_PATHS[type]} {...props} />;
}

/** Ikon cuaca dekoratif; teks cuacanya harus tersedia di tempat lain untuk pembaca layar. */
export function WeatherIcon({ description, ...props }: IconProps & { description: string | null }) {
  return <Svg paths={WEATHER_ICON_PATHS[weatherKind(description)]} {...props} />;
}

const MISC = {
  clock: ["M12 6v6l4 2", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"],
  arrowRight: ["M5 12h14", "m12 5 7 7-7 7"],
  externalLink: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  mapPin: ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z", "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"],
  info: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z", "M12 16v-4", "M12 8h.01"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  chevronUp: ["m18 15-6-6-6 6"],
  chevronDown: ["m6 9 6 6 6-6"],
  cloudLightning: ["M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973", "m13 12-3 5h4l-3 5"],
} as const;

export function MiscIcon({ name, ...props }: IconProps & { name: keyof typeof MISC }) {
  return <Svg paths={[...MISC[name]]} {...props} />;
}
