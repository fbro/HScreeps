let AssignOpenJobs = {
    run: function () {
        /*
        * creep types:
        * [T] transporter   no work
        * [H] harvester     only one carry
        * [B] builder       equal work and carry
        * TODO not in first version
        * [W] warrior
        * [M] medic
        * [S] scout
        * [C] claimer
        * [R] rangedHarvester
        *
        * job types:
        *
        *     T  H  B
        * AS  -  1  7  ActiveSources
        * DR  5  5  6  DroppedResources
        * SE  1  8  8  SpawnsAndExtensionsNeedEnergy
        * TE  2  7  7  TowersNeedEnergy
        * FL  3  9  9  FullLinks
        * FC  4  9  9  FullContainers
        * OC  -  8  1  OwnedControllers
        * DS  -  6  2  DamagedStructures
        * CO  -  7  3  Constructions
        * AE  -  2  7  ActiveExtractors
        * HC  -  -  -  HostileCreeps
        *
        * TODO not in first version
        * FlaggedControllersToClaim
        * FlaggedRoomsToScout
        * FlaggedActiveSources
        * FlaggedRallyPoints
        * */

        // job types:
        Memory.OpenJobsActiveSources = CheckForNewJobs("ActiveSources", Memory.OpenJobsActiveSources);
        Memory.OpenJobsDroppedResources = CheckForNewJobs("DroppedResources", Memory.OpenJobsDroppedResources);
        Memory.OpenJobsSpawnsAndExtensionsNeedEnergy = CheckForNewJobs("SpawnsAndExtensionsNeedEnergy", Memory.OpenJobsSpawnsAndExtensionsNeedEnergy);
        Memory.OpenJobsTowersNeedEnergy = CheckForNewJobs("TowersNeedEnergy", Memory.OpenJobsTowersNeedEnergy);
        Memory.OpenJobsFullLinks = CheckForNewJobs("FullLinks", Memory.OpenJobsFullLinks);
        Memory.OpenJobsFullContainers = CheckForNewJobs("FullContainers", Memory.OpenJobsFullContainers);
        Memory.OpenJobsOwnedControllers = CheckForNewJobs("OwnedControllers", Memory.OpenJobsOwnedControllers);
        Memory.OpenJobsDamagedStructures = CheckForNewJobs("DamagedStructures", Memory.OpenJobsDamagedStructures);
        Memory.OpenJobsConstructions = CheckForNewJobs("Constructions", Memory.OpenJobsConstructions);
        Memory.OpenJobsActiveExtractors = CheckForNewJobs("ActiveExtractors", Memory.OpenJobsActiveExtractors);
        Memory.OpenJobsHostileCreeps = CheckForNewJobs("HostileCreeps", Memory.OpenJobsHostileCreeps);

        function CheckForNewJobs(jobName, openJobs) {
            for (const creepName in Game.creeps) { // loop through each unassigned creep
                const creep = Game.creeps[creepName];
                if (creep.memory.job === "open") {
                    for (const openJob in openJobs) { // loop through each openJob in room - sort with lowest number first and closest job
                        const jobOBJ = Game.getObjectById(openJob.id);
                        // assign job - move job to closedJobs and set creep job to job.id
                        creep.memory.job = openJob.id; // assign job to creep
                    }
                    // if still not assigned then idle or maybe do rangedHarvest
                }
            }
            return openJobs;
        }
    }
};
module.exports = AssignOpenJobs;