import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { searchPlaces } from "@/lib/maps.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ExploreSearch({
  value,
  onChange,
  onSearch,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: (name: string) => void;
}) {
  const id = useId();
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const search = useServerFn(searchPlaces);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value.trim());
      setActive(-1);
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);
  const query = useQuery({
    queryKey: ["explore-autocomplete", debounced],
    queryFn: () => search({ data: { query: debounced } }),
    enabled: open && debounced.length >= 2,
    staleTime: 300000,
    retry: false,
  });
  const suggestions =
    debounced === value.trim() ? (query.data || []).slice(0, 6) : [];
  const expanded = open && suggestions.length > 0;
  function select(name: string) {
    onChange(name);
    setOpen(false);
    setActive(-1);
    onSearch(name);
  }
  return (
    <form
      className="flex gap-2 items-start"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim().length >= 2) select(value.trim());
      }}
    >
      <div className="relative flex-1 min-w-0">
        <Input
          role="combobox"
          aria-label="Search a place in Goa"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? `${id}-list` : undefined}
          aria-activedescendant={
            expanded && active >= 0 ? `${id}-option-${active}` : undefined
          }
          value={value}
          maxLength={120}
          placeholder="Search beaches, forts, waterfalls, markets in Goa…"
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            }
            if (
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              suggestions.length
            ) {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                event.key === "ArrowDown"
                  ? (index + 1) % suggestions.length
                  : index <= 0
                    ? suggestions.length - 1
                    : index - 1,
              );
            }
            if (
              event.key === "Enter" &&
              expanded &&
              active >= 0 &&
              suggestions[active]
            ) {
              event.preventDefault();
              select(suggestions[active]!.name);
            }
          }}
          className="h-12 text-base rounded-full bg-card/70 border-border/50"
        />
        {expanded && (
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label="Place suggestions"
            className="absolute left-0 right-0 top-14 z-40 overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
          >
            {suggestions.map((place, index) => (
              <button
                type="button"
                role="option"
                aria-selected={active === index}
                id={`${id}-option-${index}`}
                key={place.id}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(place.name)}
                className={`block w-full px-4 py-3 text-left ${active === index ? "bg-primary/10" : "hover:bg-secondary"}`}
              >
                <span className="block text-sm font-semibold">
                  {place.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {place.address}
                </span>
              </button>
            ))}
          </div>
        )}
        <span className="sr-only" aria-live="polite">
          {expanded
            ? `${suggestions.length} suggestions available. Use up and down arrows to choose.`
            : ""}
        </span>
      </div>
      <Button
        type="submit"
        disabled={value.trim().length < 2}
        className="h-12 px-6 rounded-full font-bold"
      >
        <Search className="size-4 mr-1.5" />
        Explore
      </Button>
    </form>
  );
}
