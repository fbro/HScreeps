let Util = require('Util');
const Towers = {
    run: function (gameRoom) {
        if(gameRoom.controller){
            const towers = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (tower) {
                    return tower.structureType === STRUCTURE_TOWER && tower.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            // TODO optimize tower computations!
            // TODO only repair every 30 tick
            EmergencyRepair(towers);
            // TODO check every other tick but then if hostiles attack everytime
            HostileCreeps(towers);
        }

        function EmergencyRepair(towers){
            const damagedStructures = gameRoom.find(FIND_STRUCTURES, {
                filter: function (structure) {
                    return (structure.hits < structure.hitsMax / 2
                        && structure.structureType !== STRUCTURE_WALL
                        && structure.structureType !== STRUCTURE_RAMPART)
                        ||
                        ((structure.structureType === STRUCTURE_RAMPART
                            || structure.structureType === STRUCTURE_WALL)
                            && structure.hits < Util.RAMPART_WALL_HITS_U_LVL5);
                }
            });

            for (let i = 0; i < towers.length; i++) {
                if (damagedStructures.length > 0 && towers[i].store.getUsedCapacity(RESOURCE_ENERGY) > 700) {
                    const val = ((i + 1) % damagedStructures.length);
                    towers[i].repair(damagedStructures[val]);
                }
            }
        }

        function HostileCreeps(towers){
            const hostileTargets = gameRoom.find(FIND_HOSTILE_CREEPS, {
                filter: function (hostile) {
                    return hostile.hits < hostile.hitsMax || hostile.pos.findInRange(FIND_STRUCTURES, 4).length > 0;
                }
            });

            let damagedCreeps = gameRoom.find(FIND_MY_CREEPS, {
                filter: function (creep) {
                    return creep.hits < creep.hitsMax;
                }
            });

            if(gameRoom.controller.isPowerEnabled){
                damagedCreeps = damagedCreeps.concat(gameRoom.find(FIND_MY_POWER_CREEPS, {filter: function (powerCreep) {return powerCreep.hits < powerCreep.hitsMax;}}));
            }

            for (let i = 0; i < towers.length; i++) {
                if (hostileTargets.length > 0) {
                    const val = ((i + 1) % hostileTargets.length);
                    towers[i].attack(hostileTargets[val]);
                } else if (damagedCreeps.length > 0) {
                    const val = ((i + 1) % damagedCreeps.length);
                    towers[i].heal(damagedCreeps[val]);
                }
            }
        }
    }
};
module.exports = Towers;