const Towers = {
    run: function() {
        // TODO - right now it is just a copy from the old - it may be good enough

        const allMyTowers = _.filter(Game.structures, (structure) => structure.structureType == STRUCTURE_TOWER && structure.energy > 0);
        for(const count in allMyTowers){
            const tower = allMyTowers[count];
            if(tower) {
                let priorityHostileCreep = undefined;
                const hostileCreeps = tower.room.find(FIND_HOSTILE_CREEPS);
                for(const hostileCreepCount in hostileCreeps){
                    const hostileCreep = hostileCreeps[hostileCreepCount];
                    for(const hostileCreepBodyCount in hostileCreep.body){
                        const  hostileCreepBody = hostileCreep.body[hostileCreepBodyCount];
                        if(hostileCreepBody.type == HEAL && hostileCreepBody.hits > 0){
                            // this creep has a heal part
                            priorityHostileCreep = hostileCreep;
                            console.log("FOUND HEALER CREEP " + hostileCreep);
                            break;
                        }else if(hostileCreepBody.boost !== undefined && hostileCreepBody.hits > 0){
                            console.log(hostileCreep + " hostileCreepBody.boost " + hostileCreepBody.boost);
                            priorityHostileCreep = hostileCreep; // next priority is boosted creeps
                        }
                    }
                    if(priorityHostileCreep !== undefined){break;}
                }
                if(priorityHostileCreep === undefined){
                    priorityHostileCreep = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS); // no prioritized hostile creeps found
                }

                if(priorityHostileCreep) {
                    tower.attack(priorityHostileCreep);
                    console.log(tower + " IS ATTACKING ENEMY CREEP!! energy: " + tower.energy + ", closestHostile: " + priorityHostileCreep + ", in room " + tower.room.name);
                }else{
                    const damagedCreeps = _.filter(Game.creeps, (creep) => creep.hits < creep.hitsMax);
                    if(damagedCreeps.length > 0){
                        tower.heal(damagedCreeps[0]);
                    }
                    else if(tower.energy > 700){
                        const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {filter: (structure) => (structure.hits < structure.hitsMax/2 && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART) || ((structure.structureType === STRUCTURE_RAMPART || structure.structureType === STRUCTURE_WALL) && structure.hits < 1000)});
                        if(closestDamagedStructure) {
                            tower.repair(closestDamagedStructure);
                        }
                    }
                }
            }
        }
    }
};
module.exports = Towers;