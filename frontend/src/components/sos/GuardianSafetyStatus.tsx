import { useSosSignals } from "@/features/tracking/hooks/useSosSignals";
import { Link } from "@tanstack/react-router";
import { useGuardianWorkspace } from "@/features/tracking/hooks/useGuardianWorkspace";
export function GuardianSafetyStatus() {
  const query = useGuardianWorkspace(true);
  useSosSignals(query.data?.incidents ?? []);
  if (!query.data?.incidents.length) return null;
  return (
    <div
      role="alert"
      className="relative z-30 border-b border-destructive/40 bg-destructive/10 p-3 text-center text-sm font-semibold text-destructive"
    >
      <Link to="/live-tracking">
        SOS active:{" "}
        {query.data.incidents
          .map((incident) => incident.sender_name)
          .join(", ")}{" "}
        · Open Reunite
      </Link>
    </div>
  );
}
