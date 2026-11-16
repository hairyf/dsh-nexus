import type { PanelModel } from '../../types/web'
import { createContext, useContext, useRef, useState } from 'react'
import { useStore } from './use-store'

export const RefreshContext = createContext<() => Promise<void>>(async () => { })
export function usePanel(): {
  data: PanelModel
  refresh: () => Promise<void>
} {
  const data = useStore(state => state.model) as PanelModel

  return { data, refresh: useContext(RefreshContext) }
}
export function useCommand(): {
  run: (label: string, operation: () => Promise<unknown>, success?: string) => Promise<void>
  busy: boolean
  feedback: string
  error: string
} {
  const { refresh } = usePanel()

  const lock = useRef(false)

  const [busy, setBusy] = useState(false)

  const [feedback, setFeedback] = useState('')

  const [error, setError] = useState('')

  async function run(label: string, operation: () => Promise<unknown>, success = '保存已受理。'): Promise<void> {
    if (lock.current)
      return

    lock.current = true

    setBusy(true)

    setFeedback(`${label}…`)

    setError('')

    try {
      const result = await operation()
      setFeedback(typeof result === 'string' ? result : success)

      await refresh()
    }
    catch (error) {
      setFeedback('')

      setError(`${label}失败：${error instanceof Error ? error.message : String(error)}。输入已保留，请核对后重试。`)
    }
    finally {
      lock.current = false

      setBusy(false)
    }
  }

  return { run, busy, feedback, error }
}
