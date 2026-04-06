import * as React from "react"

const MOBILE_BREAKPOINT = 768

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribeMobile(cb: () => void) {
  const mql = window.matchMedia(query)
  mql.addEventListener("change", cb)
  return () => mql.removeEventListener("change", cb)
}

function getMobileSnapshot() {
  return window.matchMedia(query).matches
}

function getServerMobileSnapshot() {
  return false
}

/**
 * True when viewport is below the md breakpoint. Uses useSyncExternalStore so
 * the first client paint matches the real viewport (avoids treating phones as
 * desktop before useEffect runs — broke mobile sidebar toggle / sheet).
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getServerMobileSnapshot
  )
}
