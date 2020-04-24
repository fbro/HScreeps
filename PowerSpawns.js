let Util = require('Util');
const PowerSpawns = {
    run: function (gameRoom) {
        if (gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8 && Memory.MemRooms[gameRoom.name]) {
            if(!Memory.MemRooms[gameRoom.name].PowerSpawnId){
                 const foundPowerSpawn = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_POWER_SPAWN;
                    }
                })[0];
                 if(foundPowerSpawn){
                    Memory.MemRooms[gameRoom.name].PowerSpawnId = foundPowerSpawn.id;
                 }else{
                     return; // no powerSpawn found
                 }
            }
            const powerSpawn = Game.getObjectById(Memory.MemRooms[gameRoom.name].PowerSpawnId);
            if (powerSpawn){
                if(powerSpawn.store.getUsedCapacity(RESOURCE_POWER) > 0 && powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    powerSpawn.processPower();
                }
            }else{
                Util.ErrorLog('PowerSpawns','PowerSpawns','Power spawn gone in ' + gameRoom.name + ' ' + Memory.MemRooms[gameRoom.name].PowerSpawnId);
                delete Memory.MemRooms[gameRoom.name].PowerSpawnId;
            }
        }
    }
};
module.exports = PowerSpawns;