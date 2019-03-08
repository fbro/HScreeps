const SpawnCreeps = {
    run: function() {
        // TODO

        /*
        *
        * loop through all openJobs
        *   if there are no spawns in the room
        *   or if the spawns are low on energy
        *   or other room has a lot of energy to waste on helping out
        *       then find closest room to spawn it in instead - beware, if closest room is far aways and the spawn in the jobs room just need a little more energy then wait!
        *   else spawn creep in the room where the openJob is
        *
        * */

        const openJobs = Memory.openJobs;
        for(const openJobsCount in openJobs){
            const openJob = openJobs[openJobsCount];
            const openJobOBJ = Game.getObjectById(openJob.id);
            for(const spawnCount in Game.spawns){
                if(openJobOBJ.room == ){

                }
            }
        }
    }
};
module.exports = SpawnCreeps;