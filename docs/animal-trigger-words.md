# 動物動畫文字觸發詞 / Animal trigger words

在聊天室輸入 `*詞*` 並送出即可觸發（說明見 [README](../README.md#動物動畫耳朵尾巴翅膀)）。**七種語言的詞全部有效，與你的介面語言無關**：房間裡的人用哪種語言，都可以用自己的語言觸發。

Type `*word*` in a chatroom and send it. **All seven languages work regardless of your UI language.** The source of truth is [`src/features/animal/triggers.js`](../src/features/animal/triggers.js); keep this page in sync with it.

## 規則 / Rules

- 整句訊息必須只有 `*詞*`，不能夾其他文字。The whole message must be exactly `*word*`.
- 大小寫、重音符號（é、ö、ё…）、重複空白都不影響；半形 `*` 與全形 `＊` 皆可。Case, accents and extra spaces are ignored; both `*` and full-width `＊` work.
- 同一個詞不會同時屬於兩個部位（載入時會檢查，重複會直接報錯）。
- 部位開關要打開，且 A、B 姿勢都已儲存才會播放。

## 耳朵 Ears

| 語言 / Language | 觸發詞 / Words |
|---|---|
| English | `*wiggle*`、`*wiggles*`、`*twitch*`、`*twitches*`、`*wiggle ears*`、`*wiggles ears*`、`*twitch ears*`、`*twitches ears*` |
| 繁體中文 | `*搖耳朵*`、`*晃耳朵*`、`*抖耳朵*`、`*動耳朵*`、`*搖動耳朵*`、`*擺動耳朵*` |
| 简体中文 | `*摇耳朵*`、`*晃耳朵*`、`*抖耳朵*`、`*动耳朵*`、`*摇动耳朵*`、`*摆动耳朵*` |
| Русский | `*шевелит ушами*`、`*шевелит ушками*`、`*дергает ушами*`、`*дергает ушками*`、`*шевелить ушами*` |
| Français | `*remue les oreilles*`、`*bouge les oreilles*`、`*agite les oreilles*`、`*frétille des oreilles*` |
| Українська | `*ворушить вухами*`、`*ворушить вушками*`、`*сіпає вухами*`、`*сіпає вушками*` |
| Deutsch | `*wackelt mit den ohren*`、`*zuckt mit den ohren*`、`*bewegt die ohren*` |

## 尾巴 Tail

| 語言 / Language | 觸發詞 / Words |
|---|---|
| English | `*wag*`、`*wags*`、`*wag tail*`、`*wags tail*` |
| 繁體中文 | `*搖尾巴*`、`*擺尾巴*`、`*甩尾巴*`、`*搖擺尾巴*`、`*搖動尾巴*` |
| 简体中文 | `*摇尾巴*`、`*摆尾巴*`、`*甩尾巴*`、`*摇摆尾巴*`、`*摇动尾巴*` |
| Русский | `*виляет хвостом*`、`*машет хвостом*`、`*помахивает хвостом*`、`*вилять хвостом*` |
| Français | `*remue la queue*`、`*agite la queue*`、`*bouge la queue*`、`*frétille de la queue*` |
| Українська | `*виляє хвостом*`、`*махає хвостом*`、`*помахує хвостом*` |
| Deutsch | `*wedelt mit dem schwanz*`、`*wackelt mit dem schwanz*`、`*bewegt den schwanz*`、`*wedelt mit dem schweif*` |

## 翅膀 Wings

| 語言 / Language | 觸發詞 / Words |
|---|---|
| English | `*flap*`、`*flaps*`、`*flap wings*`、`*flaps wings*` |
| 繁體中文 | `*拍翅膀*`、`*搧翅膀*`、`*揮翅膀*`、`*振翅*`、`*拍動翅膀*` |
| 简体中文 | `*拍翅膀*`、`*扇翅膀*`、`*挥翅膀*`、`*振翅*`、`*拍动翅膀*` |
| Русский | `*машет крыльями*`、`*хлопает крыльями*`、`*взмахивает крыльями*`、`*трепещет крыльями*` |
| Français | `*bat des ailes*`、`*bat les ailes*`、`*agite les ailes*`、`*remue les ailes*` |
| Українська | `*махає крилами*`、`*змахує крилами*`、`*тріпоче крилами*` |
| Deutsch | `*flattert mit den flügeln*`、`*schlägt mit den flügeln*`、`*wackelt mit den flügeln*`、`*bewegt die flügel*` |

> 俄、烏、法、德語的詞由非母語者整理，若有不自然的說法，歡迎直接修改 `src/features/animal/triggers.js` 與本頁。
