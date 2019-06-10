const DoJobs = {
    run: function() {
        // constants
        const MAX_HITS_TO_MAINTAIN = 200000; // when repair and build, walls and ramparts have high hits - only maintain up to this
        const MIN_VALID_ENERGY_AMOUNT = 50; // when searching for stored energy in links, containers, storage, dropped energy, ignore below this number
        const MAX_ENERGY_TERMINAL = 100000; // end TerminalsNeedEnergy job when terminal has more than MAX_ENERGY_TERMINAL energy

        for(const creepName in Memory.creeps) {
            const creepMemory = Memory.creeps[creepName];
            const creep = Game.creeps[creepName];
            if(creep){
                let jobOBJ;
                let jobStatus = 2;
                if(creepMemory.flagName){
                    jobOBJ = Game.flags[creepMemory.flagName];
                }else if(creepMemory.jobName === "idle"){
                    // TODO idle action
                }else{
                    jobOBJ = Game.getObjectById(creepMemory.jobId);
                }

                if(jobOBJ){
                    // jobStatus = 0 - doing job actively
                    // jobStatus = 1 - moved to job
                    // jobStatus = 2 - job is done
                    // jobStatus = 3 - not enough energy
                    jobStatus = CreepActions(creep, creepMemory.jobName, jobOBJ);

                    if(jobStatus >= 2){ // job is done
                        if(jobStatus === 2){
                            console.log("DoJobs, job done: " + creepMemory.jobName + ", room: " + jobOBJ.pos.roomName);
                            creep.say("job✔" + jobOBJ.pos.x + "," + jobOBJ.pos.y);
                        }else if(jobStatus === 3){ // no energy for job
                            console.log("DoJobs, no energy, job set to done: " + creepMemory.jobName + ", room: " + jobOBJ.pos.roomName);
                            creep.say("job⚡" + jobOBJ.pos.x + "," + jobOBJ.pos.y);
                        }
                        UpdateJob(creepName, creepMemory, false);
                    }
                }else if(creepMemory.jobName !== "idle"){ // job object is gone
                    console.log("DoJobs, job object disappeared: " + creepMemory.jobName);
                    creep.say("job🌀 gone"); // most common job object to disappear is the DroppedResources job
                    UpdateJob(creepName, creepMemory, false);
                }

                let actionResult;
                if(jobStatus > 0 && creep.carry[RESOURCE_ENERGY] > 0){ // deposit energy in nearby extension or spawn if it needs it
                    const toFill = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {filter: (structure) => {
                            return (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) && structure.energy < structure.energyCapacity;
                        }})[0];
                    if(toFill){
                        actionResult = creep.transfer(toFill, RESOURCE_ENERGY);
                        //console.log("DoJobs, " + creep.name + " transferred on the go to spawn or extension in " + toFill.pos.roomName);
                        if(actionResult !== 0){
                            console.log("DoJobs, ERROR: " + creep.name + ", could not transfer on the go: " + JSON.stringify(toFill));
                        }
                    }
                }
                if(actionResult !== 0 && jobStatus > 0 && _.sum(creep.carry) < creep.carryCapacity){ // pickup dropped stuff in the immediate area
                    const droppedResource = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
                    if(droppedResource){
                        actionResult = creep.pickup(droppedResource);
                        //console.log("DoJobs, " + creep.name + " picked up on the go in " + droppedResource.pos.roomName);
                        if(actionResult !== 0){
                            console.log("DoJobs, ERROR: " + creep.name + ", could not pickup on the go: " + JSON.stringify(droppedResource));
                        }
                    }
                }
                if(jobStatus > 0 && jobStatus > 0 && creep.carry[RESOURCE_ENERGY] > 0 && creep.body.filter(part => (part.type === WORK)).some(x => !!x)){ // creep only moved or is idle - try and act
                    const structureToRepair = creep.pos.findInRange(FIND_STRUCTURES, 2, {filter: (structure) => {
                            return structure.hits < structure.hitsMax
                                && structure.structureType !== STRUCTURE_WALL
                                && structure.structureType !== STRUCTURE_RAMPART;
                        }})[0];
                    if(structureToRepair){
                        actionResult = creep.repair(structureToRepair);
                        if(actionResult !== 0){
                            console.log("DoJobs, ERROR: " + creep.name + ", could not repair on the go: " + JSON.stringify(structureToRepair));
                        }
                    }
                }
                if(actionResult !== 0 && jobStatus > 0 && creepMemory.jobName === "idle" && _.sum(creep.carry) > 0){ // deposit stuff if creep is idle and has stuff
                    // TODO more extensive lookup of a valid storage and then move to it to deposit in it
                }
            }else{ // creep is gone
                console.log("DoJobs, creep " + creepName + " is gone " + JSON.stringify(creep));
                UpdateJob(creepName, creepMemory, true);
            }
        }

        // end job or remove creep on job, if closed job move to open jobs
        function UpdateJob(creepName, creepMemory, isCreepGone){
            let foundJob = false;
            for(let i = 0; i < Memory.closedJobs.length; i++){
                if(Memory.closedJobs[i].name === creepMemory.jobName && Memory.closedJobs[i].id === creepMemory.jobId && Memory.closedJobs[i].flagName === creepMemory.flagName){
                    foundJob = true;
                    for(let e = 0; e < Memory.closedJobs[i].creeps.length; e++){
                        if(isCreepGone) { // remove creep from job
                            if(Memory.closedJobs[i].creeps[e] === creepName){
                                Memory.closedJobs[i].creeps.splice(e, 1); // remove dead creep
                                Memory.openJobs.push(Memory.closedJobs.splice(i, 1)[0]); // move closed job to open jobs
                                break;
                            }
                        }else{ // remove job, done or gone
                            UnassignCreep(Memory.creeps[Memory.closedJobs[i].creeps[e]]);
                        }
                    }
                    if(!isCreepGone){
                        Memory.closedJobs.splice(i, 1)
                    }
                    break;
                }
            }
            if(!foundJob){ // then search in open jobs
                for(let i = 0; i < Memory.openJobs.length; i++){
                    if(Memory.openJobs[i].name === creepMemory.jobName && Memory.openJobs[i].id === creepMemory.jobId && Memory.openJobs[i].flagName === creepMemory.flagName){
                        foundJob = true;
                        for(let e = 0; e < Memory.openJobs[i].creeps.length; e++){
                            if(isCreepGone) { // remove creep from job
                                if(Memory.openJobs[i].creeps[e] === creepName){
                                    Memory.openJobs[i].creeps.splice(e, 1); // remove dead creep
                                    break;
                                }
                            }else{ // remove job, done or gone
                                UnassignCreep(Memory.creeps[Memory.openJobs[i].creeps[e]]);
                            }
                        }
                        if(!isCreepGone){
                            Memory.openJobs.splice(i, 1)
                        }
                        break;
                    }
                }
            }
            if(!foundJob){ // did not find the job that was in creep memory
                console.log("DoJobs, could not find job " + creepMemory.jobName + " that " + creepName + " had, unassigning creep only");
                UnassignCreep(Memory.creeps[creepName]);
            }
            if(isCreepGone){
                delete Memory.creeps[creepName];
            }
        }

        function UnassignCreep(creepMemory) {
            creepMemory.jobName = "idle";
            if(creepMemory.jobId              ){creepMemory.jobId               = undefined;}
            if(creepMemory.energyTarget       ){creepMemory.energyTarget        = undefined;}
            if(creepMemory.closestLink        ){creepMemory.closestLink         = undefined;}
            if(creepMemory.resourceDestination){creepMemory.resourceDestination = undefined;}
            if(creepMemory.flagName           ){
                if(Game.flags[creepMemory.flagName]){Game.flags[creepMemory.flagName].remove();}
                creepMemory.flagName     = undefined;
            }
        }

        /**
         * @return {int}
         */
        function CreepActions(creep, closedJobName, closedJobOBJ){
            let actionResult = ERR_NOT_FOUND;
            // jobStatus = 0 - doing job actively
            // jobStatus = 1 - moved to job
            // jobStatus = 2 - job is done
            // jobStatus = 3 - not enough energy
            let jobStatus = 0;
            switch (closedJobName) {
                case "ActiveSources": // these jobs extract resources
                case "ActiveMinerals":
                    if (_.sum(creep.carry) === creep.carryCapacity) {
                        let closestLink = null;
                        if(closedJobName === "ActiveSources") {
                            if (creep.memory.closestLink) {
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
                        if(creep.carry[RESOURCE_ENERGY] > 0 && closestLink && closestLink.energy < closestLink.energyCapacity){
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
                    let sumCreepCarry = _.sum(creep.carry);
                    if (sumCreepCarry > 0
                        && (creep.memory.resourceDestination || (
                            sumCreepCarry === creep.carryCapacity
                            || (closedJobName === "DroppedResources" && closedJobOBJ.amount === 0)
                            || (closedJobName === "FullLinks" && closedJobOBJ.energy === 0)
                            || (closedJobName === "FullContainers" && _.sum(closedJobOBJ.store) === 0)
                            || (closedJobName === "StorageHasMinerals" && (_.sum(closedJobOBJ.store) - closedJobOBJ.store[RESOURCE_ENERGY]) === 0)
                        ))) {

                        let bestResDropoff; // find closest terminal or storage - depending on job type
                        if(closedJobName === "StorageHasMinerals"){
                            // get a valid terminal
                            if(creep.memory.resourceDestination){
                                bestResDropoff = Game.getObjectById(creep.memory.resourceDestination);
                            }else if(closedJobOBJ.room && closedJobOBJ.room.terminal && _.sum(closedJobOBJ.room.terminal.store) < closedJobOBJ.room.terminal.storeCapacity){ // we know it has a storage that I own in this room but does it have a terminal?
                                bestResDropoff = closedJobOBJ.room.terminal;
                            }else if(closedJobOBJ.pos.roomName !== creep.pos.roomName && creep.room.terminal && _.sum(creep.room.terminal.store) < creep.room.terminal.storeCapacity){ // then check creep room
                                bestResDropoff = creep.room.terminal;
                                creep.memory.resourceDestination = bestResDropoff.id;
                            }else{ // still no luck then search for terminals in other rooms
                                let roomWithStorageLinearDistance = Number.MAX_SAFE_INTEGER;
                                for (let roomCount in Game.rooms) {
                                    const room = Game.rooms[roomCount];
                                    if(room.terminal && _.sum(room.terminal.store) < room.terminal.storeCapacity){
                                        if(!bestResDropoff || Game.map.getRoomLinearDistance(room.name, creep.pos.roomName) < roomWithStorageLinearDistance){
                                            bestResDropoff = room.terminal;
                                            roomWithStorageLinearDistance = Game.map.getRoomLinearDistance(room.name, creep.pos.roomName);
                                            console.log(creep.name + " found alternate terminal in room " + bestResDropoff.pos.roomName);
                                        }
                                    }
                                }
                                if(bestResDropoff){
                                    creep.memory.resourceDestination = bestResDropoff.id;
                                }
                            }
                        }else{
                            // get a valid storage
                            if(creep.memory.resourceDestination){
                                bestResDropoff = Game.getObjectById(creep.memory.resourceDestination);
                            }else if(closedJobOBJ.room && closedJobOBJ.room.storage && _.sum(closedJobOBJ.room.storage.store) < closedJobOBJ.room.storage.storeCapacity){ // first check job room
                                bestResDropoff = closedJobOBJ.room.storage;
                                creep.memory.resourceDestination = bestResDropoff.id;
                            }else if(closedJobOBJ.pos.roomName !== creep.pos.roomName && creep.room.storage && _.sum(creep.room.storage.store) < creep.room.storage.storeCapacity){ // then check creep room
                                bestResDropoff = creep.room.storage;
                                creep.memory.resourceDestination = bestResDropoff.id;
                            }else{ // still no luck then search for storage in other rooms
                                let roomWithStorageLinearDistance = Number.MAX_SAFE_INTEGER;
                                for (let roomCount in Game.rooms) {
                                    const room = Game.rooms[roomCount];
                                    if(room.storage && _.sum(room.storage.store) < room.storage.storeCapacity){
                                        if(!bestResDropoff || Game.map.getRoomLinearDistance(room.name, creep.pos.roomName) < roomWithStorageLinearDistance){
                                            bestResDropoff = room.storage;
                                            roomWithStorageLinearDistance = Game.map.getRoomLinearDistance(room.name, creep.pos.roomName);
                                            console.log(creep.name + " found alternate storage in room " + bestResDropoff.pos.roomName);
                                        }
                                    }
                                }
                                if(bestResDropoff){
                                    creep.memory.resourceDestination = bestResDropoff.id;
                                }
                            }
                        }
                        if(bestResDropoff){ // abort if storage or terminal was not found
                            actionResult = CreepAct(creep, closedJobName, 1, bestResDropoff);
                            if(actionResult === ERR_NOT_IN_RANGE){
                                creep.moveTo(bestResDropoff, {visualizePathStyle:{fill: 'transparent',stroke: '#0000ff',lineStyle: 'dotted',strokeWidth: .15,opacity: .1}});
                                jobStatus = 1;
                            }else if(actionResult === ERR_FULL){
                                console.log("DoJobs, depositing ERR_FULL! code: " + actionResult + ", creep: " + creep.name + ", job (" + bestResDropoff.pos.x + ", " + bestResDropoff.pos.y + ", " + bestResDropoff.pos.roomName + "), ending job!");
                                jobStatus = 2;
                            }
                        }else{
                            console.log("DoJobs, no storage or terminal found, creep " + creep.name + ", job: " + closedJobName + " ending job!");
                            jobStatus = 2;
                        }
                    } else {
                        if(creep.memory.resourceDestination){creep.memory.resourceDestination = undefined;} // reset
                        actionResult = CreepAct(creep, closedJobName, 2, closedJobOBJ); // obtaining the stuff that should be moved around
                        if(actionResult === ERR_NOT_IN_RANGE){
                            creep.moveTo(closedJobOBJ, {visualizePathStyle:{fill: 'transparent',stroke: '#0000ff',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                            jobStatus = 1;
                        }else if((actionResult === ERR_NOT_ENOUGH_RESOURCES || actionResult === ERR_INVALID_TARGET) && sumCreepCarry === 0){
                            jobStatus = 2;
                        }
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
                            energyTarget = ClosestEnergyFullStoreInRoom(creep, closedJobOBJ);
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
                case "ReserveController":
                case "GuardPos":
                    let isAttackingHostile = false;
                    if(closedJobName === "GuardPos" && closedJobOBJ.pos.roomName === creep.pos.roomName){
                        const targets = creep.room.find(FIND_HOSTILE_CREEPS);
                        if(targets.length > 0){
                            creep.say("ATTACK!", true);
                            console.log("DoJobs, " + creep.name + " is attacking " + targets[0].name + " in room " + creep.pos.roomName);
                            actionResult = creep.attack(targets[0]);
                            if(actionResult === ERR_NOT_IN_RANGE) {
                                creep.moveTo(targets[0].pos, {visualizePathStyle:{fill: 'transparent',stroke: '#ff0000',lineStyle: 'dashed',strokeWidth: .15,opacity: .5}});
                                jobStatus = 1;
                            }
                            isAttackingHostile = true;
                        }
                    }

                    if(!isAttackingHostile){
                        actionResult = CreepAct(creep, closedJobName, 2, closedJobOBJ);
                        if(actionResult === ERR_NOT_IN_RANGE) {
                            creep.moveTo(closedJobOBJ.pos, {visualizePathStyle:{fill: 'transparent',stroke: '#fd00ff',lineStyle: 'dashed',strokeWidth: .15,opacity: .5}});
                            jobStatus = 1;
                        }else if(closedJobName === "TagController" || closedJobName === "ClaimController") {
                            jobStatus = 2;
                        }
                    }
                    break;
                default:
                    console.log("DoJobs, ERROR! ended in default in CreepActions! closedJobName: " + closedJobName + ", creepName: " + creep.name);
                    jobStatus = 0;
            }
            return jobStatus;
        }

        // used by creep-transporters to see which store in the room where the creep is is most full of energy
        function ClosestEnergyFullStoreInRoom(creep, closedJobOBJ){
            let bestEnergyLocation;
            if(closedJobOBJ.room){
                if(closedJobOBJ.room.storage && closedJobOBJ.room.storage.store[RESOURCE_ENERGY] > 0){
                    bestEnergyLocation = closedJobOBJ.room.storage;
                }

                const energyCandidates = [];
                const droppedEnergy = closedJobOBJ.room.find(FIND_DROPPED_RESOURCES, {
                    filter: (drop) => {
                        return (drop.resourceType === RESOURCE_ENERGY && drop.amount >= MIN_VALID_ENERGY_AMOUNT);
                    }
                }).map(function (p) {return {'name': 'droppedEnergy', 'id': p.id, 'pos': p.pos, 'energy': p.amount};});
                const containers = closedJobOBJ.room.find(FIND_STRUCTURES, {
                    filter: (container) => {
                        return ((container.structureType === STRUCTURE_CONTAINER || container.structureType === STRUCTURE_STORAGE) && container.store[RESOURCE_ENERGY] >= MIN_VALID_ENERGY_AMOUNT);
                    }
                }).map(function (p) {return {'name': 'containers', 'id': p.id, 'pos': p.pos, 'energy': p.store[RESOURCE_ENERGY]};});
                const links = closedJobOBJ.room.find(FIND_MY_STRUCTURES, {
                    filter: (link) => {
                        return ((link.structureType === STRUCTURE_LINK) && link.energy >= MIN_VALID_ENERGY_AMOUNT);
                    }
                }).map(function (p) {return {'name': 'links', 'id': p.id, 'pos': p.pos, 'energy': p.energy};});
                energyCandidates.push(...droppedEnergy);
                energyCandidates.push(...containers);
                energyCandidates.push(...links);

                if(creep.pos.roomName === closedJobOBJ.pos.roomName){ // creep and job is in the same room - take the closest candidate
                    let bestRange = Number.MAX_SAFE_INTEGER;
                    for(let i = 0; i < energyCandidates.length; i++){
                        const energyCandidate = energyCandidates[i];
                        const range = creep.pos.getRangeTo(energyCandidate.pos);
                        if(bestRange > range){
                            bestEnergyLocation = energyCandidate;
                            bestRange = range;
                        }
                    }
                }else{ // creep and job is not in the same room - take the candidate with the most energy
                    let bestEnergy = 0;
                    for(let i = 0; i < energyCandidates.length; i++){
                        const energyCandidate = energyCandidates[i];
                        const energy = energyCandidate.energy;
                        if(bestEnergy < energy){
                            bestEnergyLocation = energyCandidate;
                            bestEnergy = energy;
                        }
                    }
                }
            } else if(creep.pos.roomName !== closedJobOBJ.pos.roomName && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 0){
                bestEnergyLocation = creep.room.storage;
            }
            if(!bestEnergyLocation){ // could not find any energy in creep room to take from - look in other rooms for a storage
                let roomWithStorageLinearDistance = Number.MAX_SAFE_INTEGER;
                for (let roomCount in Game.rooms) {
                    const room = Game.rooms[roomCount];
                    if(!bestEnergyLocation && room.storage || room.storage &&  Game.map.getRoomLinearDistance(room.name, creep.pos.roomName) < roomWithStorageLinearDistance){
                        bestEnergyLocation = room.storage;
                        roomWithStorageLinearDistance = Game.map.getRoomLinearDistance(room.name, creep.pos.roomName);
                        console.log(creep.name + " found alternate storage in room " + bestEnergyLocation.pos.roomName);
                    }
                }
            }
            creep.say("get⚡" + bestEnergyLocation.pos.x + "," + bestEnergyLocation.pos.y);
            return Game.getObjectById(bestEnergyLocation.id);
        }

        /**
         * @return {int}
         */
        function CreepAct(creep, closedJobName, actId, closedJobOBJ){
            let actionResult = -5;
            // act: 1 - action needed to later complete the job
            // act: 2 - main action to complete the job
            switch (true) {
                case closedJobName === "DroppedResources" && actId === 1:
                case closedJobName === "FullLinks" && actId === 1:
                case closedJobName === "FullContainers" && actId === 1:
                case closedJobName === "StorageHasMinerals" && actId === 1:
                    for(const resourceType in creep.carry) {
                        actionResult = creep.transfer(closedJobOBJ, resourceType);
                    }
                    break;
                case closedJobName === "DroppedResources" && actId === 2:
                    actionResult = creep.pickup(closedJobOBJ);
                    break;
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
                    if(closedJobOBJ.room){
                        actionResult = creep.signController(closedJobOBJ.room.controller, closedJobOBJ.name);
                    }else{actionResult = ERR_NOT_IN_RANGE;}
                    break;
                case closedJobName === "ScoutPos" && actId === 2:
                case closedJobName === "GuardPos" && actId === 2:
                    if(creep.pos.roomName === closedJobOBJ.pos.roomName && creep.pos.x === closedJobOBJ.pos.x && creep.pos.y === closedJobOBJ.pos.y){
                        creep.say(closedJobOBJ.name, true);
                        actionResult = 0;
                    }else{actionResult = ERR_NOT_IN_RANGE;}
                    break;
                case closedJobName === "ClaimController" && actId === 2:
                    creep.say("clm " + closedJobOBJ.pos.roomName, true);
                    if(closedJobOBJ.room){
                        actionResult = creep.claimController(closedJobOBJ.room.controller);
                    }else{actionResult = ERR_NOT_IN_RANGE;}
                    break;
                case closedJobName === "ReserveController" && actId === 2:
                    creep.say("res " + closedJobOBJ.pos.roomName, true);
                    if(closedJobOBJ.room){
                        actionResult = creep.reserveController(closedJobOBJ.room.controller);
                    }else{actionResult = ERR_NOT_IN_RANGE;}
                    break;
                default:
                    console.log("DoJobs, ERROR! ended in default in CreepAct! closedJobName: " + closedJobName + ", actId: " + actId + ", creepName: " + creep.name);
                    actionResult = -5;
            }
            return actionResult;
        }
    }
};
module.exports = DoJobs;