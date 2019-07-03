const AssignJobs = {
    run: function () {

        // assign jobs to creeps or create the creeps like this:
        // look for idle creep with correct type in room
        // if failed then create that creep in room
        // if that failed then create it in the closest room with enough energy at its disposal

        // different creep types for different jobs
        /*creep types:
        * [T] transporter       no WORK
        * [H] harvester         only one CARRY
        * [B] builder           equal WORK and CARRY
        * TODO not in first version
        * [E] extractor         only one CARRY and maxed out WORK
        * [W] warrior           ATTACK and MOVE
        * [S] scout             just a MOVE
        * [C] claimer           CLAIM - many CLAIM when reserving
        * [G] gunner            RANGED_ATTACK and MOVE
        * [M] medic             HEAL
        * [D] distantHarvester  equal WORK and CARRY
        */

        for (let creepKey in Game.creeps) {
            const creep = Game.creeps[creepKey];
            if(creep.memory.jobName === "idle" && Memory.MemRooms[creep.pos.roomName] !== undefined){
                const roomJobs = Memory.MemRooms[creep.pos.roomName].RoomJobs;
                for(let jobKey in roomJobs){
                    const roomJob = roomJobs[jobKey];
                    if(roomJob.JobCreep === "vacant" && roomJob.JobType === creepKey.substring(0, 1)){
                        // an idle creep that is in a room that exist in memory looks at a specific job that is vacant and matching jobType
                        creep.memory.jobName = jobKey;
                        roomJob.JobCreep = creepKey;
                    }
                }
            }
        }

        // loop through vacant jobs and see if a creep should be spawned
        // be careful not to spawn too many or too few creeps
        // introduce max creep per room but for each job -

    }
};
module.exports = AssignJobs;