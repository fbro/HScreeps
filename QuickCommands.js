console.log(JSON.stringify(Game.getObjectById("5cdb05141330c33d51911104")))
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];if(creepName.length < 10) {creep.suicide();}}
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];creep.suicide();}
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];creep.memory.jobName = "idle"; creep.memory.jobId = undefined; creep.memory.energyTarget = undefined; creep.memory.flagName = undefined; creep.memory.closestLink = undefined; }
Memory.closedJobs = []; Memory.openJobs = [];
