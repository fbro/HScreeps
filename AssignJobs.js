let Util = require('Util');
const AssignJobs = {
    run: function () {

        // assign jobs to creeps or create the creeps like this:
        // look for idle creep with correct type in room
        // if failed then create that creep in room
        // if that failed and there are no spawns present then create it in the closest room with enough energy at its disposal

        // different creep types for different jobs
        /*creep types:
        * [H] harvester         only one CARRY
        * [T] transporter       no WORK
        * [B] builder           equal WORK and CARRY
        * [E] extractor         only one CARRY and maxed out WORK
        * [S] scout             just a MOVE
        * [C] claimer           CLAIM - one CLAIM
        * [R] reserver          CLAIM - many CLAIM when reserving
        * [W] warrior           ATTACK and MOVE
        * [G] gunner            RANGED_ATTACK and MOVE - needs clever attack pattern to avoid creeps with ATTACK body parts
        * [M] medic             HEAL
        * [D] distantHarvester  equal WORK and MOVE
        * [L] lifter            50 MOVE - lifts other creeps TODO
        */

        AssignOrSpawnCreeps();

        // loop through vacant jobs per room and see if an idle creep could be assigned or a new creep should be spawned
        function AssignOrSpawnCreeps() {
            const idleCreeps = _.filter(Game.creeps, function (creep) {
                if (creep.memory.JobName) {
                    return creep.memory.JobName.startsWith('idle');
                } else {
                    return false;
                }
            });
            for (const memRoomKey in Memory.MemRooms) {
                const memRoom = Memory.MemRooms[memRoomKey];
                if (!memRoom) {
                    continue;
                }
                for (const roomJobKey in memRoom.RoomJobs) {
                    const roomJob = memRoom.RoomJobs[roomJobKey];
                    if (roomJob && roomJob.Creep === 'vacant') {
                        let creepFound = AssignCreep(roomJob, idleCreeps, roomJobKey, memRoomKey); // first try and assign a creep from the room the job is in
                        if (!creepFound) {
                            creepFound = AssignCreepOtherRoom(roomJob, idleCreeps, roomJobKey, memRoomKey); // then see if there are nearby idle creep in other room
                            if (!creepFound) {
                                const availableSpawnsInRoom = _.filter(Game.spawns, function (spawn) {
                                    return spawn && spawn.room.name === memRoomKey;
                                });
                                creepFound = SpawnCreep(roomJob, availableSpawnsInRoom, roomJobKey, memRoomKey);
                                //if(!creepFound){ // TODO
                                //    Util.Warning('AssignJobs', 'AssignOrSpawnCreeps', 'giving up assigning jobs in ' + memRoomKey + ' because of job ' + roomJobKey);
                                //    break;
                                //}
                            }
                        }
                    }
                }
            }
        }

        /**@return {boolean}*/
        function AssignCreep(roomJob, idleCreeps, roomJobKey, memRoomKey) {
            for (const idleCreepCounter in idleCreeps) {
                const idleCreep = idleCreeps[idleCreepCounter];
                if (idleCreep.pos.roomName === memRoomKey && idleCreep.name.startsWith(roomJob.CreepType)) { // idle creep is in memory room with vacant job and matching job type
                    idleCreep.memory.JobName = roomJobKey;
                    for (const memoryElementKey in idleCreep.memory) {
                        if (memoryElementKey !== 'JobName' && memoryElementKey !== 'Boost') { // creep.memory that should not be deleted
                            idleCreep.memory[memoryElementKey] = undefined;
                        }
                    }
                    roomJob.Creep = idleCreep.name;
                    //Util.Info('AssignJobs', 'AssignCreeps', idleCreep.name + ' assigned to ' + roomJobKey + ' in ' + memRoomKey);
                    delete idleCreeps[idleCreepCounter];
                    return true;
                }
            }
            return false;
        }

        /**@return {boolean}*/
        function AssignCreepOtherRoom(roomJob, idleCreeps, roomJobKey, memRoomKey) {
            if (roomJob.JobType === Util.FLAG_JOB
                && (Game.rooms[memRoomKey] && Game.rooms[memRoomKey].controller && Game.rooms[memRoomKey].controller.my && Game.rooms[memRoomKey].controller.level < 8
                    || !Game.rooms[memRoomKey]
                    || !Game.rooms[memRoomKey].controller
                    || !Game.rooms[memRoomKey].controller.my)) {
                // loop through all creeps of desired creepType and assign the nearest one to the job
                let nearestCreep;
                let bestRange = Number.MAX_SAFE_INTEGER;
                let bestIdleCreepCounter;
                for (const idleCreepCounter in idleCreeps) {
                    const idleCreep = idleCreeps[idleCreepCounter];
                    if (idleCreep.name.startsWith(roomJob.CreepType)) {
                        const linearDistance = Game.map.getRoomLinearDistance(memRoomKey, idleCreep.pos.roomName);
                        if (bestRange > linearDistance) {
                            bestRange = linearDistance;
                            nearestCreep = idleCreep;
                            bestIdleCreepCounter = idleCreepCounter;
                        }
                    }
                }
                if (nearestCreep) {
                    nearestCreep.memory.JobName = roomJobKey;
                    roomJob.Creep = nearestCreep.name;
                    delete idleCreeps[bestIdleCreepCounter];
                    return true;
                }
            }
            return false; // for now, do not assign creeps of type OBJECT_JOB to other rooms
        }

        /**@return {boolean}*/
        function SpawnCreep(roomJob, availableSpawnsInRoom, roomJobKey, memRoomKey) {
            // if idle creep not found for vacant job then look if spawn is possible
            if (ShouldSpawnCreep(roomJob.CreepType, memRoomKey)) {
                let maxLinearDistance = 1; // normally creeps should only be spawned in the room they are needed
                let spawnLargeVersion = false;
                // job in another room
                if (Game.rooms[memRoomKey]) { // job in invisible room
                    const gameRoom = Game.rooms[memRoomKey];
                    if (gameRoom.controller) { // flag in controller-less room
                        if (gameRoom.controller.my) { // only use my room
                            if (availableSpawnsInRoom.length === 0) { // no spawn in my room
                                Util.Info('AssignJobs', 'SpawnCreep', 'job in room has no available spawns ' + roomJobKey);
                                if (!_.find(Game.spawns, function (spawn) {
                                    return spawn.pos.roomName === gameRoom;
                                })) {
                                    Util.Info('AssignJobs', 'SpawnCreep', 'no spawns found in ' + gameRoom + ' for ' + roomJobKey);
                                    maxLinearDistance = Number.MAX_SAFE_INTEGER;
                                }
                            } else {
                                spawnLargeVersion = ShouldSpawnLargeVersion(gameRoom, roomJob);
                            }
                        } else {
                            Util.Info('AssignJobs', 'SpawnCreep', 'job in room, not my room ' + roomJobKey);
                            maxLinearDistance = Number.MAX_SAFE_INTEGER;
                        }
                    } else {
                        Util.Info('AssignJobs', 'SpawnCreep', 'job in room, no controller ' + roomJobKey);
                        maxLinearDistance = Number.MAX_SAFE_INTEGER;
                    }
                } else {
                    Util.Info('AssignJobs', 'SpawnCreep', 'job in room, invisible room ' + roomJobKey);
                    maxLinearDistance = Number.MAX_SAFE_INTEGER;
                }
                const bestAvailableSpawn = FindBestSpawn(availableSpawnsInRoom, maxLinearDistance, roomJob, memRoomKey);

                return SpawningCreep(bestAvailableSpawn, spawnLargeVersion, roomJob, roomJobKey, memRoomKey);
            }
            return true;
        }

        /**@return {boolean}*/
        function ShouldSpawnCreep(creepType, roomKey) {
            const memRoom = Memory.MemRooms[roomKey];
            let maxCreepsInRoom = 3;
            if (memRoom.MaxCreeps[creepType] && memRoom.MaxCreeps[creepType].M) {
                maxCreepsInRoom = memRoom.MaxCreeps[creepType].M;
            } else { // this code should only run when a reset happens
                switch (creepType) {
                    case 'T': // transporter
                        if (memRoom.SourceNumber === 0) {
                            maxCreepsInRoom = 4;
                        } else {
                            maxCreepsInRoom = memRoom.SourceNumber;
                        }
                        break;
                    case 'H': // harvester
                        if (memRoom.SourceNumber === 0) {
                            maxCreepsInRoom = 3;
                        } else {
                            maxCreepsInRoom = memRoom.SourceNumber;
                        }
                        if (memRoom.RoomLevel <= 3) {
                            maxCreepsInRoom += memRoom.SourceNumber;
                        }
                        break;
                    case 'B': // builder
                        maxCreepsInRoom = 2;
                        if (memRoom.RoomLevel < 8) {
                            maxCreepsInRoom += 2;
                            if (memRoom.RoomLevel <= 3) {
                                maxCreepsInRoom += 1;
                            }
                        }
                        break;
                    case 'E': // extractor
                        maxCreepsInRoom = 1;
                        break;
                    case 'W': // warrior
                    case 'G': // gunner
                    case 'M': // medic
                    case 'S': // scout
                        if (!Game.rooms[roomKey] || !Game.rooms[roomKey].controller || Game.rooms[roomKey].controller.level <= 6) {
                            maxCreepsInRoom = 3;
                        } else {
                            maxCreepsInRoom = 0;
                        }
                        break;
                    case 'C': // claimer
                    case 'R': // reserver
                        if (!Game.rooms[roomKey] || Game.rooms[roomKey].controller && Game.rooms[roomKey].controller.level === 0) {
                            maxCreepsInRoom = 1;
                        } else {
                            maxCreepsInRoom = 0;
                        }
                        break;
                    case 'D': // distantHarvester
                        if (!Game.rooms[roomKey] || !Game.rooms[roomKey].controller || Game.rooms[roomKey].controller && Game.rooms[roomKey].controller.level === 0) {
                            maxCreepsInRoom = 6;
                        } else {
                            maxCreepsInRoom = 0;
                        }
                        break;
                    default:
                        Util.ErrorLog('AssignJobs', 'ShouldSpawnCreep', 'creep type not found ' + creepType);
                }
                if (!memRoom.MaxCreeps[creepType]) {
                    memRoom.MaxCreeps[creepType] = {};
                }
                memRoom.MaxCreeps[creepType]['M'] = maxCreepsInRoom;
            }
            return (Object.keys(memRoom.MaxCreeps[creepType]).length - 1) < maxCreepsInRoom;
        }

        /**@return {boolean}*/
        function ShouldSpawnLargeVersion(gameRoom, roomJob) {
            let spawnLargeVersion = false;
            if (roomJob.CreepType === 'H' && gameRoom.storage) { // logic only relevant for harvester
                const source = gameRoom.find(FIND_SOURCES)[0];
                for (const effectKey in source.effects) {
                    if (source.effects[effectKey].effect === PWR_REGEN_SOURCE) {
                        spawnLargeVersion = true;
                        break;
                    }
                }
            } else if (roomJob.CreepType === 'B' && gameRoom.storage && gameRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_MEDIUM) { // large builders are only allowed when the room has the required energy - the drawback is that upgrade controller takes alot of energy
                spawnLargeVersion = true;
            }
            return spawnLargeVersion;
        }

        function FindBestSpawn(availableSpawnsInRoom, bestLinearDistance, roomJob, memRoomKey) {
            let bestAvailableSpawn;
            let bestAvailableSpawnCounter;
            let timeToLiveMaxRoomRange;
            let minEnergyCapacityNeeded = 300;
            if (roomJob.CreepType === 'C' || roomJob.CreepType === 'R') { //  creep with CLAIM body parts
                minEnergyCapacityNeeded = 650;
                timeToLiveMaxRoomRange = 10; // 600 time to live / 50 max room tiles
                Util.Info('AssignJobs', 'FindBestSpawn', 'availableSpawns ' + Game.spawns + ' availableSpawnsInRoom ' + availableSpawnsInRoom + ' bestLinearDistance ' + bestLinearDistance + ' roomJob ' + roomJob + ' memRoomKey ' + memRoomKey);
            } else {
                timeToLiveMaxRoomRange = 16; // 1500 time to live / 50 max room tiles
            }
            for (const availableSpawnCounter in Game.spawns) { // find closest spawn
                const availableSpawn = Game.spawns[availableSpawnCounter];
                if (availableSpawn.room.energyCapacityAvailable >= minEnergyCapacityNeeded) {
                    if (availableSpawnsInRoom.length > 0) { // spawn in room
                        if (availableSpawn.id === availableSpawnsInRoom[0].id) {
                            bestAvailableSpawn = availableSpawnsInRoom[0];
                            bestAvailableSpawnCounter = availableSpawnCounter;
                            if (!availableSpawn.HasSpawned && !availableSpawn.spawning) {
                                break;
                            }
                        }
                    } else { // no spawn in room - look in other rooms
                        const linearDistance = Game.map.getRoomLinearDistance(availableSpawn.pos.roomName, memRoomKey);
                        if (linearDistance <= timeToLiveMaxRoomRange) { // spawn cannot be too far away
                            let energyAvailableModifier = 0;
                            if (!availableSpawn.room.storage || availableSpawn.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) < Util.STORAGE_ENERGY_LOW) {
                                energyAvailableModifier++;
                            }
                            if (availableSpawn.room.energyCapacityAvailable / 2 <= availableSpawn.room.energyCapacityAvailable - availableSpawn.room.energyAvailable) {
                                energyAvailableModifier++;
                            }
                            if (availableSpawn.HasSpawned || availableSpawn.spawning) {
                                energyAvailableModifier++;
                            }
                            if ((energyAvailableModifier + linearDistance) < bestLinearDistance && energyAvailableModifier !== Number.MAX_SAFE_INTEGER) {
                                bestLinearDistance = energyAvailableModifier + linearDistance;
                                bestAvailableSpawn = availableSpawn;
                                bestAvailableSpawnCounter = availableSpawnCounter;
                            }
                        }
                    }
                }
            }
            return bestAvailableSpawn;
        }

        /**@return {boolean}*/
        function SpawningCreep(bestAvailableSpawn, spawnLargeVersion, roomJob, roomJobKey, memRoomKey) {
            const availableName = GetAvailableName(roomJob.CreepType);
            if (bestAvailableSpawn && !bestAvailableSpawn.HasSpawned && !bestAvailableSpawn.spawning) { // the closest spawn is found
                let spawnAgileVersion = false;
                if (memRoomKey !== bestAvailableSpawn.pos.roomName) {
                    spawnAgileVersion = true;
                }
                const creepBody = GetCreepBody(roomJob.CreepType, Game.rooms[bestAvailableSpawn.pos.roomName].energyAvailable, spawnLargeVersion, spawnAgileVersion);
                const spawnResult = bestAvailableSpawn.spawnCreep(creepBody, availableName);
                if (spawnResult === OK) {
                    bestAvailableSpawn.HasSpawned = true;
                    Game.creeps[availableName].memory.JobName = roomJobKey;
                    roomJob.Creep = availableName;
                    const creepType = availableName.substring(0, 1);
                    if (Memory.MemRooms[memRoomKey].MaxCreeps[creepType]) {
                        Memory.MemRooms[memRoomKey].MaxCreeps[creepType][availableName] = availableName;
                    }
                    Util.Info('AssignJobs', 'SpawnCreep', 'OK ' + availableName + ' assigned to ' + roomJobKey + ' in ' + memRoomKey + ' spawned at ' + bestAvailableSpawn.name + ' ' + bestAvailableSpawn.pos.roomName + (bestAvailableSpawn.pos.roomName !== memRoomKey ? ' distance ' + Game.map.getRoomLinearDistance(bestAvailableSpawn.pos.roomName, memRoomKey) : ''));
                    Game.map.visual.circle(bestAvailableSpawn.pos, {
                        radius: 8,
                        stroke: '#000000',
                        opacity: 1,
                        lineStyle: 'dashed',
                        strokeWidth: 1
                    });
                    Game.map.visual.text(availableName, bestAvailableSpawn.pos, {
                        color: creepType === 'B' ? '#808000' : creepType === 'T' ? '#7f7f7f' : creepType === 'H' ? '#8080ff' : '#000000',
                        fontSize: 6,
                        opacity: 1
                    });
                    return true;
                } else {
                    Util.Warning('AssignJobs', 'SpawnCreep', 'failed spawning ' + availableName + ' job ' + roomJobKey + ' in ' + memRoomKey + ' spawnResult ' + spawnResult + ' spawn ' + bestAvailableSpawn.name + ' ' + bestAvailableSpawn.pos.roomName + ' room energy: ' + Game.rooms[bestAvailableSpawn.pos.roomName].energyAvailable);
                    return false;
                }
            } else {
                Util.Warning('AssignJobs', 'SpawnCreep', 'no valid spawn for ' + availableName + ', job ' + roomJobKey +
                    (bestAvailableSpawn ? ' spawn ' + bestAvailableSpawn.name + ' in ' + bestAvailableSpawn.pos.roomName
                        + (bestAvailableSpawn.HasSpawned ? ' HasSpawned ' + bestAvailableSpawn.HasSpawned : ' ')
                        + (bestAvailableSpawn.spawning ? ' spawning ' + bestAvailableSpawn.spawning : ' ') : ' no spawn found!'));
                return false;
            }
        }

        /**@return {array}*/
        function GetCreepBody(creepType, energyAvailable, spawnLargeVersion, spawnAgileVersion) {
            let body = [];
            switch (creepType) {
                // harvester
                case 'H':
                    switch (true) {
                        case (energyAvailable >= 2300 && spawnLargeVersion):
                            body = [
                                WORK, WORK, WORK, WORK, WORK,
                                WORK, WORK, WORK, WORK, WORK,
                                WORK, WORK, WORK, WORK, WORK,
                                CARRY, CARRY,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE
                            ];
                            break;
                        case (energyAvailable >= 800): // energyCapacityAvailable: 12900, 5600, 2300, 1800, 1300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 450): // energyCapacityAvailable: 550
                            body = [WORK, WORK, WORK, CARRY, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [WORK, CARRY, MOVE];
                            break;
                    }
                    break;
                // transporter
                case 'T':
                    switch (true) {
                        case (energyAvailable >= 1500): // energyCapacityAvailable: 12900
                            body = [
                                CARRY, CARRY, CARRY, CARRY, CARRY,
                                CARRY, CARRY, CARRY, CARRY, CARRY,
                                CARRY, CARRY, CARRY, CARRY, CARRY,
                                CARRY, CARRY, CARRY, CARRY, CARRY,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE
                            ];
                            break;
                        case (energyAvailable >= 1200): // energyCapacityAvailable: 5600
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 1050): // energyCapacityAvailable: 2300
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 900): // energyCapacityAvailable: 1800
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 600): // energyCapacityAvailable: 1300
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 550
                            body = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 150): // energyCapacityAvailable: 300
                            body = [CARRY, CARRY, MOVE];
                            break;
                        case (energyAvailable >= 100): // energyCapacityAvailable: 300
                            body = [CARRY, MOVE];
                            break;
                    }
                    break;
                // builder
                case 'B':
                    switch (true) {
                        case (energyAvailable >= 3250 && spawnLargeVersion): // energyCapacityAvailable: 12900
                            body = [
                                WORK, WORK, WORK, WORK, WORK,
                                WORK, WORK, WORK, WORK, WORK,
                                WORK, WORK, WORK, WORK, WORK,
                                CARRY, CARRY, CARRY, CARRY, CARRY,
                                CARRY, CARRY, CARRY, CARRY, CARRY,
                                CARRY, CARRY, CARRY, CARRY, CARRY,
                                CARRY, CARRY,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 2350 && spawnAgileVersion): // energyCapacityAvailable: 5600
                            body = [
                                WORK, WORK, WORK, WORK, WORK, WORK, WORK,
                                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 2000): // energyCapacityAvailable: 5600
                            body = [
                                WORK, WORK, WORK, WORK, WORK, WORK, WORK,
                                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 1400): // energyCapacityAvailable: 1800
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 1000): // energyCapacityAvailable: 1300
                            body = [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 400): // energyCapacityAvailable: 550
                            body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [WORK, CARRY, MOVE];
                            break;
                    }
                    break;
                // extractor
                case 'E':
                    switch (true) {
                        case (energyAvailable >= 2200): // energyCapacityAvailable: 12900
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 2050): // energyCapacityAvailable: 5600
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 1300): // energyCapacityAvailable: 1800
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 800): // energyCapacityAvailable: 1300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];
                            break;
                    }
                    break;
                // scout
                case 'S':
                    body = [MOVE];
                    break;
                // claimer
                case 'C':
                    switch (true) {
                        case (energyAvailable >= 850): // energyCapacityAvailable: 1800
                            body = [MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM];
                            break;
                        case (energyAvailable >= 650): // energyCapacityAvailable: 1300
                            body = [MOVE, CLAIM];
                            break;
                    }
                    break;
                // reserver
                case 'R':
                    switch (true) {
                        case (energyAvailable >= 2050): // energyCapacityAvailable: 5600
                            body = [MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM];
                            break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [MOVE, MOVE, CLAIM, CLAIM];
                            break;
                        case (energyAvailable >= 1300): // energyCapacityAvailable: 1800
                            body = [MOVE, MOVE, CLAIM, CLAIM];
                            break;
                        case (energyAvailable >= 800): // energyCapacityAvailable: 1300
                            body = [MOVE, CLAIM];
                            break;
                    }
                    break;
                // warrior
                case 'W':
                    switch (true) {
                        case (energyAvailable >= 2600): // energyCapacityAvailable: 12900
                            body = [
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK
                            ];
                            break;
                        case (energyAvailable >= 2340): // energyCapacityAvailable: 5600
                            body = [
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK
                            ];
                            break;
                        case (energyAvailable >= 2080): // energyCapacityAvailable: 2300
                            body = [
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK
                            ];
                            break;
                        case (energyAvailable >= 1690): // energyCapacityAvailable: 1800
                            body = [
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK
                            ];
                            break;
                        case (energyAvailable >= 780): // energyCapacityAvailable: 1300
                            body = [
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK
                            ];
                            break;
                        case (energyAvailable >= 520): // energyCapacityAvailable: 550
                            body = [
                                MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK
                            ];
                            break;
                        case (energyAvailable >= 390): // energyCapacityAvailable: 550
                            body = [
                                MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK
                            ];
                            break;
                        case (energyAvailable >= 260): // energyCapacityAvailable: 300
                            body = [
                                MOVE, MOVE, ATTACK, ATTACK
                            ];
                            break;
                    }
                    break;
                // gunner
                case 'G':
                    switch (true) {
                        case (energyAvailable >= 5000): // energyCapacityAvailable: 12900
                            body = [
                                RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
                                RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
                                RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
                                RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
                                RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK];
                            break;
                        case (energyAvailable >= 3000): // energyCapacityAvailable: 5600
                            body = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
                                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK];
                            break;
                    }
                    break;
                // medic
                case 'M':
                    switch (true) {
                        case (energyAvailable >= 7500): // energyCapacityAvailable: 12900
                            body = [
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                HEAL, HEAL, HEAL, HEAL, HEAL,
                                HEAL, HEAL, HEAL, HEAL, HEAL,
                                HEAL, HEAL, HEAL, HEAL, HEAL,
                                HEAL, HEAL, HEAL, HEAL, HEAL,
                                HEAL, HEAL, HEAL, HEAL, HEAL];
                            break;
                        case (energyAvailable >= 4800): // energyCapacityAvailable: 5600
                            body = [HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
                                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
                            break;
                        case (energyAvailable >= 1200): // energyCapacityAvailable: 1300
                            body = [
                                MOVE, MOVE, MOVE, MOVE,
                                HEAL, HEAL, HEAL, HEAL
                            ];
                            break;
                        case (energyAvailable >= 550): // energyCapacityAvailable: 550
                            body = [
                                MOVE, HEAL, HEAL
                            ];
                            break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 300
                            body = [
                                MOVE, HEAL
                            ];
                            break;
                    }
                    break;
                // distant harvester
                case 'D':
                    switch (true) {
                        case (energyAvailable >= 3500): // energyCapacityAvailable: 12900
                            body = [
                                WORK, WORK, WORK, WORK, WORK,
                                WORK, WORK, WORK, WORK, WORK,
                                WORK, WORK, WORK, WORK, WORK,
                                WORK, WORK, WORK, WORK, WORK,
                                CARRY, CARRY, CARRY, CARRY, CARRY,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE
                            ];
                            break;
                    }
                    break;
                default:
                    Util.ErrorLog('AssignJobs', 'GetCreepBody', 'creep type  not found' + creepType);
            }
            return body;
        }

        /**@return {string}*/
        function GetAvailableName(creepType) {
            let availableCount = 1;
            while (true) {
                if (Memory.creeps[creepType + availableCount]) {
                    availableCount++;
                } else {
                    break; // name is free
                }
            }
            return creepType + availableCount;
        }
    }
};
module.exports = AssignJobs;