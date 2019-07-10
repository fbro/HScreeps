const ExecuteJobs = {
    run: function () {
        // jobs have been created
        // creeps where assigned
        // check if creep on job is dead then set job to vacant - one room at a time - one job at a time
            // TODO if creep alive then execute the job
            // TODO after execution - check if job is done
                // TODO if job is done then set creep to idle and remove job from memory

        const ERR_NO_RESULT_FOUND = -20; // job flow did not encounter any actions that lead to any results!

        ExecuteRoomJobs();

        function ExecuteRoomJobs(){
            for(const memRoomKey in Memory.MemRooms) {
                const memRoom = Memory.MemRooms[memRoomKey];
                for(const roomJobKey in memRoom.RoomJobs) {
                    const roomJob = memRoom.RoomJobs[roomJobKey];
                    if(roomJob.Creep !== "vacant") {
                        const gameCreep = Game.creeps[roomJob.Creep];
                        if(gameCreep){// creep is alive
                            JobAction(gameCreep, memRoom.RoomJobs, roomJobKey);
                        }else{ // creep is dead
                            console.log("ExecuteJobs, ExecuteRoomJobs: " + roomJob.Creep + " on " + roomJobKey + " in " + memRoomKey + " has died");
                            const tombstone = Game.rooms[memRoomKey].find(FIND_TOMBSTONES, {filter: function(tombstone) {return tombstone.creep.name === roomJob.Creep;}})[0];
                            new RoomVisual(memRoomKey).text(roomJob.Creep + "⚰", tombstone.pos.x, tombstone.pos.y);
                            roomJob.Creep = "vacant";
                            delete Memory.creeps[roomJob.Creep];
                        }
                    }
                }
            }
        }

        function JobAction(creep, roomJobs, jobKey){
            const roomJob = roomJobs[jobKey];
            let result = ERR_NO_RESULT_FOUND;
            switch (true) {
                case jobKey.startsWith("Source"):
                    result = JobSource(creep, roomJob, jobKey);
                    break;
                case jobKey.startsWith("Controller"):
                    result = JobController(creep, roomJob, jobKey);
                    break;
                case jobKey.startsWith("Repair"):
                    result = JobRepair(creep, roomJob, jobKey);
                    break;
                case jobKey.startsWith("Construction"):
                    result = JobConstruction(creep, roomJob, jobKey);
                    break;
                case jobKey.startsWith("FillSpawnExtension"):
                    result = JobFillSpawnExtension(creep, roomJob, jobKey);
                    break;
                case jobKey.startsWith("FillTower"):
                    result = JobFillTower(creep, roomJob, jobKey);
                    break;
                case jobKey.startsWith("ResourceDrop"):
                    result = JobResourceDrop(creep, roomJob, jobKey);
                    break;
                case jobKey.startsWith("FillStorage"):
                    result = JobFillStorage(creep, roomJob, jobKey);
                    break;
                default:
                    console.log("ExecuteJobs, JobAction: ERROR! job not found: " + jobKey + ", " + creep.name);
            }
            if(result === OK){
                // job is done everyone is happy, nothing to do.
            }else{ // results where anything else than OK - one should end the job!
                if(result === ERR_NO_RESULT_FOUND){
                    console.log("ExecuteJobs, JobAction: ERROR! no result gained: " + jobKey + ", " + creep.name);
                }
                // TODO end job
                const removedJob = roomJobs.splice(jobKey, 1);
                console.log("ExecuteJobs, JobAction: removed: " + JSON.stringify(removedJob) + ", " + creep.name);
            }
        }

        /**@return {int}*/
        function JobSource(creep, roomJob, jobKey){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            if(_.sum(creep.carry) < creep.carryCapacity){
                result = creep.harvest(obj);
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(obj, {visualizePathStyle:{fill: 'transparent',stroke: '#ffe100',lineStyle: 'undefined',strokeWidth: .15,opacity: .5}});
                }else{
                    console.log("ExecuteJobs, JobAction: ERROR! Source result: " + result + ", with " + creep.name + " on " + jobKey + " in " + obj.pos.roomName);
                }
            }else{
                const link = obj.findInRange(FIND_MY_STRUCTURES, 1, {filter: function(link) { return link.structureType === STRUCTURE_LINK && link.energy < link.energyCapacity;}})[0];
                if(link && creep.carry[RESOURCE_ENERGY] === creep.carryCapacity){
                    result = creep.transfer(link, RESOURCE_ENERGY);
                }else{
                    const container = obj.findInRange(FIND_MY_STRUCTURES, 1, {filter: function(container) { return container.structureType === STRUCTURE_CONTAINER && _.sum(container.store) < container.storeCapacity;}})[0];
                    if(container){
                        result = creep.transfer(link, RESOURCE_ENERGY);
                    }else{
                        for(const resourceType in creep.carry) {
                            result = creep.drop(resourceType);
                        }
                    }
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobController(creep, roomJob, jobKey){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
                if(creep.carry[RESOURCE_ENERGY] === 0){ // find more energy
                    const energySupply = FindClosestEnergy(creep, obj);
                    // TODO
                }
                // TODO
            return result;
        }

        /**@return {int}*/
        function JobRepair(creep, roomJob, jobKey){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);

            return result;
        }

        /**@return {int}*/
        function JobConstruction(creep, roomJob, jobKey){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);

            return result;
        }

        /**@return {int}*/
        function JobFillSpawnExtension(creep, roomJob, jobKey){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);

            return result;
        }

        /**@return {int}*/
        function JobFillTower(creep, roomJob, jobKey){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);

            return result;
        }

        /**@return {int}*/
        function JobResourceDrop(creep, roomJob, jobKey){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);

            return result;
        }

        /**@return {int}*/
        function JobFillStorage(creep, roomJob, jobKey){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);

            return result;
        }

        /**@return {object}*/
        function FindClosestEnergy(creep, obj){
            let energySupply = undefined;
            if(creep.memory.EnergySupply){
                energySupply = Game.getObjectById(creep.memory.EnergySupply);
            }else{ // closest link then container then droppedRes then storage
                energySupply = obj.findClosestByPath(FIND_MY_STRUCTURES, {filter: function(s) {return s.structureType === STRUCTURE_LINK && s.energy > 0;}});
                if(!energySupply){
                    energySupply = obj.findClosestByPath(FIND_STRUCTURES, {filter: function(s) {return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0;}});
                    if(!energySupply){
                        energySupply = obj.findClosestByPath(FIND_DROPPED_RESOURCES, {filter: function(d) {return d.resourceType === RESOURCE_ENERGY && d.amount > 50;}});
                        if(!energySupply){
                            energySupply = obj.room.storage;
                        }
                    }
                }
                creep.memory.EnergySupply = energySupply.id;
            }
            return energySupply;
        }
    }
};
module.exports = ExecuteJobs;