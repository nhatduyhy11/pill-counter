export type OpenCVRuntime = typeof import("@techstark/opencv-js");

type OpenCVModuleShape = Partial<OpenCVRuntime> & {
  default?: unknown;
  cv?: unknown;
  Mat?: unknown;
  onRuntimeInitialized?: () => void;
};

let cvReady: OpenCVRuntime | null = null;
let cvLoading: Promise<OpenCVRuntime> | null = null;

export async function getCV(): Promise<OpenCVRuntime> {
  if (cvReady) return cvReady;
  if (cvLoading) return cvLoading;

  cvLoading = loadCV();
  cvReady = await cvLoading;
  return cvReady;
}

async function loadCV(): Promise<OpenCVRuntime> {
  const mod = (await import("@techstark/opencv-js")) as OpenCVModuleShape;
  const candidate = await resolveMaybePromise(mod.default ?? mod.cv ?? mod);

  if (isReadyCV(candidate)) return candidate;

  return waitForRuntime(candidate);
}

function isReadyCV(value: unknown): value is OpenCVRuntime {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as OpenCVModuleShape).Mat === "function"
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

async function resolveMaybePromise(value: unknown): Promise<unknown> {
  return isPromiseLike(value) ? value : Promise.resolve(value);
}

function waitForRuntime(candidate: unknown): Promise<OpenCVRuntime> {
  return new Promise((resolve, reject) => {
    const runtime = candidate as OpenCVModuleShape;
    const startedAt = Date.now();
    const timeoutMs = 10_000;
    const previousCallback = runtime.onRuntimeInitialized;

    runtime.onRuntimeInitialized = () => {
      previousCallback?.();
      if (isReadyCV(candidate)) resolve(candidate);
    };

    const poll = () => {
      if (isReadyCV(candidate)) {
        resolve(candidate);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("OpenCV runtime initialization timed out"));
        return;
      }

      setTimeout(poll, 25);
    };

    poll();
  });
}
