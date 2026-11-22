import { saveTripAtomically } from "@/lib/trip-save";
import { validateAge } from "@/lib/age-validation";
import {
  validatePhone,
  normalizePhone,
  validateOptionalPhone,
} from "@/lib/phone-validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, User, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOA_PLACES } from "@/lib/goa-schemas";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/setup")({
  component: Setup,
});

type Person = {
  id?: string;
  name: string;
  age: string;
  category: "adult" | "kid" | "senior";
  phone: string;
};

function Setup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [style, setStyle] = useState<"solo" | "group">("solo");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [destination, setDestination] = useState("Panjim");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState(3);
  const [people, setPeople] = useState<Person[]>([
    { name: "", age: "", category: "adult", phone: "" },
  ]);
  const [phoneErrors, setPhoneErrors] = useState<Record<number, string>>({});
  const [phoneTouched, setPhoneTouched] = useState<Record<number, boolean>>({});

  const validatePersonPhone = (
    index: number,
    val: string,
    allPeople: Person[],
    ownerPhoneVal: string,
  ) => {
    const normalized = normalizePhone(val);
    if (!normalized) return null;
    if (!allPeople[index]?.name.trim()) return "Add a name for this number";

    const ownerNormalized = normalizePhone(ownerPhoneVal);
    if (normalized === ownerNormalized) return "This is your own number";

    for (let j = 0; j < allPeople.length; j++) {
      if (
        j !== index &&
        normalizePhone(allPeople[j]?.phone || "") === normalized
      ) {
        return `This number is already used for ${allPeople[j]?.name.trim() || "another person"}`;
      }
    }

    return validateOptionalPhone(normalized);
  };

  const hydratedTrip = useRef<string | undefined>(undefined);
  const {
    data: existing,
    isPending: loadingTrip,
    isError: tripError,
    refetch: retryTrip,
  } = useQuery({
    queryKey: ["trip"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, travellers(*)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!existing || hydratedTrip.current === existing.id) return;
    hydratedTrip.current = existing.id;
    setStyle(existing.travel_style === "group" ? "group" : "solo");
    setName(existing.traveller_name);
    setPhone(existing.phone_number ?? "");
    setDestination(existing.destination);
    setStartDate(existing.start_date ?? "");
    setDays(existing.days);
    const t = (existing.travellers ?? []) as Array<{
      id: string;
      name: string;
      age: number | null;
      category: string;
      phone_number: string | null;
    }>;
    if (t.length > 0) {
      setPeople(
        t.map((p) => ({
          id: p.id,
          name: p.name,
          age: p.age != null ? String(p.age) : "",
          category: p.category as Person["category"],
          phone: p.phone_number ?? "",
        })),
      );
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (loadingTrip || tripError)
        throw new Error("Load your existing trip before saving changes.");
      if (!name.trim() || !destination.trim())
        throw new Error("Enter your name and destination.");
      if (!Number.isInteger(days) || days < 1 || days > 365)
        throw new Error(
          "Trip length must be a whole number from 1 to 365 days.",
        );
      const phoneError = validatePhone(normalizePhone(phone));
      if (phoneError) throw new Error(phoneError);

      if (style === "group") {
        let firstInvalidIndex = -1;
        const newErrors: Record<number, string> = {};

        for (let i = 0; i < people.length; i++) {
          const person = people[i];
          if (!person) continue;
          const hasName = !!person.name.trim();
          const hasPhone = !!normalizePhone(person.phone);

          if (!hasName && !hasPhone) continue;

          if (hasName) {
            const ageError = validateAge(person.age, person.category);
            if (ageError) throw new Error(`${person.name}: ${ageError}`);
          }

          const pErr = validatePersonPhone(i, person.phone, people, phone);
          if (pErr) {
            newErrors[i] = pErr;
            if (firstInvalidIndex === -1) firstInvalidIndex = i;
          }
        }

        if (firstInvalidIndex !== -1) {
          setPhoneErrors(newErrors);
          setPhoneTouched(
            Object.keys(newErrors).reduce(
              (acc, k) => ({ ...acc, [Number(k)]: true }),
              {},
            ),
          );
          setTimeout(() => {
            const el = document.getElementById(
              `person-phone-${firstInvalidIndex}`,
            );
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
          throw new Error("Please fix the errors before saving.");
        }
      }
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const payload = {
        user_id: userId,
        travel_style: style,
        traveller_name: name.trim(),
        phone_number: normalizePhone(phone),
        destination,
        start_date: startDate || null,
        days,
      };

      const rows =
        style === "group"
          ? people
              .filter((person) => person.name.trim())
              .map((person) => ({
                id: person.id ?? null,
                name: person.name.trim(),
                age: Number(person.age),
                category: person.category,
                phone_number: normalizePhone(person.phone) || null,
              }))
          : [];
      return saveTripAtomically(supabase, {
        _trip: payload,
        _travellers: rows,
        _trip_id: existing?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip"] });
      queryClient.invalidateQueries({ queryKey: ["tracking-workspace"] });
      toast.success("Trip saved");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => {
      let msg = e instanceof Error ? e.message : "Could not save trip";
      if (msg.includes("travellers_trip_phone_unique")) {
        msg = "That phone number is already used in this trip";
      } else if (msg.includes("Traveller phone number cannot match")) {
        msg = "Traveller phone number cannot match the trip owner phone number";
      } else if (msg.includes("travellers_phone_number_format")) {
        msg = "Invalid phone number format";
      }
      toast.error(msg);
    },
  });

  return (
    <AppShell title="Trip setup" subtitle="Step " back>
      {tripError && (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-destructive/30 p-4 text-sm"
        >
          Your trip could not be loaded. Retry before making changes.
          <Button
            variant="outline"
            className="ml-2"
            onClick={() => void retryTrip()}
          >
            Retry
          </Button>
        </div>
      )}
      {loadingTrip && <p role="status">Loading your trip…</p>}
      <fieldset
        disabled={loadingTrip || tripError || save.isPending}
        className="min-w-0"
      >
        {step === 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">How are you travelling?</h2>
            {(
              [
                {
                  value: "solo",
                  icon: User,
                  title: "Solo",
                  text: "Just me exploring",
                },
                {
                  value: "group",
                  icon: Users,
                  title: "In a group",
                  text: "Family or friends travelling together",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setStyle(opt.value);
                  setStep(1);
                }}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                  style === opt.value
                    ? "border-primary bg-secondary"
                    : "border-border bg-card hover:border-primary"
                }`}
              >
                <opt.icon className="size-6 text-primary" />
                <span>
                  <span className="block font-semibold">{opt.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {opt.text}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                toast.error("Please add your name");
                return;
              }
              const phoneError = validatePhone(normalizePhone(phone));
              if (phoneError) {
                toast.error(phoneError);
                return;
              }
              if (style === "group") setStep(2);
              else save.mutate();
            }}
          >
            <h2 className="text-xl font-semibold">Your trip details</h2>
            <div className="space-y-1.5">
              <Label htmlFor="tname">Your name</Label>
              <Input
                id="tname"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                placeholder="e.g. 9876543210"
                maxLength={15}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dest">Which city are you based in?</Label>
              <select
                id="dest"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {GOA_PLACES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start">Arriving on</Label>
                <Input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="days">Number of days</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) =>
                    setDays(
                      Math.max(1, Math.min(60, Number(e.target.value) || 1)),
                    )
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(0)}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={save.isPending}
              >
                {style === "group"
                  ? "Next: who's travelling"
                  : save.isPending
                    ? "Saving…"
                    : "Save trip"}
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Who's travelling?</h2>
            <p className="text-sm text-muted-foreground">
              Add each person. We use kids and seniors to tailor safety tips and
              QR tags.
              <br />
              Only the phone numbers you add here can be tracked later. Add a
              number for anyone you want to be able to find if you get
              separated.
            </p>
            <div className="space-y-3">
              {people.map((p, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="grid grid-cols-[1fr_5rem] gap-2">
                    <Input
                      placeholder="Name"
                      value={p.name}
                      maxLength={60}
                      onChange={(e) =>
                        setPeople(
                          people.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder="Age"
                      type="number"
                      min={0}
                      max={120}
                      value={p.age}
                      onChange={(e) =>
                        setPeople(
                          people.map((x, j) =>
                            j === i ? { ...x, age: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="mt-2">
                    <Input
                      id={`person-phone-${i}`}
                      type="tel"
                      inputMode="tel"
                      maxLength={20}
                      placeholder="Phone number (optional)"
                      value={p.phone}
                      aria-invalid={!!phoneErrors[i]}
                      aria-describedby={
                        phoneErrors[i] ? `phone-error-${i}` : undefined
                      }
                      onChange={(e) => {
                        const newPeople = people.map((x, j) =>
                          j === i ? { ...x, phone: e.target.value } : x,
                        );
                        setPeople(newPeople);
                        if (phoneTouched[i] && phoneErrors[i]) {
                          const err = validatePersonPhone(
                            i,
                            e.target.value,
                            newPeople,
                            phone,
                          );
                          setPhoneErrors((prev) => ({
                            ...prev,
                            [i]: err || "",
                          }));
                        }
                      }}
                      onBlur={() => {
                        setPhoneTouched((prev) => ({ ...prev, [i]: true }));
                        const err = validatePersonPhone(
                          i,
                          p.phone,
                          people,
                          phone,
                        );
                        setPhoneErrors((prev) => ({ ...prev, [i]: err || "" }));
                      }}
                    />
                    {phoneErrors[i] && (
                      <p
                        id={`phone-error-${i}`}
                        className="mt-1 text-sm text-destructive"
                      >
                        {phoneErrors[i]}
                      </p>
                    )}
                    {p.phone.trim() !== "" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Only numbers added here can be tracked. They must agree
                        to share their location on their own phone.
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {(["adult", "kid", "senior"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setPeople(
                            people.map((x, j) =>
                              j === i ? { ...x, category: c } : x,
                            ),
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs capitalize ${
                          p.category === c
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                    {people.length > 1 && (
                      <button
                        type="button"
                        aria-label="Remove traveller"
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setPeople(people.filter((_, j) => j !== i))
                        }
                      >
                        <Minus className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setPeople([
                  ...people,
                  { name: "", age: "", category: "adult", phone: "" },
                ])
              }
            >
              <Plus className="size-4" /> Add person
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => save.mutate()}
                disabled={save.isPending}
              >
                {save.isPending ? "Saving…" : "Save trip"}
              </Button>
            </div>
          </div>
        )}
      </fieldset>
    </AppShell>
  );
}
