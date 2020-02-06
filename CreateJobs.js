let Util = require('Util');
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
        //       Creep - CreepName - H1 or B4... - if job is not taken then the value is vacant

        // job type int enum
        const OBJECT_JOB = 1;
        const FLAG_JOB = 2;

        const DO_EXTRACTOR_WHEN_STORAGE_OVER_ENERGY = 50000;
        const DO_EXTRACTOR_WHEN_STORAGE_UNDER_MINERAL = 150000;
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
                if (color === COLOR_ORANGE) { // scout and pos actions and hallway action
                    if (secColor === COLOR_ORANGE) { // scout tag
                        jobs = CreateFlagJob(jobs, '4TagCtrl', gameFlagKey, gameFlag, 'S');
                    } else if (secColor === COLOR_YELLOW) { // scout at pos
                        jobs = CreateFlagJob(jobs, '5ScoutPos', gameFlagKey, gameFlag, 'S');
                    } else if (secColor === COLOR_RED) { // flag to be placed on an observer that enables it to scan for power banks and deposits
                        // observers handle this flag
                    } else if (secColor === COLOR_PURPLE) { // flag that observers create and put on found power banks and deletes again when deadline is reached
                        jobs = PowerBankJobs(jobs, gameFlagKey, gameFlag);
                    } else if (secColor === COLOR_GREY) { // flag that is created for each transporter that should fetch the power
                        jobs = CreateFlagJob(jobs, '1TrnsprtP', gameFlagKey, gameFlag, 'T');
                    } else if (secColor === COLOR_CYAN) { // flag that observers create and put on deposits and deletes again when deadline is reached
                        jobs = CreateFlagJob(jobs, '5HrvstDpst', gameFlagKey, gameFlag, 'D');
                    } else if (secColor === COLOR_GREEN) { // harvester, transporter and builder move to pos
                        jobs = CreateFlagJob(jobs, '2HarvestPos', gameFlagKey, gameFlag, 'H');
                        jobs = CreateFlagJob(jobs, '2TransPos', gameFlagKey, gameFlag, 'T');
                        jobs = CreateFlagJob(jobs, '2BuildPos', gameFlagKey, gameFlag, 'B');
                    } else {
                        notFound = true;
                    }
                } else if (color === COLOR_RED) { // aggressive jobs
                    if (secColor === COLOR_RED) { // warrior at pos
                        jobs = CreateFlagJob(jobs, '2GuardPos', gameFlagKey, gameFlag, 'W');
                    } else if (secColor === COLOR_BLUE) { // gunner at pos
                        jobs = CreateFlagJob(jobs, '2GuardGunPos', gameFlagKey, gameFlag, 'G');
                    } else if (secColor === COLOR_GREEN) { // medic at pos
                        jobs = CreateFlagJob(jobs, '2GuardMedPos', gameFlagKey, gameFlag, 'M');
                    } else {
                        notFound = true;
                    }
                } else if (color === COLOR_YELLOW) { // energy actions
                    notFound = true;
                } else if (color === COLOR_PURPLE) { // lab actions
                    if (secColor === COLOR_PURPLE) { // FillLabMineral
                        jobs = FillLabMineralJobs(jobs, gameFlagKey, gameFlag);
                    } else if (secColor === COLOR_WHITE) { // EmptyLabMineral
                        jobs = EmptyLabMineralJobs(jobs, gameFlagKey, gameFlag);
                    } else {
                        notFound = true;
                    }
                } else if (color === COLOR_GREEN) { // claimer actions
                    if (secColor === COLOR_GREEN) { // claimer claim
                        jobs = CreateFlagJob(jobs, '1ClaimCtrl', gameFlagKey, gameFlag, 'C');
                    } else if (secColor === COLOR_YELLOW) { // claimer reserve
                        jobs = ReserveRoomJobs(jobs, gameFlagKey, gameFlag);
                    } else if (secColor === COLOR_ORANGE) { // claimer move to pos - used when one wants to enter a portal
                        jobs = CreateFlagJob(jobs, '2ClaimPos', gameFlagKey, gameFlag, 'C');
                    } else {
                        notFound = true;
                    }
                } else if (color === COLOR_BLUE) { // power creep actions
                    if (secColor === COLOR_ORANGE) {
                        // PowerCreeps spawn based on flag name = power creep name
                    } else {
                        notFound = true;
                    }
                } else {
                    notFound = true;
                }
                if (notFound) {
                    Util.ErrorLog('CreateJobs', 'CreateFlagJobs', 'flag color not found ' + gameFlagKey + ' ' + gameFlag.color + ' ' + gameFlag.secondaryColor + ' (' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')');
                }
            }
            return jobs;
        }

        function CreateFlagJob(jobs, jobName, gameFlagKey, gameFlag, creepType) {
            //Util.Info('CreateJobs', 'CreateFlagJob', 'AddJob ' + gameFlagKey);
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
                        //Util.Info('CreateJobs', 'CreateObjJobs', 'flagJobs found in ' + gameRoomKey + ' ' + flagJobKey + ' ' + JSON.stringify(jobs[flagJobKey]) + ' length ' + Object.keys(jobs).length);
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
                            const freeSpaces = Util.FreeSpaces(source.pos);
                            if (freeSpaces > 1) {
                                AddJob(jobs, '5Src(' + source.pos.x + ',' + source.pos.y + ')' + gameRoom.name, source.id, OBJECT_JOB, 'H');
                            }
                        }
                    }
                    // Controller
                    new RoomVisual(gameRoom.name).text('🧠', gameRoom.controller.pos.x, gameRoom.controller.pos.y);
                    if(!gameRoom.storage || gameRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 10000 || gameRoom.controller.ticksToDowngrade < 20000){
                        AddJob(jobs, '0Ctrl(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, OBJECT_JOB, 'B');
                    }
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
                            //Util.Info('CreateJobs', 'CreateObjJobs', 'new job added ' + newJobKey);
                            addedNewJob = true;
                        }
                    }
                    // remove only old disappeared vacant jobs
                    for (const oldJobKey in Memory.MemRooms[gameRoom.name].RoomJobs) { // loop through old jobs
                        const oldJob = Memory.MemRooms[gameRoom.name].RoomJobs[oldJobKey];
                        if (oldJob.Creep === 'vacant' && !jobs[oldJobKey]) { // old job is vacant and old job id not in the new job array
                            Memory.MemRooms[gameRoom.name].RoomJobs[oldJobKey] = undefined; // delete old vacant disappeared job
                            //Util.Info('CreateJobs', 'CreateObjJobs', 'old job deleted ' + oldJobKey);
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
            jobs = CreateFlagJob(jobs, '3AtkP1', gameFlagKey, gameFlag, 'W');
            jobs = CreateFlagJob(jobs, '3AtkP2', gameFlagKey, gameFlag, 'W');
            jobs = CreateFlagJob(jobs, '3MedP1', gameFlagKey, gameFlag, 'M');
            jobs = CreateFlagJob(jobs, '3MedP2', gameFlagKey, gameFlag, 'M');
            return jobs;
        }

        function EmptyLabMineralJobs(jobs, gameFlagKey, gameFlag) {
            if (!gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_LAB;
                }
            })) { // flag must be on top of an existing lab!
                gameFlag.remove();
                Util.ErrorLog('CreateJobs', 'CreateFlagJobs', 'lab gone ' + gameFlagKey);
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
                Util.ErrorLog('CreateJobs', 'CreateFlagJobs', 'lab gone ' + gameFlagKey);
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
                    let maxResources = 0;
                    let High = Util.TERMINAL_STORAGE_HIGH;
                    let HighTransfer = Util.TERMINAL_STORAGE_HIGH_TRANSFER;
                    let Medium = Util.TERMINAL_STORAGE_MEDIUM;
                    let MediumTransfer = Util.TERMINAL_STORAGE_MEDIUM_TRANSFER;
                    let Low = Util.TERMINAL_STORAGE_LOW;
                    let LowTransfer = Util.TERMINAL_STORAGE_LOW_TRANSFER;
                    if (resourceType === RESOURCE_ENERGY) {
                        High = Util.TERMINAL_STORAGE_ENERGY_HIGH;
                        HighTransfer = Util.TERMINAL_STORAGE_ENERGY_HIGH_TRANSFER;
                        Medium = Util.TERMINAL_STORAGE_ENERGY_MEDIUM;
                        MediumTransfer = Util.TERMINAL_STORAGE_ENERGY_MEDIUM_TRANSFER;
                        Low = Util.TERMINAL_STORAGE_ENERGY_LOW;
                        LowTransfer = Util.TERMINAL_STORAGE_ENERGY_LOW_TRANSFER;
                    }
                    // if storage contains alot of the specified resource then allow the terminal to be filled to an extent where it will sell out
                    if (storageResourceAmount >= High) {
                        maxResources = HighTransfer;
                    } else if (storageResourceAmount >= Medium) {
                        maxResources = MediumTransfer;
                    } else if (storageResourceAmount >= Low) {
                        maxResources = LowTransfer;
                    }
                    if (gameRoom.terminal.store[resourceType] < maxResources) {
                        if(resourceType === RESOURCE_ENERGY){
                            AddJob(roomJobs, '2FillTerm(' + resourceType + ')' + gameRoom.name, gameRoom.terminal.id, OBJECT_JOB, 'T');
                        }else{
                            AddJob(roomJobs, '5FillTerm(' + resourceType + ')' + gameRoom.name, gameRoom.terminal.id, OBJECT_JOB, 'T');
                        }
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
                if (factory) {
                    if (factory.store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
                        AddJob(roomJobs, '5FillFctr(' + RESOURCE_ENERGY + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
                    }
                    // Biological chain
                    if (gameRoom.storage.store.getUsedCapacity(RESOURCE_BIOMASS) > 0
                        || gameRoom.terminal.store.getUsedCapacity(RESOURCE_BIOMASS) > 0
                        || factory.store.getUsedCapacity(RESOURCE_BIOMASS) > 0
                        || factory.store.getUsedCapacity(RESOURCE_CELL) > 0) {
                        roomJobs = AddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_BIOMASS);
                        roomJobs = AddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_LEMERGIUM);
                        roomJobs = AddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_LEMERGIUM_BAR);
                        roomJobs = AddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_CELL);
                        if (factory.store.getUsedCapacity(RESOURCE_CELL) > 0 && factory.level === 1) { // level 1 specific
                            roomJobs = AddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_OXYGEN);
                            roomJobs = AddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_OXIDANT);
                        }else if(factory.store.getUsedCapacity(RESOURCE_PHLEGM) > 0 && factory.level === 2){ // level 2 specific
                            roomJobs = AddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_HYDROGEN);
                            roomJobs = AddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_REDUCTANT);
                            roomJobs = AddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_PHLEGM);
                        }
                    }
                }
            }
            return roomJobs;
        }

        function AddFillFactoryJob(gameRoom, factory, roomJobs, resource) {
            if (factory.store.getUsedCapacity(resource) < 2000 && (gameRoom.storage.store.getUsedCapacity(resource) > 0 || gameRoom.terminal.store.getUsedCapacity(resource) > 0)) {
                roomJobs = AddJob(roomJobs, '5FillFctr(' + resource + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
            }
            return roomJobs;
        }

        function ExtractMineralJobs(gameRoom, roomJobs) {
            const mineral = gameRoom.find(FIND_MINERALS, {
                filter: (s) => {
                    return s.mineralAmount > 0;
                }
            })[0];
            if (mineral && gameRoom.storage && (gameRoom.storage.store[RESOURCE_ENERGY] > DO_EXTRACTOR_WHEN_STORAGE_OVER_ENERGY && gameRoom.storage.store[mineral.mineralType] < DO_EXTRACTOR_WHEN_STORAGE_UNDER_MINERAL
                || gameRoom.find(FIND_MY_CREEPS, {
                    filter: (c) => {
                        return c.name.startsWith('E');
                    }
                })[0]
            )) { // only create these jobs when one has energy in the room
                const extractMineral = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_EXTRACTOR;
                    }
                })[0];
                if (extractMineral) {
                    new RoomVisual(gameRoom.name).text('⛏', extractMineral.pos.x, extractMineral.pos.y);
                    AddJob(roomJobs, '5ExtrMin-' + mineral.mineralType + '(' + extractMineral.pos.x + ',' + extractMineral.pos.y + ')' + gameRoom.name, mineral.id, OBJECT_JOB, 'E');
                }
            }
        }

        function FillStorageJobs(gameRoom, roomJobs) {
            if (gameRoom.storage.store.getFreeCapacity() < 5000) {
                Util.Warning('CreateJobs', 'FillStorageJobs', 'storage full! ' + gameRoom.name);
                return;
            }

            // container
            const containers = gameRoom.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_CONTAINER && Memory.MemRooms[gameRoom.name]);
                }
            });
            for (const containerKey in containers) {
                const container = containers[containerKey];
                new RoomVisual(gameRoom.name).text('📦', container.pos.x, container.pos.y);
                for (const resourceType in container.store) {
                    if (container.id !== Memory.MemRooms[gameRoom.name].CtrlConId && container.store.getUsedCapacity() >= 600 || resourceType !== RESOURCE_ENERGY) { // do not empty the controller container for energy
                        AddJob(roomJobs, '5FillStrg-' + container.structureType + '(' + container.pos.x + ',' + container.pos.y + ',' + resourceType + ')' + gameRoom.name, container.id, OBJECT_JOB, 'T');
                    }
                }
            }

            // link
            const link = gameRoom.storage.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                filter: (s) => {
                    return s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] >= 600;
                }
            })[0];
            if (link) {
                AddJob(roomJobs, '5FillStrg-' + link.structureType + '(' + link.pos.x + ',' + link.pos.y + ',' + RESOURCE_ENERGY + ')' + gameRoom.name, link.id, OBJECT_JOB, 'T');
            }

            // terminal
            if (gameRoom.terminal && (gameRoom.terminal.store[RESOURCE_ENERGY] >= 120000 || gameRoom.storage.store[RESOURCE_ENERGY] < 5000)) {
                AddJob(roomJobs, '5FillStrg-' + gameRoom.terminal.structureType + '(' + gameRoom.terminal.pos.x + ',' + gameRoom.terminal.pos.y + ',' + RESOURCE_ENERGY + ')' + gameRoom.name, gameRoom.terminal.id, OBJECT_JOB, 'T');
            }

            // factory
            const factory = gameRoom.find(FIND_STRUCTURES, {
                filter: (f) => {
                    return f.structureType === STRUCTURE_FACTORY;
                }
            })[0];
            if (factory) {
                for (const resourceType in factory.store) {
                    if (resourceType === RESOURCE_PHLEGM && factory.store[resourceType] > 1000 && factory.level === 1
                        || resourceType === RESOURCE_TISSUE && factory.store[resourceType] > 1000 && factory.level === 2
                        || resourceType === RESOURCE_MUSCLE && factory.store[resourceType] > 1000 && factory.level === 3
                        || resourceType === RESOURCE_ORGANOID && factory.store[resourceType] > 1000 && factory.level === 4
                        || resourceType === RESOURCE_ORGANISM && factory.store[resourceType] > 1000 && factory.level === 5) {
                        new RoomVisual(gameRoom.name).text('🏭', factory.pos.x, factory.pos.y);
                        AddJob(roomJobs, '5FillStrg-' + factory.structureType + '(' + factory.pos.x + ',' + factory.pos.y + ',' + resourceType + ')' + gameRoom.name, factory.id, OBJECT_JOB, 'T');
                    }
                }
            }

            // drop
            const resourceDrops = gameRoom.find(FIND_DROPPED_RESOURCES, {
                filter: (drop) => {
                    return (drop.resourceType === RESOURCE_ENERGY && drop.amount > 100 || drop.resourceType !== RESOURCE_ENERGY && drop.amount > 30);
                }
            });
            for (const resourceDropKey in resourceDrops) {
                const resourceDrop = resourceDrops[resourceDropKey];
                new RoomVisual(gameRoom.name).text('💰', resourceDrop.pos.x, resourceDrop.pos.y);
                AddJob(roomJobs, '3FillStrg-drop' + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.resourceType + ')' + gameRoom.name, resourceDrop.id, OBJECT_JOB, 'T');
            }

            // tombstone
            const tombstoneDrops = gameRoom.find(FIND_TOMBSTONES, {
                filter: (tombstone) => {
                    return tombstone.store.getUsedCapacity() > 0;
                }
            });
            for (const tombstoneDropKey in tombstoneDrops) {
                const tombstoneDrop = tombstoneDrops[tombstoneDropKey];
                new RoomVisual(gameRoom.name).text('⚰', tombstoneDrop.pos.x, tombstoneDrop.pos.y);
                AddJob(roomJobs, '4FillStrg-tomb' + '(' + tombstoneDrop.pos.x + ',' + tombstoneDrop.pos.y + ')' + gameRoom.name, tombstoneDrop.id, OBJECT_JOB, 'T');
            }

            // ruin
            const ruinDrops = gameRoom.find(FIND_RUINS, {
                filter: (ruin) => {
                    return ruin.store.getUsedCapacity() > 0;
                }
            });
            for (const ruinDropKey in ruinDrops) {
                const ruinDrop = ruinDrops[ruinDropKey];
                new RoomVisual(gameRoom.name).text('🏚️', ruinDrop.pos.x, ruinDrop.pos.y);
                AddJob(roomJobs, '4FillStrg-ruin' + '(' + ruinDrop.pos.x + ',' + ruinDrop.pos.y + ')' + gameRoom.name, ruinDrop.id, OBJECT_JOB, 'T');
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
                    Util.InfoLog('CreateJobs', 'FillControllerContainerJobs', 'removed container id from mem' + gameRoom.name);
                    Memory.MemRooms[gameRoom.name].CtrlConId = undefined;
                }
            }else if (!controllerContainer && Memory.MemRooms[gameRoom.name]) {
                controllerContainer = gameRoom.controller.pos.findInRange(FIND_STRUCTURES, 3, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_CONTAINER;
                    }
                })[0];
                if (controllerContainer) {
                    Util.InfoLog('CreateJobs', 'FillControllerContainerJobs', 'found new container (' + controllerContainer.pos.x + ',' + controllerContainer.pos.y + ',' + controllerContainer.pos.roomName + ') saving in memory');
                    Memory.MemRooms[gameRoom.name].CtrlConId = controllerContainer.id;
                }
            }
            if (controllerContainer && controllerContainer.store.getFreeCapacity > 0) {
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
            };
            Util.Info('CreateJobs', 'CreateRoom', 'add new room ' + roomName + ' level ' + level + ' sourceNumber ' + sourceNumber + ' jobs ' + JSON.stringify(jobs))
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
    }
};
module.exports = CreateJobs;