// ════════════════════════════════════════════════════════════════════════════
// 讀取 BC 全域的統一入口
//
// 規則：LCE 一律用「裸識別字」讀 BC 全域（Player、CurrentScreen…），不用 globalThis.X / window.X。
// 原因：BC 的全域若是 let / const 宣告，不會掛在 globalThis 上，globalThis.X 會讀到 undefined，
//       裸識別字則 var / let 都讀得到。兩種寫法混用時，同一個值在不同檔案可能讀到不同結果。
// 登入前、畫面尚未建立時這些全域可能還不存在，裸識別字會丟 ReferenceError，
// 所以「可能不存在」的全域統一用這裡的函式（內部以 typeof 守衛）。
// 只寫入不讀取的 window.MouseX = … 之類不受影響。
// ════════════════════════════════════════════════════════════════════════════

/** 讀取任意可能不存在的 BC 全域：`readBc(() => KeyManager)`；不存在時回傳 undefined。 */
export const readBc = read => { try { return read(); } catch { return undefined; } };

/** 本人角色；登入前為 undefined。 */
export const getPlayer = () => (typeof Player === 'undefined' ? undefined : Player);

/** 目前畫面名稱（'ChatRoom'、'Login'…）；尚未就緒為 undefined。 */
export const getCurrentScreen = () => (typeof CurrentScreen === 'undefined' ? undefined : CurrentScreen);

/** 聊天室內目前載入的角色；不在聊天室時為空陣列。 */
export const getRoomCharacters = () => (typeof ChatRoomCharacter === 'undefined' || !Array.isArray(ChatRoomCharacter) ? [] : ChatRoomCharacter);

/** 目前聊天室資料；不在聊天室時為 null / undefined。 */
export const getRoomData = () => (typeof ChatRoomData === 'undefined' ? undefined : ChatRoomData);

/** 正在對話的角色（點開角色對話框時）。 */
export const getCurrentCharacter = () => (typeof CurrentCharacter === 'undefined' ? undefined : CurrentCharacter);

/** 遊戲主畫布；尚未建立為 undefined。 */
export const getMainCanvas = () => (typeof MainCanvas === 'undefined' ? undefined : MainCanvas);

/** 是否在聊天室畫面。 */
export const inChatRoom = () => getCurrentScreen() === 'ChatRoom';
