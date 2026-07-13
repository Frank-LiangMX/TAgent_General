import { useAtomValue } from 'jotai'

import { Toaster } from '@tagent/ui'

import { resolvedThemeAtom } from '@/atoms/theme'

type ToasterProps = React.ComponentProps<typeof Toaster>

/**
 * Toaster 薄包装：读 jotai theme atom 注入给纯展示组件 Toaster。
 * packages/ui 的 Toaster 不耦合状态管理，theme 由调用方传入。
 */
const ToasterWithTheme = ({ ...props }: Omit<ToasterProps, 'theme'>) => {
  const theme = useAtomValue(resolvedThemeAtom)
  return <Toaster theme={theme as ToasterProps['theme']} {...props} />
}

export { ToasterWithTheme as Toaster }
