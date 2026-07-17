import { AlertTriangle, ArrowLeft, RotateCw } from 'lucide-react'
import * as React from 'react'

interface TabErrorBoundaryProps {
  sessionId: string
  children: React.ReactNode
  fallbackAction?: { label: string; onClick: () => void }
}

interface TabErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

export class TabErrorBoundary extends React.Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  constructor(props: TabErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: unknown): TabErrorBoundaryState {
    const msg = error instanceof Error ? error.message : String(error)
    return { hasError: true, errorMessage: msg }
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('[TabErrorBoundary] 渲染异常:', error, info.componentStack)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' })
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
          <AlertTriangle className="size-10 text-destructive/60" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">页面渲染出错</p>
            <p className="text-xs text-muted-foreground max-w-xs break-all">
              {this.state.errorMessage}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <RotateCw className="size-3.5" aria-hidden />
              重新加载
            </button>
            {this.props.fallbackAction ? (
              <button
                type="button"
                onClick={this.props.fallbackAction.onClick}
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                {this.props.fallbackAction.label}
              </button>
            ) : null}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
