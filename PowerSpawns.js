let Util = require('Util');
const PowerSpawns = {
    run: function (gameRoom) {
        if ((Memory.MemRooms[gameRoom.name].IsPowerSpawnActive || Game.time % 30 === 0)) {
            if (!Memory.MemRooms[gameRoom.name].PowerSpawnId) {
                const foundPowerSpawn = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_POWER_SPAWN;
                    }
                })[0];
                if (foundPowerSpawn) {
                    Memory.MemRooms[gameRoom.name].PowerSpawnId = foundPowerSpawn.id;
                } else {
                    return; // no powerSpawn found
                }
            }
            const powerSpawn = Game.getObjectById(Memory.MemRooms[gameRoom.name].PowerSpawnId);
            if (powerSpawn) {
                if (powerSpawn.store.getUsedCapacity(RESOURCE_POWER) > 0 && powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) >= 50) {
                    powerSpawn.processPower();
                    if (!Memory.MemRooms[gameRoom.name].IsPowerSpawnActive) {
                        Memory.MemRooms[gameRoom.name].IsPowerSpawnActive = true;
                    }
                } else {
                    Memory.MemRooms[gameRoom.name].IsPowerSpawnActive = false;
                }
            } else {
                Util.ErrorLog('PowerSpawns', 'PowerSpawns', 'Power spawn gone in ' + gameRoom.name + ' ' + Memory.MemRooms[gameRoom.name].PowerSpawnId);
                delete Memory.MemRooms[gameRoom.name].PowerSpawnId;
            }
        }
    }
};
module.exports = PowerSpawns;