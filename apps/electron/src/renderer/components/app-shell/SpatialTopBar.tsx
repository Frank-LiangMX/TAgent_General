/**
 * SpatialTopBar — operating-system chrome for the main application window.
 *
 * Product navigation belongs to the rail and workspace tab strip. This layer
 * stays intentionally quiet so canvas and Office scenes do not inherit a
 * second, competing mode navigation.
 */

import * as React from 'react'

import { WindowControls } from '@/components/WindowControls'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

export function SpatialTopBar(): React.ReactElement {
  const isMac = React.useMemo(() => detectIsMac(), [])

  return (
    <header
      className={cn('app-spatial-topbar titlebar-drag-region', isMac && 'app-spatial-topbar--mac')}
    >
      <span className="app-spatial-topbar-version" aria-label={`版本 ${__APP_VERSION__}`}>
        v{__APP_VERSION__}
      </span>

      <span className="app-spatial-topbar-brand" aria-hidden="true">
        TAGENT
      </span>

      <WindowControls />
    </header>
  )
}
