export const faces = [
    // Explicit slash/backslash faces (must be at top to prevent bare match override)
    [/^>[\\/]{2,}<$/, { Eyes: 'Daydream', Mouth: 'Pout', Eyebrows: 'Lowered', Blush: 'Medium' }],
    [/^(?:>[\\/]{2,}>|<[\\/]{2,}<)$/, { Eyes: 'Shy', Eyebrows: 'Lowered', Blush: 'Medium' }],
    [/^=[\\/]{2,}=$/, { Eyes: 'Horny', Mouth: 'Pout', Blush: 'Medium' }],
    [/^(?:o|0)[\\/]{2,}(?:o|0)$/i, { Eyes: 'Surprised', Mouth: 'HalfOpen', Eyebrows: 'Raised', Blush: 'Medium' }],
    [/^\^[\\/]{2,}\^$/, { Eyes: 'ShylyHappy', Mouth: 'Smile', Blush: 'Medium' }],
    // Classic cat/cute faces
    [/^>~<$/, { Eyes: 'Daydream', Mouth: 'Smirk' }],
    [/^>[._,]?<$/, { Eyes: 'Daydream' }],
    // Cat faces with W
    [/^(?:>w<)$/i, { Eyes: 'Daydream', Mouth: 'Happy' }],
    [/^(?:=w=|>w>|<w<)$/i, { Eyes: 'Horny', Mouth: 'Happy' }],
    // Cat faces with V
    [/^(?:>v<)$/i, { Eyes: 'Daydream', Mouth: 'Smile' }],
    [/^(?:=v=|>v>|<v<)$/i, { Eyes: 'Horny', Mouth: 'Smirk' }],
    // Normal cat face
    [/^(?::3|:>)$/, { Mouth: 'Happy' }],
    // Winking cat face
    [/^(?:;3|;>)$/, { Eyes: 'Closed', Eyes2: null, Mouth: 'Happy' }],
    // Happy / Smile
    [/^(?:\^_\^|\^\^|\^~\^)$/, { Eyes: 'ShylyHappy', Mouth: 'Smile' }],
    [/^xd$/i, { Eyes: 'Daydream', Mouth: 'Laughing' }],
    [/^[:;]d$/i, { Mouth: 'Laughing' }],
    [/^(?::\)|:\])$/, { Mouth: 'Smile' }],
    // Confused / Huh
    [/^(?:O[.,_]o|o[.,_]O|0[.,_]o|o[.,_]0)$/, { Eyes: 'Dazed', Mouth: 'HalfOpen', Eyebrows: 'OneRaised' }],
    // Surprised
    [/^(?:0[._x]0|o[._x]o)$/i, { Eyes: 'Surprised', Mouth: 'HalfOpen', Eyebrows: 'Raised' }],
    // Crazy / Dazed
    [/^x[_.]?x$/i, { Eyes: 'Dazed', Mouth: 'Sad' }],
    [/^@[_.,~-]*@$/, { Eyes: 'Crazy', Mouth: 'Sad' }],
    [/^(?:>+[.,~_]*>+|<+[.,~_]*<+)$/, { Eyes: 'Dazed', Eyebrows: 'Harsh' }],
    // Horny / Closed
    [/^(?:==|=\[_\]=)$/, { Eyes: 'Horny' }],
    [/^(?:=~=|=\.=|=,=)$/, { Eyes: 'Horny', Mouth: 'Frown' }],
    [/^(?:=[_^-]=)$/, { Eyes: 'Closed', Mouth: 'Frown' }],
    [/^-_-$/, { Eyes: 'Dazed', Eyebrows: 'Harsh', Mouth: 'Frown' }],
    // Ahegao
    [/^(?:;p|;d|;\))$/i, { Eyes: 'Closed', Eyes2: null, Mouth: 'Ahegao' }],
    [/^:p$/i, { Mouth: 'Ahegao' }],
    // Sad / Tears
    [/^(?:t[_xwv.~-]?t)$/i, { Eyes: 'Shy', Mouth: 'Sad', Fluids: 'TearsHigh', Eyebrows: 'Sad' }],
    [/^qwq$/i, { Eyes: 'Shy', Mouth: 'Happy', Fluids: 'TearsHigh', Eyebrows: 'Sad' }],
    [/^:\($/, { Mouth: 'Frown' }],
    [/^D:$/i, { Eyes: 'Dazed', Mouth: 'Sad' }],
    // Pout
    [/^(?:=3=|>3<|>3>|<3<)$/, { Mouth: 'Pout' }],
    // Angry
    [/^(?:>:<|>;<|>x<|>[:;xX=]|[:;xX=]<)$/i, { Eyes: 'Angry', Mouth: 'Angry', Eyebrows: 'Angry' }],
    // Standalone slash/backslash blush faces
    [/^(?:[<>])?[\\/]{2,}(?:[<>])?$/, { Blush: 'Medium' }],
    // Hearts and Sleep
    [/^<3+$/i, { Emoticon: 'Hearts' }],
    [/^z{3,}[.~]*$/i, { Eyes: 'Closed', Emoticon: 'Sleep' }]
];

export const knownEchoNames = new Set([
    '张开嘴', '闭上嘴', '吞咽口水', '流口水', '舔手', '舔手指', '舔脸', '舔脚', '舔牵绳手',
    '口塞亲吻嘴唇', '用嘴脱掉手套', '用嘴脱掉鞋子', '用嘴脱掉袜子', '舔触手', '舔尾巴',
    '猫爪舔手', '轻弹额头', '轻拍脑袋', '钻进怀里', '抱入怀中', '抱腿',
    'Flick', 'FlickForehead',
]);

export const mappings = [
    ['LongKiss', /深吻|(?<![a-z])(?:Deep|French)[ _-]?(?:Kiss|Kissing|Kisses)(?![a-z])/i],
    ['KissOnLips', /接吻|亲吻|親吻|(?<![a-z])(?:Kiss|Kissing|Kisses)(?![a-z])/i],
    ['Lick', /舔|吸吮|含住|用嘴脱掉|(?<![a-z])(?:Lick|Suck)(?:s|ed|ing)?(?![a-z])/i],
    ['LipBite', /咬|(?<![a-z])(?:Bite|Biting|Bites|Bit)(?![a-z])/i],
    ['DroolSides', /流口水|(?<![a-z])Drool(?:s|ed|ing)?(?![a-z])/i],
    ['OpenMouth', /张开嘴|(?<![a-z])Open[ _-]?Mouth(?![a-z])/i],
    ['CloseMouth', /闭上嘴|吞咽口水|(?<![a-z])(?:Close[ _-]?Mouth|Swallow(?:s|ed|ing)?)(?![a-z])/i],
    ['Spank', /拍打|打屁股|轻拍|轻弹|扇耳光|(?<![a-z])(?:Spank|Slap|Flick|Bap)(?:s|ed|ing|ped|ping)?(?![a-z])/i],
    ['Cuddle', /拥抱|擁抱|贴贴|貼貼|钻进怀里|抱入怀中|抱腿|(?<![a-z])(?:Cuddle|Hug)(?:s|ed|ing|ged|ging)?(?![a-z])/i],
    ['Pinch', /掐|拧|(?<![a-z])Pinch(?:es|ed|ing)?(?![a-z])/i],
    ['Hit', /(?:^|_)Hit(?:$|_)|(?<![a-z])Hit(?:s|ting)?(?![a-z])/i],
    ['ShockLight', /吓|(?<![a-z])(?:Shock|Startle)(?:s|ed|ing)?(?![a-z])/i],
    ['Smile', /微笑|(?<![a-z])Smile(?:s|d|ing)?(?![a-z])/i],
    ['Giggle', /轻笑|(?<![a-z])Giggle(?:s|d|ing)?(?![a-z])/i],
    ['Laugh', /大笑|(?<![a-z])Laugh(?:s|ed|ing)?(?![a-z])/i],
    ['Blush', /脸红|害羞|(?<![a-z])(?:Blush(?:es|ed|ing)?|Shy)(?![a-z])/i],
    ['Sad', /委屈|伤心|(?<![a-z])(?:Sad|Cry(?:ing|ies)?|Cried)(?![a-z])/i],
    ['Angry', /生气|愤怒|(?<![a-z])(?:Angry|Mad)(?![a-z])/i],
];
export const targetOnly = new Set(['Spank', 'Hit', 'Pinch', 'ShockLight', 'LipBite']);
export const mutualEvents = new Set(['LongKiss', 'KissOnLips', 'Cuddle']);
