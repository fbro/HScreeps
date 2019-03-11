const AssignOpenJobs = {
    run: function() {

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
        while(!isAllAssigned){
            let openJobs = Memory.OpenJobs;
            let idleCreeps = _(Game.creeps).filter({ memory: { jobName: 'idle' }}).value();
            let bestCreep = null;
            let bestOpenJob = null;
            let bestOpenJobPlacement = 0;
            let bestWeight = ALLOWED_COMPATIBILITY;
            let bestPositionWeight = Number.MAX_SAFE_INTEGER;
            for(let i = 0; i < openJobs.length - 1; i++){ // loop through all open jobs
                const openJob = openJobs[i];
                const openJobOBJ = Game.getObjectById(openJob.id);
                for (const creepName in idleCreeps) { // loop through all idle creeps
                    const creep = Game.creeps[creepName];
                    let weight = CreepOnJobPoints(creep.name.substring(0, 1), openJob.name);
                    if(weight > 0){ // is applicable
                        if(bestWeight > weight){ // best creep for the job (for now) is found
                            let positionWeight = 0;
                            if(openJobOBJ.pos.roomName === creep.pos.roomName){ // in same room
                                positionWeight += -JOB_WEIGHT_MOD;
                                positionWeight += Math.sqrt(Math.pow(openJobOBJ.pos.x - creep.pos.x, 2) + Math.pow(openJobOBJ.pos.y - creep.pos.y, 2)) * JOB_WEIGHT_MULTIPLIER_INTER_ROOM; // in room range
                            }else{ // Get the linear distance (in rooms) between two rooms
                                positionWeight = JOB_WEIGHT_MOD * Game.map.getRoomLinearDistance(openJobOBJ.pos.roomName, creep.pos.roomName);
                            }
                            if(bestPositionWeight > positionWeight && (positionWeight < JOB_ACCEPTABLE_POSITION_WEIGHT || openJob.name.startsWith("Remote"))){ // best creep range (for now) is found
                                bestCreep = creep;
                                bestOpenJob = openJob;
                                bestOpenJobPlacement = i;
                                bestWeight = weight;
                                bestPositionWeight = positionWeight;
                            }
                        }
                    }
                }
            }
            if(bestCreep !== null){ // best creep for the job is now assigned
                bestCreep.memory.jobName = bestOpenJob.name;
                bestCreep.memory.jobId = bestOpenJob.id;
                bestOpenJob.creeps.push(bestCreep.id);
                if(bestOpenJob.creeps.length >= NumberOfCreepsOnJob(Game.getObjectById(bestOpenJob.id).room.controller.level, bestOpenJob.name)){
                    // considering RCL this job should not employ more creeps
                    Memory.OpenJobs.splice(bestOpenJobPlacement, 1);
                    Memory.closedJobs.push(bestOpenJob);
                }
                console.log("job: " + bestOpenJob.name + " (" + bestOpenJob.pos.x + ", " + bestOpenJob.pos.y + ", " + bestOpenJob.pos.roomName + "), assigned to creep: " + bestCreep.name);
            }
            else{ // done
                isAllAssigned = true;
            }
        }

        /**
         * @return {int}
         */
        function NumberOfCreepsOnJob(RCL, jobName){
            let numOfCreeps = 1;
            switch(jobName){
                case "ActiveSources":
                    switch (RCL) {
                        case 1:
                        case 2: numOfCreeps = 3; break;
                        case 3:
                        case 4:
                        case 5: numOfCreeps = 2; break;
                        case 6:
                        case 7:
                        case 8: numOfCreeps = 1; break;
                        default: numOfCreeps = 1;
                    }break;
                case "DroppedResources": numOfCreeps = 1; break;
                case "SpawnsAndExtensionsNeedEnergy": numOfCreeps = 1; break;
                case "TowersNeedEnergy": numOfCreeps = 1; break;
                case "FullLinks": numOfCreeps = 1; break;
                case "FullContainers": numOfCreeps = 1; break;
                case "OwnedControllers":
                    switch (RCL) {
                        case 1:
                        case 2: numOfCreeps = 1; break;
                        case 3:
                        case 4:
                        case 5: numOfCreeps = 2; break;
                        case 6:
                        case 7:
                        case 8: numOfCreeps = 3; break;
                        default: numOfCreeps = 1;
                    }break;
                case "DamagedStructures": numOfCreeps = 1; break;
                case "Constructions": numOfCreeps = 1; break;
                case "ActiveExtractors": numOfCreeps = 1; break;
                default: numOfCreeps = 1;
            }
            return numOfCreeps;
        }

        /**
         * @return {int}
         */
        function CreepOnJobPoints(creepInitial, jobName){
            let val = -1;
            switch(creepInitial){
                case "T": // transporter
                    switch (jobName) {
                        case "DroppedResources": val = 5; break;
                        case "SpawnsAndExtensionsNeedEnergy": val = 1; break;
                        case "TowersNeedEnergy": val = 2; break;
                        case "FullLinks": val = 3; break;
                        case "FullContainers": val = 4; break;
                        default: val = -1;
                    }
                    break;
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
                        case "ActiveExtractors": val = 6; break;
                        default: val = -1;
                    }
                    break;
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
                        case "ActiveExtractors": val = 7; break;
                        default: val = -1;
                    }
                    break;
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
                        case "ActiveExtractors": val = 1; break;
                        default: val = -1;
                    }
                    break;
                default: val = -1;
            }
            return val;
        }
    }
};
module.exports = AssignOpenJobs;