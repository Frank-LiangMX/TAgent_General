## Summary

<1-3 句话概括改动>

## Cache 影响

- [ ] 改动不影响 system prompt 组装顺序
- [ ] 改动不动态增删工具
- [ ] 改动不插入新消息到会话中部
- [ ] 改动不翻转消息顺序

若任一未勾选：在此论证 cache 影响与替代方案，或说明属于"用户主动操作失效点"（permissionMode / mode / SOUL.md / eagerness）。详见 `CLAUDE.md` "Prompt Cache 不可侵犯" 段。

## Test plan

- [ ] `bun run typecheck` 通过
- [ ] `bun test` 通过
- [ ] 手动验证：<列出关键场景>

## 关联

<关联的 plan 文档 / issue / PR>
