/** A hold must remain uninterrupted for two seconds. Scheduling is injectable for tests. */
export function createHoldTrigger(
  activate: () => void,
  schedule: (run: () => void, ms: number) => () => void = (run, ms) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
) {
  let cancelTask: (() => void) | null = null;
  return {
    start() {
      if (cancelTask) return;
      cancelTask = schedule(() => {
        cancelTask = null;
        activate();
      }, 2000);
    },
    cancel() {
      cancelTask?.();
      cancelTask = null;
    },
  };
}
