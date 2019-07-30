console.log("manual search: " + JSON.stringify(Game.getObjectById("5ce30b9e9917085da40b3a9e")))
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];if(creepName.length < 10) {creep.suicide();}}
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];creep.suicide();}
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];creep.memory.jobName = "idle"; creep.memory.jobId = undefined; creep.memory.energyTarget = undefined; creep.memory.resourceDestination = undefined; creep.memory.flagName = undefined; creep.memory.closestLink = undefined; }
Memory.closedJobs = []; Memory.openJobs = []; Memory.MemRooms = {};


// for v2:
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];creep.memory.JobName = "idle";}
Memory.MemRooms = new Object();