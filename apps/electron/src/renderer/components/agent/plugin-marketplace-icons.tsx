import * as React from 'react'

import type { PluginStoreLogoKey } from '@tagent/shared'

import context7Docs from '@/assets/plugin-icons/context7-docs.svg'
import frontendE2e from '@/assets/plugin-icons/frontend-e2e.svg'
import githubDevCollab from '@/assets/plugin-icons/github-dev-collab.svg'
import officeSuite from '@/assets/plugin-icons/office-suite.svg'
import planningSuite from '@/assets/plugin-icons/planning-suite.svg'
import skillWorkshop from '@/assets/plugin-icons/skill-workshop.svg'
import taAgentSuite from '@/assets/plugin-icons/ta-agent-suite.svg'

// superpowers-full 临时复用 planning-suite logo（后续换专属 icon）
const superpowersFull = planningSuite

export const PLUGIN_BUNDLE_LOGO_URLS: Record<PluginStoreLogoKey, string> = {
  'ta-agent-suite': taAgentSuite,
  'github-dev-collab': githubDevCollab,
  'frontend-e2e': frontendE2e,
  'context7-docs': context7Docs,
  'office-suite': officeSuite,
  'planning-suite': planningSuite,
  'skill-workshop': skillWorkshop,
  'superpowers-full': superpowersFull,
}

interface PluginBundleLogoProps {
  logo: PluginStoreLogoKey
  className?: string
  alt: string
}

export function PluginBundleLogo({
  logo,
  className,
  alt,
}: PluginBundleLogoProps): React.ReactElement {
  return (
    <img
      src={PLUGIN_BUNDLE_LOGO_URLS[logo]}
      alt={alt}
      className={className}
      draggable={false}
    />
  )
}
