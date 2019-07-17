const Towers = {
    run: function() {

        for(const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            const towers = gameRoom.find(STRUCTURE_TOWER, {filter: function(tower) {return tower.energy > 0;}});

            const hostileTargets = gameRoom.find(FIND_HOSTILE_CREEPS, {
                filter: function(hostile) {
                    return hostile.getActiveBodyparts(ATTACK) > 0 || hostile.getActiveBodyparts(RANGED_ATTACK) > 0 || hostile.getActiveBodyparts(HEAL) > 0;
                }});

            const damagedCreeps = gameRoom.find(FIND_MY_CREEPS, {
                filter: function(creep) {
                    return creep.hits < creep.hitsMax;
                }});

            const damagedStructures = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function(structure) {
                    return (structure.hits < structure.hitsMax / 2
                            && structure.structureType !== STRUCTURE_WALL
                            && structure.structureType !== STRUCTURE_RAMPART)
                            ||
                            ((structure.structureType === STRUCTURE_RAMPART
                            || structure.structureType === STRUCTURE_WALL)
                            && structure.hits < 1000);
                }});

            for (let i = 0; i < towers.length; i++) {
                if(hostileTargets.length > 0){
                    const val = i % hostileTargets.length === 0;
                    towers[i].attack(hostileTargets[val]);
                }

                if(damagedCreeps.length > 0){
                    const val = i % damagedCreeps.length === 0;
                    towers[i].heal(damagedCreeps[val]);
                }

                if(damagedStructures.length > 0 && towers[i].energy < 700){
                    const val = i % damagedStructures.length === 0;
                    towers[i].repair(damagedStructures[val]);
                }
            }
        }
    }
};
module.exports = Towers;