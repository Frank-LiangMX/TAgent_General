export const DEV_RENDERER_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000, 3_000] as const

export interface RendererLoadRetryOptions {
  isDev: boolean
  isDestroyed: () => boolean
  load: () => Promise<void>
  onAttemptFailure?: (error: unknown, attempt: number) => void
  retryDelaysMs?: readonly number[]
  sleep?: (delayMs: number) => Promise<void>
}

export interface RendererLoadResult {
  success: boolean
  attempts: number
  error?: unknown
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

/**
 * Load the renderer while tolerating short-lived development network failures.
 *
 * Chromium may restart its network utility process while a TUN adapter changes
 * routes. Retrying the local Vite URL keeps that recovery from turning into a
 * permanently hidden application window. Production loads still fail fast.
 */
export async function loadRendererWithRetry(
  options: RendererLoadRetryOptions
): Promise<RendererLoadResult> {
  const retryDelays = options.retryDelaysMs ?? DEV_RENDERER_RETRY_DELAYS_MS
  const sleep = options.sleep ?? defaultSleep
  let attempts = 0

  while (!options.isDestroyed()) {
    attempts += 1

    try {
      await options.load()
      return { success: true, attempts }
    } catch (error) {
      options.onAttemptFailure?.(error, attempts)

      const retryDelay = retryDelays[attempts - 1]
      if (!options.isDev || retryDelay === undefined || options.isDestroyed()) {
        return { success: false, attempts, error }
      }

      await sleep(retryDelay)
    }
  }

  return { success: false, attempts }
}
