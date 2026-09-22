import { createHook } from '../../core/hooks.js';
import { getFeature } from '../../core/feature-settings.js';

const hook = createHook('PetsuitAnimation', () => getFeature('petsuitAnimation'));

let animInterval = null;
let animBtn = null;
let animFrame = 0;

const animPoses = [
    "OverTheHead",
    "BackElbowTouch"
];

function createAnimBtn() {
    if (animBtn) return animBtn;
    
    animBtn = document.createElement("div");
    animBtn.id = "lce-petsuit-anim-btn";
    animBtn.title = "Fast Pose Animation";
    Object.assign(animBtn.style, {
        position: "fixed",
        bottom: "60px",
        left: "12px",
        width: "50px",
        height: "50px",
        backgroundImage: "url('https://raw.githubusercontent.com/Izumii99/BC-Desktop/main/Assets/arm_logo_chat-qol.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#ffffff",
        borderRadius: "4px",
        display: "none",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        border: "2px solid #000",
        userSelect: "none",
        zIndex: "100",
    });

    animBtn.onclick = () => {
        if (animInterval) return;
        
        animBtn.style.backgroundColor = "rgba(100,200,100,0.8)";
        animFrame = 0;
        let count = 0;
        const maxCycles = 4;
        const animDelay = 350;

        const eyeRefreshSec = Math.ceil(animDelay / 1000) + 3;
        if (typeof CharacterSetFacialExpression === "function" && typeof Player !== "undefined") {
            CharacterSetFacialExpression(Player, "Eyes", "Daydream", eyeRefreshSec);
        }

        animInterval = setInterval(() => {
            try {
                let poseName = animPoses[animFrame % animPoses.length];
                
                if (typeof CharacterSetActivePose === "function" && typeof Player !== "undefined") {
                    CharacterSetActivePose(Player, poseName);
                    if (typeof ServerSend === "function") {
                        ServerSend("ChatRoomCharacterPoseUpdate", { Pose: Player.Pose });
                    }
                    if (typeof ChatRoomCharacterUpdate === "function") {
                        ChatRoomCharacterUpdate(Player);
                    }
                    if (typeof CharacterRefresh === "function") {
                        CharacterRefresh(Player);
                    }
                }
                
                animFrame++;
                count++;
                
                if (count >= maxCycles) {
                    clearInterval(animInterval);
                    animInterval = null;
                    animBtn.style.backgroundColor = "#ffffff";
                    
                    try {
                        if (typeof CharacterSetActivePose === "function" && typeof Player !== "undefined") {
                            CharacterSetActivePose(Player, animPoses[1]);
                            if (typeof ServerSend === "function") {
                                ServerSend("ChatRoomCharacterPoseUpdate", { Pose: Player.Pose });
                            }
                            if (typeof ChatRoomCharacterUpdate === "function") {
                                ChatRoomCharacterUpdate(Player);
                            }
                            if (typeof CharacterRefresh === "function") {
                                CharacterRefresh(Player);
                            }
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }, animDelay);
    };

    return animBtn;
}

export function installPetsuitAnimation() {
    createAnimBtn();

    hook('ChatRoomDraw', 0, (args, next) => {
        const ret = next(args);
        
        try {
            if (!getFeature('petsuitAnimation') || typeof Player === "undefined") {
                if (animBtn && animBtn.style.display !== "none") {
                    animBtn.style.display = "none";
                    if (animInterval) {
                        clearInterval(animInterval);
                        animInterval = null;
                        animBtn.style.backgroundColor = "#ffffff";
                    }
                }
                return ret;
            }

            let isRestricted = Player.Appearance && Player.Appearance.some(a => {
                if (a && a.Asset && a.Asset.Group && a.Asset.Name) {
                    let name = a.Asset.Name.toLowerCase();
                    let group = a.Asset.Group.Name;
                    return (
                        name.includes("petsuit") ||
                        name.includes("pet suit") ||
                        name.includes("straitjacket") ||
                        name.includes("armbinder") ||
                        name.includes("box tie") ||
                        name.includes("yoked")
                    ) && (group === "ItemArms" || group === "ItemTorso");
                }
                return false;
            });

            if (typeof CurrentScreen !== "undefined" && CurrentScreen === "ChatRoom" && isRestricted) {
                if (!animBtn.parentNode) {
                    document.body.appendChild(animBtn);
                }
                if (animBtn.style.display !== "flex") {
                    animBtn.style.display = "flex";
                }
            } else {
                if (animBtn.style.display !== "none") {
                    animBtn.style.display = "none";
                    if (animInterval) {
                        clearInterval(animInterval);
                        animInterval = null;
                        animBtn.style.backgroundColor = "#ffffff";
                    }
                }
            }
        } catch (e) {}
        
        return ret;
    });
}
