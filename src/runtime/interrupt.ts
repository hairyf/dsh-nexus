import { LedgerError } from '../database'

export async function interruptible<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal)
    return operation()
  if (signal.aborted)
    throw new LedgerError('interrupted_tool')
  let abort: () => void = () => {}
  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new LedgerError('interrupted_tool'))
    signal.addEventListener('abort', abort, { once: true })
  })
  try {
    return await Promise.race([operation(), interrupted])
  }
  finally {
    signal.removeEventListener('abort', abort)
  }
}

export function checkInterrupt(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new LedgerError('interrupted_tool')
}
