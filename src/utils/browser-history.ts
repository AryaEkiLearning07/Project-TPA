const NAVIGATION_STATE_KEY = 'tpaNavigation'

const toStateRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return {}
  }
  return value as Record<string, unknown>
}

export const parseNavigationState = <T>(
  state: unknown,
  guard: (value: unknown) => value is T,
): T | null => {
  const record = toStateRecord(state)
  const navigationState = record[NAVIGATION_STATE_KEY]
  return guard(navigationState) ? navigationState : null
}

export const readNavigationState = <T>(
  guard: (value: unknown) => value is T,
): T | null => {
  if (typeof window === 'undefined') {
    return null
  }
  return parseNavigationState(window.history.state, guard)
}

const mergeNavigationState = (nextNavigationState: unknown): Record<string, unknown> => ({
  ...toStateRecord(window.history.state),
  [NAVIGATION_STATE_KEY]: nextNavigationState,
})

export const replaceNavigationState = (nextNavigationState: unknown): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.history.replaceState(
    mergeNavigationState(nextNavigationState),
    '',
    window.location.href,
  )
}

export const pushNavigationState = (nextNavigationState: unknown): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.history.pushState(
    mergeNavigationState(nextNavigationState),
    '',
    window.location.href,
  )
}
