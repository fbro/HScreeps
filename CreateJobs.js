let CreateJobs = {
    run: function(room) {
        // TODO
        // RCL level - overwrite jobs with old RCL
        // place newly found jobs in OpenJobsArrays
        
        
        // load closed and open jobs
        // loop through all potential jobs in the room - based on RCL level
            // if exists in closed or open jobs then skip
            // else create the job and add it to OpenJobsArrays

        let activeSources                 = room.find(FIND_SOURCES_ACTIVE);

        let droppedResources              = room.find(FIND_DROPPED_RESOURCES, {filter: (drop) => {return (drop.amount > 50);}});
        let spawnsAndExtensionsNeedEnergy = room.find(FIND_MY_STRUCTURES, {filter: (structure) => {return ((structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_EXTENSION) && structure.energy < structure.energyCapacity);}});
        let towersNeedEnergy              = room.find(FIND_MY_STRUCTURES, {filter: (tower) => {return (tower.structureType == STRUCTURE_TOWER && tower.energy < tower.energyCapacity);}});
        let fullLinks                     = room.find(FIND_MY_STRUCTURES, {filter: (link) => {return (link.structureType == STRUCTURE_LINK && link.energy < link.energyCapacity);}});
        let fullContainers                = room.find(FIND_STRUCTURES, {filter: (container) => {return (container.structureType == STRUCTURE_CONTAINER && _.sum(container.store) > 0);}});

        let ownedControllers              = room.find(FIND_STRUCTURES, {filter: (controller) => {return (controller.structureType == STRUCTURE_CONTROLLER);}});

        let damagedStructures             = room.find(FIND_STRUCTURES, {filter: (structure) => {return (structure.hits < structure.hitsMax);}});
        let constructions                 = room.find(FIND_CONSTRUCTION_SITES);

        let activeExtractors              = []; if(room.find(FIND_MINERALS, {filter: (mineral) => {return (mineral.mineralAmount > 0);}})){activeExtractors = room.find(FIND_MY_STRUCTURES, {filter: (extractor) => {return (extractor.structureType == STRUCTURE_EXTRACTOR && extractor.isActive());}});}

        let hostileCreeps                 = room.find(FIND_HOSTILE_CREEPS, {filter: (creep) => {return (creep.owner.username != "Invader");}});

        // load all arrays from memory
        let memActiveSources = Memory.activeSources;
        let memDroppedResources = Memory.droppedResources;
        let memSpawnsAndExtensionsNeedEnergy = Memory.spawnsAndExtensionsNeedEnergy;
        let memTowersNeedEnergy = Memory.towersNeedEnergy;
        let memFullLinks = Memory.fullLinks;
        let memFullContainers = Memory.fullContainers;
        let memOwnedControllers = Memory.ownedControllers;
        let memDamagedStructures = Memory.damagedStructures;
        let memConstructions = Memory.constructions;
        let memActiveExtractors = Memory.activeExtractors;
        let memHostileCreeps = Memory.hostileCreeps;
        
        
    }
};
module.exports = CreateJobs;