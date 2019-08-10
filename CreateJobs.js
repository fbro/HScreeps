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

        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey]; // visible room
            let jobs = {};
            let level = -1;
            if (gameRoom.controller && gameRoom.controller.my) {
                level = gameRoom.controller.level;
                CreateObjJobs(gameRoom, jobs, level);
            }
            CreateFlagJobs(gameRoom, jobs);
            UpdateJobs(gameRoom, jobs, level);
        }

        function CreateObjJobs(gameRoom, jobs, level) {
            switch (level) { // create all the jobs
                case 8:
                // TODO FillPowerSpawnEnergy
                // TODO FillPowerSpawnPowerUnits
                case 7:
                case 6:
                    // TODO FillLabEnergy
                    FillLabEnergyJobs(gameRoom, jobs); // TODO add executeJob
                    // TODO FillLabMineral
                    //FillLabMineralJobs(gameRoom, jobs);
                    // TODO EmptyLabMineral
                    // FillTerminalEnergy
                    FillTerminalEnergyJobs(gameRoom, jobs);
                    // FillTerminalMineral
                    FillTerminalMineralJobs(gameRoom, jobs);
                    // ExtractMineral
                    ExtractMineralJobs(gameRoom, jobs);
                case 5:
                case 4:
                    if (gameRoom.storage !== undefined) {
                        // FillStorage - link, container and resource drops
                        FillStorageJobs(gameRoom, jobs);
                    }
                case 3:
                    // FillTower
                    FillTowerJobs(gameRoom, jobs);
                case 2:
                case 1:
                    // FillSpawnExtension
                    FillSpawnExtensionJobs(gameRoom, jobs);
                    // Construction
                    ConstructionJobs(gameRoom, jobs);
                    // Repair
                    RepairJobs(gameRoom, jobs);
                    // Controller
                    new RoomVisual(gameRoom.name).text('🧠', gameRoom.controller.pos.x, gameRoom.controller.pos.y);
                    CreateJob(jobs, 'Controller(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B', 1);
                    if (gameRoom.controller.level < 8 && gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 100000) { // not at max level - more creeps on the controller job
                        CreateJob(jobs, 'Controller1(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B', 5);
                        if (gameRoom.storage.store[RESOURCE_ENERGY] > 200000) {
                            CreateJob(jobs, 'Controller2(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B', 5);
                        }
                    }
                    // Source
                    const sources = gameRoom.find(FIND_SOURCES);
                    for (const sourceKey in sources) {
                        const source = sources[sourceKey];
                        new RoomVisual(gameRoom.name).text('🏭', source.pos.x, source.pos.y);
                        CreateJob(jobs, 'Source(' + source.pos.x + ',' + source.pos.y + ')' + gameRoom.name, source.id, OBJECT_JOB, 'H', 2);
                    }
                case 0:
                    // do nothing
                    break;
                default:
                    console.log('CreateJobs UpdateJobsInRoom ERROR! level not found ' + gameRoom.controller.level);
            }
        }

        function CreateFlagJobs(gameRoom, jobs) {
            for (const gameFlagKey in Game.flags) {
                const gameFlag = Game.flags[gameFlagKey];
                if (gameRoom.name === gameFlag.pos.roomName) { // this flag is in this room
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
                        jobName = 'ReserveController';
                        creepType = 'R';
                        jobImportance = 4;
                    } else if (gameFlag.color === COLOR_RED && gameFlag.secondaryColor === COLOR_RED) { // warrior at pos
                        jobName = 'GuardPos';
                        creepType = 'W';
                        jobImportance = 2;
                    } else if (gameFlag.color === COLOR_YELLOW && gameFlag.secondaryColor === COLOR_YELLOW) { // distantHarvester on source at flag pos
                        jobName = 'RemoteHarvest';
                        creepType = 'D';
                        jobImportance = 5;
                    } else {
                        console.log('CreateJobs UpdateJobsInRoom ERROR! flag color not found ' + gameFlag.color + ' ' + gameFlag.secondaryColor + ' (' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')');
                    }
                    const newJobName = jobName + '-' + gameFlagKey + '(' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')' + gameRoom.name; // for flag
                    CreateJob(jobs, newJobName, gameFlagKey, FLAG_JOB, creepType, jobImportance);
                }
            }
        }

        function UpdateJobs(gameRoom, jobs, level) {
            const memRoom = Memory.MemRooms[gameRoom.name];
            if (memRoom === undefined && Object.keys(jobs).length > 0) { // room not found and there are jobs in it - create it
                Memory.MemRooms[gameRoom.name] = {
                    'RoomLevel': level,
                    'RoomJobs': jobs,
                    'MaxCreeps': {},
                    'SourceNumber': gameRoom.find(FIND_SOURCES).length,
                };
                console.log('CreateJobs UpdateJobs add new room ' + gameRoom.name + ' level ' + level + ' jobs ' + JSON.stringify(jobs))
            } else if (memRoom !== undefined) { // update jobs in memRoom
                // update jobs if jobs does not exist - else do nothing
                for (const newJobKey in jobs) { // loop through new jobs
                    for (const oldJobKey in memRoom.RoomJobs) { // loop through old jobs
                        if (oldJobKey === newJobKey) {
                            jobs[newJobKey] = memRoom.RoomJobs[oldJobKey]; // save the old job because of historic job info
                            break;
                        }
                    }
                }
                memRoom.RoomLevel = level;
                // TODO maybe the sorting can be weaved into the generation of the job array
                const keysRes = Object.keys(jobs).sort(function (a, b) {
                    return jobs[a].JobImportance - jobs[b].JobImportance
                });
                const sortedJobs = {};
                for (const keysResKey in keysRes) {
                    const key = keysRes[keysResKey];
                    for (const jobKey in jobs) {
                        if (key === jobKey) {
                            const job = jobs[jobKey];
                            sortedJobs[jobKey] = job;
                            break;
                        }
                    }
                }
                // TODO - by overwriting and removing old jobs the creeps finishing the job ends up idle before it can really finish its job
                memRoom.RoomJobs = sortedJobs; // overwrite the old jobs with the new jobs - and the existing old jobs - old jobs that where not refound is forgotten
            }
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
                        CreateJob(roomJobs, 'FillLabEnergy(' + lab.pos.x + ',' + lab.pos.y + ')' + gameRoom.name, lab.id, OBJECT_JOB, 'T', 5);
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
                    CreateJob(roomJobs, 'FillTerminalEnergy(' + terminal.pos.x + ',' + terminal.pos.y + ')' + gameRoom.name, terminal.id, OBJECT_JOB, 'T', 4);
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
                if (terminal && _.sum(terminal.store) < (terminal.storeCapacity - 100000)) {
                    let storageHasMinerals = false;
                    for (const resourceType in gameRoom.storage.store) {
                        if (gameRoom.storage.store[resourceType] > 0 && resourceType !== RESOURCE_ENERGY) {
                            storageHasMinerals = true;
                        }
                    }
                    if (storageHasMinerals) {
                        CreateJob(roomJobs, 'FillTerminalMineral(' + terminal.pos.x + ',' + terminal.pos.y + ')' + gameRoom.name, terminal.id, OBJECT_JOB, 'T', 5);
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
                    CreateJob(roomJobs, 'ExtractMineral-' + mineral.mineralType + '(' + extractMineral.pos.x + ',' + extractMineral.pos.y + ')' + gameRoom.name, mineral.id, OBJECT_JOB, 'E', 5);
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
                CreateJob(roomJobs, 'FillStorage-' + fillStorage.structureType + '(' + fillStorage.pos.x + ',' + fillStorage.pos.y + ')' + gameRoom.name, fillStorage.id, OBJECT_JOB, 'T', 5);
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
                CreateJob(roomJobs, 'FillStorage-drop' + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.resourceType + ')' + gameRoom.name, resourceDrop.id, OBJECT_JOB, 'T', 4);
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
                CreateJob(roomJobs, 'FillTower(' + fillTower.pos.x + ',' + fillTower.pos.y + ')' + gameRoom.name, fillTower.id, OBJECT_JOB, 'T', 2);
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
                CreateJob(roomJobs, 'FillSpawnExtension(' + fillSpawnExtension.pos.x + ',' + fillSpawnExtension.pos.y + ')' + gameRoom.name, fillSpawnExtension.id, OBJECT_JOB, 'T', 1);
            }
        }

        function ConstructionJobs(gameRoom, roomJobs) {
            const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES);
            for (const constructionKey in constructions) {
                const construction = constructions[constructionKey];
                new RoomVisual(gameRoom.name).text('🏗', construction.pos.x, construction.pos.y);
                CreateJob(roomJobs, 'Construction-' + construction.structureType + '(' + construction.pos.x + ',' + construction.pos.y + ')' + gameRoom.name, construction.id, OBJECT_JOB, 'B', 2);
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
                                s.structureType === STRUCTURE_RAMPART && (gameRoom.controller.level < 8 && s.hits < 100000 || gameRoom.controller.level === 8 && s.hits < 2000000) ||
                                s.structureType === STRUCTURE_WALL && (gameRoom.controller.level < 8 && s.hits < 100000 || gameRoom.controller.level === 8 && s.hits < 2000000) ||
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
                CreateJob(roomJobs, 'Repair-' + repair.structureType + '(' + repair.pos.x + ',' + repair.pos.y + ')' + gameRoom.name, repair.id, OBJECT_JOB, 'B', 3);
            }
        }

        function CreateJob(roomJobs, jobName, jobId, jobType, creepType, jobImportance) {
            roomJobs[jobName] = {
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