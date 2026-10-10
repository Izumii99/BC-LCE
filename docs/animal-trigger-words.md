# 動物動畫文字觸發詞 / Animal trigger words

在聊天室輸入 `*詞*` 或 `*詞`（結尾星號可省略）並送出即可觸發（說明見 [README](../README.md#動物動畫耳朵尾巴翅膀)）。**七種語言的詞全部有效，與你的介面語言無關**：房間裡的人用哪種語言，都可以用自己的語言觸發。

Type `*word*` or `*word` (the closing asterisk is optional) in a chatroom and send it. **All seven languages work regardless of your UI language.** The source of truth is [`src/features/animal/triggers.js`](../src/features/animal/triggers.js); keep this page in sync with it.

## 規則 / Rules

- 整句訊息必須只有 `*詞*` 或 `*詞`，不能夾其他文字；開頭的 `*` 必填，結尾的 `*` 可省略（BC 對兩種寫法的動作效果相同）。The whole message must be exactly `*word*` or `*word`; the opening asterisk is required, the closing one is optional.
- 大小寫、重音符號（é、ö、ё…）、重複空白都不影響；結尾的語氣符號（`~`、`～`、`!`、`！`、`?`、`.`、`。`、`,`、`…`、`♪`、`♥`）會先去掉，所以 `*搖尾巴~*`、`*wag!` 也算；半形 `*` 與全形 `＊` 皆可。Case, accents and extra spaces are ignored; both `*` and full-width `＊` work.
- 同一個詞不會同時屬於兩個部位（載入時會檢查，重複會直接報錯）。
- 部位開關要打開，且 A、B 姿勢都已儲存才會播放。

## 耳朵 Ears

| 語言 / Language | 觸發詞 / Words |
|---|---|
| English | `*wiggle*`、`*wiggles*`、`*wiggling*`、`*twitch*`、`*twitches*`、`*twitching*`、`*wiggle ears*`、`*wiggles ears*`、`*wiggling ears*`、`*wiggle ear*`、`*wiggles ear*`、`*twitch ears*`、`*twitches ears*`、`*twitching ears*`、`*twitch ear*`、`*twitches ear*`、`*shake ears*`、`*shakes ears*`、`*flick ears*`、`*flicks ears*` |
| 繁體中文 | `*搖耳朵*`、`*晃耳朵*`、`*抖耳朵*`、`*動耳朵*`、`*搖動耳朵*`、`*擺動耳朵*`、`*甩耳朵*`、`*搖搖耳朵*`、`*晃晃耳朵*`、`*抖抖耳朵*`、`*動動耳朵*`、`*抖動耳朵*`、`*晃動耳朵*` |
| 简体中文 | `*摇耳朵*`、`*晃耳朵*`、`*抖耳朵*`、`*动耳朵*`、`*摇动耳朵*`、`*摆动耳朵*`、`*甩耳朵*`、`*摇摇耳朵*`、`*晃晃耳朵*`、`*抖抖耳朵*`、`*动动耳朵*`、`*抖动耳朵*`、`*晃动耳朵*` |
| Русский | `*шевелит ушами*`、`*шевелит ушками*`、`*дергает ушами*`、`*дергает ушками*`、`*шевелить ушами*` |
| Français | `*remue les oreilles*`、`*bouge les oreilles*`、`*agite les oreilles*`、`*frétille des oreilles*` |
| Українська | `*ворушить вухами*`、`*ворушить вушками*`、`*сіпає вухами*`、`*сіпає вушками*` |
| Deutsch | `*wackelt mit den ohren*`、`*zuckt mit den ohren*`、`*bewegt die ohren*` |

## 尾巴 Tail

| 語言 / Language | 觸發詞 / Words |
|---|---|
| English | `*wag*`、`*wags*`、`*wagging*`、`*wag tail*`、`*wags tail*`、`*wagging tail*`、`*swish*`、`*swishes*`、`*swish tail*`、`*swishes tail*`、`*wiggle tail*`、`*wiggles tail*`、`*shake tail*`、`*shakes tail*` |
| 繁體中文 | `*搖尾巴*`、`*擺尾巴*`、`*甩尾巴*`、`*搖擺尾巴*`、`*搖動尾巴*`、`*晃尾巴*`、`*動尾巴*`、`*搖搖尾巴*`、`*擺擺尾巴*`、`*甩甩尾巴*`、`*動動尾巴*`、`*擺動尾巴*`、`*晃動尾巴*` |
| 简体中文 | `*摇尾巴*`、`*摆尾巴*`、`*甩尾巴*`、`*摇摆尾巴*`、`*摇动尾巴*`、`*晃尾巴*`、`*动尾巴*`、`*摇摇尾巴*`、`*摆摆尾巴*`、`*甩甩尾巴*`、`*动动尾巴*`、`*摆动尾巴*`、`*晃动尾巴*` |
| Русский | `*виляет хвостом*`、`*машет хвостом*`、`*помахивает хвостом*`、`*вилять хвостом*` |
| Français | `*remue la queue*`、`*agite la queue*`、`*bouge la queue*`、`*frétille de la queue*` |
| Українська | `*виляє хвостом*`、`*махає хвостом*`、`*помахує хвостом*` |
| Deutsch | `*wedelt mit dem schwanz*`、`*wackelt mit dem schwanz*`、`*bewegt den schwanz*`、`*wedelt mit dem schweif*` |

## 翅膀 Wings

| 語言 / Language | 觸發詞 / Words |
|---|---|
| English | `*flap*`、`*flaps*`、`*flapping*`、`*flap wings*`、`*flaps wings*`、`*flapping wings*`、`*flap wing*`、`*flaps wing*`、`*flutter*`、`*flutters*`、`*flutter wings*`、`*flutters wings*` |
| 繁體中文 | `*拍翅膀*`、`*搧翅膀*`、`*揮翅膀*`、`*拍動翅膀*`、`*搖翅膀*`、`*動翅膀*`、`*拍拍翅膀*`、`*搧搧翅膀*`、`*揮動翅膀*`、`*擺動翅膀*`、`*振動翅膀*`、`*搧動翅膀*`、`*動動翅膀*`、`*振翅*` |
| 简体中文 | `*拍翅膀*`、`*扇翅膀*`、`*挥翅膀*`、`*拍动翅膀*`、`*摇翅膀*`、`*动翅膀*`、`*拍拍翅膀*`、`*扇扇翅膀*`、`*挥动翅膀*`、`*摆动翅膀*`、`*振动翅膀*`、`*扇动翅膀*`、`*动动翅膀*`、`*振翅*` |
| Русский | `*машет крыльями*`、`*хлопает крыльями*`、`*взмахивает крыльями*`、`*трепещет крыльями*` |
| Français | `*bat des ailes*`、`*bat les ailes*`、`*agite les ailes*`、`*remue les ailes*` |
| Українська | `*махає крилами*`、`*змахує крилами*`、`*тріпоче крилами*` |
| Deutsch | `*flattert mit den flügeln*`、`*schlägt mit den flügeln*`、`*wackelt mit den flügeln*`、`*bewegt die flügel*` |

> 繁／簡中文與英文是依「動作詞 × 部位」整理，涵蓋常見的疊字（`搖搖`）、動詞加動（`搖動`）與進行式（`wagging`）。此表由 `src/features/animal/triggers.js` 對照產生，`tests/animal.test.mjs` 會檢查兩邊是否同步。
>
> 俄、烏、法、德語的詞由非母語者整理，若有不自然的說法，歡迎直接修改 `src/features/animal/triggers.js` 與本頁。
