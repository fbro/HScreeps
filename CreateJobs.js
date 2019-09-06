const CreateJobs = {
    run: function () {
        // CreateJobs
        //   Rooms - RoomNumber - room.name
        //     RoomLevel - 0 to 8
        //     MaxCreeps
        //     RoomJobs - JobName - [JobName(x,y)] - user friendly, unique per room, name
        //       JobId - real id
        //       JobType - int enum - OBJECT_JOB = 1, FLAG_JOB = 2
        //       CreepType - T, H, B...
        //       Creep - CreepName

        /* jobs:
        * Source
        * Controller
        * Repair
        * Construction
        * FillSpawnExtension
        *
        * FillTower
        *
        * ResourceDrop
        * FillStorage
        *
        * FillTerminalMineral
        * FillTerminalEnergy
        * EmptyLabMineral
        * FillLabMineral
        * FillLabEnergy
        * Extractor
        *
        * FillPowerSpawnPowerUnits
        * FillPowerSpawnEnergy
        * */

        // job type int enum
        const OBJECT_JOB = 1;
        const FLAG_JOB = 2;

        let flagJobs = CreateFlagJobs();
        CreateObjJobs(flagJobs);

        function CreateObjJobs(flagJobs) {
            for (const gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey]; // visible room
                let jobs = {};
                // weave flag jobs into the job array that is in this room object
                for (const flagJobKey in flagJobs) {
                    if(flagJobKey.split(')').pop() === gameRoomKey){
                        const flagJob = flagJobs[flagJobKey];
                        jobs[flagJobKey] = flagJob; // add job to this room job array
                        delete flagJobs[flagJobKey];
                    }
                }
                if (gameRoom.controller && gameRoom.controller.my) { // create all the jobs in this room
                    // Source
                    const sources = gameRoom.find(FIND_SOURCES);
                    for (const sourceKey in sources) {
                        const source = sources[sourceKey];
                        new RoomVisual(gameRoom.name).text('🏭', source.pos.x, source.pos.y);
                        AddJob(jobs, 'Source(' + source.pos.x + ',' + source.pos.y + ')' + gameRoom.name, source.id, OBJECT_JOB, 'H', 2);
                    }
                    // Controller
                    new RoomVisual(gameRoom.name).text('🧠', gameRoom.controller.pos.x, gameRoom.controller.pos.y);
                    AddJob(jobs, 'Controller(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B', 1);
                    // FillSpawnExtension
                    FillSpawnExtensionJobs(gameRoom, jobs);
                    // Construction
                    ConstructionJobs(gameRoom, jobs);
                    // Repair
                    RepairJobs(gameRoom, jobs);
                    if (gameRoom.controller.level < 8 && gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 100000) { // not at max level - more creeps on the controller job
                        AddJob(jobs, 'Controller1(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B', 5);
                        if (gameRoom.storage.store[RESOURCE_ENERGY] > 200000) {
                            AddJob(jobs, 'Controller2(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B', 5);
                        }
                    }
                    if (gameRoom.controller.level >= 3) {
                        // FillTower
                        FillTowerJobs(gameRoom, jobs);
                        if (gameRoom.controller.level >= 4) {
                            if (gameRoom.storage !== undefined) {
                                // FillStorage - link, container and resource drops
                                FillStorageJobs(gameRoom, jobs);
                                if (gameRoom.controller.level >= 6) {
                                    // ExtractMineral
                                    ExtractMineralJobs(gameRoom, jobs);
                                    // FillTerminalEnergy
                                    FillTerminalEnergyJobs(gameRoom, jobs);
                                    // FillTerminalMineral
                                    FillTerminalMineralJobs(gameRoom, jobs);
                                    // FillLabEnergy
                                    FillLabEnergyJobs(gameRoom, jobs);
                                    // TODO FillLabMineral
                                    //FillLabMineralJobs(gameRoom, jobs);
                                    // TODO EmptyLabMineral
                                    // if (gameRoom.controller.level === 8) {
                                        // TODO FillPowerSpawnEnergy
                                        // TODO FillPowerSpawnPowerUnits
                                    // }
                                }
                            }
                        }
                    }
                    if (!Memory.MemRooms[gameRoom.name] && Object.keys(jobs).length > 0) { // room not found and there are jobs in it - create it
                        CreateRoom(gameRoom.name, jobs);
                    } else if (Memory.MemRooms[gameRoom.name]) { // update jobs in memRoom
                        // update jobs if jobs does not exist - else do nothing
                        for (const newJobKey in jobs) { // loop through new jobs
                            for (const oldJobKey in Memory.MemRooms[gameRoom.name].RoomJobs) { // loop through old jobs
                                if (oldJobKey === newJobKey) {
                                    jobs[newJobKey] = Memory.MemRooms[gameRoom.name].RoomJobs[oldJobKey]; // save the old job because of historic job info
                                    break;
                                }
                            }
                        }
                        if(Memory.MemRooms[gameRoom.name].RoomLevel !== gameRoom.controller.level){
                            Memory.MemRooms[gameRoom.name].RoomLevel = gameRoom.controller.level;
                            Memory.MemRooms[gameRoom.name].SourceNumber = gameRoom.find(FIND_SOURCES).length;
                        }
                        Memory.MemRooms[gameRoom.name].RoomJobs = jobs; // overwrite the old jobs with the new jobs - and the existing old jobs - old jobs that where not refound is forgotten
                    }
                }
            }

            // now some flag jobs might still be unplaced, loop trough them and add them maybe also create the room object
            for (const flagJobKey in flagJobs) {
                const roomName = flagJobKey.split(')').pop();
                const flagJob = flagJobs[flagJobKey];
                if(Memory.MemRooms[roomName]){
                    if(!Memory.MemRooms[roomName].RoomJobs[flagJobKey]){
                        Memory.MemRooms[roomName].RoomJobs[flagJobKey] = flagJob;
                    }
                }else{
                    const jobs = {};
                    jobs[flagJobKey] = flagJob;
                    CreateRoom(roomName, jobs);
                }
            }
        }

        // this method is not just run in the Game.rooms loop because flags may be in "invisible" rooms
        function CreateFlagJobs() {
            let jobs = {};
            for (const gameFlagKey in Game.flags) {
                const gameFlag = Game.flags[gameFlagKey];
                let jobName;
                let creepType;
                let jobImportance = 5;
                if (gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_ORANGE) { // scout tag
                    jobName = 'TagController';
                    creepType = 'S';
                    jobImportance = 4;
                } else if (gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_YELLOW) { // scout at pos
                    jobName = 'ScoutPos';
                    creepType = 'S';
                    jobImportance = 5;
                } else if (gameFlag.color === COLOR_GREEN && gameFlag.secondaryColor === COLOR_GREEN) { // claimer claim
                    jobName = 'ClaimController';
                    creepType = 'C';
                    jobImportance = 1;
                } else if (gameFlag.color === COLOR_GREEN && gameFlag.secondaryColor === COLOR_YELLOW) { // claimer reserve
                    if(!gameFlag.room || (gameFlag.room.controller.reservation.ticksToEnd < 2000 && !Memory.MemRooms[gameFlag.pos.roomName].RoomJobs[gameFlagKey])){
                        jobName = 'ReserveController';
                        creepType = 'R';
                        jobImportance = 4;
                    }
                } else if (gameFlag.color === COLOR_RED && gameFlag.secondaryColor === COLOR_RED) { // warrior at pos
                    jobName = 'GuardPos';
                    creepType = 'W';
                    jobImportance = 2;
                } else if (gameFlag.color === COLOR_YELLOW && gameFlag.secondaryColor === COLOR_YELLOW) { // distantHarvester on source at flag pos
                    jobName = 'RemoteHarvest';
                    creepType = 'D';
                    jobImportance = 5;
                } else {
                    console.log('CreateJobs UpdateJobsInRoom ERROR! flag color not found ' + gameFlagKey + ' ' + gameFlag.color + ' ' + gameFlag.secondaryColor + ' (' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')');
                }

                if(jobName){
                    AddJob(jobs, jobName + '-' + gameFlagKey + '(' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')' + gameFlag.pos.roomName, gameFlagKey, FLAG_JOB, creepType, jobImportance);
                }
            }
            return jobs;
        }

        // jobs:

        function FillLabEnergyJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 50000) {
                const labs = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_LAB;
                    }
                });
                for (const labKey in labs) {
                    const lab = labs[labKey];
                    if (lab && lab.energy < lab.energyCapacity) {
                        new RoomVisual(gameRoom.name).text('⚡', lab.pos.x, lab.pos.y);
                        AddJob(roomJobs, 'FillLabEnergy(' + lab.pos.x + ',' + lab.pos.y + ')' + gameRoom.name, lab.id, OBJECT_JOB, 'T', 3);
                    }
                }
            }
        }

        function FillTerminalEnergyJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 50000) {
                const terminal = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_TERMINAL;
                    }
                })[0];
                if (terminal && terminal.store[RESOURCE_ENERGY] < 100000 && _.sum(terminal.store) < terminal.storeCapacity) {
                    new RoomVisual(gameRoom.name).text('⚡', terminal.pos.x, terminal.pos.y);
                    AddJob(roomJobs, 'FillTerminalEnergy(' + terminal.pos.x + ',' + terminal.pos.y + ')' + gameRoom.name, terminal.id, OBJECT_JOB, 'T', 4);
                }
            }
        }

        function FillTerminalMineralJobs(gameRoom, roomJobs) {
            if (gameRoom.storage) {
                const terminal = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_TERMINAL;
                    }
                })[0];
                if (terminal && (_.sum(terminal.store) - terminal.store[RESOURCE_ENERGY]) < (terminal.storeCapacity - 100000)) {
                    let storageHasMinerals = false;
                    for (const resourceType in gameRoom.storage.store) {
                        if (gameRoom.storage.store[resourceType] > 0 && resourceType !== RESOURCE_ENERGY) {
                            storageHasMinerals = true;
                        }
                    }
                    if (storageHasMinerals) {
                        new RoomVisual(gameRoom.name).text('⛏', terminal.pos.x, terminal.pos.y);
                        AddJob(roomJobs, 'FillTerminalMineral(' + terminal.pos.x + ',' + terminal.pos.y + ')' + gameRoom.name, terminal.id, OBJECT_JOB, 'T', 5);
                    }
                }
            }
        }

        function ExtractMineralJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 50000 || gameRoom.find(FIND_MY_CREEPS, {
                filter: (c) => {
                    return c.name.startsWith('E');
                }
            })[0]) { // only create these jobs when one has energy in the room
                const extractMineral = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_EXTRACTOR;
                    }
                })[0];
                const mineral = gameRoom.find(FIND_MINERALS, {
                    filter: (s) => {
                        return s.mineralAmount > 0;
                    }
                })[0];
                if (mineral && extractMineral) {
                    new RoomVisual(gameRoom.name).text('⛏', extractMineral.pos.x, extractMineral.pos.y);
                    AddJob(roomJobs, 'ExtractMineral-' + mineral.mineralType + '(' + extractMineral.pos.x + ',' + extractMineral.pos.y + ')' + gameRoom.name, mineral.id, OBJECT_JOB, 'E', 5);
                }
            }
        }

        function FillStorageJobs(gameRoom, roomJobs) {
            const fillStorages = gameRoom.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_CONTAINER && _.sum(s.store) >= 600)
                        || (s.structureType === STRUCTURE_LINK && s.energy >= 600 && s.room.storage.pos.inRangeTo(s, 1));
                }
            });
            for (const fillStorageKey in fillStorages) {
                const fillStorage = fillStorages[fillStorageKey];
                new RoomVisual(gameRoom.name).text('📦', fillStorage.pos.x, fillStorage.pos.y);
                AddJob(roomJobs, 'FillStorage-' + fillStorage.structureType + '(' + fillStorage.pos.x + ',' + fillStorage.pos.y + ')' + gameRoom.name, fillStorage.id, OBJECT_JOB, 'T', 5);
            }
            // drop is a little bit different - but same kind of job as above
            const resourceDrops = gameRoom.find(FIND_DROPPED_RESOURCES, {
                filter: (drop) => {
                    return (drop.resourceType === RESOURCE_ENERGY && drop.amount > 100 || drop.resourceType !== RESOURCE_ENERGY && drop.amount > 30);
                }
            });
            for (const resourceDropKey in resourceDrops) {
                const resourceDrop = resourceDrops[resourceDropKey];
                new RoomVisual(gameRoom.name).text('💰', resourceDrop.pos.x, resourceDrop.pos.y);
                AddJob(roomJobs, 'FillStorage-drop' + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.resourceType + ')' + gameRoom.name, resourceDrop.id, OBJECT_JOB, 'T', 4);
            }
        }

        function FillTowerJobs(gameRoom, roomJobs) {
            const fillTowers = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_TOWER) && s.energy < (s.energyCapacity - 100));
                }
            });
            for (const fillTowerKey in fillTowers) {
                const fillTower = fillTowers[fillTowerKey];
                new RoomVisual(gameRoom.name).text('🗼', fillTower.pos.x, fillTower.pos.y);
                AddJob(roomJobs, 'FillTower(' + fillTower.pos.x + ',' + fillTower.pos.y + ')' + gameRoom.name, fillTower.id, OBJECT_JOB, 'T', 2);
            }
        }

        function FillSpawnExtensionJobs(gameRoom, roomJobs) {
            const fillSpawnExtensions = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.energy < s.energyCapacity);
                }
            });
            for (const fillSpawnExtensionKey in fillSpawnExtensions) {
                const fillSpawnExtension = fillSpawnExtensions[fillSpawnExtensionKey];
                new RoomVisual(gameRoom.name).text('🌱', fillSpawnExtension.pos.x, fillSpawnExtension.pos.y);
                AddJob(roomJobs, 'FillSpawnExtension(' + fillSpawnExtension.pos.x + ',' + fillSpawnExtension.pos.y + ')' + gameRoom.name, fillSpawnExtension.id, OBJECT_JOB, 'T', 1);
            }
        }

        function ConstructionJobs(gameRoom, roomJobs) {
            const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES);
            for (const constructionKey in constructions) {
                const construction = constructions[constructionKey];
                new RoomVisual(gameRoom.name).text('🏗', construction.pos.x, construction.pos.y);
                AddJob(roomJobs, 'Construction-' + construction.structureType + '(' + construction.pos.x + ',' + construction.pos.y + ')' + gameRoom.name, construction.id, OBJECT_JOB, 'B', 2);
            }
        }

        function RepairJobs(gameRoom, roomJobs) {
            const repairs = gameRoom.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (
                        s.hits < s.hitsMax / 1.5 // health at 75%
                        &&
                        (
                            (
                                (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL)
                                    && (gameRoom.controller.level < 8 && s.hits < 100000 || gameRoom.controller.level === 8 && (s.hits < 2000000 || gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 500000))
                                ||
                                s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax / 2
                            )
                            ||
                            (
                                s.structureType !== STRUCTURE_RAMPART &&
                                s.structureType !== STRUCTURE_WALL &&
                                s.structureType !== STRUCTURE_ROAD
                            )
                        )
                    );
                }
            });
            for (const repairKey in repairs) {
                const repair = repairs[repairKey];
                new RoomVisual(gameRoom.name).text('🛠', repair.pos.x, repair.pos.y);
                AddJob(roomJobs, 'Repair-' + repair.structureType + '(' + repair.pos.x + ',' + repair.pos.y + ')' + gameRoom.name, repair.id, OBJECT_JOB, 'B', 3);
            }
        }


        function CreateRoom(roomName, jobs){
            const gameRoom = Game.rooms[roomName];
            let level = -1;
            let sourceNumber = -1;
            if(gameRoom){
                level = gameRoom.controller.level;
                sourceNumber = gameRoom.find(FIND_SOURCES).length;
            }
            Memory.MemRooms[roomName] = {
                'RoomLevel': level,
                'RoomJobs': jobs,
                'MaxCreeps': {},
                'SourceNumber': sourceNumber,
            };
            console.log('CreateJobs CreateRoom add new room ' + roomName + ' level ' + level + ' sourceNumber ' + sourceNumber + ' jobs ' + JSON.stringify(jobs))
        }

        function AddJob(roomJobs, jobName, jobId, jobType, creepType, jobImportance) {
            roomJobs[jobName] = CreateJob(jobId, jobType, creepType, jobImportance);
        }

        function CreateJob(jobId, jobType, creepType, jobImportance) {
            return {
                'JobId': jobId,
                'JobType': jobType,
                'CreepType': creepType,
                'Creep': 'vacant',
                'JobImportance': jobImportance
            };
        }
    }
};
module.exports = CreateJobs;