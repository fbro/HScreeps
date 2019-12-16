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

        // job type int enum
        const OBJECT_JOB = 1;
        const FLAG_JOB = 2;

        const EXTRACTOR_WHEN_STORAGE_ENERGY = 50000;
        const RAMPART_WALL_HITS_U_LVL8 = 100000;
        const RAMPART_WALL_HITS_O_LVL8 = 2000000;
        const RAMPART_WALL_MAX_HITS_WHEN_STORAGE_ENERGY = 600000;

        let flagJobs = CreateFlagJobs();
        CreateObjJobs(flagJobs);

        // this method is not just run in the Game.rooms loop because flags may be in 'invisible' rooms
        function CreateFlagJobs() {
            let jobs = {};
            let notFound = false;
            for (const gameFlagKey in Game.flags) {
                const gameFlag = Game.flags[gameFlagKey];
                const color = gameFlag.color;
                const secColor = gameFlag.secondaryColor;
                if (color === COLOR_ORANGE) {
                    if (secColor === COLOR_ORANGE) { // scout tag
                        jobs = CreateFlagJob(jobs, '4TagCtrl', gameFlagKey, gameFlag, 'S');
                    } else if (secColor === COLOR_YELLOW) { // scout at pos
                        jobs = CreateFlagJob(jobs, '5ScoutPos', gameFlagKey, gameFlag, 'S');
                    } else if (secColor === COLOR_RED) { // flag to be placed on an observer that enables it to scan for power banks and deposits
                        // observers handle this flag
                    } else if (secColor === COLOR_PURPLE) { // flag that observers create and put on found power banks and deletes again when deadline is reached
                        jobs = PowerBankJobs(jobs, gameFlagKey, gameFlag);
                    } else if (secColor === COLOR_CYAN) { // flag that observers create and put on deposits and deletes again when deadline is reached
                        jobs = CreateFlagJob(jobs, '5HrvstDpst', gameFlagKey, gameFlag, 'D');
                    } else {
                        notFound = true;
                    }
                } else if (color === COLOR_RED) {
                    if (secColor === COLOR_RED) { // warrior at pos
                        jobs = CreateFlagJob(jobs, '2GuardPos', gameFlagKey, gameFlag, 'W')
                    } else if (secColor === COLOR_BLUE) { // gunner at pos
                        jobs = CreateFlagJob(jobs, '2GuardGunPos', gameFlagKey, gameFlag, 'G')
                    } else if (secColor === COLOR_GREEN) { // medic at pos
                        jobs = CreateFlagJob(jobs, '2GuardMedPos', gameFlagKey, gameFlag, 'M')
                    } else {
                        notFound = true;
                    }
                } else if (color === COLOR_YELLOW) {
                    if (secColor === COLOR_YELLOW) { // distantHarvester on source at flag pos
                        jobs = CreateFlagJob(jobs, '5RemoteHarvest', gameFlagKey, gameFlag, 'D');
                    } else if (secColor === COLOR_GREEN) { // harvester move to pos
                        jobs = CreateFlagJob(jobs, '2HarvestPos', gameFlagKey, gameFlag, 'H');
                        jobs = CreateFlagJob(jobs, '2TransPos', gameFlagKey, gameFlag, 'T');
                        jobs = CreateFlagJob(jobs, '2BuildPos', gameFlagKey, gameFlag, 'B');
                    }
                } else if (color === COLOR_PURPLE) {
                    if (secColor === COLOR_PURPLE) { // FillLabMineral
                        jobs = FillLabMineralJobs(jobs, gameFlagKey, gameFlag);
                    } else if (secColor === COLOR_WHITE) { // EmptyLabMineral
                        jobs = EmptyLabMineralJobs(jobs, gameFlagKey, gameFlag);
                    } else {
                        notFound = true;
                    }
                } else if (color === COLOR_GREEN) {
                    if (secColor === COLOR_GREEN) { // claimer claim
                        jobs = CreateFlagJob(jobs, '1ClaimCtrl', gameFlagKey, gameFlag, 'C');
                    } else if (secColor === COLOR_YELLOW) { // claimer reserve
                        jobs = ReserveRoomJobs(jobs, gameFlagKey, gameFlag);
                    } else if (secColor === COLOR_ORANGE) { // claimer move to pos - used when one wants to enter a portal
                        jobs = CreateFlagJob(jobs, '2ClaimPos', gameFlagKey, gameFlag, 'C');
                    } else {
                        notFound = true;
                    }
                } else {
                    notFound = true;
                }
                if (notFound) {
                    Logs.Error('CreateJobs CreateFlagJobs flag color not found', gameFlagKey + ' ' + gameFlag.color + ' ' + gameFlag.secondaryColor + ' (' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')');
                }
            }
            return jobs;
        }

        function CreateFlagJob(jobs, jobName, gameFlagKey, gameFlag, creepType) {
            //console.log('CreateJobs CreateFlagJobs AddJob ' + gameFlagKey);
            return AddJob(jobs, jobName + '-' + gameFlagKey + '(' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')' + gameFlag.pos.roomName, gameFlagKey, FLAG_JOB, creepType);
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
                        if (gameRoom.controller.level < 3) {
                            const freeSpaces = FreeSpaces(source.pos);
                            if (freeSpaces > 1) {
                                AddJob(jobs, '5Src(' + source.pos.x + ',' + source.pos.y + ')' + gameRoom.name, source.id, OBJECT_JOB, 'H');
                            }
                        }
                    }
                    // Controller
                    new RoomVisual(gameRoom.name).text('🧠', gameRoom.controller.pos.x, gameRoom.controller.pos.y);
                    AddJob(jobs, '0Ctrl(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B');
                    if (!gameRoom.storage || gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] > 100000 && gameRoom.controller.level < 8) {
                        AddJob(jobs, '8Ctrl(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B');
                        AddJob(jobs, '9Ctrl(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B');
                    }
                    // FillSpawnExtension
                    FillSpawnExtensionJobs(gameRoom, jobs);
                    // Construction
                    ConstructionJobs(gameRoom, jobs);
                    // Repair
                    RepairJobs(gameRoom, jobs);
                    // FillControllerContainer
                    FillControllerContainerJobs(gameRoom, jobs);
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
                                    // FillTerminal
                                    FillTerminalJobs(gameRoom, jobs);
                                    // FillFactory
                                    FillFactoryJobs(gameRoom, jobs);
                                    // FillLabEnergy
                                    FillLabEnergyJobs(gameRoom, jobs);
                                    if (gameRoom.controller.level === 8) {
                                        FillPowerSpawnEnergyJobs(gameRoom, jobs);
                                        FillPowerSpawnPowerJobs(gameRoom, jobs);
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
                            //console.log('CreateJobs CreateObjJobs new job added ' + newJobKey);
                            addedNewJob = true;
                        }
                    }
                    // remove only old disappeared vacant jobs
                    for (const oldJobKey in Memory.MemRooms[gameRoom.name].RoomJobs) { // loop through old jobs
                        const oldJob = Memory.MemRooms[gameRoom.name].RoomJobs[oldJobKey];
                        if (oldJob.Creep === 'vacant' && !jobs[oldJobKey]) { // old job is vacant and old job id not in the new job array
                            Memory.MemRooms[gameRoom.name].RoomJobs[oldJobKey] = undefined; // delete old vacant disappeared job
                            //console.log('CreateJobs CreateObjJobs old job deleted ' + oldJobKey);
                        }
                    }
                    if (gameRoom.controller && Memory.MemRooms[gameRoom.name].RoomLevel !== gameRoom.controller.level) { // room level change
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

        // flag jobs:

        function PowerBankJobs(jobs, gameFlagKey, gameFlag) {
            if (gameFlag.room) { // power bank on low health - get transporters over to the power bank
                const powerBank = gameFlag.pos.lookFor(LOOK_STRUCTURES)[0];
                const droppedPower = gameFlag.room.find(FIND_DROPPED_RESOURCES, {
                    filter: (d) => {
                        return d.resourceType === RESOURCE_POWER;
                    }
                })[0];
                if (powerBank) {
                    jobs = CreateFlagJob(jobs, '3AtkP1', gameFlagKey, gameFlag, 'W');
                    jobs = CreateFlagJob(jobs, '3AtkP2', gameFlagKey, gameFlag, 'W');
                    jobs = CreateFlagJob(jobs, '3MedP1', gameFlagKey, gameFlag, 'M');
                    jobs = CreateFlagJob(jobs, '3MedP2', gameFlagKey, gameFlag, 'M');
                }
                if ((powerBank && powerBank.hits < 250000) || droppedPower) {
                    jobs = CreateFlagJob(jobs, '1TrnsprtP1', gameFlagKey, gameFlag, 'T');
                    console.log('CreateJobs PowerBankJobs 1TrnsprtP1 ' + gameFlag.room.name);
                    if ((powerBank && powerBank.hits > 1000) || (droppedPower && droppedPower.amount > 800)) {
                        jobs = CreateFlagJob(jobs, '1TrnsprtP2', gameFlagKey, gameFlag, 'T');
                        console.log('CreateJobs PowerBankJobs 1TrnsprtP2 ' + gameFlag.room.name);
                        if ((powerBank && powerBank.hits > 2000) || (droppedPower && droppedPower.amount > 1500)) {
                            jobs = CreateFlagJob(jobs, '1TrnsprtP3', gameFlagKey, gameFlag, 'T');
                            console.log('CreateJobs PowerBankJobs 1TrnsprtP3 ' + gameFlag.room.name);
                            if ((powerBank && powerBank.hits > 3000) || (droppedPower && droppedPower.amount > 2900)) {
                                jobs = CreateFlagJob(jobs, '1TrnsprtP4', gameFlagKey, gameFlag, 'T');
                                console.log('CreateJobs PowerBankJobs 1TrnsprtP4 ' + gameFlag.room.name);
                            }
                        }
                    }
                }
            } else { // create the jobs if the room is invisible - not needed if the observer is looking at the room at all ticks
                jobs = CreateFlagJob(jobs, '3AtkP1', gameFlagKey, gameFlag, 'W');
                jobs = CreateFlagJob(jobs, '3AtkP2', gameFlagKey, gameFlag, 'W');
                jobs = CreateFlagJob(jobs, '3MedP1', gameFlagKey, gameFlag, 'M');
                jobs = CreateFlagJob(jobs, '3MedP2', gameFlagKey, gameFlag, 'M');
            }
            return jobs;
        }

        function EmptyLabMineralJobs(jobs, gameFlagKey, gameFlag) {
            if (!gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_LAB;
                }
            })) { // flag must be on top of an existing lab!
                gameFlag.remove();
                Logs.Error('CreateJobs CreateFlagJobs lab gone', gameFlagKey);
            } else if (gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_LAB;
                }
            })[0].mineralAmount > 0) {
                // flagname rules: CREATE-GH = CREATE the mineral from the nearby lab to this lab
                CreateFlagJob(jobs, '5EmptyLabMin', gameFlagKey, gameFlag, 'T');
            }
            return jobs;
        }

        function FillLabMineralJobs(jobs, gameFlagKey, gameFlag) {
            if (!gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_LAB;
                }
            })) { // flag must be on top of an existing lab!
                gameFlag.remove();
                Logs.Error('CreateJobs CreateFlagJobs lab gone', gameFlagKey);
            } else if (gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_LAB;
                }
            })[0].mineralAmount < LAB_MINERAL_CAPACITY) {
                // flagname rules: GET-L = get lemergium from all rooms, BUY-L = get it from all rooms or then buy it from the terminal
                jobs = CreateFlagJob(jobs, '6FillLabMin', gameFlagKey, gameFlag, 'T');
            }
            return jobs;
        }

        function ReserveRoomJobs(jobs, gameFlagKey, gameFlag) {
            if (!gameFlag.room
                || !gameFlag.room.controller.reservation
                || !Memory.MemRooms[gameFlag.pos.roomName]
                || Memory.MemRooms[gameFlag.pos.roomName].RoomJobs['4ReserveCtrl-' + gameFlagKey + '(' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')' + gameFlag.pos.roomName]
                || (gameFlag.room.controller.reservation.ticksToEnd < 2500 && !Memory.MemRooms[gameFlag.pos.roomName].RoomJobs[gameFlagKey])) { // extra logic to try and optimize creep not being idle
                jobs = CreateFlagJob(jobs, '4ReserveCtrl', gameFlagKey, gameFlag, 'R');
            }
            return jobs;
        }

        // in-room jobs:

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
                        AddJob(roomJobs, '3FillPSpwnE(' + powerSpawn.pos.x + ',' + powerSpawn.pos.y + ')' + gameRoom.name, powerSpawn.id, OBJECT_JOB, 'T');
                    }
                }
            }
        }

        function FillPowerSpawnPowerJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store[RESOURCE_POWER] > 0 || gameRoom.terminal && gameRoom.terminal.store[RESOURCE_POWER] > 0) {
                const powerSpawn = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_POWER_SPAWN;
                    }
                })[0];
                if (powerSpawn && powerSpawn.store.getFreeCapacity(RESOURCE_POWER) > 0) {
                    new RoomVisual(gameRoom.name).text('🌪️', powerSpawn.pos.x, powerSpawn.pos.y);
                    AddJob(roomJobs, '3FillPSpwnP(' + powerSpawn.pos.x + ',' + powerSpawn.pos.y + ')' + gameRoom.name, powerSpawn.id, OBJECT_JOB, 'T');
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

        function FillTerminalJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.terminal) {
                for (const resourceType in gameRoom.storage.store) {
                    const storageResourceAmount = gameRoom.storage.store[resourceType];
                    let maxResources = 3000;
                    if (resourceType === RESOURCE_ENERGY) {
                        if (storageResourceAmount >= 200000) {
                            maxResources = 100000;
                        } else if (storageResourceAmount >= 100000) {
                            maxResources = 80000;
                        } else if (storageResourceAmount >= 50000) {
                            maxResources = 50000;
                        }
                    } else if (storageResourceAmount >= 5000) {
                        maxResources = 5000;
                    }
                    if (gameRoom.terminal.store[resourceType] < maxResources) {
                        AddJob(roomJobs, '5FillTerm(' + resourceType + ')' + gameRoom.name, gameRoom.terminal.id, OBJECT_JOB, 'T');
                    }
                }
            }
        }

        function FillFactoryJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.terminal) {
                const factory = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_FACTORY;
                    }
                })[0];
                if(factory){
                    if(factory.store.getUsedCapacity(RESOURCE_ENERGY) < 10000){
                        AddJob(roomJobs, '5FillFctr(' + RESOURCE_ENERGY + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
                    }
                    if(gameRoom.storage.store.getUsedCapacity(RESOURCE_BIOMASS) > 0 || gameRoom.terminal.store.getUsedCapacity(RESOURCE_BIOMASS) > 0) {
                        if(factory.store.getUsedCapacity(RESOURCE_BIOMASS) < 2000) {
                            AddJob(roomJobs, '5FillFctr(' + RESOURCE_BIOMASS + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
                        }
                        if(factory.store.getUsedCapacity(RESOURCE_LEMERGIUM) < 2000 && (gameRoom.storage.store.getUsedCapacity(RESOURCE_LEMERGIUM) > 0 || gameRoom.terminal.store.getUsedCapacity(RESOURCE_LEMERGIUM) > 0)) {
                            AddJob(roomJobs, '5FillFctr(' + RESOURCE_LEMERGIUM + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
                        }
                        if(factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) < 2000 && (gameRoom.storage.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) > 0 || gameRoom.terminal.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) > 0)) {
                            AddJob(roomJobs, '5FillFctr(' + RESOURCE_LEMERGIUM_BAR + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
                        }
                        if(factory.store.getUsedCapacity(RESOURCE_CELL) < 2000 && (gameRoom.storage.store.getUsedCapacity(RESOURCE_CELL) > 0 || gameRoom.terminal.store.getUsedCapacity(RESOURCE_CELL) > 0)) {
                            AddJob(roomJobs, '5FillFctr(' + RESOURCE_CELL + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
                        }
                        if(factory.store.getUsedCapacity(RESOURCE_CELL) > 0 && factory.level === 1) {
                            if(factory.store.getUsedCapacity(RESOURCE_OXYGEN) < 2000 && (gameRoom.storage.store.getUsedCapacity(RESOURCE_OXYGEN) > 0 || gameRoom.terminal.store.getUsedCapacity(RESOURCE_OXYGEN) > 0)) {
                                AddJob(roomJobs, '5FillFctr(' + RESOURCE_OXYGEN + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
                            }
                            if(factory.store.getUsedCapacity(RESOURCE_OXIDANT) < 2000 && (gameRoom.storage.store.getUsedCapacity(RESOURCE_OXIDANT) > 0 || gameRoom.terminal.store.getUsedCapacity(RESOURCE_OXIDANT) > 0)) {
                                AddJob(roomJobs, '5FillFctr(' + RESOURCE_OXIDANT + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
                            }
                        }
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
            if(gameRoom.storage.store.getFreeCapacity() < 5000){
                Logs.Warning('CreateJobs FillStorageJobs storage full!', gameRoom.name);
                return;
            }
            const fillStorages = gameRoom.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_CONTAINER && Memory.MemRooms[gameRoom.name] && s.id !== Memory.MemRooms[gameRoom.name].CtrlConId && s.store.getUsedCapacity() >= 600) // do not take the controller container into account here
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
                AddJob(roomJobs, '5FillStrg-drp' + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.resourceType + ')' + gameRoom.name, resourceDrop.id, OBJECT_JOB, 'T');
            }
            // Tombstone is also a little bit different - but same kind of job as above
            const tombstoneDrops = gameRoom.find(FIND_TOMBSTONES, {
                filter: (tombstone) => {
                    return tombstone.store.getUsedCapacity() > 0;
                }
            });
            for (const tombstoneDropKey in tombstoneDrops) {
                const tombstoneDrop = tombstoneDrops[tombstoneDropKey];
                new RoomVisual(gameRoom.name).text('⚰', tombstoneDrop.pos.x, tombstoneDrop.pos.y);
                AddJob(roomJobs, '5FillStrg-tmb' + '(' + tombstoneDrop.pos.x + ',' + tombstoneDrop.pos.y + ')' + gameRoom.name, tombstoneDrop.id, OBJECT_JOB, 'T');
            }
            // Ruin is also a little bit different - but same kind of job as above
            const ruinDrops = gameRoom.find(FIND_RUINS, {
                filter: (ruin) => {
                    return ruin.store.getUsedCapacity() > 0;
                }
            });
            for (const ruinDropKey in ruinDrops) {
                const ruinDrop = ruinDrops[ruinDropKey];
                new RoomVisual(gameRoom.name).text('', ruinDrop.pos.x, ruinDrop.pos.y);
                AddJob(roomJobs, '5FillStrg-ruin' + '(' + ruinDrop.pos.x + ',' + ruinDrop.pos.y + ')' + gameRoom.name, ruinDrop.id, OBJECT_JOB, 'T');
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

        function FillControllerContainerJobs(gameRoom, roomJobs) {
            let controllerContainer;
            if (Memory.MemRooms[gameRoom.name] && Memory.MemRooms[gameRoom.name].CtrlConId) {
                controllerContainer = Game.getObjectById(Memory.MemRooms[gameRoom.name].CtrlConId);
                if (!controllerContainer) {
                    console.log('CreateJobs FillControllerContainerJobs removed container id from mem' + gameRoom.name);
                    Memory.MemRooms[gameRoom.name].CtrlConId = undefined;
                }
            }
            if (!controllerContainer && Memory.MemRooms[gameRoom.name]) {
                controllerContainer = gameRoom.controller.pos.findInRange(FIND_STRUCTURES, 3, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity() > 0;
                    }
                })[0];
                if (controllerContainer) {
                    console.log('CreateJobs FillControllerContainerJobs found new container (' + controllerContainer.pos.x + ',' + controllerContainer.pos.y + ',' + controllerContainer.pos.roomName + ') saving in memory');
                    Memory.MemRooms[gameRoom.name].CtrlConId = controllerContainer.id;
                }
            }
            if (controllerContainer) {
                new RoomVisual(gameRoom.name).text('🔋', controllerContainer.pos.x, controllerContainer.pos.y);
                AddJob(roomJobs, '2FillCtrlCon(' + controllerContainer.pos.x + ',' + controllerContainer.pos.y + ')' + gameRoom.name, controllerContainer.id, OBJECT_JOB, 'T');
            }
        }

        // util:

        function CreateRoom(roomName, jobs) {
            const gameRoom = Game.rooms[roomName];
            let level = -1;
            let sourceNumber = -1;
            if (gameRoom) {
                if (gameRoom.controller) {
                    level = gameRoom.controller.level;
                }
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
            return roomJobs;
        }

        function CreateJob(jobId, jobType, creepType) {
            return {
                'JobId': jobId,
                'JobType': jobType,
                'CreepType': creepType,
                'Creep': 'vacant'
            };
        }


        /**@return {number}*/
        function FreeSpaces(pos) { // get the number of free spaces around a pos
            let freeSpaces = 0;
            const terrain = Game.map.getRoomTerrain(pos.roomName);
            for (let x = pos.x - 1; x <= pos.x + 1; x++) {
                for (let y = pos.y - 1; y <= pos.y + 1; y++) {
                    const t = terrain.get(x, y);
                    if (t === 0 && (pos.x !== x || pos.y !== y)) {
                        freeSpaces++;
                    }
                }
            }
            return freeSpaces;
        }
    }
};
module.exports = CreateJobs;