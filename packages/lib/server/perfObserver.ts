import { PerformanceObserver } from "perf_hooks";

declare global {
  // eslint-disable-next-line no-var
  var perfObserver: PerformanceObserver | undefined;
}
export const perfObserver =
  globalThis.perfObserver ||
  new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      // Log entry duration in seconds with four decimal places.
      if (!!process.env.NEXT_PUBLIC_DEBUG)
        console.log(entry.name.replace("$1", `${(entry.duration / 1000.0).toFixed(4)}s`));
    });
  });

perfObserver.observe({ entryTypes: ["measure"] });

if (process.env.NODE_ENV !== "production") {
  globalThis.perfObserver = perfObserver;
}

export default perfObserver;

export { performance } from "perf_hooks";
