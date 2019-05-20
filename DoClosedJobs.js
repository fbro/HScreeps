const DoClosedJobs = {
    run: function() {
        // constants
        const MAX_HITS_TO_MAINTAIN = 200000; // when repair and build, walls and ramparts have high hits - only maintain up to this
        const MIN_VALID_ENERGY_AMOUNT = 10; // when searching for stored energy in links, containers, storage, dropped energy, ignore below this number
        const MAX_ENERGY_TERMINAL = 100000; // end TerminalsNeedEnergy job when terminal has more than MAX_ENERGY_TERMINAL energy

        for(const creepName in Memory.creeps) {
            const creepMemory = Memory.creeps[creepName];
            const creep = Game.creeps[creepName];
            let jobOBJ;
            if(creepMemory.flagName){
                jobOBJ = Game.flags[creepMemory.flagName];
            }else{
                jobOBJ = Game.getObjectById(creepMemory.jobId);
            }
            if(creep){
                if(jobOBJ){
                    const jobStatus = CreepActions(creep, creepMemory.jobName, jobOBJ);
                    // TODO add CARRY "on the road" jobs here - pickup stuff and transfer stuff that are "dead weight"
                    // TODO two jobs
                    if(jobStatus > 0 && creep.carry[RESOURCE_ENERGY] > 0 && creep.body.filter(part => (part.type === WORK)).some(x => !!x)){ // creep only moved - try and act
                        const structureToRepair = creep.pos.findInRange(FIND_STRUCTURES, 2, {filter: (structure) => {
                                return structure.hits < structure.hitsMax
                                    && structure.structureType !== STRUCTURE_WALL
                                    && structure.structureType !== STRUCTURE_RAMPART;
                            }})[0];
                        if(structureToRepair !== undefined){
                            if(creep.repair(structureToRepair) !== 0){
                                console.log("DoClosedJob, ERROR: " + creep.name + ", could not repair " + JSON.stringify(structureToRepair));
                            }
                        }
                    }
                    if(jobStatus >= 2){ // job is done
                        if(jobStatus === 2){
                            console.log("DoClosedJob, job done: " + creepMemory.jobName + ", room: " + jobOBJ.pos.roomName);
                        }else if(jobStatus === 3){
                            console.log("DoClosedJob, no energy, job set to done: " + creepMemory.jobName + ", room: " + jobOBJ.pos.roomName);
                        }
                        creep.say("job✔" + jobOBJ.pos.x + "," + jobOBJ.pos.y);
                        UpdateJob(creepName, creepMemory, false);
                    }
                }else if(creepMemory.jobName !== "idle"){ // job object is gone
                    console.log("DoClosedJob, job object disappeared: " + creepMemory.jobName);
                    creep.say("job🌀 gone"); // most common job object to disappear is the DroppedResources job
                    UpdateJob(creepName, creepMemory, false);
                }
            }else{ // creep is gone
                console.log("DoClosedJob, creep " + creepName + " is gone " + JSON.stringify(creep));
                UpdateJob(creepName, creepMemory, true);
            }
        }

        // end job or remove creep on job, if closed job move to open jobs
        function UpdateJob(creepName, creepMemory, isCreepGone){
            let foundJob = false;
            for(let i = 0; i < Memory.closedJobs.length; i++){ // search in closed jobs
                if(Memory.closedJobs[i].name === creepMemory.jobName && Memory.closedJobs[i].id === creepMemory.jobId && Memory.closedJobs[i].flagName === creepMemory.flagName){
                    if(isCreepGone){ // remove creep from job and move closedJob to openJobs
                        for(let e = 0; e < Memory.closedJobs[i].creeps.length; e++){
                            if(Memory.closedJobs[i].creeps[e] === creepName){
                                Memory.closedJobs[i].creeps.splice(e, 1); // remove dead creep
                                Memory.openJobs.push(Memory.closedJobs.splice(i, 1)[0]); // move closed job to open jobs
                                break;
                            }
                        }
                    }else{ // remove job, done or gone
                        Memory.closedJobs.splice(i, 1);
                    }
                    foundJob = true;
                    break;
                }
            }
            if(!foundJob){ // then search in open jobs
                for(let i = 0; i < Memory.openJobs.length; i++){
                    if(Memory.openJobs[i].name === creepMemory.jobName && Memory.openJobs[i].id === creepMemory.jobId && Memory.openJobs[i].flagName === creepMemory.flagName){
                        if(isCreepGone){ // remove creep from job
                            for(let e = 0; e < Memory.openJobs[i].creeps.length; e++){
                                if(Memory.openJobs[i].creeps[e] === creepName){
                                    Memory.openJobs[i].creeps.splice(e, 1); // remove dead creep
                                    break;
                                }
                            }
                        }else{ // remove job, done or gone
                            Memory.openJobs.splice(i, 1);
                        }
                        foundJob = true;
                        break;
                    }
                }
            }
            if(!isCreepGone){ // if creep is not gone but it is just the job that is done then cleanup the creep memory
                creepMemory.jobName = "idle";
                if(creepMemory.jobId        !== undefined){creepMemory.jobId        = undefined;}
                if(creepMemory.energyTarget !== undefined){creepMemory.energyTarget = undefined;}
                if(creepMemory.closestLink  !== undefined){creepMemory.closestLink  = undefined;}
                if(creepMemory.storage      !== undefined){creepMemory.storage      = undefined;}
                if(creepMemory.flagName     !== undefined){
                    if(Game.flags[creepMemory.flagName]){Game.flags[creepMemory.flagName].remove();}
                    creepMemory.flagName     = undefined;
                }
            }else{
                delete Memory.creeps[creepName];
            }
        }

        /**
         * @return {int}
         */
        function CreepActions(creep, closedJobName, closedJobOBJ){
            let actionResult = -5;
            let jobStatus = 0;
            switch (closedJobName) {
                case "ActiveSources": // these jobs extract resources
                case "ActiveMinerals":
                    if (_.sum(creep.carry) === creep.carryCapacity) {
                        let closestLink = null;
                        if(closedJobName === "ActiveSources") {
                            if (creep.memory.closestLink !== undefined) {
                                const link = Game.getObjectById(creep.memory.closestLink);
                                if (creep.pos.inRangeTo(link, 1)) {
                                    closestLink = link;
                                }
                            }
                            if (closestLink === null) {
                                for (let i = 0; i < Memory.links.length; i++) {
                                    if (Memory.links[i].room === creep.room.name) { // already saved in memory
                                        for (let e = 0; e < Memory.links[i].harvesterLinks.length; e++) {
                                            const link = Game.getObjectById(Memory.links[i].harvesterLinks[e]);
                                            if (creep.pos.inRangeTo(link, 1)) {
                                                closestLink = link;
                                                creep.memory.closestLink = link.id;
                                                break;
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        if(creep.carry[RESOURCE_ENERGY] > 0 && closestLink !== null && closestLink.energy < closestLink.energyCapacity){
                            actionResult = creep.transfer(closestLink, RESOURCE_ENERGY); // first try to add to a link
                        }else{
                            for (const resourceType in creep.carry) { // drop everything
                                actionResult = creep.drop(resourceType);
                            }
                        }
                    }
                    else {
                        actionResult = creep.harvest(closedJobOBJ);
                    }
                    if(actionResult === ERR_NOT_IN_RANGE){
                        creep.moveTo(closedJobOBJ, {visualizePathStyle:{fill: 'transparent',stroke: '#ffe100',lineStyle: 'undefined',strokeWidth: .15,opacity: .5}});
                        jobStatus = 1;
                    }else if(actionResult === ERR_NOT_ENOUGH_RESOURCES){
                        jobStatus = 2;
                    }
                    break;

                case "DroppedResources": // these jobs move resources around
                case "FullLinks":
                case "FullContainers":
                case "StorageHasMinerals":
                    let bestEnergyLocation;
                    if(creep.memory.storage){
                        bestEnergyLocation = Game.getObjectById(creep.memory.storage);
                    }else{
                        bestEnergyLocation = creep.room.storage;
                        if(bestEnergyLocation){
                            creep.memory.storage = bestEnergyLocation.id;
                        }
                    }
                    if(!bestEnergyLocation){
                        let roomWithStorageLinearDistance = Number.MAX_SAFE_INTEGER;
                        for (let roomCount in Game.rooms) {
                            const room = Game.rooms[roomCount];
                            if(bestEnergyLocation === undefined && room.storage !== undefined || room.storage !== undefined &&  Game.map.getRoomLinearDistance(room.name, creep.pos.roomName) < roomWithStorageLinearDistance){
                                bestEnergyLocation = room.storage;
                                roomWithStorageLinearDistance = Game.map.getRoomLinearDistance(room.name, creep.pos.roomName);
                                console.log("found alternate storage " + bestEnergyLocation.pos.roomName);
                            }
                        }
                        if(bestEnergyLocation !== undefined){
                            creep.memory.storage = bestEnergyLocation.id;
                        }
                    }
                    if(bestEnergyLocation !== undefined && (closedJobName !== "StorageHasMinerals" || (creep.room.terminal !== undefined && _.sum(creep.room.terminal.store) < creep.room.terminal.storeCapacity))){
                        let sumCreepCarry = _.sum(creep.carry);
                        if (sumCreepCarry > 0
                            && (creep.memory.resourceDestination !== undefined
                            || (sumCreepCarry === creep.carryCapacity
                            || (closedJobName === "DroppedResources" && closedJobOBJ.amount === 0)
                            || (closedJobName === "FullLinks" && closedJobOBJ.energy === 0)
                            || (closedJobName === "FullContainers" && _.sum(closedJobOBJ.store) === 0)
                            || (closedJobName === "StorageHasMinerals" && (_.sum(closedJobOBJ.store) - closedJobOBJ.store[RESOURCE_ENERGY]) === 0)))) {
                            let resourceDestOBJ; // resource destination object - where do we want to place the stuff
                            if(closedJobName === "StorageHasMinerals"){
                                creep.memory.resourceDestination = creep.room.terminal.id;
                                resourceDestOBJ = creep.room.terminal;
                            }else{ // mainly in storage!...
                                creep.memory.resourceDestination = bestEnergyLocation.id;
                                resourceDestOBJ = bestEnergyLocation;
                            }
                            actionResult = CreepAct(creep, closedJobName, 1, resourceDestOBJ);
                            if(actionResult === ERR_NOT_IN_RANGE){
                                creep.moveTo(resourceDestOBJ, {visualizePathStyle:{fill: 'transparent',stroke: '#0000ff',lineStyle: 'dotted',strokeWidth: .15,opacity: .1}});
                                jobStatus = 1;
                            }
                        } else {
                            if(creep.memory.resourceDestination !== undefined){creep.memory.resourceDestination = undefined;} // reset
                            actionResult = CreepAct(creep, closedJobName, 2, closedJobOBJ); // obtaining the stuff that should be moved around
                            if(actionResult === ERR_NOT_IN_RANGE){
                                creep.moveTo(closedJobOBJ, {visualizePathStyle:{fill: 'transparent',stroke: '#0000ff',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                                jobStatus = 1;
                            }
                            if((actionResult === ERR_NOT_ENOUGH_RESOURCES || actionResult === ERR_INVALID_TARGET) && sumCreepCarry === 0){
                                creep.memory.storage = undefined;
                                jobStatus = 2;
                            }
                        }
                    }else{
                        console.log("DoClosedJob, no storage in room: " + creep.room.name + " or terminal full/undefined, creep " + creep.name);
                        jobStatus = 2;
                    }
                    break;

                case "SpawnsAndExtensionsNeedEnergy": // these jobs take energy and places it somewhere where it is needed
                case "TowersNeedEnergy":
                case "TerminalsNeedEnergy":
                case "LabsNeedEnergy":
                case "OwnedControllers":
                case "DamagedStructures":
                case "Constructions":
                    if (creep.carry[RESOURCE_ENERGY] === 0) { // go get some energy!
                        const energyTargetID = creep.memory.energyTarget;
                        let energyTarget;
                        if(energyTargetID){
                            energyTarget = Game.getObjectById(energyTargetID);
                        }
                        if(!energyTargetID || !energyTarget){
                            energyTarget = ClosestEnergyFullStoreInRoom(creep);
                            creep.memory.energyTarget = energyTarget.id; // save so that the function only runs once
                        }
                        actionResult = CreepAct(creep, closedJobName, 1, energyTarget); // get energy
                        if(actionResult === ERR_NOT_IN_RANGE){
                            creep.moveTo(energyTarget, {visualizePathStyle:{fill: 'transparent',stroke: '#ffe100',lineStyle: 'dotted',strokeWidth: .15,opacity: .1}});
                            jobStatus = 1;
                        }else if(actionResult ===  ERR_NOT_ENOUGH_RESOURCES){
                            jobStatus = 3; // drop job if there are no energy available - it will be recreated later
                        }
                    } else { // go build/repair/upgrade/transfer
                        actionResult = CreepAct(creep, closedJobName, 2, closedJobOBJ);
                        if(actionResult === ERR_NOT_IN_RANGE){
                            creep.moveTo(closedJobOBJ, {visualizePathStyle:{fill: 'transparent',stroke: '#00ff00',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                            jobStatus = 1;
                        }else if(actionResult === ERR_FULL || actionResult === ERR_INVALID_TARGET
                            || (closedJobName === "DamagedStructures" && (closedJobOBJ.hits === closedJobOBJ.hitsMax || closedJobOBJ.hits >= MAX_HITS_TO_MAINTAIN))
                            || (closedJobName === "TerminalsNeedEnergy" && closedJobOBJ.store[RESOURCE_ENERGY] >= MAX_ENERGY_TERMINAL)
                            || (closedJobName === "TowersNeedEnergy" && closedJobOBJ.energy >= 980)
                            || (closedJobName === "LabsNeedEnergy" && closedJobOBJ.energy === closedJobOBJ.energyCapacity)
                        ){
                            jobStatus = 2;
                        }else if(creep.memory.energyTarget !== undefined){ // reset to enable check for a new energy target
                            creep.memory.energyTarget = undefined;
                        }
                    }
                    break;
                case "TagController":
                case "ScoutPos":
                case "ClaimController":
                    if(closedJobOBJ.room !== undefined){
                        actionResult = CreepAct(creep, closedJobName, 2, closedJobOBJ);
                    }
                    if(closedJobOBJ.room === undefined || actionResult === ERR_NOT_IN_RANGE) {
                        creep.moveTo(closedJobOBJ.pos, {visualizePathStyle:{fill: 'transparent',stroke: '#fd00ff',lineStyle: 'dashed',strokeWidth: .15,opacity: .5}});
                        jobStatus = 1;
                    }else if(closedJobName !== "ScoutPos"){
                        jobStatus = 2;
                    }
                    break;
                default:
                    console.log("DoClosedJob, ERROR! ended in default in CreepActions! closedJobName: " + closedJobName + ", creepName: " + creep.name);
                    jobStatus = 0;
            }
            return jobStatus;
        }

        // used by creep-transporters to see which store in the room where the creep is is most full of energy
        function ClosestEnergyFullStoreInRoom(creep){
            let bestEnergyLocation = creep.room.storage;
            let bestRange = Number.MAX_SAFE_INTEGER;
            const energyCandidates = [];

            const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: (drop) => {
                    return (drop.resourceType === RESOURCE_ENERGY && drop.amount >= MIN_VALID_ENERGY_AMOUNT);
                }
            }).map(function (p) {
                return {'name': 'droppedEnergy', 'id': p.id, 'pos': p.pos, 'energy': p.amount};
            });
            energyCandidates.push(...droppedEnergy);

            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return ((structure.structureType === STRUCTURE_CONTAINER || structure.structureType === STRUCTURE_STORAGE) && structure.store[RESOURCE_ENERGY] >= MIN_VALID_ENERGY_AMOUNT);
                }
            }).map(function (p) {
                return {'name': 'containers', 'id': p.id, 'pos': p.pos, 'energy': p.store[RESOURCE_ENERGY]};
            });
            energyCandidates.push(...containers);

            const links = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (link) => {
                    return ((link.structureType === STRUCTURE_LINK) && link.energy >= MIN_VALID_ENERGY_AMOUNT);
                }
            }).map(function (p) {
                return {'name': 'links', 'id': p.id, 'pos': p.pos, 'energy': p.energy};
            });
            energyCandidates.push(...links);
            for(let i = 0; i < energyCandidates.length; i++){
                const energyCandidate = energyCandidates[i];
                const range = creep.pos.getRangeTo(energyCandidate.pos);
                if(bestRange > range){
                    bestEnergyLocation = energyCandidate;
                    bestRange = range;}
            }
            if(bestEnergyLocation === undefined){
                let roomWithStorageLinearDistance = Number.MAX_SAFE_INTEGER;
                for (let roomCount in Game.rooms) {
                    const room = Game.rooms[roomCount];
                    if(bestEnergyLocation === undefined && room.storage !== undefined || room.storage !== undefined &&  Game.map.getRoomLinearDistance(room.name, creep.pos.roomName) < roomWithStorageLinearDistance){
                        bestEnergyLocation = room.storage;
                        roomWithStorageLinearDistance = Game.map.getRoomLinearDistance(room.name, creep.pos.roomName);
                        console.log("found alternate storage " + bestEnergyLocation.pos.roomName);
                    }
                }
            }
            creep.say("get⚡" + bestEnergyLocation.pos.x + "," + bestEnergyLocation.pos.y);
            return Game.getObjectById(bestEnergyLocation.id);
        }

        function CreepAct(creep, closedJobName, actId, closedJobOBJ){
            let actionResult = -5;
            // act: 1 - action needed to later complete the job
            // act: 2 - main action to complete the job
            switch (true) {
                case closedJobName === "DroppedResources" && actId === 1:
                case closedJobName === "FullContainers" && actId === 1:
                case closedJobName === "StorageHasMinerals" && actId === 1:
                    for(const resourceType in creep.carry) {
                        actionResult = creep.transfer(closedJobOBJ, resourceType);
                    }
                    break;
                case closedJobName === "DroppedResources" && actId === 2:
                    actionResult = creep.pickup(closedJobOBJ);
                    break;
                case closedJobName === "FullLinks" && actId === 1:
                case closedJobName === "SpawnsAndExtensionsNeedEnergy" && actId === 2:
                case closedJobName === "TowersNeedEnergy" && actId === 2:
                case closedJobName === "TerminalsNeedEnergy" && actId === 2:
                case closedJobName === "LabsNeedEnergy" && actId === 2:
                    actionResult = creep.transfer(closedJobOBJ, RESOURCE_ENERGY);
                    break;
                case closedJobName === "FullLinks" && actId === 2:
                case closedJobName === "SpawnsAndExtensionsNeedEnergy" && actId === 1:
                case closedJobName === "TowersNeedEnergy" && actId === 1:
                case closedJobName === "TerminalsNeedEnergy" && actId === 1:
                case closedJobName === "LabsNeedEnergy" && actId === 1:
                case closedJobName === "OwnedControllers" && actId === 1:
                case closedJobName === "Constructions" && actId === 1:
                case closedJobName === "DamagedStructures" && actId === 1:
                    actionResult = creep.withdraw(closedJobOBJ, RESOURCE_ENERGY);
                    if(actionResult === ERR_INVALID_TARGET){
                        actionResult = creep.pickup(closedJobOBJ);
                    }
                    break;
                case closedJobName === "FullContainers" && actId === 2:
                    for (const resourceType in closedJobOBJ.store) {
                        actionResult = creep.withdraw(closedJobOBJ, resourceType);
                    }
                    break;
                case closedJobName === "StorageHasMinerals" && actId === 2:
                    for (const resourceType in closedJobOBJ.store) {
                        if(resourceType !== RESOURCE_ENERGY){
                            actionResult = creep.withdraw(closedJobOBJ, resourceType);
                        }
                    }
                    break;
                case closedJobName === "OwnedControllers" && actId === 2:
                    actionResult = creep.upgradeController(closedJobOBJ);
                    break;
                case closedJobName === "Constructions" && actId === 2:
                    actionResult = creep.build(closedJobOBJ);
                    break;
                case closedJobName === "DamagedStructures" && actId === 2:
                    actionResult = creep.repair(closedJobOBJ);
                    break;
                case closedJobName === "TagController" && actId === 2:
                    actionResult = creep.signController(closedJobOBJ.room.controller, closedJobOBJ.name);
                    break;
                case closedJobName === "ScoutPos" && actId === 2:
                    if(creep.pos.x === closedJobOBJ.pos.x && creep.pos.y === closedJobOBJ.pos.y && creep.pos.roomName === closedJobOBJ.pos.roomName){
                        creep.say(closedJobOBJ.name, true);
                        actionResult = 0;
                    }else{
                        actionResult = creep.moveTo(closedJobOBJ.pos);
                    }
                    break;
                case closedJobName === "ClaimController" && actId === 2:
                    creep.say("clm " + closedJobOBJ.pos.roomName, true);
                    actionResult = creep.claimController(closedJobOBJ.room.controller);
                    break;
                default:
                    console.log("DoClosedJob, ERROR! ended in default in CreepAct! closedJobName: " + closedJobName + ", actId: " + actId + ", creepName: " + creep.name);
                    actionResult = -5;
            }
            return actionResult;
        }
    }
};
module.exports = DoClosedJobs;