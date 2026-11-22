import { useState } from "react";
import {
  Landmark,
  Trees,
  Umbrella,
  MapPin,
  Coffee,
  ShoppingBag,
} from "lucide-react";

export function PlaceImage({
  src,
  name,
  category,
  className = "h-44 w-full",
  pending = false,
}: {
  src?: string | undefined;
  name: string;
  category?: string | undefined;
  className?: string;
  pending?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const Icon =
    category === "beach"
      ? Umbrella
      : category === "nature"
        ? Trees
        : category === "food"
          ? Coffee
          : category === "market"
            ? ShoppingBag
            : ["monument", "heritage", "fort", "church"].includes(
                  category || "",
                )
              ? Landmark
              : MapPin;
  return src && src !== failedSrc ? (
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      className={`${className} object-cover`}
      onError={() => setFailedSrc(src)}
    />
  ) : (
    <div
      className={`${className} flex flex-col gap-2 items-center justify-center bg-gradient-to-br from-secondary to-muted text-muted-foreground`}
      role="img"
      aria-label={`${name} — no photo available`}
    >
      <Icon className="size-12" />
      <span className="text-xs">
        {pending ? "Finding a photo…" : "Photo unavailable"}
      </span>
    </div>
  );
}
