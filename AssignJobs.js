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
            const availableSpawns = _.filter(Game.spawns, function (spawn) {
                return spawn.spawning === null && spawn.room.energyAvailable >= Util.MINIMUM_ENERGY_REQUIRED;
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
                                const availableSpawnsInRoom = _.filter(availableSpawns, function (spawn) {
                                    return spawn && spawn.room.name === memRoomKey;
                                });
                                creepFound = SpawnCreep(roomJob, availableSpawns, availableSpawnsInRoom, roomJobKey, memRoomKey);
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
                if (idleCreep.pos.roomName === memRoomKey && idleCreep.name.startsWith(roomJob.CreepType)) {
                    // idle creep is in memory room with vacant job and matching job type
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
        function SpawnCreep(roomJob, availableSpawns, availableSpawnsInRoom, roomJobKey, memRoomKey) {
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
                                if(!_.find(Game.spawns, function (spawn) {
                                    return spawn.pos.roomName === gameRoom;
                                })){
                                    Util.Info('AssignJobs', 'SpawnCreep', 'and no spawns at all' + roomJobKey);
                                    maxLinearDistance = Number.MAX_SAFE_INTEGER;
                                }
                            } else {
                                spawnLargeVersion = ShouldSpawnLargeVersion(gameRoom, roomJob, roomJobKey, memRoomKey);
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
                const bestAvailableSpawn = FindBestSpawn(availableSpawns, availableSpawnsInRoom, maxLinearDistance, roomJob, memRoomKey);

                return SpawningCreep(bestAvailableSpawn, spawnLargeVersion, roomJob, roomJobKey, memRoomKey);
            }
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
                        if (memRoom.RoomLevel < 3) {
                            maxCreepsInRoom += memRoom.SourceNumber;
                        }
                        break;
                    case 'B': // builder
                        maxCreepsInRoom = 2;
                        if (memRoom.RoomLevel < 8) {
                            maxCreepsInRoom += 1;
                            if (memRoom.RoomLevel < 3) {
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
        function ShouldSpawnLargeVersion(gameRoom, roomJob, roomJobKey, memRoomKey) {
            let spawnLargeVersion = false;
            if (roomJob.CreepType === 'H' && gameRoom.storage) { // logic only relevant for harvester
                const source = gameRoom.find(FIND_SOURCES)[0];
                for (const effectKey in source.effects) {
                    if (source.effects[effectKey].effect === PWR_REGEN_SOURCE) {
                        //Util.Info('AssignJobs', 'SpawnCreep', 'Harvester spawning uses large version because of PWR_REGEN_SOURCE ' + source.effects[effectKey].effect + ' ' + memRoomKey);
                        spawnLargeVersion = true;
                        break;
                    }
                }
            } else if (roomJob.CreepType === 'B' && gameRoom.storage && gameRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_MEDIUM/*large builders are only allowed when the room has the required energy - the drawback is that upgrade controller takes alot of energy*/) {
                spawnLargeVersion = true;
            }
            return spawnLargeVersion;
        }

        function FindBestSpawn(availableSpawns, availableSpawnsInRoom, bestLinearDistance, roomJob, memRoomKey) {
            let bestAvailableSpawn;
            let bestAvailableSpawnCounter;
            let timeToLiveMaxRoomRange;
            if(roomJob.CreepType === 'C' || roomJob.CreepType === 'R'){ //  creep with CLAIM body parts
                timeToLiveMaxRoomRange = 8; // 600 time to live / 50 max room tile - 4 for elbow room
            }else {
                timeToLiveMaxRoomRange = 20; // 1500 time to live / 50 max room tile - 10 for elbow room
            }
            for (const availableSpawnCounter in availableSpawns) { // find closest spawn
                const availableSpawn = availableSpawns[availableSpawnCounter];

                if (availableSpawnsInRoom.length > 0) { // spawn in room if possible
                    if (availableSpawn.id === availableSpawnsInRoom[0].id) {
                        bestAvailableSpawn = availableSpawnsInRoom[0];
                        bestAvailableSpawnCounter = availableSpawnCounter;
                        delete availableSpawnsInRoom[0];
                        break;
                    }
                } else {
                    const linearDistance = Game.map.getRoomLinearDistance(availableSpawn.pos.roomName, memRoomKey);
                    if(linearDistance <= timeToLiveMaxRoomRange) { // spawn cannot be too far away
                        let energyAvailableModifier = 0;
                        if (roomJob.JobType === Util.FLAG_JOB) { // on flag jobs one wants to share the load between rooms with more energy
                            switch (true) {
                                case !availableSpawn.room.storage || availableSpawn.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) < Util.STORAGE_ENERGY_LOW: // do not spawn for a flag job when the storage has under STORAGE_ENERGY_MEDIUM
                                    energyAvailableModifier = Number.MAX_SAFE_INTEGER;
                                    break;
                                case availableSpawn.room.energyAvailable < 500:
                                    energyAvailableModifier = -1;
                                    break;
                                case availableSpawn.room.energyAvailable < 1000:
                                    energyAvailableModifier = -2;
                                    break;
                                case availableSpawn.room.energyAvailable < 2000:
                                    energyAvailableModifier = -3;
                                    break;
                                case availableSpawn.room.energyAvailable < 3000:
                                    energyAvailableModifier = -4;
                                    break;
                                case availableSpawn.room.energyAvailable < 4000:
                                    energyAvailableModifier = -5;
                                    break;
                                case availableSpawn.room.energyAvailable < 5000:
                                    energyAvailableModifier = -6;
                                    break;
                                case availableSpawn.room.energyAvailable < 6000:
                                    energyAvailableModifier = -7;
                                    break;
                                case availableSpawn.room.energyAvailable < 7000:
                                    energyAvailableModifier = -8;
                                    break;
                                case availableSpawn.room.energyAvailable < 8000:
                                    energyAvailableModifier = -9;
                                    break;
                                case availableSpawn.room.energyAvailable < 9000:
                                    energyAvailableModifier = -10;
                                    break;
                                case availableSpawn.room.energyAvailable < 10000:
                                    energyAvailableModifier = -11;
                                    break;
                                case availableSpawn.room.energyAvailable > 10000:
                                    energyAvailableModifier = -12;
                                    break;
                            }
                        }
                        if ((energyAvailableModifier + linearDistance) < bestLinearDistance && energyAvailableModifier !== Number.MAX_SAFE_INTEGER) {
                            bestLinearDistance = energyAvailableModifier + linearDistance;
                            bestAvailableSpawn = availableSpawn;
                            bestAvailableSpawnCounter = availableSpawnCounter;
                        }
                    }
                }
            }
            delete availableSpawns[bestAvailableSpawnCounter];
            return bestAvailableSpawn;
        }

        /**@return {boolean}*/
        function SpawningCreep(bestAvailableSpawn, spawnLargeVersion, roomJob, roomJobKey, memRoomKey) {
            if (bestAvailableSpawn) { // the closest spawn is found
                const availableName = GetAvailableName(roomJob.CreepType);
                let spawnAgileVersion = false;
                if(memRoomKey !== bestAvailableSpawn.pos.roomName){
                    spawnAgileVersion = true;
                }
                const creepBody = GetCreepBody(roomJob.CreepType, Game.rooms[bestAvailableSpawn.pos.roomName].energyAvailable, spawnLargeVersion, spawnAgileVersion);
                const spawnResult = bestAvailableSpawn.spawnCreep(creepBody, availableName);
                if (spawnResult === OK) {
                    Game.creeps[availableName].memory.JobName = roomJobKey;
                    roomJob.Creep = availableName;
                    if (Memory.MemRooms[memRoomKey].MaxCreeps[availableName.substring(0, 1)]) {
                        Memory.MemRooms[memRoomKey].MaxCreeps[availableName.substring(0, 1)][availableName] = availableName;
                    }
                    Util.Info('AssignJobs', 'SpawnCreep', 'OK ' + availableName + ' assigned to ' + roomJobKey + ' in ' + memRoomKey + ' spawned at ' + bestAvailableSpawn.name + ' ' + bestAvailableSpawn.pos.roomName + (bestAvailableSpawn.pos.roomName !== memRoomKey ? ' distance ' + Game.map.getRoomLinearDistance(bestAvailableSpawn.pos.roomName, memRoomKey) : ''));
                    return true;
                } else {
                    Util.Warning('AssignJobs', 'SpawnCreep', 'failed ' + availableName + ' assigned to ' + roomJobKey + ' in ' + memRoomKey + ' spawnResult ' + spawnResult + ' spawn ' + bestAvailableSpawn.name + ' ' + bestAvailableSpawn.pos.roomName + ' room energy: ' + Game.rooms[bestAvailableSpawn.pos.roomName].energyAvailable);
                    return false;
                }
            }else{
                Util.Warning('AssignJobs', 'SpawnCreep', 'bestAvailableSpawn not found, assigned to ' + roomJobKey + ' in ' + memRoomKey);
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