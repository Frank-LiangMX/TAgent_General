# ADR-0002: Ask 妗ｄ綅缁熶竴 Composer锛堟浛浠ｇ嫭绔?Chat 妯″紡锛?
> **Status**: Superseded in part by ADR-0004  
> **Date**: 2026-06-13  
> **Implemented**: 2026-06-14  
> **Deciders**: 浜у搧鏂瑰悜锛堢敤鎴风‘璁わ級+ 宸ョ▼瀹炴柦寰呭姙

## Context

TAgent 闀挎湡缁存姢 **Chat 妯″紡** 涓?**Agent 妯″紡** 涓ゅ UI銆佷袱濂椾細璇濆瓨鍌紙`conversations/*` vs `agent-sessions/*`锛夊拰鍏ㄥ眬 `appMode` 浜掓枼鍒囨崲銆侰hat 鍏ュ彛鍒嗘暎锛堟杩庨〉銆佽缃€佸揩鎹烽敭锛夛紝涓?Rail銆屼細璇濄€嶅浘鏍囪涔夊啿绐侊紝涓旂浉瀵圭綉椤电 Chat 浜у搧缂轰箯鐙崰浠峰€笺€?
鍚屾椂 Agent 鍦烘櫙闇€瑕?**杞婚噺闂瓟**锛堣В閲婁笂涓嬫枃銆佺煭闂煭绛斻€佷笉瑙﹀彂宸ュ叿鏉冮檺锛夛紝宸叉湁 `/btw` 渚ч潰鎻愰棶涓?`btw-service` 瀹炵幇浜嗙被浼艰兘鍔涳紝浣嗕笌涓?Composer 鍓茶銆?
## Decision

1. **浠?Agent 浼氳瘽涓哄敮涓€涓讳細璇濇ā鍨?*锛涗笉鍐嶅皢 Chat 浣滀负涓?Agent 骞崇骇鐨勯《灞?`appMode`銆?2. 鍦?**Agent 杈撳叆鍖?* 澧炲姞 Composer 妗ｄ綅锛歚agent`锛堥粯璁わ級涓?`ask`锛堣交閲忓璇濓級锛屼氦浜掑鏍?Cursor Ask / Agent 鍒囨崲銆?3. **Ask 鍚庣** 澶嶇敤 `@tagent/core` Provider 娴佸紡涓?`chat-service` 缂栨帓缁忛獙锛屼絾缁戝畾 `agentSessionId`锛屾秷鎭瓨鍏ョ嫭绔?`ask.jsonl`锛屼笉鍐欏叆 SDK JSONL銆?4. Ask 璇锋眰娉ㄥ叆 **鏉冮檺杈圭晫濂戠害**锛堢郴缁熸彁绀猴級锛涢€氳繃鐧藉悕鍗曞伐鍏?`suggest_agent_switch` 寮曞鐢ㄦ埛鍒囧洖 Agent 妗ｄ綅锛堝悓浼氳瘽銆侀濉?prompt锛夛紝鑰岄潪鏂板缓 Chat 浼氳瘽銆?5. **娓愯繘閫€褰?* 鐙珛 Chat UI 涓?`conversations/*` 涓昏矾寰勶紱鏃ф暟鎹彧璇绘垨瀵煎嚭锛屼笉鑷姩鍒犻櫎鐢ㄦ埛鏂囦欢銆?
璇︾粏瀹炴柦瑙?[`plans/2026-06-13-ask-mode-unification-design.md`](plans/2026-06-13-ask-mode-unification-design.md)銆?
## Consequences

### Positive

- 鍗曚竴涓荤晫闈€佸崟渚ф爮銆佸崟 Tab 绫诲瀷锛岄檷浣庡鑸笌瀵归綈鎴愭湰銆?- Ask 涓?Agent 鍏变韩浼氳瘽涓婁笅鏂囦笌鏃堕棿绾匡紝绗﹀悎銆屽厛闂啀鍋氥€嶅伐浣滄祦銆?- 鏄庣‘鑳藉姏杈圭晫锛屽噺灏戞ā鍨嬪够瑙夋墽琛屾枃浠?鍛戒护銆?- 鍙鐢ㄧ幇鏈?`suggest_agent_mode` 涓?`AgentRecommendBanner` 閫昏緫銆?
### Negative

- 闇€鍚堝苟鏃堕棿绾挎覆鏌擄紙SDK 娑堟伅 + Ask 娑堟伅锛夈€?- 杩佺Щ鏈熼渶缁存姢 Chat 鍙鎴栧吋瀹逛唬鐮佺洿鑷?P3 鍒犻櫎銆?- 鍏ㄦ笭閬?Ask 涓?Agent 娓犻亾鑳藉姏涓嶄竴鑷撮渶鍦?UI 璇存槑銆?
### Neutral

- `packages/core` Provider 閫傞厤鍣ㄤ繚鐣欙紱`chat-service` 鍙兘鎷嗗垎涓哄叡浜祦寮忓唴鏍?+ `ask-service`銆?- `/btw` 涓?Ask 鍏崇郴闇€鍦?P2 鏀舵暃锛堝悎骞舵垨 deprecate锛夈€?
## Alternatives Considered

### Option A: 淇濈暀鍙屾ā寮忥紝浠呬紭鍖栦晶鏍?Chip 鍒囨崲

- Pros: 鏀瑰姩灏忋€?- Cons: 浠嶅弻鍒楄〃銆佸弻瀛樺偍銆乣appMode` 蹇冩櫤璐熸媴涓嶅彉锛涙湭瑙ｅ喅銆孋hat 鏃犵嫭鍗犱环鍊笺€嶉棶棰樸€?
### Option B: 瀹屽叏鍒犻櫎 Chat 鏍堬紝Ask 涓嶅鐢?chat-service

- Pros: 浠ｇ爜鍒犲緱澶氥€?- Cons: 閲嶅瀹炵幇娴佸紡銆佸伐鍏枫€侀檮浠讹紱宸ユ湡鏇撮暱銆?
### Option C: Ask 鍐欏叆 SDK 浼氳瘽锛堟棤宸ュ叿锛?
- Pros: 鍗曚竴 JSONL銆?- Cons: SDK 娑堟伅 schema 涓?Provider 娣风敤澶嶆潅锛涙薄鏌?Agent resume 涓婁笅鏂囥€?
## References

- [`plans/2026-06-13-ask-mode-unification-design.md`](plans/2026-06-13-ask-mode-unification-design.md)
- `apps/electron/src/main/lib/btw-service.ts`
- `apps/electron/src/main/lib/chat-tools/agent-recommend-tool.ts`
- `apps/electron/src/renderer/components/chat/AgentRecommendBanner.tsx`

