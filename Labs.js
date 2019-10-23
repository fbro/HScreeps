const Labs = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my) {
                const labs = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (lab) {
                        return lab.structureType === STRUCTURE_LAB && lab.cooldown === 0 && lab.store[RESOURCE_ENERGY] > 0;
                    }
                });

                // in one lvl 8 room - E28S29 - my old room
                // decide all by flags - a provider flag with color and text decide a mineral and creator flag decides what should be created
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


                // Z+K + U+L = G
                // G + H = GH --> ghodium hydride
            }
        }
    }
};
module.exports = Labs;