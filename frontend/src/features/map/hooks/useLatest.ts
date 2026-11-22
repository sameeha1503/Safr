import { useEffect, useRef } from "react";

export function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef<T>(value);
  ref.current = value;
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
