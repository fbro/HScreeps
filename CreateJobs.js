const CreateJobs = {
    run: function(room) {
        let newJobsCounter = 0;
        let existingOpenJobsCounter = 0;

        // new jobs
        const activeSources                 = room.find(FIND_SOURCES_ACTIVE).map(function (p) { return {'name' : 'activeSources', 'id': p.id, 'creeps': []}; });
        const droppedResources              = room.find(FIND_DROPPED_RESOURCES, {filter: (drop) => {return (drop.amount > 50);}}).map(function (p) { return {'name' : 'droppedResources', 'id': p.id, 'creeps': []}; });
        const spawnsAndExtensionsNeedEnergy = room.find(FIND_MY_STRUCTURES, {filter: (structure) => {return ((structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) && structure.energy < structure.energyCapacity);}}).map(function (p) { return {'name' : 'spawnsAndExtensionsNeedEnergy', 'id': p.id, 'creeps': []}; });
        const towersNeedEnergy              = room.find(FIND_MY_STRUCTURES, {filter: (tower) => {return (tower.structureType === STRUCTURE_TOWER && tower.energy < tower.energyCapacity);}}).map(function (p) { return {'name' : 'towersNeedEnergy', 'id': p.id, 'creeps': []}; });
        const fullLinks                     = room.find(FIND_MY_STRUCTURES, {filter: (link) => {return (link.structureType === STRUCTURE_LINK && link.energy > 700);}}).map(function (p) { return {'name' : 'fullLinks', 'id': p.id, 'creeps': []}; });
        const fullContainers                = room.find(FIND_STRUCTURES, {filter: (container) => {return (container.structureType === STRUCTURE_CONTAINER && _.sum(container.store) > 700);}}).map(function (p) { return {'name' : 'fullContainers', 'id': p.id, 'creeps': []}; });
        const ownedControllers              = room.find(FIND_STRUCTURES, {filter: (controller) => {return (controller.structureType === STRUCTURE_CONTROLLER);}}).map(function (p) { return {'name' : 'ownedControllers', 'id': p.id, 'creeps': []}; });
        const damagedStructures             = room.find(FIND_STRUCTURES, {filter: (structure) => {return (structure.hits < structure.hitsMax);}}).map(function (p) { return {'name' : 'damagedStructures', 'id': p.id, 'creeps': []}; });
        const constructions                 = room.find(FIND_CONSTRUCTION_SITES).map(function (p) { return {'name' : 'constructions', 'id': p.id, 'creeps': []}; });
        const activeExtractors              = room.find(FIND_MY_STRUCTURES, {filter: (extractor) => {return (extractor.structureType === STRUCTURE_EXTRACTOR && extractor.isActive());}}).map(function (p) { return {'name' : 'activeExtractors', 'id': p.id, 'creeps': []}; });

        let newJobs = [];
        newJobs.push(...activeSources);
        newJobs.push(...droppedResources);
        newJobs.push(...spawnsAndExtensionsNeedEnergy);
        newJobs.push(...towersNeedEnergy);
        newJobs.push(...fullLinks);
        newJobs.push(...fullContainers);
        newJobs.push(...ownedControllers);
        newJobs.push(...damagedStructures);
        newJobs.push(...constructions);
        newJobs.push(...activeExtractors);

        const closedJobs = Memory.closedJobs;
        const openJobs = Memory.openJobs;

        let newOpenJobs = [];
        // loop through all new jobs
        for(const newJobCount in newJobs){
            const newJob = newJobs[newJobCount];
            let isClosedJobFound = false;
            let foundExistingOpenJob = undefined;

            for(const closedJobsCount in closedJobs){ // first look through the closed jobs
                const closedJob = closedJobs[closedJobsCount];
                if(closedJob !== undefined && closedJob.id === newJob){
                    isClosedJobFound = true;
                    break;
                }
            }
            if(!isClosedJobFound){
                for(const openJobsCount in openJobs){ // if not in closed jobs then look in open jobs
                    const openJob = openJobs[openJobsCount];
                    if(openJob !== undefined){
                        if(openJob.id === newJob){
                            foundExistingOpenJob = openJob;
                            break;
                        }
                    }
                }
            }

            if(foundExistingOpenJob !== undefined){
                newOpenJobs.push(foundExistingOpenJob); // existing open jobs are re-saved in the memory
                existingOpenJobsCounter++;
            }else if(!isClosedJobFound){ // new job found - now it is created
                newOpenJobs.push(newJob);
                newJobsCounter++;
            }
        }
        Memory.OpenJobs =  newOpenJobs;
        console.log("CreateJobs " + room.name + ", new: " + newJobsCounter + ", existing: " + existingOpenJobsCounter);
    }
};
module.exports = CreateJobs;