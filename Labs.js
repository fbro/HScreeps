let Util = require('Util');
const Labs = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8) {
                const flags = gameRoom.find(FIND_FLAGS, {
                    filter: function (flag) {
                        return flag.color === COLOR_PURPLE;
                    }
                });
                for (const flagKey in flags) {
                    const flag = flags[flagKey];
                    const lab = flag.pos.lookFor(LOOK_STRUCTURES)[0];
                    TryPossibleReactionLab(lab, flag);
                }
            }
        }

        function TryPossibleReactionLab(lab, flag) {
            if (!lab.cooldown) {
                const mineral = flag.name.split('-')[1];
                if ((!lab.store || lab.store.getFreeCapacity(mineral) >= 5)) {
                    let result;
                    switch (true) {
                        case (mineral === RESOURCE_ZYNTHIUM_KEANITE) :
                            result = Reaction(lab, RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM);
                            break;
                        case (mineral === RESOURCE_UTRIUM_LEMERGITE) :
                            result = Reaction(lab, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM);
                            break;
                        case (mineral === RESOURCE_GHODIUM) :
                            result = Reaction(lab, RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE);
                            break;
                        case (mineral === RESOURCE_GHODIUM_HYDRIDE) :
                            result = Reaction(lab, RESOURCE_GHODIUM, RESOURCE_HYDROGEN);
                            break;
                        case (mineral === RESOURCE_HYDROXIDE) :
                            result = Reaction(lab, RESOURCE_HYDROGEN, RESOURCE_OXYGEN);
                            break;
                        case (mineral === RESOURCE_GHODIUM_ACID) :
                            result = Reaction(lab, RESOURCE_GHODIUM_HYDRIDE, RESOURCE_HYDROXIDE);
                            break;
                        case (mineral === RESOURCE_CATALYZED_GHODIUM_ACID) :
                            result = Reaction(lab, RESOURCE_CATALYST, RESOURCE_GHODIUM_ACID);
                            break;
                    }
                    if (result) {
                        Util.ErrorLog('Labs', 'Labs', 'result ' + result + ' mineral ' + mineral + ' lab.store ' + lab.store);
                    }
                }
            }
        }

        function Reaction(lab, resource1, resource2) {
            const lab1 = lab.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                filter: function (l) {
                    return l.store && l.store[resource1] >= 5;
                }
            })[0];
            if (lab1) {
                const lab2 = lab.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                    filter: function (l) {
                        return l.store && l.store[resource2] >= 5;
                    }
                })[0];
                if (lab2) {
                    const result = lab.runReaction(lab1, lab2);
                    //Util.Info('Labs', 'Reaction', lab.pos.roomName + ' merge ' + resource1 + ' and ' + resource2);
                    return result;
                }
            }
        }
    }
};
module.exports = Labs;