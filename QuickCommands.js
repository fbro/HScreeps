// reset for v2:
Memory.buyOrdersHistory = {};
Memory.MemRooms = {};
Memory.ErrorLog = undefined;
for (const creepName in Memory.creeps) {
    const gc = Game.creeps[creepName];
    const mc = Memory.creeps[creepName];
    if (gc === undefined) {
        delete Memory.creeps[creepName];
    } else {
        mc.Transferring = undefined;
        mc.JobName = 'idle(' + gc.pos.x + ',' + gc.pos.y + ')' + gc.pos.roomName;
        mc.EnergySupply = undefined;
        mc.EnergySupplyType = undefined;
        mc.ClosestRoomWithStorage = undefined;

    }
}
//gc.suicide(); // total reset
console.log("manual search: " + JSON.stringify(Game.getObjectById("5cee5f96d1936f6f4667aa35")))
console.log("Game.time: " + Game.time)