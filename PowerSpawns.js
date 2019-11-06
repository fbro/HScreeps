const PowerSpawns = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8) {
                const powerSpawn = gameRoom.find(FIND_MY_STRUCTURES, {filter: (s) => {return s.structureType === STRUCTURE_POWER_SPAWN;}})[0];
                if(powerSpawn && powerSpawn.store[RESOURCE_POWER] > 0 && powerSpawn.store[RESOURCE_ENERGY] > 0){
                    powerSpawn.processPower();
                }
            }
        }
    }
};
module.exports = PowerSpawns;