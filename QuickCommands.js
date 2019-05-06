console.log(JSON.stringify(Game.getObjectById("5c70f5f9d5a5d2619b8c0376")))
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];if(creepName.length < 10) {creep.suicide();}}
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];creep.suicide();}
for(const creepName in Game.creeps){const creep = Game.creeps[creepName];creep.memory.jobName = "idle"; creep.memory.jobId = undefined; creep.memory.job2Id = undefined; creep.memory.closestLink = undefined; }
Memory.closedJobs = []; Memory.openJobs = [];
