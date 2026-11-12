/**
 * 客户端数据层。
 *
 * 请求函数全部来自 GenAPI 生成物（`src/client/apis`），不手写 URL ——
 * 路由一改，生成物跟着变，客户端不会静默调错地址。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { POLL_INTERVAL_MS } from '../constants'

export * from './apis'

/** 轮询结果。`data` 在第一次成功前是 undefined。 */
export interface Polled<T> {
  data: T | undefined
  error: string | undefined
  reload: () => Promise<void>
}

/**
 * 定时拉一次。
 *
 * 失败时保留上一次的数据并暴露 `error` —— 面板不该因为一次网络抖动就整屏变空。
 */
export function usePoll<T>(load: () => Promise<T>, interval = POLL_INTERVAL_MS, deps: readonly unknown[] = []): Polled<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  // load 每次渲染都是新函数，用 ref 拿最新的，避免把它放进依赖里反复重启定时器
  const latest = useRef(load)
  latest.current = load
  const alive = useRef(true)

  const reload = useCallback(async (): Promise<void> => {
    try {
      const next = await latest.current()
      if (!alive.current)
        return
      setData(next)
      setError(undefined)
    }
    catch (failure) {
      if (!alive.current)
        return
      setError(errorText(failure))
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void reload()
    if (!interval) {
      return () => {
        alive.current = false
      }
    }
    const timer = setInterval(() => {
      void reload()
    }, interval)
    return () => {
      alive.current = false
      clearInterval(timer)
    }
    // deps 由调用方给，重新拉取的时机应跟着它走
  }, [interval, reload, ...deps])

  return { data, error, reload }
}

/** 把任何异常变成一句人话。 */
export function errorText(failure: unknown): string {
  if (failure instanceof Error)
    return failure.message
  if (typeof failure === 'string')
    return failure
  return '请求失败'
}

/** 写操作的忙碌态与错误处理。返回 true 表示成功。 */
export function useAction(action: () => Promise<unknown>, reload?: () => Promise<unknown>): {
  run: () => Promise<boolean>
  busy: boolean
  error: string | undefined
} {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const running = useRef(false)

  const run = useCallback(async (): Promise<boolean> => {
    if (running.current)
      return false
    running.current = true
    setBusy(true)
    setError(undefined)
    try {
      await action()
      await reload?.()
      return true
    }
    catch (failure) {
      setError(errorText(failure))
      return false
    }
    finally {
      running.current = false
      setBusy(false)
    }
  }, [action, reload])

  return { run, busy, error }
}
