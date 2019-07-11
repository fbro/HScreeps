const ExecuteJobs = {
    run: function () {
        // jobs have been created
        // creeps where assigned
        // check if creep on job is dead then set job to vacant - one room at a time - one job at a time
            // if creep alive then execute the job
            // after execution - check if job is done
                // if job is done then set creep to idle and remove job from memory

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
                    result = JobSource(creep, roomJob);
                    break;
                case jobKey.startsWith("Controller"):
                    result = JobController(creep, roomJob);
                    break;
                case jobKey.startsWith("Repair"):
                    result = JobRepair(creep, roomJob);
                    break;
                case jobKey.startsWith("Construction"):
                    result = JobConstruction(creep, roomJob);
                    break;
                case jobKey.startsWith("FillSpawnExtension"):
                    result = JobFillSpawnExtension(creep, roomJob);
                    break;
                case jobKey.startsWith("FillTower"):
                    result = JobFillTower(creep, roomJob);
                    break;
                case jobKey.startsWith("ResourceDrop"):
                    result = JobResourceDrop(creep, roomJob);
                    break;
                case jobKey.startsWith("FillStorage"):
                    result = JobFillStorage(creep, roomJob);
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
                console.log("ExecuteJobs, JobAction: removing: " + jobKey + ", " + roomJobs[jobKey].Creep + ", " + JSON.stringify(roomJobs[jobKey]));
                delete roomJobs[jobKey];
                creep.memory.JobName = "idle";
            }
        }

        /**@return {int}*/
        function JobSource(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            if(_.sum(creep.carry) < creep.carryCapacity){
                result = creep.harvest(obj);
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(obj, {visualizePathStyle:{fill: 'transparent',stroke: '#ffe100',lineStyle: 'undefined',strokeWidth: .15,opacity: .5}});
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
        function JobController(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.upgradeController(obj);}});
            return result;
        }

        /**@return {int}*/
        function JobRepair(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.repair(obj);}});
            return result;
        }

        /**@return {int}*/
        function JobConstruction(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.build(obj);}});
            return result;
        }

        /**@return {int}*/
        function JobFillSpawnExtension(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.transfer(obj);}});
            return result;
        }

        /**@return {int}*/
        function JobFillTower(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.transfer(obj);}});
            return result;
        }

        /**@return {int}*/
        function JobResourceDrop(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            // TODO
            return result;
        }

        /**@return {int}*/
        function JobFillStorage(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            // TODO

            if(_.sum(creep.carry) === creep.carryCapacity){ // carry full - fill storage
                
            }
            return result;
        }

        /**@return {int}*/
        function JobEnergyAction(creep, roomJob, obj, actionFunction){
            let result = ERR_NO_RESULT_FOUND;
            if(creep.carry[RESOURCE_ENERGY] > 0){
                result = actionFunction.creepAction();
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(obj, {visualizePathStyle:{fill: 'transparent',stroke: '#00ff00',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }
            }else{ // find more energy
                const energySupply = FindClosestEnergy(creep, obj);
                if(creep.memory.EnergySupplyType === "DROP"){
                    result = creep.pickup(energySupply);
                }else{
                    result = creep.withdraw(energySupply);
                }
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(energySupply, {visualizePathStyle:{fill: 'transparent',stroke: '#ffe100',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }else if(result === ERR_FULL){ // creep store is full with anything other than ENERGY - get rid of it asap
                    if(creep.memory.EnergySupplyType === "CONTAINER" || creep.memory.EnergySupplyType === "STORAGE"){
                        for(const resourceType in creep.carry) {
                            result = creep.transfer(energySupply, resourceType);
                        }
                    }else{
                        for(const resourceType in creep.carry) {
                            result = creep.drop(resourceType);
                        }
                    }
                }else if(result === OK){ // energy withdrawn successfully - now remove creep.memory.EnergySupply
                    creep.memory.EnergySupply = undefined;
                    creep.memory.EnergySupplyType = undefined;
                }
            }
            return result;
        }

        /**@return {object}*/
        function FindClosestEnergy(creep, obj){
            let energySupply = undefined;
            let energySupplyType = undefined;
            if(creep.memory.EnergySupply){
                energySupply = Game.getObjectById(creep.memory.EnergySupply);// closest link then container then droppedRes then storage
                // if the saved energySupply does not have any energy then remove it to make way for a new search
                if(energySupply && (creep.memory.EnergySupplyType === "LINK" && energySupply.energy === 0)
                    || (creep.memory.EnergySupplyType === "CONTAINER" && energySupply.store[RESOURCE_ENERGY] === 0)){
                    energySupplyType = undefined;
                    creep.memory.EnergySupply = undefined;
                    creep.memory.EnergySupplyType = undefined;
                }
            }
            if(!energySupply){
                energySupply = obj.findClosestByPath(FIND_MY_STRUCTURES, {filter: function(s) {return s.structureType === STRUCTURE_LINK && s.energy > 0;}});
                energySupplyType = "LINK";
                if(!energySupply){
                    energySupply = obj.findClosestByPath(FIND_STRUCTURES, {filter: function(s) {return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0;}});
                    energySupplyType = "CONTAINER";
                    if(!energySupply){
                        energySupply = obj.findClosestByPath(FIND_DROPPED_RESOURCES, {filter: function(d) {return d.resourceType === RESOURCE_ENERGY && d.amount > 50;}});
                        energySupplyType = "DROP";
                        if(!energySupply){
                            energySupply = obj.room.storage;
                            energySupplyType = "STORAGE";
                        }
                    }
                }
                creep.memory.EnergySupply = energySupply.id;
                creep.memory.EnergySupplyType = energySupplyType;
            }
            return energySupply;
        }
    }
};
module.exports = ExecuteJobs;