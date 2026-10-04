// BC has one BodyUpper pose. Compose two native renders rather than changing
// shared assets or storing unsupported left/right poses on the character.
export function drawAlternatingPetsuit(character, raisedLeft, draw) {
    const original = {
        DrawPoseMapping: character.DrawPoseMapping,
        AppearanceLayers: character.AppearanceLayers,
        AppearanceMasks: character.AppearanceMasks,
    };
    const copies = [];
    try {
        for (const pose of ['OverTheHead', 'BackElbowTouch']) {
            character.DrawPoseMapping = { ...original.DrawPoseMapping, BodyUpper: pose };
            character.AppearanceLayers = CharacterAppearanceSortLayers(character);
            character.AppearanceMasks = CharacterAppearanceBuildMasks(character);
            draw();
            copies.push(['Canvas', 'CanvasBlink'].map(key => {
                const source = character[key];
                const copy = document.createElement('canvas');
                copy.width = source.width;
                copy.height = source.height;
                copy.getContext('2d').drawImage(source, 0, 0);
                return copy;
            }));
        }
        for (const [index, key] of ['Canvas', 'CanvasBlink'].entries()) {
            const canvas = character[key], ctx = canvas.getContext('2d');
            const width = canvas.width, height = canvas.height, half = width / 2;
            ctx.clearRect(0, 0, width, height);
            for (const side of [0, 1]) {
                const source = copies[(side === 0) === raisedLeft ? 0 : 1][index];
                ctx.drawImage(source, side * half, 0, half, height, side * half, 0, half, height);
            }
        }
    } finally {
        Object.assign(character, original);
    }
}
