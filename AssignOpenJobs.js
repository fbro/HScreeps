const AssignOpenJobs = {
    run: function () {

        /* --------------- Assign jobs algorithm --------------- */
        const JOB_ACCEPTABLE_POSITION_WEIGHT = 200; // the acceptable range-weight for allowing a job to be assigned to a creep
        const JOB_WEIGHT_MOD = 100; // modifier for how pronounced the range part should be
        const JOB_WEIGHT_MULTIPLIER_INTER_ROOM = 1; // multiplier for how pronounced the inter room range part should be
        const ALLOWED_COMPATIBILITY = 9; // do not assign the job to a creep that is not compatible

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
        * TODO not in first version
        * HC  -  -  -  -  HostileCreeps
        * --  -  -  -  -  RemoteControllersToClaim
        * --  -  -  -  -  RemoteRoomsToScout
        * --  -  -  -  -  RemoteActiveSources
        * --  -  -  -  -  RemoteRallyPoints
        */
        let isAllAssigned = false; // loop until all openJobs or idleCreeps is empty or not applicable
        while (!isAllAssigned) {
            let idleCreeps = _(Game.creeps).filter({memory: {jobName: 'idle'}}).value(); // new search each time because a creep may have been assigned
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
                let openJobOBJ = undefined;
                if(openJob.flagName){
                    openJobOBJ = Game.flags[openJob.flagName];
                }else{
                    openJobOBJ = Game.getObjectById(openJob.id);
                }
                if(!openJobOBJ){
                    const splicedJob = Memory.openJobs.splice(i, 1)[0];
                    console.log("AssignOpenJobs, " + JSON.stringify(splicedJob) + " is not found, removing job: " + JSON.stringify(openJobOBJ) + ", in idle section");
                    i--;
                    continue;
                }else if(!AtCreepRoof(openJob.name, openJobOBJ, true)){
                    for (let e = 0; e < idleCreeps.length; e++) { // loop through all idle creeps
                        const creep = idleCreeps[e];
                        let weight = CreepOnJobPoints(creep.name.substring(0, 1), openJob.name);
                        if (weight > 0) { // is applicable
                            if (weight < bestWeight) { // best creep for the job (for now) is found
                                let positionWeight = 0;
                                if (openJobOBJ.pos.roomName === creep.pos.roomName) { // in same room
                                    positionWeight += -JOB_WEIGHT_MOD;
                                    positionWeight += Math.sqrt(Math.pow(openJobOBJ.pos.x - creep.pos.x, 2) + Math.pow(openJobOBJ.pos.y - creep.pos.y, 2)) * JOB_WEIGHT_MULTIPLIER_INTER_ROOM; // in room range
                                } else { // Get the linear distance (in rooms) between two rooms
                                    positionWeight = JOB_WEIGHT_MOD * Game.map.getRoomLinearDistance(openJobOBJ.pos.roomName, creep.pos.roomName);
                                }
                                if ((weight < bestWeight || (bestWeight === weight && bestPositionWeight > positionWeight)) && (positionWeight <= JOB_ACCEPTABLE_POSITION_WEIGHT || openJob.flagName)) { // best creep range (for now) is found
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
            }
            if (bestCreep) { // best creep for the job is now assigned
                bestCreep.memory.jobName = bestOpenJob.name;
                if(bestOpenJob.flagName){bestCreep.memory.flagName = bestOpenJob.flagName}else{bestCreep.memory.jobId = bestOpenJob.id;}
                bestOpenJob.creeps.push(bestCreep.name);
                let RCL = 0;
                if(bestOpenJobOBJ.room !== undefined && bestOpenJobOBJ.room.controller !== undefined){
                    RCL = bestOpenJobOBJ.room.controller.level;
                }
                if (bestOpenJob.creeps.length >= NumberOfCreepsOnJob(RCL, bestOpenJob.name)) {
                    // considering RCL this job should not employ more creeps
                    Memory.openJobs.splice(bestOpenJobPlacement, 1);
                    Memory.closedJobs.push(bestOpenJob);
                }
                bestCreep.say("new💼" + bestOpenJobOBJ.pos.x + "," + bestOpenJobOBJ.pos.y);
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
        const MINIMUM_ENERGY_REQUIRED = 200; // the smallest creep that a spawn can create

        const availableSpawns = _(Game.spawns).filter(spawn => spawn.spawning === null && spawn.room.energyAvailable >= MINIMUM_ENERGY_REQUIRED).value();
        if(availableSpawns.length > 0){ // no need to enter algorithm if there are no available spawns
            let bestSpawn = undefined;
            let bestSpawnPlacement = 0;
            let bestOpenJob = undefined;
            let bestOpenJobPlacement = 0;
            let bestWeight = Number.MAX_SAFE_INTEGER;
            let bestOpenJobOBJ = undefined;

            for (let i = 0; i < Memory.openJobs.length; i++) { // loop through all open jobs
                const openJob = Memory.openJobs[i];
                let openJobOBJ;
                if(openJob.flagName){
                    openJobOBJ = Game.flags[openJob.flagName];
                }else{
                    openJobOBJ = Game.getObjectById(openJob.id);
                }
                if(!openJobOBJ){
                    const splicedJob = Memory.openJobs.splice(i, 1)[0];
                    console.log("AssignOpenJobs, " + JSON.stringify(splicedJob) + " is not found, removing job: " + JSON.stringify(openJobOBJ) + ", in spawn section");
                    i--;
                }else if(!AtCreepRoof(openJob.name, openJobOBJ, false)){
                    for (let e = 0; e < availableSpawns.length; e++) {
                        const spawn = availableSpawns[e];
                        let weight = -spawn.room.energyAvailable;
                        if (spawn.pos.roomName === openJobOBJ.pos.roomName) { // same room
                            weight += -RANGE_WEIGHT_MOD;
                            weight += Math.sqrt(Math.pow(openJobOBJ.pos.x - spawn.pos.x, 2) + Math.pow(openJobOBJ.pos.y - spawn.pos.y, 2)) * RANGE_WEIGHT_MULTIPLIER_INTER_ROOM; // in room range
                        } else { // Get the linear distance (in rooms) between two rooms
                            weight += RANGE_WEIGHT_MOD * Game.map.getRoomLinearDistance(openJobOBJ.pos.roomName, spawn.pos.roomName);
                        }
                        weight += -JobImportance(openJob.name); // prioritize jobs
                        if (bestWeight > weight && (weight <= SPAWN_ACCEPTABLE_WEIGHT || openJob.flagName)) {
                            bestSpawn = spawn;
                            bestOpenJob = openJob;
                            bestOpenJobPlacement = i;
                            bestSpawnPlacement = e;
                            bestOpenJobOBJ = openJobOBJ;
                            bestWeight = weight;
                        }
                    }
                }
            }
            if (bestSpawn) { // best spawn found - spawning creep
                const spawningCreep = SpawnLogic(bestSpawn, bestOpenJob, bestSpawn.room.energyAvailable); // spawn
                console.log("AssignOpenJobs, spawn: " + spawningCreep.name + ", " + bestSpawn.name + ", bestOpenJob: " + JSON.stringify(bestOpenJob) + ", energy available: " + bestSpawn.room.energyAvailable);
                if (!spawningCreep) {
                    console.log("AssignOpenJobs, ERROR spawningCreep failed, job: " + bestOpenJob.name + " (" + bestOpenJobOBJ.pos.x + ", " + bestOpenJobOBJ.pos.y + ", " + bestOpenJobOBJ.pos.roomName + "), from spawn: " + bestSpawn.name);
                } else {
                    bestOpenJob.creeps.push(spawningCreep.name);
                    spawningCreep.memory.jobName = bestOpenJob.name;
                    if(bestOpenJob.flagName){spawningCreep.memory.flagName = bestOpenJob.flagName}else{spawningCreep.memory.jobId = bestOpenJob.id;}
                    let RCL = 0;
                    if(bestOpenJobOBJ.room !== undefined && bestOpenJobOBJ.room.controller !== undefined){
                        RCL = bestOpenJobOBJ.room.controller.level;
                    }
                    if (bestOpenJob.creeps.length >= NumberOfCreepsOnJob(RCL, bestOpenJob.name)) {
                        // considering RCL this job should not employ more creeps
                        Memory.openJobs.splice(bestOpenJobPlacement, 1);
                        Memory.closedJobs.push(bestOpenJob);
                        availableSpawns.splice(bestSpawnPlacement, 1);
                    }
                    console.log("AssignOpenJobs, spawn: job: " + bestOpenJob.name + " (" + bestOpenJobOBJ.pos.x + ", " + bestOpenJobOBJ.pos.y + ", " + bestOpenJobOBJ.pos.roomName + "), assigned to creep: " + spawningCreep.name  + ", from spawn: " + bestSpawn.name);
                }
            }
        }
        /**
         * @return {boolean}
         */
        function AtCreepRoof(jobName, openJobOBJ, checkingIdleCreeps){
            let creepInitials = "X";
            let maxCreepAtRoof = 0;
            switch (jobName) {
                // harvester
                case "ActiveSources":
                    creepInitials = "H";
                        maxCreepAtRoof = 2;
                    break;
                // transporter
                case "DroppedResources":
                case "SpawnsAndExtensionsNeedEnergy":
                case "TowersNeedEnergy":
                case "FullLinks":
                case "FullContainers":
                case "TerminalsNeedEnergy":
                case "StorageHasMinerals":
                case "LabsNeedEnergy":
                    creepInitials = "T";
                    if(checkingIdleCreeps){
                        maxCreepAtRoof = 3;
                    }else{
                        maxCreepAtRoof = 2;
                    }
                    break;
                // builder
                case "OwnedControllers":
                case "DamagedStructures":
                case "Constructions":
                    creepInitials = "B";
                    if(checkingIdleCreeps){
                        maxCreepAtRoof = 3;
                    }else{
                        maxCreepAtRoof = 2;
                    }
                    break;
                // extractor
                case "ActiveMinerals":
                    creepInitials = "E";
                    maxCreepAtRoof = 1;
                    break;
                // scout
                case "TagController":
                case "ScoutPos":
                    creepInitials = "S";
                    maxCreepAtRoof = 1;
                    break;
                // claimer
                case "ClaimController":
                    creepInitials = "C";
                    maxCreepAtRoof = 1;
                    break;
                default:
                    console.log("AssignOpenJobs, ERROR! AtCreepRoof jobName not found: " + jobName);
            }
            let creepCount = 0;
            for (const creepName in Game.creeps) {
                let creep = Game.creeps[creepName];
                if(creep.name.startsWith(creepInitials)){
                    if(creep.memory.jobName === "idle"){
                        if(!checkingIdleCreeps){
                            creepCount++;
                        }
                    }else {
                        const job = Game.getObjectById(creep.memory.jobId);
                        if(job && openJobOBJ) {
                            if (job.pos.roomName === openJobOBJ.pos.roomName) {
                                creepCount++;
                            }
                        }else{
                            creepCount++; // the job have disappeared
                        }
                    }
                }
            }
            let isAtCreepRoof = true;
            if(creepCount < maxCreepAtRoof){
                //console.log("WHY? " + jobName + " " + creepInitials + " " + maxCreepAtRoof + " creepCount " + creepCount + " room " + openJobOBJ.pos.roomName);
                isAtCreepRoof = false;
            }
            return isAtCreepRoof;
        }

        /**
         * @return {int}
         */
        function JobImportance(jobName){ // general importance of the job
            let val = 0;
            switch (jobName) {
                // harvester
                case "ActiveSources": val = 200; break;
                // transporter
                case "DroppedResources": val = 10; break;
                case "SpawnsAndExtensionsNeedEnergy": val = 500; break;
                case "TowersNeedEnergy": val = 50; break;
                case "FullLinks": val = 30; break;
                case "FullContainers": val = 10; break;
                case "TerminalsNeedEnergy": val = 1; break;
                case "StorageHasMinerals": val = 0; break;
                case "LabsNeedEnergy": val = 0; break;
                // builder
                case "OwnedControllers": val = 800; break;
                case "DamagedStructures": val = 100; break;
                case "Constructions": val = 10; break;
                // extractor
                case "ActiveMinerals": val = 1; break;
                // scout
                case "TagController": val = 0; break;
                case "ScoutPos": val = 0; break;
                // claimer
                case "ClaimController": val = 100; break;
                default:
                    console.log("AssignOpenJobs, ERROR! JobImportance jobName not found: " + jobName);
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
                        case 1: case 2: numOfCreeps = 1; break;
                        case 3: case 4: case 5: numOfCreeps = 1; break;
                        case 6: case 7: case 8: numOfCreeps = 1; break;
                    } break;
                case "DroppedResources": numOfCreeps = 1; break;
                case "SpawnsAndExtensionsNeedEnergy": numOfCreeps = 1; break;
                case "TowersNeedEnergy": numOfCreeps = 1; break;
                case "FullLinks": numOfCreeps = 1; break;
                case "FullContainers": numOfCreeps = 1; break;
                case "TerminalsNeedEnergy": numOfCreeps = 1; break;
                case "StorageHasMinerals": numOfCreeps = 1; break;
                case "LabsNeedEnergy": numOfCreeps = 1; break;
                case "OwnedControllers":
                    switch (RCL) {
                        case 1: case 2: numOfCreeps = 1; break;
                        case 3: case 4: case 5: numOfCreeps = 2; break;
                        case 6: case 7: numOfCreeps = 2; break;
                        case 8: numOfCreeps = 1; break;
                    } break;
                case "DamagedStructures": numOfCreeps = 1; break;
                case "Constructions": numOfCreeps = 1; break;
                case "ActiveMinerals": numOfCreeps = 1; break;
                case "TagController": numOfCreeps = 1; break;
                case "ScoutPos": numOfCreeps = 1; break;
                case "ClaimController": numOfCreeps = 1; break;
                default:
                    console.log("AssignOpenJobs, ERROR! NumberOfCreepsOnJob jobName not found: " + jobName);
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
                        case "TerminalsNeedEnergy": val = 4; break;
                        case "StorageHasMinerals": val = 4; break;
                        case "LabsNeedEnergy": val = 4; break;

                        case "TagController": val = 8; break;
                        case "ScoutPos": val = 9; break;
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
                        case "TerminalsNeedEnergy": val = 9; break;
                        case "StorageHasMinerals": val = 9; break;
                        case "LabsNeedEnergy": val = 9; break;
                        case "OwnedControllers": val = 8; break;
                        case "DamagedStructures": val = 6; break;
                        case "Constructions": val = 7; break;
                        case "ActiveMinerals": val = 6; break;

                        case "TagController": val = 9; break;
                        case "ScoutPos": val = 9; break;
                        default: val = -1;
                    } break;
                case "B": // builder
                    switch (jobName) {
                        case "ActiveSources": val = 7; break;
                        case "DroppedResources": val = 6; break;
                        case "SpawnsAndExtensionsNeedEnergy": val = 8; break;
                        case "TowersNeedEnergy": val = 6; break;
                        case "FullLinks": val = 8; break;
                        case "FullContainers": val = 8; break;
                        case "TerminalsNeedEnergy": val = 8; break;
                        case "StorageHasMinerals": val = 8; break;
                        case "LabsNeedEnergy": val = 8; break;
                        case "OwnedControllers": val = 1; break;
                        case "DamagedStructures": val = 2; break;
                        case "Constructions": val = 3; break;
                        case "ActiveMinerals": val = 7; break;

                        case "TagController": val = 9; break;
                        case "ScoutPos": val = 9; break;
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
                        case "TerminalsNeedEnergy": val = 9; break;
                        case "StorageHasMinerals": val = 9; break;
                        case "LabsNeedEnergy": val = 9; break;
                        case "OwnedControllers": val = 8; break;
                        case "DamagedStructures": val = 7; break;
                        case "Constructions": val = 7; break;
                        case "ActiveMinerals": val = 1; break;

                        case "TagController": val = 9; break;
                        case "ScoutPos": val = 9; break;
                        default: val = -1;
                    } break;
                case "S": // scout
                    switch (jobName) {
                        case "TagController": val = 1; break;
                        case "ScoutPos": val = 2; break;
                        default: val = -1;
                    } break;
                case "C": // claimer
                    switch (jobName) {
                        case "ClaimController": val = 1; break;
                        default: val = -1;
                    } break;
                default:
                    val = -1;
                    console.log("AssignOpenJobs, ERROR! CreepOnJobPoints jobName or creepInitial not found: " + jobName + ", " + creepInitial);
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
                case "TerminalsNeedEnergy":
                case "StorageHasMinerals":
                case "LabsNeedEnergy":
                    switch (true) {
                        case (energyAvailable >= 1350): // energyCapacityAvailable: 12900
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1200): // energyCapacityAvailable: 5600
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1050): // energyCapacityAvailable: 2300
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 900): // energyCapacityAvailable: 1800
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 600): // energyCapacityAvailable: 1300
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];break;
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
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1400): // energyCapacityAvailable: 1800
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];break;
                        case (energyAvailable >= 1000): // energyCapacityAvailable: 1300
                            body = [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];break;
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

                // [S] scout
                case "TagController":
                case "ScoutPos":
                    body = [MOVE];
                    creepRole = "S";
                    break;

                // [C] claimer
                case "ClaimController":
                    body = [MOVE, MOVE, CLAIM];
                    creepRole = "C";
                    break;
                default:
                    console.log("AssignOpenJobs, ERROR! SpawnLogic job.name not found: " + job.name);
            }
            if(creepRole !== undefined){
                const availableName = getAvailableName(creepRole);
                let spawnResult = spawn.spawnCreep(body, availableName);
                if(spawnResult !== OK){
                    console.log("AssignOpenJobs, SpawnLogic error, spawnResult: " + spawnResult + ", availableName: " + availableName + ", jobName: " + job.name);
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
                if(Game.creeps[creepRole + availableCount]){
                    availableCount++;
                }else{
                    break; // name is free
                }
            }
            return creepRole + availableCount;
        }
    }
};
module.exports = AssignOpenJobs;