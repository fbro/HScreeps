// reset
Memory.MemRooms = {};
Memory.ErrorLog = undefined;
Memory.InfoLog = undefined;
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