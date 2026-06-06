import { useEffect, useRef, useState } from 'react'

const DEFAULT_SESSION_MINUTES = 30
const DEFAULT_WARNING_BEFORE_MS = 2 * 60 * 1000

export function useSessionTimer(onExpire: () => void, sessionMinutes = DEFAULT_SESSION_MINUTES) {
  const [showWarning, setShowWarning] = useState(false)
  const effectiveMinutes = sessionMinutes > 0 ? sessionMinutes : DEFAULT_SESSION_MINUTES
  const warningBeforeMs = Math.min(DEFAULT_WARNING_BEFORE_MS, Math.max(10_000, Math.floor(effectiveMinutes * 60 * 1000 / 2)))
  const expireAt = useRef<number>(Date.now() + effectiveMinutes * 60 * 1000)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const resetTimer = () => {
    expireAt.current = Date.now() + effectiveMinutes * 60 * 1000
    setShowWarning(false)
    scheduleCheck()
  }

  const scheduleCheck = () => {
    clearTimeout(timer.current)
    const now = Date.now()
    const timeUntilWarning = expireAt.current - now - warningBeforeMs
    const timeUntilExpiry = expireAt.current - now

    if (timeUntilExpiry <= 0) {
      onExpire()
      return
    }

    if (timeUntilWarning > 0) {
      timer.current = setTimeout(() => {
        setShowWarning(true)
        timer.current = setTimeout(onExpire, warningBeforeMs)
      }, timeUntilWarning)
    } else {
      setShowWarning(true)
      timer.current = setTimeout(onExpire, timeUntilExpiry)
    }
  }

  useEffect(() => {
    expireAt.current = Date.now() + effectiveMinutes * 60 * 1000
    scheduleCheck()
    const events = ['mousemove', 'keydown', 'click', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))
    return () => {
      clearTimeout(timer.current)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMinutes])

  return { showWarning, resetTimer }
}
