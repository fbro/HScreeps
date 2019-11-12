let Logs = require('Logs');
const AssignJobs = {
    run: function () {

        const MINIMUM_ENERGY_REQUIRED = 200; // the smallest creep that a spawn can create
        const FLAG_JOB = 2;

        // assign jobs to creeps or create the creeps like this:
        // look for idle creep with correct type in room
        // if failed then create that creep in room
        // TODO if that failed then create it in the closest room with enough energy at its disposal

        // different creep types for different jobs
        /*creep types:
        * [T] transporter       no WORK
        * [H] harvester         only one CARRY
        * [B] builder           equal WORK and CARRY
        * [E] extractor         only one CARRY and maxed out WORK
        * [S] scout             just a MOVE
        * [C] claimer           CLAIM - one CLAIM
        * [R] reserver          CLAIM - many CLAIM when reserving
        * [W] warrior           ATTACK and MOVE
        * [D] distantHarvester  equal WORK and CARRY
        * [G] gunner            RANGED_ATTACK and MOVE - needs clever attack pattern to avoid creeps with ATTACK body parts
        * [M] medic             HEAL
        */

        AssignOrSpawnCreeps();

        // loop through vacant jobs per room and see if an idle creep could be assigned or a new creep should be spawned
        function AssignOrSpawnCreeps() {
            const idleCreeps = _.filter(Game.creeps, function (creep) {
                return creep.memory.JobName.startsWith('idle');
            });
            const availableSpawns = _.filter(Game.spawns, function (spawn) {
                return spawn.spawning === null && spawn.room.energyAvailable >= MINIMUM_ENERGY_REQUIRED;
            });
            for (const memRoomKey in Memory.MemRooms) {
                const memRoom = Memory.MemRooms[memRoomKey];
                if(!memRoom){
                    continue;
                }
                // TODO what about many idle creeps in one room that could be moved to another room
                // TODO what about idle creeps that could take a job in another neutral room so that one does not need to spawn a new creep
                for (const roomJobKey in memRoom.RoomJobs) {
                    const roomJob = memRoom.RoomJobs[roomJobKey];
                    if (roomJob && roomJob.Creep === 'vacant') {
                        let creepFound = AssignCreep(roomJob, idleCreeps, roomJobKey, memRoomKey);
                        if (!creepFound) {
                            creepFound = AssignCreepOtherRoom(roomJob, idleCreeps, roomJobKey, memRoomKey);
                            if(!creepFound){
                                creepFound = SpawnCreep(roomJob, availableSpawns, roomJobKey);
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
                    roomJob.Creep = idleCreep.name;
                    //console.log('AssignJobs AssignCreeps ' + idleCreep.name + ' assigned to ' + roomJobKey + ' in ' + memRoomKey);
                    delete idleCreeps[idleCreepCounter];
                    return true;
                }
            }
            return false;
        }

        /**@return {boolean}*/
        function AssignCreepOtherRoom(roomJob, idleCreeps, roomJobKey, memRoomKey){
            if(roomJob.JobType === FLAG_JOB){
                // loop through all creeps of desired creepType and assign the nearest one to the job
                let nearestCreep;
                let bestRange = Number.MAX_SAFE_INTEGER;
                let bestIdleCreepCounter;
                for (const idleCreepCounter in idleCreeps) {
                    const idleCreep = idleCreeps[idleCreepCounter];
                    if(idleCreep.name.startsWith(roomJob.CreepType)){
                        const linearDistance = Game.map.getRoomLinearDistance(memRoomKey, idleCreep.pos.roomName);
                        if(bestRange > linearDistance){
                            bestRange = linearDistance;
                            nearestCreep = idleCreep;
                            bestIdleCreepCounter = idleCreepCounter;
                        }
                    }
                }
                if(nearestCreep){
                    nearestCreep.memory.JobName = roomJobKey;
                    roomJob.Creep = nearestCreep.name;
                    delete idleCreeps[bestIdleCreepCounter];
                    return true;
                }
            }
            return false; // for now, do not assign creeps of type OBJECT_JOB to other rooms
        }

        /**@return {boolean}*/
        function SpawnCreep(roomJob, availableSpawns, roomJobKey) {
            const roomOnJobKey = roomJobKey.split(')').pop();

            // if idle creep not found for vacant job then look if spawn is possible
            if (ShouldSpawnCreep(roomJob.CreepType, roomOnJobKey)) {
                const availableName = GetAvailableName(roomJob.CreepType);
                let bestLinearDistance = 1; // normally creeps should only be spawned in the room they are needed

                // job in another room
                if (Game.rooms[roomOnJobKey]) { // job in invisible room
                    if (Game.rooms[roomOnJobKey].controller) { // flag in controller-less room
                        if (Game.rooms[roomOnJobKey].controller.my) { // not my room
                            if (Game.rooms[roomOnJobKey].find(FIND_MY_SPAWNS).length === 0) { // no spawn in my room
                                console.log('AssignJobs SpawnCreeps job in another room, no spawns ' + roomJobKey);
                                bestLinearDistance = Number.MAX_SAFE_INTEGER;
                            }
                        } else {
                            console.log('AssignJobs SpawnCreeps job in another room, not my room ' + roomJobKey);
                            bestLinearDistance = Number.MAX_SAFE_INTEGER;
                        }
                    } else {
                        console.log('AssignJobs SpawnCreeps job in another room, no controller ' + roomJobKey);
                        bestLinearDistance = Number.MAX_SAFE_INTEGER;
                    }
                } else {
                    console.log('AssignJobs SpawnCreeps job in another room, invisible room ' + roomJobKey);
                    bestLinearDistance = Number.MAX_SAFE_INTEGER;
                }

                let bestAvailableSpawn;
                let bestAvailableSpawnCounter;
                for (const availableSpawnCounter in availableSpawns) { // find closest spawn
                    const availableSpawn = availableSpawns[availableSpawnCounter];
                    const linearDistance = Game.map.getRoomLinearDistance(availableSpawn.pos.roomName, roomOnJobKey);
                    let energyAvailableModifier = 0;
                    switch (true) {
                        case availableSpawn.room.energyAvailable < 500:
                            energyAvailableModifier = -1;
                            break;
                        case availableSpawn.room.energyAvailable < 1000:
                            energyAvailableModifier = -2;
                            break;
                        case availableSpawn.room.energyAvailable < 2000:
                            energyAvailableModifier = -3;
                            break;
                        case availableSpawn.room.energyAvailable < 4000:
                            energyAvailableModifier = -4;
                            break;
                        case availableSpawn.room.energyAvailable > 4000:
                            energyAvailableModifier = -5;
                            break;
                    }
                    if ((energyAvailableModifier + linearDistance) < bestLinearDistance || Memory.MemRooms[roomOnJobKey].PrimaryRoom === availableSpawn.pos.roomName) {
                        bestLinearDistance = linearDistance;
                        bestAvailableSpawn = availableSpawn;
                        bestAvailableSpawnCounter = availableSpawnCounter;
                    }
                    // get on with it if a spawn in room is found or if the primary room is found
                    if (bestLinearDistance === 0 || Memory.MemRooms[roomOnJobKey].PrimaryRoom === availableSpawn.pos.roomName) {
                        break;
                    }
                }
                if (bestAvailableSpawn) { // the closest spawn is found
                    const spawnResult = bestAvailableSpawn.spawnCreep(GetCreepBody(roomJob.CreepType, Game.rooms[bestAvailableSpawn.pos.roomName].energyAvailable), availableName);
                    if (spawnResult === OK) {
                        Game.creeps[availableName].memory.JobName = roomJobKey;
                        roomJob.Creep = availableName;
                        if (Memory.MemRooms[roomOnJobKey].MaxCreeps[availableName.substring(0, 1)]) {
                            Memory.MemRooms[roomOnJobKey].MaxCreeps[availableName.substring(0, 1)][availableName] = availableName;
                        }
                        console.log('AssignJobs SpawnCreeps OK ' + availableName + ' assigned to ' + roomJobKey + ' in ' + roomOnJobKey + ' spawn ' + bestAvailableSpawn.name);
                        delete availableSpawns[bestAvailableSpawnCounter];
                        return true;
                    }else{
                        console.log('AssignJobs SpawnCreeps failed ' + availableName + ' assigned to ' + roomJobKey + ' in ' + roomOnJobKey + ' spawnResult ' + spawnResult + ' spawn ' + bestAvailableSpawn.name + ' room energy: ' + Game.rooms[bestAvailableSpawn.pos.roomName].energyAvailable);
                        return false;
                    }
                }
            }
        }

        /**@return {boolean}*/
        function ShouldSpawnCreep(creepType, roomKey) {
            const memRoom = Memory.MemRooms[roomKey];
            let maxCreepsInRoom = 3;
            if (memRoom.MaxCreeps[creepType]) {
                maxCreepsInRoom = memRoom.MaxCreeps[creepType].MaxCreepsInRoom;
            } else { // this code should only run when a reset happens
                switch (creepType) {
                    case 'T': // transporter
                        maxCreepsInRoom = memRoom.SourceNumber;
                        break;
                    case 'H': // harvester
                        maxCreepsInRoom = memRoom.SourceNumber;
                        break;
                    case 'B': // builder
                        maxCreepsInRoom = 2;
                        break;
                    case 'E': // extractor
                        maxCreepsInRoom = 1;
                        break;
                    case 'W': // warrior
                    case 'G': // gunner
                    case 'M': // medic
                    case 'S': // scout
                    case 'C': // claimer
                    case 'R': // reserver
                    case 'D': // distantHarvester
                        maxCreepsInRoom = 3;
                        break;
                    default:
                        Logs.Error('AssignJobs-ShouldSpawnCreep-creepTypeNotFound', 'AssignJobs ShouldSpawnCreep ERROR! creepType not found ' + creepType);
                }
                memRoom.MaxCreeps[creepType] = {
                    'MaxCreepsInRoom': maxCreepsInRoom,
                };
                // loop through all creeps
                let addedCreeps = '';
                for (const creepName in Game.creeps) {
                    const gameCreep = Game.creeps[creepName];
                    if (gameCreep.name.substring(0, 1) === creepType) {
                        if (gameCreep.memory.JobName.split(')').pop() === roomKey) { // creep that is employed in this room
                            memRoom.MaxCreeps[creepType][gameCreep.name] = gameCreep.name;
                            addedCreeps += gameCreep.name + ' '
                        }
                    }
                }
                Logs.Info('new MaxCreeps', creepType + ' ' + roomKey + ' maxCreepsInRoom ' + maxCreepsInRoom + ' addedCreeps ' + addedCreeps);
            }
            return (Object.keys(memRoom.MaxCreeps[creepType]).length - 1) < maxCreepsInRoom;
        }

        /**@return {array}*/
        function GetCreepBody(creepType, energyAvailable) {
            let body = [];
            switch (creepType) {
                // harvester
                case 'H':
                    switch (true) {
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
                        case (energyAvailable >= 1350): // energyCapacityAvailable: 12900
                            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
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
                        case (energyAvailable >= 2200): // energyCapacityAvailable: 12900
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 2000): // energyCapacityAvailable: 5600
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
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
                        case (energyAvailable >= 3250): // energyCapacityAvailable: 12900
                            body = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, CLAIM];
                            break;
                        case (energyAvailable >= 2050): // energyCapacityAvailable: 5600
                            body = [TOUGH, TOUGH, MOVE, MOVE, MOVE, CLAIM];
                            break;
                        case (energyAvailable >= 1800): // energyCapacityAvailable: 2300
                            body = [TOUGH, MOVE, MOVE, CLAIM];
                            break;
                        case (energyAvailable >= 1300): // energyCapacityAvailable: 1800
                            body = [TOUGH, MOVE, MOVE, CLAIM];
                            break;
                        case (energyAvailable >= 800): // energyCapacityAvailable: 1300
                            body = [TOUGH, MOVE, MOVE, CLAIM];
                            break;
                    }
                    break;
                // reserver
                case 'R':
                    switch (true) {
                        case (energyAvailable >= 3250): // energyCapacityAvailable: 12900
                            body = [MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM, CLAIM, CLAIM];
                            break;
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
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                ATTACK
                            ];
                            break;
                        case (energyAvailable >= 2340): // energyCapacityAvailable: 5600
                            body = [
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE,
                                ATTACK
                            ];
                            break;
                        case (energyAvailable >= 2080): // energyCapacityAvailable: 2300
                            body = [
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE,
                                ATTACK
                            ];
                            break;
                        case (energyAvailable >= 1690): // energyCapacityAvailable: 1800
                            body = [
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                ATTACK, ATTACK,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE,
                                ATTACK
                            ];
                            break;
                        case (energyAvailable >= 1300): // energyCapacityAvailable: 1300
                            body = [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK];
                            break;
                        case (energyAvailable >= 520): // energyCapacityAvailable: 550
                            body = [ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, ATTACK];
                            break;
                        case (energyAvailable >= 260): // energyCapacityAvailable: 300
                            body = [ATTACK, MOVE, MOVE, ATTACK];
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
                        case (energyAvailable >= 2000): // energyCapacityAvailable: 2300
                            body = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
                                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK];
                            break;
                        case (energyAvailable >= 1400): // energyCapacityAvailable: 1800
                            body = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK];
                            break;
                        case (energyAvailable >= 1000): // energyCapacityAvailable: 1300
                            body = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK];
                            break;
                        case (energyAvailable >= 400): // energyCapacityAvailable: 550
                            body = [RANGED_ATTACK, MOVE, MOVE, RANGED_ATTACK];
                            break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [MOVE, RANGED_ATTACK];
                            break;
                    }
                    break;
                // distant transporter
                case 'D':
                    switch (true) {
                        case (energyAvailable >= 1500): // energyCapacityAvailable: 12900
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 1250): // energyCapacityAvailable: 5600
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 1000): // energyCapacityAvailable: 2300
                            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 750): // energyCapacityAvailable: 1800
                            body = [WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 500): // energyCapacityAvailable: 1300
                            body = [WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];
                            break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 550
                            body = [WORK, CARRY, MOVE];
                            break;
                        case (energyAvailable >= 200): // energyCapacityAvailable: 300
                            body = [WORK, CARRY, MOVE];
                            break;
                    }
                    break;
                // medic
                case 'M':
                    switch (true) {
                        case (energyAvailable >= 7500): // energyCapacityAvailable: 12900
                            body = [
                                HEAL, HEAL, HEAL, HEAL, HEAL,
                                HEAL, HEAL, HEAL, HEAL, HEAL,
                                HEAL, HEAL, HEAL, HEAL, HEAL,
                                HEAL, HEAL, HEAL, HEAL, HEAL,
                                HEAL, HEAL, HEAL, HEAL,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE,
                                MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
                            break;
                        case (energyAvailable >= 4800): // energyCapacityAvailable: 5600
                            body = [HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
                                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
                            break;
                        case (energyAvailable >= 2100): // energyCapacityAvailable: 2300
                            body = [HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
                            break;
                        case (energyAvailable >= 1500): // energyCapacityAvailable: 1800
                            body = [HEAL, HEAL, HEAL, HEAL, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
                            break;
                        case (energyAvailable >= 1200): // energyCapacityAvailable: 1300
                            body = [HEAL, HEAL, HEAL, MOVE, MOVE, MOVE, MOVE, HEAL];
                            break;
                        case (energyAvailable >= 480): // energyCapacityAvailable: 550
                            body = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, HEAL];
                            break;
                        case (energyAvailable >= 300): // energyCapacityAvailable: 300
                            body = [MOVE, HEAL];
                            break;
                    }
                    break;
                default:
                    Logs.Error('AssignJobs-GetCreepBody-creepTypeNotFound', 'AssignJobs GetCreepBody ERROR! creepType not found ' + creepType);
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