const SpawnCreeps = {
    run: function() {
        // TODO

        const SPAWN_ACCEPTABLE_WEIGHT = 500; // the acceptable weight for allowing a spawn to create a creep for a job
        const RANGE_WEIGHT_MOD = 500; // modifier for how pronounced the range part should be
        const RANGE_WEIGHT_MULTIPLIER_INTER_ROOM = 5; // multiplier for how pronounced the inter room range part should be

        let doneSpawning = false;
        while(!doneSpawning) {
            let bestSpawn = null;
            let bestWeight = Number.MAX_SAFE_INTEGER;
            let bestOpenJob = null;
            for (const openJob in Memory.openJobs) {
                const openJobOBJ = Game.getObjectById(openJob.id);
                for (const spawnCount in Game.spawns) {
                    const spawn = Game.spawns[spawnCount];
                    let weight = -spawn.room.energyAvailable;
                    if (spawn.pos.roomName === openJobOBJ.pos.roomName) { // same room
                        weight += -RANGE_WEIGHT_MOD;
                        weight += Math.sqrt(Math.pow(openJobOBJ.pos.x - spawn.pos.x, 2) + Math.pow(openJobOBJ.pos.y - spawn.pos.y, 2)) * RANGE_WEIGHT_MULTIPLIER_INTER_ROOM; // in room range
                    } else { // Get the linear distance (in rooms) between two rooms
                        weight += RANGE_WEIGHT_MOD * Game.map.getRoomLinearDistance(openJobOBJ.pos.roomName, spawn.pos.roomName);
                    }

                    if (bestWeight > weight && weight <= SPAWN_ACCEPTABLE_WEIGHT) {
                        bestSpawn = spawn;
                        bestWeight = weight;
                        bestOpenJob = openJob;
                    }
                }
            }
            if(bestSpawn !== null){
                // spawn
                SpawnLogic(bestSpawn, bestOpenJob, bestSpawn.room.energyAvailable);
            }else{
                doneSpawning = true;
            }
        }

        function SpawnLogic(spawn, job, energyAvailable){
            // switch through all job types, then switch through all sizes with energyAvailable
            let body = null;
            let name = null;

            switch(job.name){

                // [H] harvester
                case "ActiveSources": switch(true){
                    case (energyAvailable < 300): body = [WORK, CARRY, MOVE]; break; // TODO correct body parts
                    case (energyAvailable < 300): break;
                } name = "T"; break;

                // [T] transporter
                case "DroppedResources":
                case "SpawnsAndExtensionsNeedEnergy":
                case "TowersNeedEnergy":
                case "FullLinks":
                case "FullContainers": switch(true){
                    case (energyAvailable < 300): body = [CARRY, CARRY, MOVE]; break; // TODO correct body parts
                } name = "H"; break;

                // [B] builder
                case "OwnedControllers":
                case "DamagedStructures":
                case "Constructions": switch(true){
                    case (energyAvailable < 300): body = [WORK, CARRY, MOVE]; break; // TODO correct body parts
                } name = "B"; break;

                // [E] extractor
                case "ActiveExtractors": switch(true){
                    case (energyAvailable < 300): body = [WORK, CARRY, MOVE]; break; // TODO correct body parts
                } name = "E"; break;
                default:
            }
            spawn.spawnCreep(body, name, { memory: {"jobName" : job.name, "jobId" : job.id}});
        }
    }
};
module.exports = SpawnCreeps;