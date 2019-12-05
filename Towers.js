const Towers = {
    run: function (gameRoom) {
        const towers = gameRoom.find(FIND_MY_STRUCTURES, {
            filter: function (tower) {
                return tower.structureType === STRUCTURE_TOWER && tower.store[RESOURCE_ENERGY] > 0;
            }
        });

        const hostileTargets = gameRoom.find(FIND_HOSTILE_CREEPS);

        const damagedCreeps = gameRoom.find(FIND_MY_CREEPS, {
            filter: function (creep) {
                return creep.hits < creep.hitsMax;
            }
        });

        const damagedStructures = gameRoom.find(FIND_STRUCTURES, {
            filter: function (structure) {
                return (structure.hits < structure.hitsMax / 2
                    && structure.structureType !== STRUCTURE_WALL
                    && structure.structureType !== STRUCTURE_RAMPART)
                    ||
                    ((structure.structureType === STRUCTURE_RAMPART
                        || structure.structureType === STRUCTURE_WALL)
                        && structure.hits < 1000);
            }
        });

        for (let i = 0; i < towers.length; i++) {
            if (damagedCreeps.length > 0) {
                const val = ((i + 1) % damagedCreeps.length);
                towers[i].heal(damagedCreeps[val]);
            } else if (hostileTargets.length > 0) {
                const val = ((i + 1) % hostileTargets.length);
                towers[i].attack(hostileTargets[val]);
            } else if (damagedStructures.length > 0 && towers[i].store[RESOURCE_ENERGY] > 700) {
                const val = ((i + 1) % damagedStructures.length);
                towers[i].repair(damagedStructures[val]);
            }
        }
    }
};
module.exports = Towers;