let Logs = require('Logs');
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

        const EXTRACTOR_WHEN_STORAGE_ENERGY = 50000;
        const RAMPART_WALL_HITS_U_LVL8 = 100000;
        const RAMPART_WALL_HITS_O_LVL8 = 2000000;
        const RAMPART_WALL_MAX_HITS_WHEN_STORAGE_ENERGY = 600000;

        let flagJobs = CreateFlagJobs();
        CreateObjJobs(flagJobs);

        // this method is not just run in the Game.rooms loop because flags may be in "invisible" rooms
        function CreateFlagJobs() {
            let jobs = {};
            for (const gameFlagKey in Game.flags) {
                const gameFlag = Game.flags[gameFlagKey];
                let jobName;
                let creepType;
                if (gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_ORANGE) { // scout tag
                    jobName = '4TagCtrl';
                    creepType = 'S';
                } else if (gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_YELLOW) { // scout at pos
                    jobName = '5ScoutPos';
                    creepType = 'S';
                } else if (gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_RED) { // flag to be placed on an observer that enables it to scan for power banks and deposits
                    // observers handle this flag
                } else if (gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_PURPLE) { // flag that observers create and put on found power banks and deposits and deletes again when deadline is reached
                    jobName = '3HrvstPwrBnk';
                    creepType = 'P';
                }else if (gameFlag.color === COLOR_RED && gameFlag.secondaryColor === COLOR_RED) { // warrior at pos
                    jobName = '2GuardPos';
                    creepType = 'W';
                } else if (gameFlag.color === COLOR_YELLOW && gameFlag.secondaryColor === COLOR_YELLOW) { // distantHarvester on source at flag pos
                    jobName = '5RemoteHarvest';
                    creepType = 'D';
                } else if (gameFlag.color === COLOR_PURPLE && gameFlag.secondaryColor === COLOR_PURPLE) { // FillLabMineral
                    if (!gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                        filter: function (s) {
                            return s.structureType === STRUCTURE_LAB;
                        }
                    })) { // flag must be on top of an existing lab!
                        gameFlag.remove();
                        Logs.Error('CreateJobs-CreateFlagJobs-labGone', 'CreateJobs CreateFlagJobs ERROR! no lab ' + gameFlagKey);
                    } else if (gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                        filter: function (s) {
                            return s.structureType === STRUCTURE_LAB;
                        }
                    })[0].mineralAmount < LAB_MINERAL_CAPACITY) {
                        jobName = '6FillLabMin'; // flagname rules: GET-L = get lemergium from all rooms, BUY-L = get it from all rooms or then buy it from the terminal
                        creepType = 'T';
                    }
                } else if (gameFlag.color === COLOR_PURPLE && gameFlag.secondaryColor === COLOR_WHITE) { // EmptyLabMineral
                    if (!gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                        filter: function (s) {
                            return s.structureType === STRUCTURE_LAB;
                        }
                    })) { // flag must be on top of an existing lab!
                        gameFlag.remove();
                        Logs.Error('CreateJobs-CreateFlagJobs-labGone', 'CreateJobs CreateFlagJobs ERROR! no lab ' + gameFlagKey);
                    } else if (gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                        filter: function (s) {
                            return s.structureType === STRUCTURE_LAB;
                        }
                    })[0].mineralAmount > 0) {
                        jobName = '5EmptyLabMin'; // flagname rules: CREATE-GH = CREATE the mineral from the nearby lab to this lab
                        creepType = 'T';
                    }
                } else if (gameFlag.color === COLOR_GREEN && gameFlag.secondaryColor === COLOR_GREEN) { // claimer claim
                    jobName = '1ClaimCtrl';
                    creepType = 'C';
                } else if (gameFlag.color === COLOR_GREEN && gameFlag.secondaryColor === COLOR_YELLOW) { // claimer reserve
                    if (!gameFlag.room
                        || !gameFlag.room.controller.reservation
                        || !Memory.MemRooms[gameFlag.pos.roomName]
                        || Memory.MemRooms[gameFlag.pos.roomName].RoomJobs['4ReserveCtrl-' + gameFlagKey + '(' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')' + gameFlag.pos.roomName]
                        || (gameFlag.room.controller.reservation.ticksToEnd < 2500 && !Memory.MemRooms[gameFlag.pos.roomName].RoomJobs[gameFlagKey])) { // extra logic to try and optimize creep not being idle
                        jobName = '4ReserveCtrl';
                        creepType = 'R';
                    }
                } else {
                    Logs.Error('CreateJobs-CreateFlagJobs-flagColorNotFound', 'CreateJobs CreateFlagJobs ERROR! flag color not found ' + gameFlagKey + ' ' + gameFlag.color + ' ' + gameFlag.secondaryColor + ' (' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')');
                }

                if (jobName) {
                    //console.log('CreateJobs CreateFlagJobs AddJob ' + gameFlagKey);
                    AddJob(jobs, jobName + '-' + gameFlagKey + '(' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')' + gameFlag.pos.roomName, gameFlagKey, FLAG_JOB, creepType);
                }
            }
            return jobs;
        }

        function CreateObjJobs(flagJobs) {
            for (const gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey]; // visible room
                let jobs = {};
                // weave flag jobs into the job array that is in this room object
                for (const flagJobKey in flagJobs) {
                    if (flagJobKey.split(')').pop() === gameRoomKey) {
                        const flagJob = flagJobs[flagJobKey];
                        jobs[flagJobKey] = flagJob; // add job to this room job array
                        flagJobs[flagJobKey] = undefined;
                        // console.log('CreateJobs CreateObjJobs flagJobs found in ' + gameRoomKey + ' ' + flagJobKey + ' ' + JSON.stringify(jobs[flagJobKey]) + ' length ' + Object.keys(jobs).length);
                    }
                }
                if (gameRoom.controller && gameRoom.controller.my) { // create all the jobs in this room
                    // Source
                    const sources = gameRoom.find(FIND_SOURCES);
                    for (const sourceKey in sources) {
                        const source = sources[sourceKey];
                        new RoomVisual(gameRoom.name).text('🏭', source.pos.x, source.pos.y);
                        AddJob(jobs, '1Src(' + source.pos.x + ',' + source.pos.y + ')' + gameRoom.name, source.id, OBJECT_JOB, 'H');
                    }
                    // Controller
                    new RoomVisual(gameRoom.name).text('🧠', gameRoom.controller.pos.x, gameRoom.controller.pos.y);
                    AddJob(jobs, '0Ctrl(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B');
                    // FillSpawnExtension
                    FillSpawnExtensionJobs(gameRoom, jobs);
                    // Construction
                    ConstructionJobs(gameRoom, jobs);
                    // Repair
                    RepairJobs(gameRoom, jobs);
                    if (gameRoom.controller.level < 8 && gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 100000) { // not at max level - more creeps on the controller job
                        AddJob(jobs, '9Ctrl(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B');
                    }
                    if (gameRoom.controller.level >= 3) {
                        // FillTower
                        FillTowerJobs(gameRoom, jobs);
                        if (gameRoom.controller.level >= 4) {
                            if (gameRoom.storage !== undefined) {
                                // FillStorage - link, container and resource drops
                                FillStorageJobs(gameRoom, jobs);
                                // FillStorageFromRemote
                                if (Memory.MemRooms[gameRoom.name] && Memory.MemRooms[gameRoom.name].AttachedRooms) {
                                    FillStorageFromRemoteJobs(gameRoom, jobs);
                                }
                                if (gameRoom.controller.level >= 6) {
                                    // ExtractMineral
                                    ExtractMineralJobs(gameRoom, jobs);
                                    // FillTerminalEnergy
                                    FillTerminalEnergyJobs(gameRoom, jobs);
                                    // FillTerminalMineral
                                    FillTerminalMineralJobs(gameRoom, jobs);
                                    // FillLabEnergy
                                    FillLabEnergyJobs(gameRoom, jobs);
                                    if (gameRoom.controller.level === 8) {
                                        FillPowerSpawnEnergyJobs(gameRoom, jobs);
                                        // TODO FillPowerSpawnPowerJobs
                                    }
                                }
                            }
                        }
                    }
                }
                if (!Memory.MemRooms[gameRoom.name] && Object.keys(jobs).length > 0) { // room not found and there are jobs in it - create it
                    CreateRoom(gameRoom.name, jobs);
                } else if (Memory.MemRooms[gameRoom.name]) { // update jobs in memRoom
                    let addedNewJob = false;
                    // add new jobs
                    for (const newJobKey in jobs) { // loop through new jobs
                        if (!Memory.MemRooms[gameRoom.name].RoomJobs[newJobKey]) { // new job does not already exist
                            Memory.MemRooms[gameRoom.name].RoomJobs[newJobKey] = jobs[newJobKey]; // save it
                            //console.log("CreateJobs CreateObjJobs new job added " + newJobKey);
                            addedNewJob = true;
                        }
                    }
                    // remove only old disappeared vacant jobs
                    for (const oldJobKey in Memory.MemRooms[gameRoom.name].RoomJobs) { // loop through old jobs
                        const oldJob = Memory.MemRooms[gameRoom.name].RoomJobs[oldJobKey];
                        if (oldJob.Creep === 'vacant' && !jobs[oldJobKey]) { // old job is vacant and old job id not en the new job array
                            Memory.MemRooms[gameRoom.name].RoomJobs[oldJobKey] = undefined; // delete old vacant disappeared job
                            //console.log("CreateJobs CreateObjJobs old job deleted " + oldJobKey);
                        }
                    }
                    if (Memory.MemRooms[gameRoom.name].RoomLevel !== gameRoom.controller.level) { // room level change
                        Memory.MemRooms[gameRoom.name].RoomLevel = gameRoom.controller.level;
                        Memory.MemRooms[gameRoom.name].SourceNumber = gameRoom.find(FIND_SOURCES).length;
                        Memory.MemRooms[gameRoom.name].MaxCreeps = {}; // reset - maybe the MaxCreepsInRoom changes with room level
                    }
                    if (addedNewJob) { // new jobs have been added, now sort the job array
                        Memory.MemRooms[gameRoom.name].RoomJobs = SortObj(Memory.MemRooms[gameRoom.name].RoomJobs);
                    }
                }
            }

            // now some flag jobs might still be unplaced, loop trough them and add them maybe also create the room object
            for (const flagJobKey in flagJobs) {
                const roomName = flagJobKey.split(')').pop();
                const flagJob = flagJobs[flagJobKey];
                if (Memory.MemRooms[roomName]) {
                    if (!Memory.MemRooms[roomName].RoomJobs[flagJobKey]) {
                        Memory.MemRooms[roomName].RoomJobs[flagJobKey] = flagJob;
                    }
                } else {
                    const jobs = {};
                    jobs[flagJobKey] = flagJob;
                    CreateRoom(roomName, jobs);
                }
            }
        }

        function SortObj(map) {
            const keys = _.sortBy(_.keys(map), function (a) {
                return a;
            });
            const newmap = {};
            _.each(keys, function (k) {
                newmap[k] = map[k];
            });
            return newmap;
        }

        // jobs:

        function FillPowerSpawnEnergyJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 5000) {
                const powerSpawns = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_POWER_SPAWN;
                    }
                });
                for (const powerSpawnKey in powerSpawns) {
                    const powerSpawn = powerSpawns[powerSpawnKey];
                    if (powerSpawn && powerSpawn.store[RESOURCE_ENERGY] < powerSpawn.store.getCapacity(RESOURCE_ENERGY)) {
                        new RoomVisual(gameRoom.name).text('⚡', powerSpawn.pos.x, powerSpawn.pos.y);
                        AddJob(roomJobs, '5FillPSpwnE(' + powerSpawn.pos.x + ',' + powerSpawn.pos.y + ')' + gameRoom.name, powerSpawn.id, OBJECT_JOB, 'T');
                    }
                }
            }
        }

        function FillLabEnergyJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 5000) {
                const labs = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_LAB;
                    }
                });
                for (const labKey in labs) {
                    const lab = labs[labKey];
                    if (lab && lab.store[RESOURCE_ENERGY] < lab.store.getCapacity(RESOURCE_ENERGY)) {
                        new RoomVisual(gameRoom.name).text('⚡', lab.pos.x, lab.pos.y);
                        AddJob(roomJobs, '3FillLabE(' + lab.pos.x + ',' + lab.pos.y + ')' + gameRoom.name, lab.id, OBJECT_JOB, 'T');
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
                if (terminal && terminal.store[RESOURCE_ENERGY] < 100000 && terminal.store.getUsedCapacity() < terminal.store.getCapacity()) {
                    new RoomVisual(gameRoom.name).text('⚡', terminal.pos.x, terminal.pos.y);
                    AddJob(roomJobs, '4FillTermE(' + terminal.pos.x + ',' + terminal.pos.y + ')' + gameRoom.name, terminal.id, OBJECT_JOB, 'T');
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
                if (terminal && (terminal.store.getUsedCapacity() - terminal.store[RESOURCE_ENERGY]) < (terminal.store.getCapacity() - 100000)) {
                    let storageHasMinerals = false;
                    for (const resourceType in gameRoom.storage.store) {
                        if (gameRoom.storage.store[resourceType] > 0 && resourceType !== RESOURCE_ENERGY) {
                            storageHasMinerals = true;
                            break;
                        }
                    }
                    if (storageHasMinerals) {
                        new RoomVisual(gameRoom.name).text('⛏', terminal.pos.x, terminal.pos.y);
                        AddJob(roomJobs, '5FillTermMin(' + terminal.pos.x + ',' + terminal.pos.y + ')' + gameRoom.name, terminal.id, OBJECT_JOB, 'T');
                    }
                }
            }
        }

        function ExtractMineralJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > EXTRACTOR_WHEN_STORAGE_ENERGY || gameRoom.find(FIND_MY_CREEPS, {
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
                    AddJob(roomJobs, '5ExtrMin-' + mineral.mineralType + '(' + extractMineral.pos.x + ',' + extractMineral.pos.y + ')' + gameRoom.name, mineral.id, OBJECT_JOB, 'E');
                }
            }
        }

        function FillStorageFromRemoteJobs(gameRoom, roomJobs) {
            for (const attachedRoomKey in Memory.MemRooms[gameRoom.name].AttachedRooms) {
                if (Game.rooms[attachedRoomKey]) {
                    const fillStorageFromRemotes = Game.rooms[attachedRoomKey].find(FIND_STRUCTURES, {
                        filter: (s) => {
                            return s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity() >= 600;
                        }
                    });
                    for (const fillStorageFromRemoteKey in fillStorageFromRemotes) {
                        const fillStorageFromRemote = fillStorageFromRemotes[fillStorageFromRemoteKey];
                        const jobName = '5FillStrgFromRemote-' + fillStorageFromRemote.structureType + '(' + fillStorageFromRemote.pos.x + ',' + fillStorageFromRemote.pos.y + ')' + gameRoom.name;
                        AddJob(roomJobs, jobName, fillStorageFromRemote.id, OBJECT_JOB, 'T');
                    }
                }
            }
        }

        function FillStorageJobs(gameRoom, roomJobs) {
            const fillStorages = gameRoom.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity() >= 600)
                        || (s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] >= 600 && s.room.storage.pos.inRangeTo(s, 1))
                        || (s.structureType === STRUCTURE_TERMINAL && (s.store[RESOURCE_ENERGY] >= 120000 || gameRoom.storage.store[RESOURCE_ENERGY] < 5000));
                }
            });
            for (const fillStorageKey in fillStorages) {
                const fillStorage = fillStorages[fillStorageKey];
                new RoomVisual(gameRoom.name).text('📦', fillStorage.pos.x, fillStorage.pos.y);
                AddJob(roomJobs, '5FillStrg-' + fillStorage.structureType + '(' + fillStorage.pos.x + ',' + fillStorage.pos.y + ')' + gameRoom.name, fillStorage.id, OBJECT_JOB, 'T');
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
                AddJob(roomJobs, '4FillStrg-drp' + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.resourceType + ')' + gameRoom.name, resourceDrop.id, OBJECT_JOB, 'T');
            }
        }

        function FillTowerJobs(gameRoom, roomJobs) {
            const fillTowers = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_TOWER) && s.store[RESOURCE_ENERGY] < (s.store.getCapacity(RESOURCE_ENERGY) - 100));
                }
            });
            for (const fillTowerKey in fillTowers) {
                const fillTower = fillTowers[fillTowerKey];
                new RoomVisual(gameRoom.name).text('🗼', fillTower.pos.x, fillTower.pos.y);
                AddJob(roomJobs, '2FillTwr(' + fillTower.pos.x + ',' + fillTower.pos.y + ')' + gameRoom.name, fillTower.id, OBJECT_JOB, 'T');
            }
        }

        function FillSpawnExtensionJobs(gameRoom, roomJobs) {
            const fillSpawnExtensions = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY));
                }
            });
            for (const fillSpawnExtensionKey in fillSpawnExtensions) {
                const fillSpawnExtension = fillSpawnExtensions[fillSpawnExtensionKey];
                new RoomVisual(gameRoom.name).text('🌱', fillSpawnExtension.pos.x, fillSpawnExtension.pos.y);
                AddJob(roomJobs, '0FillSpwnEx(' + fillSpawnExtension.pos.x + ',' + fillSpawnExtension.pos.y + ')' + gameRoom.name, fillSpawnExtension.id, OBJECT_JOB, 'T');
            }
        }

        function ConstructionJobs(gameRoom, roomJobs) {
            const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES);
            for (const constructionKey in constructions) {
                const construction = constructions[constructionKey];
                new RoomVisual(gameRoom.name).text('🏗', construction.pos.x, construction.pos.y);
                AddJob(roomJobs, '2Constr-' + construction.structureType + '(' + construction.pos.x + ',' + construction.pos.y + ')' + gameRoom.name, construction.id, OBJECT_JOB, 'B');
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
                                && (gameRoom.controller.level < 8 && s.hits < RAMPART_WALL_HITS_U_LVL8 || gameRoom.controller.level === 8 && (s.hits < RAMPART_WALL_HITS_O_LVL8 || gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > RAMPART_WALL_MAX_HITS_WHEN_STORAGE_ENERGY))
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
                AddJob(roomJobs, '3Rep-' + repair.structureType + '(' + repair.pos.x + ',' + repair.pos.y + ')' + gameRoom.name, repair.id, OBJECT_JOB, 'B');
            }
        }

        // util:

        function CreateRoom(roomName, jobs) {
            const gameRoom = Game.rooms[roomName];
            let level = -1;
            let sourceNumber = -1;
            if (gameRoom) {
                level = gameRoom.controller.level;
                sourceNumber = gameRoom.find(FIND_SOURCES).length;
            }
            Memory.MemRooms[roomName] = {
                'RoomLevel': level,
                'RoomJobs': jobs,
                'MaxCreeps': {},
                'SourceNumber': sourceNumber,
                'AttachedRooms': {},
            };
            console.log('CreateJobs CreateRoom add new room ' + roomName + ' level ' + level + ' sourceNumber ' + sourceNumber + ' jobs ' + JSON.stringify(jobs))
        }

        function AddJob(roomJobs, jobName, jobId, jobType, creepType) {
            roomJobs[jobName] = CreateJob(jobId, jobType, creepType);
        }

        function CreateJob(jobId, jobType, creepType) {
            return {
                'JobId': jobId,
                'JobType': jobType,
                'CreepType': creepType,
                'Creep': 'vacant'
            };
        }
    }
};
module.exports = CreateJobs;