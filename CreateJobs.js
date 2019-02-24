let CreateJobs = {
    run: function(room) {
        // TODO
        // RCL level - overwrite jobs with old RCL
        // place newly found jobs in OpenJobsArrays
        
        
        // load closed and open jobs
        // loop through all potential jobs in the room - based on RCL level
            // if exists in closed or open jobs then skip
            // else create the job and add it to OpenJobsArrays

        // new jobs
        let activeSources                 = room.find(FIND_SOURCES_ACTIVE);

        let droppedResources              = room.find(FIND_DROPPED_RESOURCES, {filter: (drop) => {return (drop.amount > 50);}}).map(function (p) { return p.id; });
        let spawnsAndExtensionsNeedEnergy = room.find(FIND_MY_STRUCTURES, {filter: (structure) => {return ((structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_EXTENSION) && structure.energy < structure.energyCapacity);}}).map(function (p) { return p.id; });
        let towersNeedEnergy              = room.find(FIND_MY_STRUCTURES, {filter: (tower) => {return (tower.structureType == STRUCTURE_TOWER && tower.energy < tower.energyCapacity);}}).map(function (p) { return p.id; });
        let fullLinks                     = room.find(FIND_MY_STRUCTURES, {filter: (link) => {return (link.structureType == STRUCTURE_LINK && link.energy < link.energyCapacity);}}).map(function (p) { return p.id; });
        let fullContainers                = room.find(FIND_STRUCTURES, {filter: (container) => {return (container.structureType == STRUCTURE_CONTAINER && _.sum(container.store) > 0);}}).map(function (p) { return p.id; });

        let ownedControllers              = room.find(FIND_STRUCTURES, {filter: (controller) => {return (controller.structureType == STRUCTURE_CONTROLLER);}}).map(function (p) { return p.id; });

        let damagedStructures             = room.find(FIND_STRUCTURES, {filter: (structure) => {return (structure.hits < structure.hitsMax);}}).map(function (p) { return p.id; });
        let constructions                 = room.find(FIND_CONSTRUCTION_SITES);

        let activeExtractors              = []; if(room.find(FIND_MINERALS, {filter: (mineral) => {return (mineral.mineralAmount > 0);}})){activeExtractors = room.find(FIND_MY_STRUCTURES, {filter: (extractor) => {return (extractor.structureType == STRUCTURE_EXTRACTOR && extractor.isActive());}}).map(function (p) { return p.id; });}

        let hostileCreeps                 = room.find(FIND_HOSTILE_CREEPS, {filter: (creep) => {return (creep.owner.username != "Invader");}}).map(function (p) { return p.id; });

        // load all arrays from memory
        let memClosedJobsActiveSources                 = Memory.ClosedJobsActiveSources;
        let memClosedJobsDroppedResources              = Memory.ClosedJobsDroppedResources;
        let memClosedJobsSpawnsAndExtensionsNeedEnergy = Memory.ClosedJobsSpawnsAndExtensionsNeedEnergy;
        let memClosedJobsTowersNeedEnergy              = Memory.ClosedJobsTowersNeedEnergy;
        let memClosedJobsFullLinks                     = Memory.ClosedJobsFullLinks;
        let memClosedJobsFullContainers                = Memory.ClosedJobsFullContainers;
        let memClosedJobsOwnedControllers              = Memory.ClosedJobsOwnedControllers;
        let memClosedJobsDamagedStructures             = Memory.ClosedJobsDamagedStructures;
        let memClosedJobsConstructions                 = Memory.ClosedJobsConstructions;
        let memClosedJobsActiveExtractors              = Memory.ClosedJobsActiveExtractors;
        let memClosedJobsHostileCreeps                 = Memory.ClosedJobsHostileCreeps;

        let memOpenJobsActiveSources                 = Memory.OpenJobsActiveSources;
        let memOpenJobsDroppedResources              = Memory.OpenJobsDroppedResources;
        let memOpenJobsSpawnsAndExtensionsNeedEnergy = Memory.OpenJobsSpawnsAndExtensionsNeedEnergy;
        let memOpenJobsTowersNeedEnergy              = Memory.OpenJobsTowersNeedEnergy;
        let memOpenJobsFullLinks                     = Memory.OpenJobsFullLinks;
        let memOpenJobsFullContainers                = Memory.OpenJobsFullContainers;
        let memOpenJobsOwnedControllers              = Memory.OpenJobsOwnedControllers;
        let memOpenJobsDamagedStructures             = Memory.OpenJobsDamagedStructures;
        let memOpenJobsConstructions                 = Memory.OpenJobsConstructions;
        let memOpenJobsActiveExtractors              = Memory.OpenJobsActiveExtractors;
        let memOpenJobsHostileCreeps                 = Memory.OpenJobsHostileCreeps;

        // loop through all new jobs


        function Job(name, gender){
            this.name = name;
            this.gender = gender;
        }
    }
};
module.exports = CreateJobs;