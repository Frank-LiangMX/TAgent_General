# 长会话 UI 优化

> **状态**：Proposed
> **日期**：2026-07-24
> **目标**：借鉴 Kun 的设计，优化长会话 UI，避免卡顿
> **关联**：
> - `docs/plans/2026-07-24-2.0-refactor-overview.md`（2.0 重构总览）
> - `F:\Kun\src\renderer\src\components\chat\use-timeline-scroll.ts`（Kun 实现）

---

## 1. 背景

### 1.1 现状

当前 TAgent 的长会话 UI：
- 全量渲染所有消息
- 长会话（50+ turn）卡顿
- minimap 和刻度条显示完整历史

### 1.2 问题

1. **性能问题**：全量渲染导致长会话卡顿
2. **内存占用**：DOM 节点过多，内存占用高
3. **用户体验**：滚动卡顿，影响使用

### 1.3 目标

- 长会话不卡顿
- 保持 minimap 和刻度条的导航能力
- 借鉴 Kun 的设计，但适配 TAgent 的架构

---

## 2. 决策

### 2.1 Kun 的设计

**核心理念**：分页懒加载 + 折叠旧历史

```
长会话（50 个 turn）
    ↓
只渲染最近 18 个 turn（TURN_PAGE_SIZE = 18）
    ↓
滚动到顶部 → 加载更多（懒加载）
    ↓
折叠旧历史 → 显示"显示更早的 N 条消息"按钮
```

**代码逻辑**：
```typescript
const TURN_PAGE_SIZE = 18

// 只渲染最近 18 个 turn
const visibleTurns = turns.slice(hiddenTurnCount)

// 滚动到顶部 120px 时触发加载
if (scrollTop < TOP_LOAD_TRIGGER_PX) {
  loadEarlierTurns()
}

// 长会话时自动折叠
if (shouldCollapseHistory) {
  // 显示"显示更早的 18 条消息"按钮
}
```

### 2.2 TAgent 的设计

**借鉴 Kun，但适配 TAgent 的架构**：

```
┌─────────────────────────────────────────────┐
│  minimap（完整历史缩略图）                   │
│  ┌─────────────────────────────────────┐    │
│  │  Turn 1  ░░░░░░░░░░░░░░░░░░░░░░░░  │    │
│  │  Turn 2  ░░░░░░░░░░░░░░░░░░░░░░░░  │    │
│  │  Turn 3  ░░░░░░░░░░░░░░░░░░░░░░░░  │    │
│  │  ...                               │    │
│  │  Turn 18 █████████████████████████  │ ← 当前可视 │
│  │  Turn 19 █████████████████████████  │    │
│  │  Turn 20 █████████████████████████  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  消息列表（只渲染最近 18 个 turn）           │
│  ┌─────────────────────────────────────┐    │
│  │  [显示更早的 18 条消息]              │    │
│  │  Turn 3: 用户消息                    │    │
│  │  Turn 3: 助手回复                    │    │
│  │  ...                               │    │
│  │  Turn 20: 用户消息                   │    │
│  │  Turn 20: 助手回复                   │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  左侧刻度条（完整历史）                      │
│  ├── Turn 1                                 │
│  ├── Turn 2                                 │
│  ├── Turn 3                                 │
│  ├── ...                                    │
│  ├── Turn 18                                │
│  ├── Turn 19                                │
│  └── Turn 20                                │
└─────────────────────────────────────────────┘
```

**与 Kun 的差异**：
- TAgent 有 minimap，Kun 没有
- TAgent 有左侧刻度条，Kun 没有
- TAgent 需要适配现有的 minimap 和刻度条

---

## 3. 实现设计

### 3.1 分页渲染

```typescript
const TURN_PAGE_SIZE = 18

function usePaginatedTurns(turns: Turn[]) {
  const [visibleCount, setVisibleCount] = useState(TURN_PAGE_SIZE)
  
  const visibleTurns = useMemo(
    () => turns.slice(Math.max(0, turns.length - visibleCount)),
    [turns, visibleCount]
  )
  
  const hiddenTurns = useMemo(
    () => turns.slice(0, Math.max(0, turns.length - visibleCount)),
    [turns, visibleCount]
  )
  
  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(turns.length, prev + TURN_PAGE_SIZE))
  }, [turns.length])
  
  return { visibleTurns, hiddenTurns, loadMore }
}
```

### 3.2 懒加载触发

```typescript
const TOP_LOAD_TRIGGER_PX = 120

function useLazyLoad(containerRef: RefObject<HTMLDivElement>, loadMore: () => void) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleScroll = () => {
      if (container.scrollTop < TOP_LOAD_TRIGGER_PX) {
        loadMore()
      }
    }
    
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [containerRef, loadMore])
}
```

### 3.3 粘性底部

```typescript
const STICK_TO_BOTTOM_PX = 96

function useStickToBottom(containerRef: RefObject<HTMLDivElement>, deps: any[]) {
  const isSticking = useRef(true)
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleScroll = () => {
      const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      isSticking.current = distanceToBottom < STICK_TO_BOTTOM_PX
    }
    
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [containerRef])
  
  useEffect(() => {
    if (isSticking.current) {
      const container = containerRef.current
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
  }, deps)
}
```

### 3.4 折叠旧历史

```typescript
function CollapsedHistoryButton({ hiddenCount, onLoadMore }: {
  hiddenCount: number
  onLoadMore: () => void
}) {
  if (hiddenCount === 0) return null
  
  return (
    <button onClick={onLoadMore} className="collapsed-history-button">
      显示更早的 {Math.min(hiddenCount, TURN_PAGE_SIZE)} 条消息
    </button>
  )
}
```

---

## 4. minimap 和刻度条适配

### 4.1 minimap 适配

**需求**：minimap 显示完整历史，点击跳转到对应 turn

**实现**：
```typescript
function Minimap({ turns, visibleTurns, onJumpToTurn }: {
  turns: Turn[]
  visibleTurns: Turn[]
  onJumpToTurn: (turnId: string) => void
}) {
  return (
    <div className="minimap">
      {turns.map(turn => (
        <div
          key={turn.id}
          className={cn(
            'minimap-item',
            visibleTurns.includes(turn) && 'minimap-item-visible'
          )}
          onClick={() => onJumpToTurn(turn.id)}
        />
      ))}
    </div>
  )
}
```

### 4.2 刻度条适配

**需求**：刻度条显示完整历史，点击跳转到对应 turn

**实现**：
```typescript
function TimelineRail({ turns, visibleTurns, onJumpToTurn }: {
  turns: Turn[]
  visibleTurns: Turn[]
  onJumpToTurn: (turnId: string) => void
}) {
  return (
    <div className="timeline-rail">
      {turns.map(turn => (
        <div
          key={turn.id}
          className={cn(
            'rail-item',
            visibleTurns.includes(turn) && 'rail-item-visible'
          )}
          onClick={() => onJumpToTurn(turn.id)}
        />
      ))}
    </div>
  )
}
```

### 4.3 跳转逻辑

```typescript
function useJumpToTurn(containerRef: RefObject<HTMLDivElement>) {
  const jumpToTurn = useCallback((turnId: string) => {
    const container = containerRef.current
    if (!container) return
    
    const turnElement = container.querySelector(`[data-turn-id="${turnId}"]`)
    if (turnElement) {
      turnElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [containerRef])
  
  return jumpToTurn
}
```

---

## 5. 工作量

| 改动 | 工作量 | 说明 |
|------|--------|------|
| 分页渲染 | 0.5 天 | usePaginatedTurns hook |
| 懒加载触发 | 0.5 天 | useLazyLoad hook |
| 粘性底部 | 0.5 天 | useStickToBottom hook |
| 折叠旧历史 | 0.5 天 | CollapsedHistoryButton 组件 |
| minimap 适配 | 0.5 天 | Minimap 组件 + 跳转逻辑 |
| 刻度条适配 | 0.5 天 | TimelineRail 组件 + 跳转逻辑 |
| **总计** | **3 天** | |

---

## 6. 验收标准

- [ ] 长会话（50+ turn）不卡顿
- [ ] 只渲染最近 18 个 turn
- [ ] 滚动到顶部自动加载更多
- [ ] 显示"显示更早的 N 条消息"按钮
- [ ] 新消息到达时自动滚动到底部
- [ ] minimap 显示完整历史，点击跳转
- [ ] 刻度条显示完整历史，点击跳转

---

## 7. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-07-24 | 初稿：背景、决策、实现、验收 |
