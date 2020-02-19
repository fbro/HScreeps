// reset
Memory.MemRooms = {};
Memory.ErrorLog = undefined;
Memory.InfoLog = undefined;
Memory.Paths = undefined;
for (const creepName in Memory.creeps) {
    const gc = Game.creeps[creepName];
    const mc = Memory.creeps[creepName];
    if (gc === undefined) {
        delete Memory.creeps[creepName];
    } else {
        for(const memoryElementKey in gc.memory){
            gc.memory[memoryElementKey] = undefined;
        }
        mc.JobName = 'idle(' + gc.pos.x + ',' + gc.pos.y + ')' + gc.pos.roomName;
    }
}
gc.suicide();
console.log('manual search: ' + JSON.stringify(Game.getObjectById('5cee5f96d1936f6f4667aa35')));
console.log('Game.time: ' + Game.time);
console.log(JSON.stringify(Game.powerCreeps['Hulmir']));

// terminal send
Game.getObjectById('5d60034ce360cc20d4c6deee').send(RESOURCE_BIOMASS, 260, 'E28S29');
Game.market.deal('5e00325c7072b2051bcdb880', 4000, 'E29S31');
console.log(JSON.stringify(Game.rooms['E29S31'].controller.owner));

console.log(JSON.stringify(Game.rooms['E29S28'].controller.owner));

// check all flags
for (const flagKey in Game.flags) {
    const flag = Game.flags[flagKey];
    console.log(flagKey + ' ' + JSON.stringify(flag));}
    //if(flag.name.startsWith('deposit')){
    //    console.log('removing flag');
    //    flag.remove()
    //}
//}

console.log(Game.rooms['E35S29'].controller.owner);

Game.creeps['M1'].move(LEFT)

console.log(Game.rooms['E28S29'].energyAvailable);

console.log('RESOURCE_ENERGY ' + Game.getObjectById('5cf1a7158e8ea635474264ca').store.getUsedCapacity(RESOURCE_POWER));

const structures = Game.rooms['E34S29'].find(FIND_CONSTRUCTION_SITES);
for(const structureKey in structures){
    structures[structureKey].remove();
}


// get something in a rooms memory
Memory.MemRooms['E31S31'].FctrId = undefined;

// test spawn transporters
Game.spawns['Spawn3'].spawnCreep([CARRY, CARRY, MOVE], 'T51');
Game.spawns['Spawn17'].spawnCreep([CARRY, CARRY, MOVE], 'T52');
Game.spawns['Spawn9'].spawnCreep([CARRY, CARRY, MOVE], 'T53');

console.log((Object.keys(Memory.MemRooms['E29S31'].MaxCreeps['T']).length - 1))
console.log(JSON.stringify(Memory.MemRooms['E29S31'].MaxCreeps['T']['M']))