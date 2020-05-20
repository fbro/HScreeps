const Labs = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8) {
                // TODO change to all primary purple flags and then lookat lab underneath
                
                const labs = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (lab) {
                        return lab.structureType === STRUCTURE_LAB && lab.cooldown === 0 && lab.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
                if (labs) {
                    // decide all by flags
                    // TODO create ghodium hydride to upgrade work part for my builders
                    //  TODO move Hydrogen
                    //  TODO create ghodium
                    //   TODO create zynthium keanite
                    //    TODO buy zynthium
                    //    TODO move keanium
                    //   TODO create utrium lemergite
                    //    TODO buy lemergium
                    //    TODO move utrium
                    // after ghodium hydride is created it should be distributed to all the other rooms
                }


                // Z+K + U+L = G
                // G + H = GH --> ghodium hydride
            }
        }
    }
};
module.exports = Labs;