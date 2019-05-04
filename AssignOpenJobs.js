const AssignOpenJobs = {
    run: function () {

        /* --------------- Assign jobs algorithm --------------- */
        const JOB_ACCEPTABLE_POSITION_WEIGHT = 200; // the acceptable range-weight for allowing a job to be assigned to a creep
        const JOB_WEIGHT_MOD = 100; // modifier for how pronounced the range part should be
        const JOB_WEIGHT_MULTIPLIER_INTER_ROOM = 1; // multiplier for how pronounced the inter room range part should be
        const ALLOWED_COMPATIBILITY = 6; // do not assign the job to a creep that is not compatible

        /*creep types:
        * [T] transporter   no work
        * [H] harvester     only one carry
        * [B] builder       equal work and carry
        * [E] extractor     only one carry and maxed out work
        * TODO not in first version
        * [W] warrior
        * [M] medic
        * [S] scout
        * [C] claimer
        * [R] rangedHarvester
        *
        *     T  H  B  E
        * AS  -  1  7  6  ActiveSources
        * DR  5  6  6  7  DroppedResources
        * SE  1  8  8  8  SpawnsAndExtensionsNeedEnergy
        * TE  2  6  6  6  TowersNeedEnergy
        * FL  3  9  9  9  FullLinks
        * FC  4  9  9  9  FullContainers
        * OC  -  8  1  8  OwnedControllers
        * DS  -  6  2  7  DamagedStructures
        * CO  -  7  3  7  Constructions
        * AE  -  6  7  1  ActiveExtractors
        * TODO not in first version
        * HC  -  -  -  -  HostileCreeps
        * --  -  -  -  -  RemoteControllersToClaim
        * --  -  -  -  -  RemoteRoomsToScout
        * --  -  -  -  -  RemoteActiveSources
        * --  -  -  -  -  RemoteRallyPoints
        */
        let isAllAssigned = false; // loop until all openJobs or idleCreeps is empty or not applicable
        while (!isAllAssigned) {
            let idleCreeps = _(Game.creeps).filter({memory: {jobName: 'idle'}}).value();
            console.log("idle creeps: " + idleCreeps.length);
            if(idleCreeps.length === 0){
                break; // no need to enter algorithm if there are no idle creeps
            }
            let bestCreep = undefined;
            let bestOpenJob = undefined;
            let bestOpenJobPlacement = 0;
            let bestOpenJobOBJ = undefined;
            let bestWeight = ALLOWED_COMPATIBILITY;
            let bestPositionWeight = Number.MAX_SAFE_INTEGER;
            for (let i = 0; i < Memory.openJobs.length; i++) { // loop through all open jobs
                const openJob = Memory.openJobs[i];
                const openJobOBJ = Game.getObjectById(openJob.id);
                if(openJobOBJ === null || openJobOBJ === undefined){
                    console.log("AssignOpenJobs, " + JSON.stringify(openJob) + " is undefined, removing job");
                    Memory.openJobs.splice(i, 1);
                    i--;
                    continue;
                }
                for (let e = 0; e < idleCreeps.length; e++) {// const creepName in idleCreeps) { // loop through all idle creeps
                    const creep = idleCreeps[e];
                    let weight = CreepOnJobPoints(creep.name.substring(0, 1), openJob.name);
                    if (weight > 0) { // is applicable
                        if (bestWeight > weight) { // best creep for the job (for now) is found
                            let positionWeight = 0;
                            if (openJobOBJ.pos.roomName === creep.pos.roomName) { // in same room
                                positionWeight += -JOB_WEIGHT_MOD;
                                positionWeight += Math.sqrt(Math.pow(openJobOBJ.pos.x - creep.pos.x, 2) + Math.pow(openJobOBJ.pos.y - creep.pos.y, 2)) * JOB_WEIGHT_MULTIPLIER_INTER_ROOM; // in room range
                            } else { // Get the linear distance (in rooms) between two rooms
                                positionWeight = JOB_WEIGHT_MOD * Game.map.getRoomLinearDistance(openJobOBJ.pos.roomName, creep.pos.roomName);
                            }
                            if (bestPositionWeight > positionWeight && (positionWeight < JOB_ACCEPTABLE_POSITION_WEIGHT || openJob.name.startsWith("Remote"))) { // best creep range (for now) is found
                                bestCreep = creep;
                                bestOpenJob = openJob;
                                bestOpenJobPlacement = i;
                                bestOpenJobOBJ = openJobOBJ;
                                bestWeight = weight;
                                bestPositionWeight = positionWeight;
                            }
                        }
                    }
                }
            }
            if (bestCreep !== undefined && bestCreep !== null) { // best creep for the job is now assigned
                bestCreep.memory.jobName = bestOpenJob.name;
                bestCreep.memory.jobId = bestOpenJob.id;
                bestOpenJob.creeps.push(bestCreep.name);
                if (bestOpenJob.creeps.length >= NumberOfCreepsOnJob(bestOpenJobOBJ.room.controller.level, bestOpenJob.name)) {
                    // considering RCL this job should not employ more creeps
                    Memory.openJobs.splice(bestOpenJobPlacement, 1);
                    Memory.closedJobs.push(bestOpenJob);
                }
                console.log("AssignOpenJobs, job: " + bestOpenJob.name + " (" + bestOpenJobOBJ.pos.x + ", " + bestOpenJobOBJ.pos.y + ", " + bestOpenJobOBJ.pos.roomName + "), assigned to creep: " + bestCreep.name);
            }
            else { // done
                isAllAssigned = true;
            }
        }

        /* --------------- Spawn algorithm --------------- */
        const SPAWN_ACCEPTABLE_WEIGHT = 500; // the acceptable weight for allowing a spawn to create a creep for a job
        const RANGE_WEIGHT_MOD = 500; // modifier for how pronounced the range part should be
        const RANGE_WEIGHT_MULTIPLIER_INTER_ROOM = 5; // multiplier for how pronounced the inter room range part should be

        let doneSpawning = false;
        const availableSpawns = _(Game.spawns).filter(spawn => spawn.spawning === null && spawn.room.energyAvailable >= 150).value();
        while (!doneSpawning) {
            //console.log("AssignOpenJobs, availableSpawns.length " + availableSpawns.length);
            if(availableSpawns.length === 0){
                //console.log("AssignOpenJobs, no available spawns");
                break; // no need to enter algorithm if there are no available spawns
            }
            let bestSpawn = undefined;
            let bestSpawnPlacement = 0;
            let bestOpenJob = undefined;
            let bestOpenJobPlacement = 0;
            let bestWeight = Number.MAX_SAFE_INTEGER;
            let bestOpenJobOBJ = undefined;

            for (let i = 0; i < Memory.openJobs.length; i++) { // loop through all open jobs
                const openJob = Memory.openJobs[i];
                const openJobOBJ = Game.getObjectById(openJob.id);
                if(openJobOBJ === null || openJobOBJ === undefined){
                    console.log("AssignOpenJobs, " + JSON.stringify(openJob) + " is not found, removing job");
                    Memory.openJobs.splice(i, 1);
                    i--;
                    continue;
                }else if(AtCreepRoof(openJob.name, openJobOBJ)){
                    //console.log("AssignOpenJobs, decline from AtCreepRoof: " + openJob.name + ", " + JSON.stringify(openJobOBJ));
                    continue;
                }
                //console.log(JSON.stringify(openJob) + ", and object: " + JSON.stringify(openJobOBJ));
                for (let e = 0; e < availableSpawns.length; e++){
                    const spawn = availableSpawns[e];
                    let weight = - spawn.room.energyAvailable;
                    if (spawn.pos.roomName === openJobOBJ.pos.roomName) { // same room
                        weight += -RANGE_WEIGHT_MOD;
                        weight += Math.sqrt(Math.pow(openJobOBJ.pos.x - spawn.pos.x, 2) + Math.pow(openJobOBJ.pos.y - spawn.pos.y, 2)) * RANGE_WEIGHT_MULTIPLIER_INTER_ROOM; // in room range
                    } else { // Get the linear distance (in rooms) between two rooms
                        weight += RANGE_WEIGHT_MOD * Game.map.getRoomLinearDistance(openJobOBJ.pos.roomName, spawn.pos.roomName);
                    }
                    weight += -JobImportance(openJob.name); // prioritize jobs
                    if (bestWeight > weight && weight <= SPAWN_ACCEPTABLE_WEIGHT) {
                        bestSpawn = spawn;
                        bestOpenJob = openJob;
                        bestOpenJobPlacement = i;
                        bestSpawnPlacement = e;
                        bestOpenJobOBJ = openJobOBJ;
                        bestWeight = weight;
                    }
                }
            }
            if (bestSpawn !== undefined && bestSpawn !== null) { // best spawn found - spawning creep
                const spawningCreep = SpawnLogic(bestSpawn, bestOpenJob, bestSpawn.room.energyAvailable); // spawn
                console.log("AssignOpenJobs, energy available: " + bestSpawn.room.energyAvailable + ", spawningCreep: " + JSON.stringify(spawningCreep) + ", bestSpawn: " + JSON.stringify(bestSpawn) + ", bestOpenJob: " + JSON.stringify(bestOpenJob));
                if (spawningCreep === undefined || spawningCreep === null) {
                    console.log("AssignOpenJobs, spawningCreep failed, job: " + bestOpenJob.name + " (" + bestOpenJobOBJ.pos.x + ", " + bestOpenJobOBJ.pos.y + ", " + bestOpenJobOBJ.pos.roomName + "), from spawn: " + bestSpawn.name);
                    break;
                } else {
                    console.log("AssignOpenJobs, bestOpenJob.creeps.push: " + spawningCreep.name);
                    bestOpenJob.creeps.push(spawningCreep.name);
                    if (bestOpenJob.creeps.length >= NumberOfCreepsOnJob(bestOpenJobOBJ.room.controller.level, bestOpenJob.name)) {
                        // considering RCL this job should not employ more creeps
                        Memory.openJobs.splice(bestOpenJobPlacement, 1);
                        Memory.closedJobs.push(bestOpenJob);
                        availableSpawns.splice(bestSpawnPlacement, 1);
                    }
                    console.log("AssignOpenJobs, spawn: job: " + bestOpenJob.name + " (" + bestOpenJobOBJ.pos.x + ", " + bestOpenJobOBJ.pos.y + ", " + bestOpenJobOBJ.pos.roomName + "), assigned to creep: " + spawningCreep.name  + ", from spawn: " + bestSpawn.name);
                }
            } else {
                doneSpawning = true;
            }
        }

        /**
         * @return {boolean}
         */
        function AtCreepRoof(jobName, openJobOBJ){
            let isAtCreepRoof = true;
            let harvesterCount = 0;
            let transporterCount = 0;
            let builderCount = 0;
            let extractorCount = 0;
            for (const creepName in Game.creeps) {
                let creep = Game.creeps[creepName];
                if(creep.room.name === openJobOBJ.room.name){
                    if(creepName.startsWith("H")){
                        harvesterCount++;
                    }else if(creepName.startsWith("T")){
                        transporterCount++;
                    }else if(creepName.startsWith("B")){
                        builderCount++;
                    }else if(creepName.startsWith("E")){
                        extractorCount++;
                    }
                }
            }
            switch (jobName) {
                // harvester
                case "ActiveSources": if(harvesterCount < 2){isAtCreepRoof = false;} break;
                // transporter
                case "DroppedResources":
                case "SpawnsAndExtensionsNeedEnergy":
                case "TowersNeedEnergy":
                case "FullLinks":
                case "FullContainers": if(transporterCount < 4){isAtCreepRoof = false;} break;
                // builder
                case "OwnedControllers":
                case "DamagedStructures":
                case "Constructions": if(builderCount < 5){isAtCreepRoof = false;} break;
                // extractor
                case "ActiveMinerals": if(extractorCount < 0){isAtCreepRoof = false;} break;
                default:
                    console.log("AssignOpenJobs, AtCreepRoof jobName not found: " + jobName);
            }
            return isAtCreepRoof;
        }

        /**
         * @return {int}
         */
        function JobImportance(jobName){
            let val = 0;
            switch (jobName) {
                // harvester
                case "ActiveSources": val = 200; break;
                // transporter
                case "DroppedResources": val = 0; break;
                case "SpawnsAndExtensionsNeedEnergy": val = 100; break;
                case "TowersNeedEnergy": val = 100; break;
                case "FullLinks": val = 20; break;
                case "FullContainers": val = 10; break;
                // builder
                case "OwnedControllers": val = 100; break;
                case "DamagedStructures": val = 100; break;
                case "Constructions": val = 10; break;
                // extractor
                case "ActiveMinerals": val = 1; break;
                default:
                    console.log("AssignOpenJobs, JobImportance jobName not found: " + jobName);
            }
            return val;
        }

        /**
         * @return {int}
         */
        function NumberOfCreepsOnJob(RCL, jobName) {
            let numOfCreeps = 1;
            switch (jobName) {
                case "ActiveSources":
                    switch (RCL) {
                        case 1: case 2: numOfCreeps = 3; break;
                        case 3: case 4: case 5: numOfCreeps = 2; break;
                        case 6: case 7: case 8: numOfCreeps = 1; break;
                    } break;
                case "DroppedResources": numOfCreeps = 1; break;
                case "SpawnsAndExtensionsNeedEnergy": numOfCreeps = 1; break;
                case "TowersNeedEnergy": numOfCreeps = 1; break;
                case "FullLinks": numOfCreeps = 1; break;
                case "FullContainers": numOfCreeps = 1; break;
                case "OwnedControllers":
                    switch (RCL) {
                        case 1: case 2: numOfCreeps = 1; break;
                        case 3: case 4: case 5: case 8: numOfCreeps = 2; break;
                        case 6: case 7: numOfCreeps = 3; break;
                    } break;
                case "DamagedStructures": numOfCreeps = 1; break;
                case "Constructions": numOfCreeps = 1; break;
                case "ActiveMinerals": numOfCreeps = 1; break;
                default:
                    console.log("AssignOpenJobs, NumberOfCreepsOnJob jobName not found: " + jobName);
            } return numOfCreeps;
        }

        /**
         * @return {int}
         */
        function CreepOnJobPoints(creepInitial, jobName) {
            let val = -1;
            switch (creepInitial) {
                case "T": // transporter
                    switch (jobName) {
                        case "DroppedResources": val = 5; break;
                        case "SpawnsAndExtensionsNeedEnergy": val = 1; break;
                        case "TowersNeedEnergy": val = 2; break;
                        case "FullLinks": val = 3; break;
                        case "FullContainers": val = 4; break;
                        default: val = -1;
                    } break;
                case "H": // harvester
                    switch (jobName) {
                        case "ActiveSources": val = 1; break;
                        case "DroppedResources": val = 6; break;
                        case "SpawnsAndExtensionsNeedEnergy": val = 8; break;
                        case "TowersNeedEnergy": val = 6; break;
                        case "FullLinks": val = 9; break;
                        case "FullContainers": val = 9; break;
                        case "OwnedControllers": val = 8; break;
                        case "DamagedStructures": val = 6; break;
                        case "Constructions": val = 7; break;
                        case "ActiveMinerals": val = 6; break;
                        default: val = -1;
                    } break;
                case "B": // builder
                    switch (jobName) {
                        case "ActiveSources": val = 7; break;
                        case "DroppedResources": val = 6; break;
                        case "SpawnsAndExtensionsNeedEnergy": val = 8; break;
                        case "TowersNeedEnergy": val = 6; break;
                        case "FullLinks": val = 9; break;
                        case "FullContainers": val = 9; break;
                        case "OwnedControllers": val = 1; break;
                        case "DamagedStructures": val = 2; break;
                        case "Constructions": val = 3; break;
                        case "ActiveMinerals": val = 7; break;
                        default: val = -1;
                    } break;
                case "E": // extractor
                    switch (jobName) {
                        case "ActiveSources": val = 6; break;
                        case "DroppedResources": val = 7; break;
                        case "SpawnsAndExtensionsNeedEnergy": val = 8; break;
                        case "TowersNeedEnergy": val = 6; break;
                        case "FullLinks": val = 9; break;
                        case "FullContainers": val = 9; break;
                        case "OwnedControllers": val = 8; break;
                        case "DamagedStructures": val = 7; break;
                        case "Constructions": val = 7; break;
                        case "ActiveMinerals": val = 1; break;
                        default: val = -1;
                    } break;
                default:
                    val = -1;
                    console.log("AssignOpenJobs, CreepOnJobPoints jobName or creepInitial not found: " + jobName + ", " + creepInitial);
            } return val;
        }

        /**
         * @return {object}
         */
        function SpawnLogic(spawn, job, energyAvailable) {
            // switch through all job types, then switch through all sizes with energyAvailable
            let body = undefined;
            let creepRole = undefined;

            switch (job.name) {
                // [H] harvester
                case "ActiveSources":
                    switch (true) {
                        case (energyAvailable >= 800): // energyCapacityAvailable: 12900, 5600, 2300, 1800, 1300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 450): // energyCapacityAvailable: 550
                            body = [WORK, WORK, WORK, CARRY, MOVE, MOVE];break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [WORK, CARRY, MOVE];break;
                    } creepRole = "H"; break;

                // [T] transporter
                case "DroppedResources":
                case "SpawnsAndExtensionsNeedEnergy":
                case "TowersNeedEnergy":
                case "FullLinks":
                case "FullContainers":
                    switch (true) {
                        case (energyAvailable >= 1350): // energyCapacityAvailable: 12900
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1200): // energyCapacityAvailable: 5600
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1050): // energyCapacityAvailable: 2300
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 900): // energyCapacityAvailable: 1800
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 600): // energyCapacityAvailable: 1300
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 550
                            body = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];break;
                        case (energyAvailable >= 150): // energyCapacityAvailable: 300
                            body = [CARRY, CARRY, MOVE];break;
                    } creepRole = "T"; break;

                // [B] builder
                case "OwnedControllers":
                case "DamagedStructures":
                case "Constructions":
                    switch (true) {
                        case (energyAvailable >= 2200): // energyCapacityAvailable: 12900
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 2000): // energyCapacityAvailable: 5600
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1400): // energyCapacityAvailable: 1800
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1000): // energyCapacityAvailable: 1300
                            body = [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 400): // energyCapacityAvailable: 550
                            body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [WORK, CARRY, MOVE];break;
                    } creepRole = "B"; break;

                // [E] extractor
                case "ActiveMinerals":
                    switch (true) {
                        case (energyAvailable >= 2200): // energyCapacityAvailable: 12900
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 2050): // energyCapacityAvailable: 5600
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1300): // energyCapacityAvailable: 1800
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 800): // energyCapacityAvailable: 1300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 550
                            body = [WORK, WORK, CARRY, MOVE];break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [WORK, CARRY, MOVE];break;
                    } creepRole = "E"; break;
                default:
                    console.log("AssignOpenJobs, ERROR! SpawnLogic job.name not found: " + job.name);
            }
            if(creepRole !== undefined){
                const availableName = getAvailableName(creepRole);
                let spawnResult = spawn.spawnCreep(body, availableName, {memory: {"jobName": job.name, "jobId": job.id}});
                if(spawnResult !== OK){
                    console.log("AssignOpenJobs, SpawnLogic error, spawnResult: " + spawnResult + ", availableName: " + availableName + ", jobName: " + job.name + ", jobId: " + job.id);
                    return undefined;
                }else{
                    return Game.creeps[availableName];
                }
            }else{
                console.log("AssignOpenJobs, ERROR! SpawnLogic, creepRole is not found: " + creepRole + ", " + spawn + ", " + job.name + ", " + energyAvailable);
                return undefined;
            }
        }

        /**
         * @return {String}
         */
        function getAvailableName(creepRole) {
            let availableCount = 1;
            while (true) {
                let isNameTaken = false;
                for (const creepName in Game.creeps) {
                    const creep = Game.creeps[creepName];
                    if (creep.name === (creepRole + availableCount)) {
                        isNameTaken = true;
                        break; // name is already taken
                    }
                }
                if (!isNameTaken) {
                    break; // name is free
                }
                availableCount++;
            }
            return creepRole + availableCount;
        }
    }
};
module.exports = AssignOpenJobs;