let Util = require('Util');
const CreateJobs = {
    run: function () {
        // CreateJobs
        //   Rooms - RoomNumber - room.name
        //     RoomLevel - 0 to 8
        //     MaxCreeps
        //     RoomJobs - JobName - [JobName(x,y)] - user friendly, unique per room, name
        //       JobId - real id
        //       JobType - int enum - Util.OBJECT_JOB = 1, Util.FLAG_JOB = 2
        //       CreepType - T, H, B...
        //       Creep - CreepName - H1 or B4... - if job is not taken then the value is vacant

        let flagJobs = CreateFlagJobs();
        CreateObjJobs(flagJobs);

        //region create jobs

        // this method is not just run in the Game.rooms loop because flags may be in 'invisible' rooms
        function CreateFlagJobs() {
            let jobs = {};
            for (const gameFlagKey in Game.flags) {
                const gameFlag = Game.flags[gameFlagKey];
                const color = gameFlag.color;
                const secColor = gameFlag.secondaryColor;
                let notFound = false;
                if (color === COLOR_ORANGE) { // scout and pos actions and hallway action
                    if (secColor === COLOR_ORANGE) { // scout tag
                        jobs = CreateFlagJob(jobs, 'TagCtrl', gameFlagKey, gameFlag, 'S');
                    } else if (secColor === COLOR_YELLOW) { // scout at pos
                        jobs = CreateFlagJob(jobs, 'ScoutPos', gameFlagKey, gameFlag, 'S');
                    } else if (secColor === COLOR_RED) { // flag to be placed on an observer that enables it to scan for power banks and deposits
                        // observers handle this flag
                    } else if (secColor === COLOR_PURPLE) { // flag that observers create and put on found power banks and deletes again when deadline is reached
                        jobs = PowerBankJobs(jobs, gameFlagKey, gameFlag);
                    } else if (secColor === COLOR_GREY) { // flag that is created for each transporter that should fetch the power
                        jobs = CreateFlagJob(jobs, 'TrnsprtP', gameFlagKey, gameFlag, 'T');
                    } else if (secColor === COLOR_CYAN) { // flag that observers create and put on deposits and deletes again when deadline is reached
                        jobs = CreateFlagJob(jobs, 'HrvstDpst', gameFlagKey, gameFlag, 'D');
                    } else if (secColor === COLOR_GREEN) { // harvester, transporter and builder move to pos
                        jobs = CreateFlagJob(jobs, 'HarvestPos', gameFlagKey, gameFlag, 'H');
                        jobs = CreateFlagJob(jobs, 'TransPos', gameFlagKey, gameFlag, 'T');
                        jobs = CreateFlagJob(jobs, 'BuildPos', gameFlagKey, gameFlag, 'B');
                    } else {
                        notFound = true;
                    }
                } else if (color === COLOR_RED) { // aggressive jobs
                    if (secColor === COLOR_RED) { // warrior at pos
                        jobs = CreateFlagJob(jobs, 'GuardPos', gameFlagKey, gameFlag, 'W');
                    } else if (secColor === COLOR_BLUE) { // gunner at pos
                        jobs = CreateFlagJob(jobs, 'GuardGunPos', gameFlagKey, gameFlag, 'G');
                    } else if (secColor === COLOR_GREEN) { // medic at pos
                        jobs = CreateFlagJob(jobs, 'GuardMedPos', gameFlagKey, gameFlag, 'M');
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
                        jobs = CreateFlagJob(jobs, 'ClaimCtrl', gameFlagKey, gameFlag, 'C');
                    } else if (secColor === COLOR_YELLOW) { // claimer reserve
                        jobs = ReserveRoomJobs(jobs, gameFlagKey, gameFlag);
                    } else if (secColor === COLOR_ORANGE) { // claimer move to pos - used when one wants to enter a portal
                        jobs = CreateFlagJob(jobs, 'ClaimPos', gameFlagKey, gameFlag, 'C');
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
            return AddJob(jobs, jobName + '-' + gameFlagKey + '(' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')' + gameFlag.pos.roomName, gameFlagKey, Util.FLAG_JOB, creepType);
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
                    if (!gameRoom.controller.pos.lookFor(LOOK_FLAGS)[0] && (!gameRoom.controller.sign || gameRoom.controller.sign.text !== 'Homebrewed code @ github.com/fbro/HScreeps ' + gameRoom.name)) {
                        const result = gameRoom.createFlag(gameRoom.controller.pos, 'Homebrewed code @ github.com/fbro/HScreeps ' + gameRoom.name, COLOR_ORANGE, COLOR_ORANGE);
                        Util.InfoLog('CreateJobs', 'CreateObjJobs', 'createFlag sign flag ' + gameRoom.controller.pos + ' ' + result);
                    }
                    // Source
                    const sources = gameRoom.find(FIND_SOURCES);
                    for (const sourceKey in sources) {
                        const source = sources[sourceKey];
                        new RoomVisual(gameRoom.name).text('🏭', source.pos.x, source.pos.y);
                        AddJob(jobs, 'Src(' + source.pos.x + ',' + source.pos.y + ')' + gameRoom.name, source.id, Util.OBJECT_JOB, 'H');
                        if (gameRoom.controller.level < 3) {
                            const freeSpaces = Util.FreeSpaces(source.pos);
                            if (freeSpaces > 1) {
                                AddJob(jobs, 'Src(' + source.pos.x + ',' + source.pos.y + ')' + gameRoom.name, source.id, Util.OBJECT_JOB, 'H');
                            }
                        }
                    }
                    // Controller
                    new RoomVisual(gameRoom.name).text('🧠', gameRoom.controller.pos.x, gameRoom.controller.pos.y);
                    if (!gameRoom.storage || gameRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.STORAGE_ENERGY_LOW || gameRoom.controller.ticksToDowngrade < 20000) {
                        AddJob(jobs, 'Ctrl(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, Util.OBJECT_JOB, 'B');
                    }
                    if (!gameRoom.storage || gameRoom.storage && gameRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_MEDIUM && gameRoom.controller.level < 8) {
                        AddJob(jobs, 'Ctrl1(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, Util.OBJECT_JOB, 'B');
                        AddJob(jobs, 'Ctrl2(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')' + gameRoom.name, gameRoom.controller.id, Util.OBJECT_JOB, 'B');
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
                    Util.CreateRoom(gameRoom.name, jobs);
                } else if (Memory.MemRooms[gameRoom.name]) { // update jobs in memRoom
                    let addedNewJob = false;
                    // add new jobs
                    for (const newJobKey in jobs) { // loop through new jobs
                        if (!Memory.MemRooms[gameRoom.name].RoomJobs[newJobKey]) { // new job does not already exist
                            Memory.MemRooms[gameRoom.name].RoomJobs[newJobKey] = jobs[newJobKey]; // save it
                            //Util.Info('CreateJobs', 'CreateObjJobs', 'new job added ' + newJobKey);
                            IncrementMaxCreepsMForFlagJob(jobs[newJobKey], gameRoom.name);// increment M if it is a new flag job
                            addedNewJob = true;
                        }
                    }
                    // remove only old disappeared vacant jobs
                    for (const oldJobKey in Memory.MemRooms[gameRoom.name].RoomJobs) { // loop through old jobs
                        const oldJob = Memory.MemRooms[gameRoom.name].RoomJobs[oldJobKey];
                        if (oldJob.Creep === 'vacant' && !jobs[oldJobKey]) { // old job is vacant and old job id not in the new job array
                            Util.DeleteJob(oldJob, oldJobKey, gameRoom.name);
                        }
                    }
                    if (gameRoom.controller && Memory.MemRooms[gameRoom.name].RoomLevel !== gameRoom.controller.level) { // room level change
                        Memory.MemRooms[gameRoom.name].RoomLevel = gameRoom.controller.level;
                        Memory.MemRooms[gameRoom.name].SourceNumber = gameRoom.find(FIND_SOURCES).length;
                        for (const maxCreepKey in Memory.MemRooms[gameRoom.name].MaxCreeps) {
                            Memory.MemRooms[gameRoom.name].MaxCreeps[maxCreepKey].M = undefined; // reset - maybe the MaxCreepsInRoom changes with room level
                        }
                    }
                }
            }

            // now some flag jobs might still be unplaced, loop trough them and add them maybe also create the room object
            // they might still be unplaced because they are in a room that is not in MemRooms
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
                    Util.CreateRoom(roomName, jobs);
                }
            }
        }

        function IncrementMaxCreepsMForFlagJob(job, roomName) {
            // increase MaxCreeps.M for when flag jobs are created
            if (Memory.MemRooms[roomName] && job.JobType === Util.FLAG_JOB && job.CreepType !== 'T' && job.CreepType !== 'B') {
                if (Memory.MemRooms[roomName].MaxCreeps) {
                    if (Memory.MemRooms[roomName].MaxCreeps[job.CreepType]) {
                        if (!Memory.MemRooms[roomName].MaxCreeps[job.CreepType].M) {
                            Memory.MemRooms[roomName].MaxCreeps[job.CreepType]['M'] = 0;
                        }
                    } else {
                        Memory.MemRooms[roomName].MaxCreeps[job.CreepType] = {'M': 0};
                    }
                } else {
                    Memory.MemRooms[roomName].MaxCreeps = {};
                    Memory.MemRooms[roomName].MaxCreeps[job.CreepType] = {'M': 0};
                }
                Memory.MemRooms[roomName].MaxCreeps[job.CreepType].M += 1;
            }
        }

        //endregion

        //region flag jobs

        function PowerBankJobs(jobs, gameFlagKey, gameFlag) {
            jobs = CreateFlagJob(jobs, 'AtkP1', gameFlagKey, gameFlag, 'W');
            jobs = CreateFlagJob(jobs, 'AtkP2', gameFlagKey, gameFlag, 'W');
            jobs = CreateFlagJob(jobs, 'MedP1', gameFlagKey, gameFlag, 'M');
            jobs = CreateFlagJob(jobs, 'MedP2', gameFlagKey, gameFlag, 'M');
            return jobs;
        }

        function FillLabMineralJobs(jobs, gameFlagKey, gameFlag) {
            const mineral = gameFlagKey.split(/[-]+/).filter(function (e) {
                return e;
            })[1];
            const lab = gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_LAB;
                }
            })[0];
            if (lab && (!lab.mineralType || lab.mineralType === mineral)) {
                // flagname rules: GET-L-roomname = get lemergium from all rooms, BUY-L-roomname = get lemergium from all rooms or then buy it from the terminal
                if (lab.store.getFreeCapacity(mineral) >= Util.TRANSPORTER_MAX_CARRY && (lab.room.storage.store.getUsedCapacity(mineral) > 0 || lab.room.terminal.store.getUsedCapacity(mineral) > 0)) {
                    jobs = CreateFlagJob(jobs, 'FillLabMin', gameFlagKey, gameFlag, 'T');
                }
            } else { // flag must be on top of an existing lab!
                Util.ErrorLog('CreateJobs', 'CreateFlagJobs', 'lab not found! ' + gameFlagKey);
                gameFlag.remove();
            }
            return jobs;
        }

        function EmptyLabMineralJobs(jobs, gameFlagKey, gameFlag) {
            const mineral = gameFlagKey.split(/[-]+/).filter(function (e) {
                return e;
            })[1];
            const lab = gameFlag.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_LAB;
                }
            })[0];
            if (lab && (!lab.mineralType || lab.mineralType === mineral)) {
                // flagname rules: EMPTY-GH-roomname = create the mineral and allows it to be emptied from the nearby lab to this lab
                //Util.Info('CreateJobs', 'CreateFlagJobs', 'mineral ' + mineral + ' lab ' + lab.store.getUsedCapacity(mineral) + ' terminal ' + lab.room.terminal.store.getUsedCapacity(mineral));
                if (lab.store.getUsedCapacity(mineral) >= Util.TRANSPORTER_MAX_CARRY && lab.room.terminal.store.getUsedCapacity(mineral) < Util.TERMINAL_MAX_RESOURCE) {
                    CreateFlagJob(jobs, 'EmptyLabMin', gameFlagKey, gameFlag, 'T');
                }
            } else { // flag must be on top of an existing lab!
                Util.ErrorLog('CreateJobs', 'CreateFlagJobs', 'lab not found! ' + gameFlagKey);
                gameFlag.remove();
            }
            return jobs;
        }

        function ReserveRoomJobs(jobs, gameFlagKey, gameFlag) {
            if (!gameFlag.room
                || !gameFlag.room.controller.reservation
                || !Memory.MemRooms[gameFlag.pos.roomName]
                || Memory.MemRooms[gameFlag.pos.roomName].RoomJobs['ReserveCtrl-' + gameFlagKey + '(' + gameFlag.pos.x + ',' + gameFlag.pos.y + ')' + gameFlag.pos.roomName]
                || (gameFlag.room.controller.reservation.ticksToEnd < 2500 && !Memory.MemRooms[gameFlag.pos.roomName].RoomJobs[gameFlagKey])) { // extra logic to try and optimize creep not being idle
                jobs = CreateFlagJob(jobs, 'ReserveCtrl', gameFlagKey, gameFlag, 'R');
            }
            return jobs;
        }

        //endregion

        //region room jobs

        function FillPowerSpawnEnergyJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_LOW
                || gameRoom.terminal && gameRoom.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_LOW) {
                const powerSpawns = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_POWER_SPAWN;
                    }
                });
                for (const powerSpawnKey in powerSpawns) {
                    const powerSpawn = powerSpawns[powerSpawnKey];
                    if (powerSpawn && powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        new RoomVisual(gameRoom.name).text('⚡', powerSpawn.pos.x, powerSpawn.pos.y);
                        AddJob(roomJobs, 'FillPSpwnE(' + powerSpawn.pos.x + ',' + powerSpawn.pos.y + ')' + gameRoom.name, powerSpawn.id, Util.OBJECT_JOB, 'T');
                    }
                }
            }
        }

        function FillPowerSpawnPowerJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store.getUsedCapacity(RESOURCE_POWER) > 0 || gameRoom.terminal && gameRoom.terminal.store.getUsedCapacity(RESOURCE_POWER) > 0) {
                const powerSpawn = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_POWER_SPAWN;
                    }
                })[0];
                if (powerSpawn && powerSpawn.store.getFreeCapacity(RESOURCE_POWER) > 0) {
                    new RoomVisual(gameRoom.name).text('🌪️', powerSpawn.pos.x, powerSpawn.pos.y);
                    AddJob(roomJobs, 'FillPSpwnP(' + powerSpawn.pos.x + ',' + powerSpawn.pos.y + ')' + gameRoom.name, powerSpawn.id, Util.OBJECT_JOB, 'T');
                }
            }
        }

        function FillLabEnergyJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 5000) {
                const labs = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_LAB;
                    }
                });
                for (const labKey in labs) {
                    const lab = labs[labKey];
                    if (lab && lab.store.getUsedCapacity(RESOURCE_ENERGY) < lab.store.getCapacity(RESOURCE_ENERGY)) {
                        new RoomVisual(gameRoom.name).text('⚡', lab.pos.x, lab.pos.y);
                        AddJob(roomJobs, 'FillLabE(' + lab.pos.x + ',' + lab.pos.y + ')' + gameRoom.name, lab.id, Util.OBJECT_JOB, 'T');
                    }
                }
            }
        }

        function FillTerminalJobs(gameRoom, roomJobs) {
            if (gameRoom.storage && gameRoom.terminal) {
                for (const resourceType in gameRoom.storage.store) {
                    const storageResourceAmount = gameRoom.storage.store.getUsedCapacity(resourceType);
                    let maxResources = 0;
                    let High = Util.STORAGE_HIGH; // 10000
                    let HighTransfer = Util.STORAGE_HIGH_TRANSFER; // 8000
                    let Medium = Util.STORAGE_MEDIUM; // 4000
                    let MediumTransfer = Util.STORAGE_MEDIUM_TRANSFER; // 6000
                    let Low = Util.STORAGE_LOW; // 0
                    let LowTransfer = Util.STORAGE_LOW_TRANSFER; // 3000
                    if (resourceType === RESOURCE_ENERGY) {
                        High = Util.STORAGE_ENERGY_HIGH; // 200000
                        HighTransfer = Util.STORAGE_ENERGY_HIGH_TRANSFER; // 100000
                        Medium = Util.STORAGE_ENERGY_MEDIUM; // 100000
                        MediumTransfer = Util.STORAGE_ENERGY_MEDIUM_TRANSFER; // 80000
                        Low = Util.STORAGE_ENERGY_LOW; // 10000
                        LowTransfer = Util.STORAGE_ENERGY_LOW_TRANSFER; // 50000
                    }
                    // if storage contains alot of the specified resource then allow the terminal to be filled to an extent where it will sell out
                    if (storageResourceAmount >= High) {
                        maxResources = HighTransfer;
                    } else if (storageResourceAmount >= Medium) {
                        maxResources = MediumTransfer;
                    } else if (storageResourceAmount > Low) {
                        maxResources = LowTransfer;
                    }
                    if (gameRoom.terminal.store.getUsedCapacity(resourceType) < maxResources) {
                        new RoomVisual(gameRoom.name).text('🚄', gameRoom.terminal.pos.x, gameRoom.terminal.pos.y);
                        AddJob(roomJobs, 'FillTerm(' + resourceType + ')' + gameRoom.name, gameRoom.terminal.id, Util.OBJECT_JOB, 'T');
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
                    if (factory.store.getUsedCapacity(RESOURCE_ENERGY) < Util.FACTORY_TARGET_ENERGY) {
                        AddJob(roomJobs, 'FillFctr(' + RESOURCE_ENERGY + ')' + gameRoom.name, factory.id, Util.OBJECT_JOB, 'T');
                    }

                    // Biological chain
                    if (gameRoom.storage.store.getUsedCapacity(RESOURCE_BIOMASS) > 0
                        || gameRoom.terminal.store.getUsedCapacity(RESOURCE_BIOMASS) > 0
                        || factory.store.getUsedCapacity(RESOURCE_BIOMASS) > 0
                        || factory.store.getUsedCapacity(RESOURCE_CELL) > 0) {
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_BIOMASS);
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_LEMERGIUM);
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_LEMERGIUM_BAR);
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_OXYGEN);
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_HYDROGEN);
                        if (factory.level === 1) { // level 1 specific
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_CELL);
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_OXIDANT);
                        } else if (factory.level === 2) { // level 2 specific
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_PHLEGM);
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_CELL);
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_REDUCTANT);
                        }
                    }
                    // Mechanical chain
                    else if (gameRoom.storage.store.getUsedCapacity(RESOURCE_METAL) > 0
                        || gameRoom.terminal.store.getUsedCapacity(RESOURCE_METAL) > 0
                        || factory.store.getUsedCapacity(RESOURCE_METAL) > 0
                        || factory.store.getUsedCapacity(RESOURCE_ALLOY) > 0) {
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_METAL);
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_ZYNTHIUM);
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_ZYNTHIUM_BAR);
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_OXYGEN);
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_UTRIUM);
                        roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_HYDROGEN);
                        if (factory.level === 1) { // level 1 specific
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_ALLOY);
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_UTRIUM_BAR);
                        } else if (factory.level === 2) { // level 2 specific
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_ALLOY);
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_OXIDANT);
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_COMPOSITE); // used for lvl 2 FIXTURES
                        } else if (factory.level === 3) { // level 3 specific
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_FIXTURES);
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_TUBE);
                            roomJobs = TryAddFillFactoryJob(gameRoom, factory, roomJobs, RESOURCE_REDUCTANT);
                        }
                    }
                }
            }
            return roomJobs;
        }

        function TryAddFillFactoryJob(gameRoom, factory, roomJobs, resource) {
            if (factory.store.getUsedCapacity(resource) < Util.FACTORY_TARGET_RESOURCE && (gameRoom.storage.store.getUsedCapacity(resource) > 0 || gameRoom.terminal.store.getUsedCapacity(resource) > 0)) {
                roomJobs = AddJob(roomJobs, 'FillFctr(' + resource + ')' + gameRoom.name, factory.id, Util.OBJECT_JOB, 'T');
            }
            return roomJobs;
        }

        function ExtractMineralJobs(gameRoom, roomJobs) {
            const mineral = gameRoom.find(FIND_MINERALS, {
                filter: (s) => {
                    return s.mineralAmount > 0;
                }
            })[0];
            if (mineral && gameRoom.storage && (gameRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_MEDIUM/*do not extract minerals when low on storage energy*/ && gameRoom.storage.store.getUsedCapacity(mineral.mineralType) < Util.DO_EXTRACTING_WHEN_STORAGE_UNDER_MINERAL
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
                    AddJob(roomJobs, 'ExtrMin-' + mineral.mineralType + '(' + extractMineral.pos.x + ',' + extractMineral.pos.y + ')' + gameRoom.name, mineral.id, Util.OBJECT_JOB, 'E');
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
                        AddJob(roomJobs, 'FillStrg-' + container.structureType + '(' + container.pos.x + ',' + container.pos.y + ',' + resourceType + ')' + gameRoom.name, container.id, Util.OBJECT_JOB, 'T');
                    }
                }
            }

            // link
            const link = gameRoom.storage.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                filter: (s) => {
                    return s.structureType === STRUCTURE_LINK && s.store.getUsedCapacity(RESOURCE_ENERGY) >= 600;
                }
            })[0];
            if (link) {
                AddJob(roomJobs, 'FillStrg-' + link.structureType + '(' + link.pos.x + ',' + link.pos.y + ',' + RESOURCE_ENERGY + ')' + gameRoom.name, link.id, Util.OBJECT_JOB, 'T');
            }

            // terminal
            if (gameRoom.terminal) {
                for (const resourceType in gameRoom.terminal.store) {
                    const amount = gameRoom.terminal.store.getUsedCapacity(resourceType);
                    if (
                        resourceType === RESOURCE_ENERGY && (
                            amount >= Util.TERMINAL_EMPTY_ENERGY
                            || (gameRoom.storage.store.getUsedCapacity(resourceType) < Util.STORAGE_ENERGY_LOW || !gameRoom.storage.store.getUsedCapacity(resourceType))
                            && amount >= Util.TERMINAL_TARGET_ENERGY
                        )
                        || amount !== RESOURCE_ENERGY && amount > Util.TERMINAL_EMPTY_RESOURCE
                    ) {
                        AddJob(roomJobs, 'FillStrg-' + gameRoom.terminal.structureType + '(' + gameRoom.terminal.pos.x + ',' + gameRoom.terminal.pos.y + ',' + resourceType + ')' + gameRoom.name, gameRoom.terminal.id, Util.OBJECT_JOB, 'T');
                    }
                }
            }

            // factory
            if (Memory.MemRooms[gameRoom.name] && Memory.MemRooms[gameRoom.name].FctrId && Memory.MemRooms[gameRoom.name].FctrId !== '-') {
                const factory = Game.getObjectById(Memory.MemRooms[gameRoom.name].FctrId);
                if (factory) {
                    for (const resourceType in factory.store) {
                        const amount = factory.store.getUsedCapacity(resourceType);
                        if (gameRoom.storage.store.getUsedCapacity(resourceType) < Util.STORAGE_MEDIUM
                            && gameRoom.terminal.store.getUsedCapacity(resourceType) < Util.STORAGE_MEDIUM_TRANSFER
                            && (
                                (      resourceType === RESOURCE_LEMERGIUM_BAR
                                    || resourceType === RESOURCE_ZYNTHIUM_BAR
                                    || resourceType === RESOURCE_UTRIUM_BAR
                                    || resourceType === RESOURCE_KEANIUM_BAR
                                    || resourceType === RESOURCE_PURIFIER
                                    || resourceType === RESOURCE_GHODIUM_MELT
                                    || resourceType === RESOURCE_OXIDANT
                                    || resourceType === RESOURCE_REDUCTANT
                                ) && amount >= 1000 && !factory.level

                                || resourceType === RESOURCE_COMPOSITE && amount >= 500 && factory.level === 1
                                || resourceType === RESOURCE_CRYSTAL && amount >= 500 && factory.level === 2
                                || resourceType === RESOURCE_LIQUID && amount >= 500 && factory.level === 3

                                // Mechanical chain
                                || resourceType === RESOURCE_ALLOY && amount >= 900 && !factory.level
                                || resourceType === RESOURCE_TUBE && amount >= 400 && factory.level === 1
                                || resourceType === RESOURCE_FIXTURES && amount >= 100 && factory.level === 2
                                || resourceType === RESOURCE_FRAME && amount >= 50 && factory.level === 3
                                || resourceType === RESOURCE_HYDRAULICS && amount >= 10 && factory.level === 4
                                || resourceType === RESOURCE_MACHINE && amount >= 1 && factory.level === 5

                                // Biological chain
                                || resourceType === RESOURCE_CELL && amount >= 900 && !factory.level
                                || resourceType === RESOURCE_PHLEGM && amount >= 400 && factory.level === 1
                                || resourceType === RESOURCE_TISSUE && amount >= 100 && factory.level === 2
                                || resourceType === RESOURCE_MUSCLE && amount >= 50 && factory.level === 3
                                || resourceType === RESOURCE_ORGANOID && amount >= 10 && factory.level === 4
                                || resourceType === RESOURCE_ORGANISM && amount >= 1 && factory.level === 5

                                // Electronical chain
                                || resourceType === RESOURCE_WIRE && amount >= 900 && !factory.level
                                || resourceType === RESOURCE_SWITCH && amount >= 400 && factory.level === 1
                                || resourceType === RESOURCE_TRANSISTOR && amount >= 100 && factory.level === 2
                                || resourceType === RESOURCE_MICROCHIP && amount >= 50 && factory.level === 3
                                || resourceType === RESOURCE_CIRCUIT && amount >= 10 && factory.level === 4
                                || resourceType === RESOURCE_DEVICE && amount >= 1 && factory.level === 5

                                // Mystical chain
                                || resourceType === RESOURCE_CONDENSATE && amount >= 900 && !factory.level
                                || resourceType === RESOURCE_CONCENTRATE && amount >= 400 && factory.level === 1
                                || resourceType === RESOURCE_EXTRACT && amount >= 100 && factory.level === 2
                                || resourceType === RESOURCE_SPIRIT && amount >= 50 && factory.level === 3
                                || resourceType === RESOURCE_EMANATION && amount >= 10 && factory.level === 4
                                || resourceType === RESOURCE_ESSENCE && amount >= 1 && factory.level === 5
                            )
                        ) {
                            new RoomVisual(gameRoom.name).text('🏭', factory.pos.x, factory.pos.y);
                            AddJob(roomJobs, 'FillStrg-' + factory.structureType + '(' + factory.pos.x + ',' + factory.pos.y + ',' + resourceType + ')' + gameRoom.name, factory.id, Util.OBJECT_JOB, 'T');
                        }
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
                AddJob(roomJobs, 'FillStrg-drop' + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.resourceType + ')' + gameRoom.name, resourceDrop.id, Util.OBJECT_JOB, 'T');
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
                AddJob(roomJobs, 'FillStrg-tomb' + '(' + tombstoneDrop.pos.x + ',' + tombstoneDrop.pos.y + ')' + gameRoom.name, tombstoneDrop.id, Util.OBJECT_JOB, 'T');
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
                AddJob(roomJobs, 'FillStrg-ruin' + '(' + ruinDrop.pos.x + ',' + ruinDrop.pos.y + ')' + gameRoom.name, ruinDrop.id, Util.OBJECT_JOB, 'T');
            }
        }

        function FillTowerJobs(gameRoom, roomJobs) {
            const fillTowers = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_TOWER) && s.store.getUsedCapacity(RESOURCE_ENERGY) < (s.store.getCapacity(RESOURCE_ENERGY) - 100));
                }
            });
            for (const fillTowerKey in fillTowers) {
                const fillTower = fillTowers[fillTowerKey];
                new RoomVisual(gameRoom.name).text('🗼', fillTower.pos.x, fillTower.pos.y);
                AddJob(roomJobs, 'FillTwr(' + fillTower.pos.x + ',' + fillTower.pos.y + ')' + gameRoom.name, fillTower.id, Util.OBJECT_JOB, 'T');
            }
        }

        function FillSpawnExtensionJobs(gameRoom, roomJobs) {
            const fillSpawnExtensions = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.store.getUsedCapacity(RESOURCE_ENERGY) < s.store.getCapacity(RESOURCE_ENERGY));
                }
            });
            for (const fillSpawnExtensionKey in fillSpawnExtensions) {
                const fillSpawnExtension = fillSpawnExtensions[fillSpawnExtensionKey];
                new RoomVisual(gameRoom.name).text('🌱', fillSpawnExtension.pos.x, fillSpawnExtension.pos.y);
                AddJob(roomJobs, 'FillSpwnEx(' + fillSpawnExtension.pos.x + ',' + fillSpawnExtension.pos.y + ')' + gameRoom.name, fillSpawnExtension.id, Util.OBJECT_JOB, 'T');
            }
        }

        function ConstructionJobs(gameRoom, roomJobs) {
            const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES);
            for (const constructionKey in constructions) {
                const construction = constructions[constructionKey];
                new RoomVisual(gameRoom.name).text('🏗', construction.pos.x, construction.pos.y);
                AddJob(roomJobs, 'Constr-' + construction.structureType + '(' + construction.pos.x + ',' + construction.pos.y + ')' + gameRoom.name, construction.id, Util.OBJECT_JOB, 'B');
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
                                && (gameRoom.controller.level < 5 && s.hits < Util.RAMPART_WALL_HITS_U_LVL5
                                    || gameRoom.controller.level >= 5 && gameRoom.controller.level < 8 && s.hits < Util.RAMPART_WALL_HITS_U_LVL8
                                    || gameRoom.controller.level === 8 && (s.hits < Util.RAMPART_WALL_HITS_LVL8 || gameRoom.storage && gameRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.RAMPART_WALL_MAX_HITS_WHEN_STORAGE_ENERGY))
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
                AddJob(roomJobs, 'Rep-' + repair.structureType + '(' + repair.pos.x + ',' + repair.pos.y + ')' + gameRoom.name, repair.id, Util.OBJECT_JOB, 'B');
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
            } else if (!controllerContainer && Memory.MemRooms[gameRoom.name]) {
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
            if (controllerContainer && controllerContainer.store.getFreeCapacity() > 0) {
                new RoomVisual(gameRoom.name).text('🔋', controllerContainer.pos.x, controllerContainer.pos.y);
                AddJob(roomJobs, 'FillCtrlCon(' + controllerContainer.pos.x + ',' + controllerContainer.pos.y + ')' + gameRoom.name, controllerContainer.id, Util.OBJECT_JOB, 'T');
            }
        }

        //endregion

        //region helper functions



        function AddJob(roomJobs, jobName, jobId, jobType, creepType) {
            roomJobs[jobName] = { // create job - RoomJobs - JobName - [JobName(x,y)] - user friendly, unique per room, name
                'JobId': jobId, // real id
                'JobType': jobType, // int enum - Util.OBJECT_JOB = 1, Util.FLAG_JOB = 2
                'CreepType': creepType, // T, H, B...
                'Creep': 'vacant' // CreepName - H1 or B4... - if job is not taken then the value is vacant
            };
            return roomJobs;
        }

        //endregion
    }
};
module.exports = CreateJobs;