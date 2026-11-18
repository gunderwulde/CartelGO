import { POI_KINDS } from "../data/poiKinds";
import type { PoiKind } from "../types/poi";

/** Insignia cartoon de un tipo de lugar: círculo de color con borde grueso y su icono. */
export function PoiBadge({
  kind,
  size = 28,
}: {
  kind: PoiKind;
  size?: number;
}) {
  const { color, Icon } = POI_KINDS[kind];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border-[3px] border-black shrink-0"
      style={{ width: size, height: size, background: color }}
    >
      <Icon
        size={Math.round(size * 0.55)}
        strokeWidth={2.75}
        color="#fff"
        aria-hidden
      />
    </span>
  );
}
