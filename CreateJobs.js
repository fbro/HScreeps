const CreateJobs = {
    run: function (room) {
        let newJobsCounter = 0;

        // new jobs
        const activeSources = room.find(FIND_SOURCES_ACTIVE).map(function (p) {
            return p.id;
        });

        const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
            filter: (drop) => {
                return (drop.amount > 50);
            }
        }).map(function (p) {
            return p.id;
        });
        const spawnsAndExtensionsNeedEnergy = room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return ((structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_EXTENSION) && structure.energy < structure.energyCapacity);
            }
        }).map(function (p) {
            return p.id;
        });
        const towersNeedEnergy = room.find(FIND_MY_STRUCTURES, {
            filter: (tower) => {
                return (tower.structureType == STRUCTURE_TOWER && tower.energy < tower.energyCapacity);
            }
        }).map(function (p) {
            return p.id;
        });
        const fullLinks = room.find(FIND_MY_STRUCTURES, {
            filter: (link) => {
                return (link.structureType == STRUCTURE_LINK && link.energy < link.energyCapacity);
            }
        }).map(function (p) {
            return p.id;
        });
        const fullContainers = room.find(FIND_STRUCTURES, {
            filter: (container) => {
                return (container.structureType == STRUCTURE_CONTAINER && _.sum(container.store) > 0);
            }
        }).map(function (p) {
            return p.id;
        });

        const ownedControllers = room.find(FIND_STRUCTURES, {
            filter: (controller) => {
                return (controller.structureType == STRUCTURE_CONTROLLER);
            }
        }).map(function (p) {
            return p.id;
        });

        const damagedStructures = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.hits < structure.hitsMax);
            }
        }).map(function (p) {
            return p.id;
        });
        const constructions = room.find(FIND_CONSTRUCTION_SITES);

        const activeExtractors = room.find(FIND_MY_STRUCTURES, {
            filter: (extractor) => {
                return (extractor.structureType == STRUCTURE_EXTRACTOR && extractor.isActive());
            }
        }).map(function (p) {
            return p.id;
        });

        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS, {
            filter: (creep) => {
                return (creep.owner.username != "Invader");
            }
        }).map(function (p) {
            return p.id;
        });

        // load all arrays from memory
        const memClosedJobsActiveSources = Memory.ClosedJobsActiveSources;
        const memClosedJobsDroppedResources = Memory.ClosedJobsDroppedResources;
        const memClosedJobsSpawnsAndExtensionsNeedEnergy = Memory.ClosedJobsSpawnsAndExtensionsNeedEnergy;
        const memClosedJobsTowersNeedEnergy = Memory.ClosedJobsTowersNeedEnergy;
        const memClosedJobsFullLinks = Memory.ClosedJobsFullLinks;
        const memClosedJobsFullContainers = Memory.ClosedJobsFullContainers;
        const memClosedJobsOwnedControllers = Memory.ClosedJobsOwnedControllers;
        const memClosedJobsDamagedStructures = Memory.ClosedJobsDamagedStructures;
        const memClosedJobsConstructions = Memory.ClosedJobsConstructions;
        const memClosedJobsActiveExtractors = Memory.ClosedJobsActiveExtractors;
        const memClosedJobsHostileCreeps = Memory.ClosedJobsHostileCreeps;

        const memOpenJobsActiveSources = Memory.OpenJobsActiveSources;
        const memOpenJobsDroppedResources = Memory.OpenJobsDroppedResources;
        const memOpenJobsSpawnsAndExtensionsNeedEnergy = Memory.OpenJobsSpawnsAndExtensionsNeedEnergy;
        const memOpenJobsTowersNeedEnergy = Memory.OpenJobsTowersNeedEnergy;
        const memOpenJobsFullLinks = Memory.OpenJobsFullLinks;
        const memOpenJobsFullContainers = Memory.OpenJobsFullContainers;
        const memOpenJobsOwnedControllers = Memory.OpenJobsOwnedControllers;
        const memOpenJobsDamagedStructures = Memory.OpenJobsDamagedStructures;
        const memOpenJobsConstructions = Memory.OpenJobsConstructions;
        const memOpenJobsActiveExtractors = Memory.OpenJobsActiveExtractors;
        const memOpenJobsHostileCreeps = Memory.OpenJobsHostileCreeps;

        Memory.OpenJobsActiveSources = CheckForNewJobs(activeSources, memClosedJobsActiveSources, memOpenJobsActiveSources);
        Memory.OpenJobsDroppedResources = CheckForNewJobs(droppedResources, memClosedJobsDroppedResources, memOpenJobsDroppedResources);
        Memory.OpenJobsSpawnsAndExtensionsNeedEnergy = CheckForNewJobs(spawnsAndExtensionsNeedEnergy, memClosedJobsSpawnsAndExtensionsNeedEnergy, memOpenJobsSpawnsAndExtensionsNeedEnergy);
        Memory.OpenJobsTowersNeedEnergy = CheckForNewJobs(towersNeedEnergy, memClosedJobsTowersNeedEnergy, memOpenJobsTowersNeedEnergy);
        Memory.OpenJobsFullLinks = CheckForNewJobs(fullLinks, memClosedJobsFullLinks, memOpenJobsFullLinks);
        Memory.OpenJobsFullContainers = CheckForNewJobs(fullContainers, memClosedJobsFullContainers, memOpenJobsFullContainers);
        Memory.OpenJobsOwnedControllers = CheckForNewJobs(ownedControllers, memClosedJobsOwnedControllers, memOpenJobsOwnedControllers);
        Memory.OpenJobsDamagedStructures = CheckForNewJobs(damagedStructures, memClosedJobsDamagedStructures, memOpenJobsDamagedStructures);
        Memory.OpenJobsConstructions = CheckForNewJobs(constructions, memClosedJobsConstructions, memOpenJobsConstructions);
        Memory.OpenJobsActiveExtractors = CheckForNewJobs(activeExtractors, memClosedJobsActiveExtractors, memOpenJobsActiveExtractors);
        Memory.OpenJobsHostileCreeps = CheckForNewJobs(hostileCreeps, memClosedJobsHostileCreeps, memOpenJobsHostileCreeps);

        console.log("CreateJobs " + room.name + ", " + newJobsCounter);

        function CheckForNewJobs(newJobIDs, closedJobs, openJobs) {
            if (newJobIDs === undefined) {
                newJobIDs = [];
            }
            if (closedJobs === undefined) {
                closedJobs = [];
            }
            if (openJobs === undefined) {
                openJobs = [];
            }
            let newOpenJobs = [];
            // loop through all new jobs
            for (const newJobIDCount in newJobIDs) {
                const newJobID = newJobIDs[newJobIDCount]; // const newJob = Game.getObjectById(newJobID);
                let isClosedJobFound = false;
                let foundExistingOpenJob = undefined;

                for (const closedJobsCount in closedJobs) {
                    const closedJob = closedJobs[closedJobsCount];
                    if (closedJob !== undefined && closedJob.id === newJobID) {
                        isClosedJobFound = true;
                        break;
                    }
                }
                if (!isClosedJobFound) {
                    for (const openJobsCount in openJobs) {
                        const openJob = openJobs[openJobsCount];
                        if (openJob !== undefined) {
                            if (openJob.id === newJobID) {
                                foundExistingOpenJob = openJob;
                                break;
                            }
                        }
                    }
                }

                if (foundExistingOpenJob !== undefined) {
                    newOpenJobs.push(foundExistingOpenJob);
                } else if (!isClosedJobFound) {
                    let newJobOBJ = {};
                    newJobOBJ.id = newJobID;
                    newOpenJobs.push(newJobOBJ);
                    newJobsCounter++;
                }
            }
            return newOpenJobs;
        }
    }
};
module.exports = CreateJobs;