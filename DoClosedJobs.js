const DoClosedJobs = {
    run: function() {
        // constants
        const MAX_HITS_TO_MAINTAIN = 200000; // when repair and build, walls and ramparts have high hits - only maintain up to this
        const MIN_VALID_ENERGY_AMOUNT = 100; // when searching for stored energy in links, containers, storage, dropped energy, ignore below this number
        const MAX_ENERGY_TERMINAL = 100000; // end TerminalsNeedEnergy job when terminal has more than MAX_ENERGY_TERMINAL energy

        DoJobArray(Memory.closedJobs, false);
        DoJobArray(Memory.openJobs, true);

        function DoJobArray(jobs, isOpenJobs) {
            for(let i = 0; i < jobs.length; i++){
                const closedJobOBJ = Game.getObjectById(jobs[i].id);
                if(closedJobOBJ === null){

                    for (const creepNum in jobs[i].creeps) {
                        let creepName = jobs[i].creeps[creepNum];
                        let creep = Game.creeps[creepName];

                        if (creep !== undefined) {
                            console.log("DoClosedJob, job: " + creep.memory.jobName + " is not found, removing job from creep " + creepName);
                            creep.memory.jobName = 'idle';
                            creep.memory.jobId = undefined;
                            creep.memory.energyTarget = undefined;
                            creep.say("job🌀 gone"); // most common job object to disappear is the DroppedResources job
                        }
                    }
                    let spliceResult = jobs.splice(i, 1); // remove empty closedJob index
                    console.log("DoClosedJob, job object disappeared: " + JSON.stringify(spliceResult));
                    i--;
                }else{
                    let moveToOpenJobs = false;
                    for(let e = 0; e < jobs[i].creeps.length; e ++){
                        const creep = Game.creeps[jobs[i].creeps[e]];
                        if(creep === null || creep === undefined){
                            console.log("DoClosedJob, undefined creep in DoClosedJobs i:" + i + ", list: " + JSON.stringify(jobs[i].creeps));
                            jobs[i].creeps.splice(e, 1);
                            moveToOpenJobs = true;
                            continue; // do not break - there may be other creeps at this job that should be allowed to finish
                        }
                        if(creep.spawning){
                            continue;
                        }
                        // return values:
                        // 0: acted and job not done
                        // 1: moved and did not act
                        // 2: tried to act but job is done
                        const jobStatus = CreepActions(creep, jobs[i].name, closedJobOBJ); // move to job and do job
                        // TODO add CARRY "on the road" jobs here - pickup stuff and transfer stuff that are "dead weight"
                        // if ENERGY and WORK and did not act - repair stuff on the road.
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
                        if(jobStatus === 2){ // 2 means tried to act but job is done
                            creep.say("job✔" + closedJobOBJ.pos.x + "," + closedJobOBJ.pos.y);
                            let spliceResult = jobs.splice(i, 1); // delete the closed job
                            console.log("DoClosedJob, " + creep.memory.jobName + " is done, removing job and setting creep job to idle, splice: " + JSON.stringify(spliceResult));
                            creep.memory.jobName = 'idle';
                            creep.memory.jobId = undefined;
                            if(creep.memory.energyTarget !== undefined){creep.memory.energyTarget = undefined;}
                            i--;
                            break; // break - if there where other creeps in this job then they should just be ignored because the job is done
                        }
                    }
                    if(moveToOpenJobs && !isOpenJobs){
                        Memory.openJobs.push(jobs[i]); // move to openJobs, a creep in that job is probably dead
                        let spliceResult =  jobs.splice(i, 1); // remove from closedJob
                        console.log("DoClosedJob, moveToOpenJobs, splice: " + JSON.stringify(spliceResult));
                        i--;
                    }
                }
            }
        }


        // TODO remove - is only there for testing - when a job is removed manually or by errors then there may be creeps that jobName != idle fix that
        for (const creepName in Game.creeps){
            let creep = Game.creeps[creepName];
            if(creep.memory.jobName === 'idle'){
                continue;
            }else{
                let obj = Game.getObjectById(creep.memory.jobId);
                if(obj === null){
                    console.log("ERROR!! " + creep.memory.jobName + " is undefined in Memory on creep: " + creepName);
                    creep.say("ERROR!!!!!");
                    creep.memory.jobName = 'idle';
                    creep.memory.jobId = undefined;
                }
            }
        }


        /**
         * @return {int}
         */
        function CreepActions(creep, closedJobName, closedJobOBJ){
            let actionResult = -5;
            let jobStatus = 0;
            switch (closedJobName) {
                case "ActiveSources":
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

                case "DroppedResources":
                case "FullLinks":
                case "FullContainers":
                    if(creep.room.storage !== undefined){
                        let sumCreepCarry = _.sum(creep.carry);
                        if (sumCreepCarry > 0
                            && (sumCreepCarry === creep.carryCapacity
                            || (closedJobName === "DroppedResources" && closedJobOBJ.amount === 0)
                            || (closedJobName === "FullLinks" && closedJobOBJ.energy === 0)
                            || (closedJobName === "FullContainers" && _.sum(closedJobOBJ.store) === 0))) {
                            actionResult = CreepAct(creep, closedJobName, 1, creep.room.storage);
                            if(actionResult === ERR_NOT_IN_RANGE){
                                creep.moveTo(creep.room.storage, {visualizePathStyle:{fill: 'transparent',stroke: '#0000ff',lineStyle: 'dotted',strokeWidth: .15,opacity: .1}});
                                jobStatus = 1;
                            }
                        } else {
                            actionResult = CreepAct(creep, closedJobName, 2, closedJobOBJ);
                            if(actionResult === ERR_NOT_IN_RANGE){
                                creep.moveTo(closedJobOBJ, {visualizePathStyle:{fill: 'transparent',stroke: '#0000ff',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                                jobStatus = 1;
                            }
                            if((actionResult === ERR_NOT_ENOUGH_RESOURCES || actionResult === ERR_INVALID_TARGET) && sumCreepCarry === 0){
                                jobStatus = 2;
                            }
                        }
                    }else{
                        console.log("DoClosedJob, ERROR! no storage in room: " + creep.room.name + ", but creep " + creep.name + " is there!");
                    }
                    break;
                case "StorageHasMinerals":
                    if(creep.room.terminal !== undefined){
                        if(_.sum(creep.room.terminal.store) === creep.room.terminal.storeCapacity){
                            console.log("DoClosedJob, Terminal full in " + creep.room.name);
                        }else{
                            let sumCreepCarry = _.sum(creep.carry);
                            if (sumCreepCarry > 0
                                && (sumCreepCarry === creep.carryCapacity
                                    || (closedJobName === "StorageHasMinerals" && (_.sum(closedJobOBJ.store) - closedJobOBJ.store[RESOURCE_ENERGY]) === 0))) {
                                actionResult = CreepAct(creep, closedJobName, 1, creep.room.terminal);
                                if(actionResult === ERR_NOT_IN_RANGE){
                                    creep.moveTo(creep.room.terminal, {visualizePathStyle:{fill: 'transparent',stroke: '#0000ff',lineStyle: 'dotted',strokeWidth: .15,opacity: .1}});
                                    jobStatus = 1;
                                }
                            } else {
                                actionResult = CreepAct(creep, closedJobName, 2, closedJobOBJ);
                                if(actionResult === ERR_NOT_IN_RANGE){
                                    creep.moveTo(closedJobOBJ, {visualizePathStyle:{fill: 'transparent',stroke: '#0000ff',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                                    jobStatus = 1;
                                }
                                if((actionResult === ERR_NOT_ENOUGH_RESOURCES || actionResult === ERR_INVALID_TARGET) && sumCreepCarry === 0){
                                    jobStatus = 2;
                                }
                            }
                        }
                    }else{
                        console.log("DoClosedJob, ERROR! no terminal in room: " + creep.room.name + ", but creep " + creep.name + " is there!");
                    }
                    break;
                case "SpawnsAndExtensionsNeedEnergy":
                case "TowersNeedEnergy":
                case "TerminalsNeedEnergy":
                case "OwnedControllers":
                case "DamagedStructures":
                case "Constructions":
                    if (creep.carry[RESOURCE_ENERGY] === 0) { // go get some energy!
                        const energyTargetID = creep.memory.energyTarget;
                        let energyTarget;
                        if(energyTargetID === undefined){
                            energyTarget = ClosestEnergyFullStoreInRoom(creep);
                            creep.memory.energyTarget = energyTarget.id; // save so that the function only runs once
                        }else{
                            energyTarget = Game.getObjectById(energyTargetID);
                        }
                        actionResult = CreepAct(creep, closedJobName, 1, energyTarget);
                        if(actionResult === ERR_NOT_IN_RANGE){
                            creep.moveTo(energyTarget, {visualizePathStyle:{fill: 'transparent',stroke: '#ffe100',lineStyle: 'dotted',strokeWidth: .15,opacity: .1}});
                            jobStatus = 1;
                        }
                    } else { // go build/repair/upgrade/transfer
                        actionResult = CreepAct(creep, closedJobName, 2, closedJobOBJ);
                        if(actionResult === ERR_NOT_IN_RANGE){
                            creep.moveTo(closedJobOBJ, {visualizePathStyle:{fill: 'transparent',stroke: '#00ff00',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                            jobStatus = 1;
                        }else if(actionResult === ERR_FULL || actionResult === ERR_INVALID_TARGET
                            || (closedJobName === "DamagedStructures" || closedJobName === "Constructions") && (closedJobOBJ.hits === closedJobOBJ.hitsMax || closedJobOBJ.hits >= MAX_HITS_TO_MAINTAIN)
                            || closedJobName === "TerminalsNeedEnergy" && closedJobOBJ.store[RESOURCE_ENERGY] >= MAX_ENERGY_TERMINAL
                            || closedJobName === "TowersNeedEnergy" && closedJobOBJ.energy >= 980){
                            jobStatus = 2;
                        }else if(creep.memory.energyTarget !== undefined){ // reset to enable check for a new energy target
                            creep.memory.energyTarget = undefined;
                        }
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
                    actionResult = creep.transfer(closedJobOBJ, RESOURCE_ENERGY);
                    break;
                case closedJobName === "FullLinks" && actId === 2:
                case closedJobName === "SpawnsAndExtensionsNeedEnergy" && actId === 1:
                case closedJobName === "TowersNeedEnergy" && actId === 1:
                case closedJobName === "TerminalsNeedEnergy" && actId === 1:
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
                default:
                    console.log("DoClosedJob, ERROR! ended in default in CreepAct! closedJobName: " + closedJobName + ", actId: " + actId + ", creepName: " + creep.name);
                    actionResult = -5;
            }
            return actionResult;
        }
    }
};
module.exports = DoClosedJobs;