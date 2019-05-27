const CreateJobs = {
    run: function (room) {
        const RCL = room.controller.level;
        // new jobs
        const activeSources = room.find(FIND_SOURCES_ACTIVE).map(function (p) {
            new RoomVisual(p.room.name).text("🏭💼", p.pos.x, p.pos.y);
            return {'name': 'ActiveSources', 'id': p.id, 'pos': p.pos, 'creeps': []};
        });

        const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
            filter: (drop) => {
                return (drop.amount > 50);
            }
        }).map(function (p) {
            new RoomVisual(p.room.name).text("💰💼", p.pos.x, p.pos.y);
            return {'name': 'DroppedResources', 'id': p.id, 'pos': p.pos, 'creeps': []};
        });

        const spawnsAndExtensionsNeedEnergy = room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return ((structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) && structure.energy < structure.energyCapacity);
            }
        }).map(function (p) {
            new RoomVisual(p.room.name).text("⚡💼", p.pos.x, p.pos.y);
            return {'name': 'SpawnsAndExtensionsNeedEnergy', 'id': p.id, 'pos': p.pos, 'creeps': []};
        });

        const towersNeedEnergy = room.find(FIND_MY_STRUCTURES, {
            filter: (tower) => {
                return (tower.structureType === STRUCTURE_TOWER && tower.energy + 100 < tower.energyCapacity);
            }
        }).map(function (p) {
            new RoomVisual(p.room.name).text("🏰⚡💼", p.pos.x, p.pos.y);
            return {'name': 'TowersNeedEnergy', 'id': p.id, 'pos': p.pos, 'creeps': []};
        });

        const fullLinks = room.find(FIND_MY_STRUCTURES, { // only find the links that are adjacent to storage
            filter: (link) => {
                return (link.structureType === STRUCTURE_LINK && link.energy >= 500 && link.room.storage.pos.inRangeTo(link, 1));
            }
        }).map(function (p) {
            new RoomVisual(p.room.name).text("⚡💼", p.pos.x, p.pos.y);
            return {'name': 'FullLinks', 'id': p.id, 'pos': p.pos, 'creeps': []};
        });

        const fullContainers = room.find(FIND_STRUCTURES, {
            filter: (container) => {
                return (container.structureType === STRUCTURE_CONTAINER && _.sum(container.store) > 1700);
            }
        }).map(function (p) {
            new RoomVisual(p.room.name).text("⚡💼", p.pos.x, p.pos.y);
            return {'name': 'FullContainers', 'id': p.id, 'pos': p.pos, 'creeps': []};
        });

        const damagedStructures = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (
                    structure.hits < structure.hitsMax / 1.5 // health at 75%
                    &&
                    (
                        (
                            structure.structureType === STRUCTURE_RAMPART && (RCL < 8 && structure.hits < 1000 || RCL === 8 && structure.hits < 100000) ||
                            structure.structureType === STRUCTURE_WALL && (RCL < 8 && structure.hits < 1000 || RCL === 8 && structure.hits < 100000) ||
                            structure.structureType === STRUCTURE_ROAD && structure.hits < structure.hitsMax / 2
                        )
                        ||
                        (
                            structure.structureType !== STRUCTURE_RAMPART &&
                            structure.structureType !== STRUCTURE_WALL &&
                            structure.structureType !== STRUCTURE_ROAD
                        )
                    )
                );
            }
        }).map(function (p) {
            new RoomVisual(p.room.name).text("🛠💼", p.pos.x, p.pos.y);
            return {'name': 'DamagedStructures', 'id': p.id, 'pos': p.pos, 'creeps': []};
        });

        const constructions = room.find(FIND_CONSTRUCTION_SITES).map(function (p) {
            new RoomVisual(p.room.name).text("🏗💼", p.pos.x, p.pos.y);
            return {'name': 'Constructions', 'id': p.id, 'pos': p.pos, 'creeps': []};
        });

        const activeExtractors = room.find(FIND_MY_STRUCTURES, {
            filter: (extractor) => {
                return (extractor.structureType === STRUCTURE_EXTRACTOR && extractor.isActive());
            }
        });
        const activeMinerals = [];
        if(activeExtractors.length > 0){
            activeMinerals.push(...activeExtractors[0].pos.findInRange(FIND_MINERALS, 0, {filter: (mineral) => { return (mineral.mineralAmount > 0); }}).map(function (p) {
                new RoomVisual(p.room.name).text("💎💼", p.pos.x, p.pos.y);
                return {'name': 'ActiveMinerals', 'id': p.id, 'pos': p.pos, 'creeps': []};
            }));
        }

        const labsNeedEnergy = room.find(FIND_MY_STRUCTURES, {
            filter: (lab) => {
                return (lab.structureType === STRUCTURE_LAB && lab.energy < lab.energyCapacity);
            }
        }).map(function (p) {
            new RoomVisual(p.room.name).text("⚡💼", p.pos.x, p.pos.y);
            return {'name': 'LabsNeedEnergy', 'id': p.id, 'pos': p.pos, 'creeps': []};
        });

        let newJobs = [];
        newJobs.push(...activeSources);
        newJobs.push(...droppedResources);
        newJobs.push(...spawnsAndExtensionsNeedEnergy);
        newJobs.push(...towersNeedEnergy);
        newJobs.push(...fullLinks);
        newJobs.push(...fullContainers);
        newJobs.push(...damagedStructures);
        newJobs.push(...constructions);
        newJobs.push(...activeMinerals);
        newJobs.push(...labsNeedEnergy);

        new RoomVisual(room.name).text("🔩💼", room.controller.pos.x, room.controller.pos.y);
        newJobs.push({'name': 'OwnedControllers', 'id': room.controller.id, 'pos': room.controller.pos, 'creeps': []});
        if(room.storage !== undefined && room.terminal !== undefined && _.sum(room.terminal.store) < room.terminal.storeCapacity){
            if(room.terminal.store[RESOURCE_ENERGY] < 50000 && room.storage.store[RESOURCE_ENERGY] >= 50000){
                new RoomVisual(room.name).text("⚡💼", room.terminal.pos.x, room.terminal.pos.y);
                newJobs.push({'name': 'TerminalsNeedEnergy', 'id': room.terminal.id, 'pos': room.terminal.pos, 'creeps': []})
            }else if(room.terminal.store[RESOURCE_ENERGY] >= 50000){
                for (const resourceType in room.storage.store) {
                    if(room.storage.store[resourceType] > 0){
                        new RoomVisual(room.name).text("💎💼", room.storage.pos.x, room.storage.pos.y);
                        newJobs.push({'name': 'StorageHasMinerals', 'id': room.storage.id, 'pos': room.storage.pos, 'creeps': []});
                        break;
                    }
                }
            }
        }

        const closedJobs = Memory.closedJobs;
        const openJobs = Memory.openJobs;
        let newJobsCounter = 0;
        let existingOpenJobsCounter = 0;
        let existingClosedJobsCounter = 0;

        // loop through all new jobs
        for (const newJobCount in newJobs) { // loop through all new jobs
            const newJob = newJobs[newJobCount];
            let isClosedJobFound = false;
            let foundExistingOpenJob;

            for (const closedJobsCount in closedJobs) { // first look through the closed jobs
                const closedJob = closedJobs[closedJobsCount];
                if (closedJob && closedJob.id === newJob.id) {
                    isClosedJobFound = true; // closed job found - break and end
                    break;
                }
            }
            if (!isClosedJobFound) { // was not in closed jobs - maybe in open jobs?
                for (const openJobsCount in openJobs) { // look in open jobs
                    const openJob = openJobs[openJobsCount];
                    if (openJob) {
                        if (openJob.id === newJob.id) {
                            foundExistingOpenJob = openJob;
                            break;
                        }
                    }
                }
            }

            if (foundExistingOpenJob) {
                existingOpenJobsCounter++;
            } else if (!isClosedJobFound) { // new job found was not in either closed or open jobs - now save it in memory
                Memory.openJobs.push(newJob);
                newJobsCounter++;
            }else{
                existingClosedJobsCounter++;
            }
        }
        console.log("CreateJobs " + room.name + ", new: " + newJobsCounter + ", open: " + existingOpenJobsCounter + ", closed: " + existingClosedJobsCounter);
    }
};
module.exports = CreateJobs;