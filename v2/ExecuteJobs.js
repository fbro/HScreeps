const ExecuteJobs = {
    run: function () {
        // jobs have been created
        // creeps where assigned
        // check if creep on job is dead then set job to vacant - one room at a time - one job at a time
            // TODO if creep alive then execute the job
            // TODO after execution - check if job is done
                // TODO if job is done then set creep to idle and remove job from memory

        ExecuteRoomJobs();

        function ExecuteRoomJobs(){
            for(const memRoomKey in Memory.MemRooms) {
                const memRoom = Memory.MemRooms[memRoomKey];
                for(const roomJobKey in memRoom.RoomJobs) {
                    const roomJob = memRoom.RoomJobs[roomJobKey];
                    if(roomJob.Creep !== "vacant") {
                        const gameCreep = Game.creeps[roomJob.Creep];
                        if(gameCreep){// creep is alive
                            JobAction(gameCreep, roomJob, roomJobKey);
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

        function JobAction(creep, roomJob, jobKey){
            let result = ERR_INVALID_TARGET;
            switch (true) {
                case jobKey.startsWith("Source"):
                    result = JobSource(result, creep, roomJob, jobKey);
                    break;
                case jobKey.startsWith("Controller"):

                    break;
                case jobKey.startsWith("Repair"):

                    break;
                case jobKey.startsWith("Construction"):

                    break;
                case jobKey.startsWith("FillSpawnExtension"):

                    break;
                case jobKey.startsWith("FillTower"):

                    break;
                case jobKey.startsWith("ResourceDrop"):

                    break;
                case jobKey.startsWith("FillStorage"):

                    break;
                default:
                    console.log("ExecuteJobs, JobAction: ERROR! job not found: " + jobKey);
            }
        }

        function JobSource(result, creep, roomJob, jobKey){
            const source = Game.getObjectById(roomJob.JobId);
            if(_.sum(creep.carry) < creep.carryCapacity){
                result = creep.harvest(source);
                if(result === ERR_NOT_IN_RANGE){
                    creep.moveTo(source, {visualizePathStyle:{fill: 'transparent',stroke: '#ffe100',lineStyle: 'undefined',strokeWidth: .15,opacity: .5}});
                }else{
                    console.log("ExecuteJobs, JobAction: ERROR! Source result: " + result + ", with " + creep.name + " on " + jobKey + " in " + source.pos.roomName);
                }
            }else{
                const link = source.findInRange(FIND_MY_STRUCTURES, 1, {filter: function(link) { return link.structureType === STRUCTURE_LINK && link.energy < link.energyCapacity;}})[0];
                if(link && creep.carry[RESOURCE_ENERGY] === creep.carryCapacity){
                    result = creep.transfer(link, RESOURCE_ENERGY);
                }else{
                    for(const resourceType in creep.carry) {
                        result = creep.drop(resourceType);
                    }
                }
            }
            return result;
        }
    }
};
module.exports = ExecuteJobs;