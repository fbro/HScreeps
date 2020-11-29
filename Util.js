const Util = {

    TERMINAL_TARGET_RESOURCE: 3000, // if over target - terminal should send to another owned room that has under the target
    TERMINAL_TARGET_ENERGY: 30000,
    TERMINAL_EMPTY_RESOURCE: 20000, // if terminal has over TERMINAL_EMPTY_RESOURCE then it must try and empty it to storage
    TERMINAL_EMPTY_ENERGY: 200000,

    FACTORY_TARGET_RESOURCE: 2000,
    FACTORY_TARGET_ENERGY: 10000,

    // if over max - then try and sell
    TERMINAL_MAX_RESOURCE: 6000,
    TERMINAL_MAX_ENERGY: 100000,
    TERMINAL_BUFFER: 500, // buffer to avoid small sends/sales
    // if storage contains more or equal of high then creep should transfer to terminal until high_transfer is in terminal
    STORAGE_ENERGY_HIGH: 600000,
    STORAGE_ENERGY_HIGH_TRANSFER: 120000,
    STORAGE_ENERGY_MEDIUM: 100000,
    STORAGE_ENERGY_MEDIUM_TRANSFER: 30000,
    STORAGE_ENERGY_LOW: 10000, // abort transfer when storage is lower than this
    STORAGE_ENERGY_LOW_TRANSFER: 0,

    STORAGE_HIGH: 10000,
    STORAGE_HIGH_TRANSFER: 8000,
    STORAGE_MEDIUM: 6000,
    STORAGE_MEDIUM_TRANSFER: 6000,
    STORAGE_LOW: 0, // abort transfer when storage is lower than this
    STORAGE_LOW_TRANSFER: 6000,

    // job type int enum
    OBJECT_JOB: 1,
    FLAG_JOB: 2,

    OBSERVER_SCAN_RADIUS_POWER_DEPOSIT: 5, // the radius around the flagged observer when scanning for power banks or deposits
    DEPOSIT_MAX_LAST_COOLDOWN: 80, // if the deposit is over this value then ignore it and end the deposit job

    TRANSPORTER_MAX_CARRY: 1000, // used in JobAttackPowerBank to generate JobTransportPowerBank
    GENERATE_TRANSPORTER_WHEN_POWERBANK_HITS_UNDER: 250000, // used in JobAttackPowerBank to determine when powerbank hit is low when to generate transporter jobs

    DO_EXTRACTING_WHEN_STORAGE_UNDER_MINERAL: 200000, // stop extracting mineral when one has more than this

    // Game.time % modulo value below - stack expensive ticks on top of each other
    GAME_TIME_MODULO_1: 2,
    GAME_TIME_MODULO_2: 6,
    GAME_TIME_MODULO_3: 12,
    GAME_TIME_MODULO_4: 24,
    GAME_TIME_MODULO_5: 96, // create constructions
    GAME_TIME_MODULO_6: 10800,
    GAME_TIME_MODULO_7: 216000,

    ErrorLog: function (functionParentName, functionName, message) {
        const messageId = functionParentName + ' ' + functionName;
        console.log('!!----------------------------------------------------------------------!!');
        console.log('!!ERROR!! ' + messageId + ' | ' + message);
        if (!Memory.ErrorLog) {
            Memory.ErrorLog = {};
        }
        if (!Memory.ErrorLog[messageId]) {
            Memory.ErrorLog[messageId] = {};
            Memory.ErrorLog[messageId][message] = 1;
        } else if (!Memory.ErrorLog[messageId][message]) {
            Memory.ErrorLog[messageId][message] = 1;
        } else {
            Memory.ErrorLog[messageId][message] = Memory.ErrorLog[messageId][message] + 1;
        }
    },

    InfoLog: function (functionParentName, functionName, message) {
        const messageId = functionParentName + ' ' + functionName;
        console.log('--------------------------------------------------------------------------');
        console.log('--INFO-- ' + messageId + ' | ' + message);
        if (!Memory.InfoLog) {
            Memory.InfoLog = {};
        }
        if (!Memory.InfoLog[messageId]) {
            Memory.InfoLog[messageId] = {};
            Memory.InfoLog[messageId][message] = 1;
        } else if (!Memory.InfoLog[messageId][message]) {
            Memory.InfoLog[messageId][message] = 1;
        } else {
            Memory.InfoLog[messageId][message] = Memory.InfoLog[messageId][message] + 1;
        }
    },

    Info: function (functionParentName, functionName, message) {
        console.log(functionParentName + ' ' + functionName + ' | ' + message);
    },

    Warning: function (functionParentName, functionName, message) {
        console.log('--WARNING-- ' + functionParentName + ' ' + functionName + ' | ' + message);
    },

    /**@return {number}*/
    FreeSpaces: function (pos) { // get the number of free spaces around a pos
        let freeSpaces = 0;
        const terrain = Game.map.getRoomTerrain(pos.roomName);
        for (let x = pos.x - 1; x <= pos.x + 1; x++) {
            for (let y = pos.y - 1; y <= pos.y + 1; y++) {
                const t = terrain.get(x, y);
                if (t !== TERRAIN_MASK_WALL && (pos.x !== x || pos.y !== y)) {
                    freeSpaces++;
                }
            }
        }
        return freeSpaces;
    },

    DeleteJob: function (job, jobKey, roomName) {
        // this.Info('Util', 'DeleteJob', 'job deleted ' + jobKey);
        if (Memory.MemRooms[roomName] && job.JobType === this.FLAG_JOB && job.CreepType !== 'T' && job.CreepType !== 'B') {
            // if job is a flag job then remember to decrease the number og allowed creeps in the room creeptype T and B should never be changed
            if (Memory.MemRooms[roomName].MaxCreeps
                && Memory.MemRooms[roomName].MaxCreeps[job.CreepType]
                && Memory.MemRooms[roomName].MaxCreeps[job.CreepType].M
                && Memory.MemRooms[roomName].MaxCreeps[job.CreepType].M > 0) {
                Memory.MemRooms[roomName].MaxCreeps[job.CreepType].M -= 1;
            }
        }
        Memory.MemRooms[roomName].RoomJobs[jobKey] = undefined;
    },

    CreateRoom: function (roomName, jobs) {
        const gameRoom = Game.rooms[roomName];
        let level = -1;
        let sourceNumber = 0;
        if (gameRoom) {
            if (gameRoom.controller) {
                level = gameRoom.controller.level;
            }
            sourceNumber = gameRoom.find(FIND_SOURCES).length;
        }
        Memory.MemRooms[roomName] = {
            'RoomLevel': level, // 0 to 8 or if there are NO controller then -1
            'RoomJobs': jobs, // JobName - [JobName(x,y)] - user friendly, unique per room, name
            'MaxCreeps': {}, // object that gives information on how many of each type of creep may be in the room and what creeps of that type is in the room
            'SourceNumber': sourceNumber, // number of sources in room
        };
        Util.Info('Util', 'CreateRoom', 'add new room ' + roomName + ' level ' + level + ' sourceNumber ' + sourceNumber + ' jobs ' + JSON.stringify(jobs))
    },

    /**@return {number}*/
    FindNumberOfBuildableStructures: function (gameRoom, structureType) {
        return CONTROLLER_STRUCTURES[structureType][gameRoom.controller.level];
    },

    /**@return {boolean}*/
    IsHighway: function (roomName) {
        const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
        return (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
    },

    /**@return {number}*/
    GenerateOuterRoomPath: function (to, from) { // return length - saves path in Memory
        if (!Memory.Paths) {
            Memory.Paths = {};
        }
        let shouldCalculate = true;
        if (Memory.Paths[to] && Memory.Paths[to][from]) {
            shouldCalculate = false;
        }
        if (shouldCalculate && Game.map.getRoomLinearDistance(to, from) > 15/*creep should not move that much!*/) {
            return -1; // do not calculate this route!
        }
        if (shouldCalculate) { // Use `findRoute` to calculate a high-level plan for this path,
            // prioritizing highways and owned rooms
            const route = Game.map.findRoute(from, to, {
                routeCallback(roomName) {
                    const isHighway = Util.IsHighway(roomName);
                    let isMyRoom = false;
                    if (Game.rooms[roomName] && Game.rooms[roomName].controller) {
                        if (Game.rooms[roomName].controller.my) {
                            isMyRoom = true;
                        }
                    }
                    if (isHighway || isMyRoom) {
                        return 1;
                    } else {
                        return 6;
                    }
                }
            });
            if (!Memory.Paths[to]) {
                Memory.Paths[to] = {};
            }
            let lastRoom = from;
            if (route === ERR_NO_PATH) {
                Util.Warning('Util', 'GenerateOuterRoomPath', 'Path can not be found! from ' + from + ' to ' + to);
                return -1;
            } else {
                for (const roomInRouteKey in route) {
                    const roomInRoute = route[roomInRouteKey];
                    Memory.Paths[to][lastRoom] = roomInRoute.room;
                    lastRoom = roomInRoute.room
                }
                Util.Info('Util', 'GenerateOuterRoomPath', 'new path length ' + route.length + ' from ' + from + ' to ' + to + ' paths ' + JSON.stringify(Memory.Paths[to]));
                return route.length;
            }
        } else {
            let length = 0;
            let hasFoundDestination = false;
            let pointer = from;
            while (!hasFoundDestination) {
                pointer = Memory.Paths[to][pointer];
                length++;
                if (pointer === to) {
                    hasFoundDestination = true;
                }
                if (length > 50) {
                    Util.ErrorLog('Util', 'GenerateOuterRoomPath', 'old path error! length ' + length + ' from ' + from + ' to ' + to + ' deleting path! paths ' + JSON.stringify(Memory.Paths[to]));
                    delete Memory.Paths[to];
                    return -1; // do not calculate this route!
                }
            }
            //Util.Info('Util', 'GenerateOuterRoomPath', 'calculated old path length ' + length + ' from ' + from + ' to ' + to);
            return length;
        }
    },

    MissingSpawnNotification: function (objectPosition) {
        if (Memory.MemRooms[objectPosition.roomName] && Memory.MemRooms[objectPosition.roomName].MissingSpawn !== Game.time) {
            const constructSpawnFlag = _.filter(Game.flags, function (flag) {
                return flag.pos.roomName === objectPosition.roomName && flag.color === COLOR_GREEN && flag.secondaryColor === COLOR_GREY;
            })[0];
            if (!constructSpawnFlag) {
                new RoomVisual(objectPosition.roomName).text('NO SPAWN!', objectPosition.x, objectPosition.y);
                Util.Warning('Util', 'MissingSpawnNotification', objectPosition.roomName + ' no spawn flag found, add flag with primary color green and secondary color grey');
                Game.map.visual.text('NO SPAWN FLAG!', new RoomPosition(25, 25, objectPosition.roomName), {
                    color: '#ff0000',
                    fontSize: 10,
                    opacity: 1
                });
            }
            Memory.MemRooms[objectPosition.roomName].MissingSpawn = Game.time; // only notify once
        }
    },

    GetUsername: function () {
        let username = Memory.Username;
        if (!username) {
            const structure = _.find(Game.structures);
            const creep = _.find(Game.creeps);
            username = (structure ? structure.owner.username : false) || (creep ? creep.owner.username : false);
            Memory.Username = username;
            Util.InfoLog('Util', 'GetUsername', 'username saved ' + username);
        }
        return username;
    },

    /**@return {string}*/
    GetColorCodeFromColor: function (flagColor) {
        switch (flagColor) {
            case COLOR_RED:
                return '#ff0000';
            case COLOR_PURPLE:
                return '#ff00ff';
            case COLOR_BLUE:
                return '#0000ff';
            case COLOR_CYAN:
                return '#00ffff';
            case COLOR_GREEN:
                return '#00ff00';
            case COLOR_YELLOW:
                return '#ffff00';
            case COLOR_ORANGE:
                return '#ff8000';
            case COLOR_BROWN:
                return '#804000';
            case COLOR_GREY:
                return '#808080';
            case COLOR_WHITE:
                return '#ffffff';
        }
    },

    /**@return {boolean}*/
    ShouldRepairFortification: function (fortification) {
        if (!fortification || !fortification.room) {
            return false;
        }
        const hits = fortification.hits;
        const roomLevel = fortification.room.controller.level;
        return (fortification.structureType === STRUCTURE_RAMPART || fortification.structureType === STRUCTURE_WALL) &&
            (
                // rich with energy
                fortification.room.storage && fortification.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_MEDIUM &&
                (
                    roomLevel === 4 && hits < 40000 ||
                    roomLevel === 5 && hits < 80000 ||
                    roomLevel === 6 && hits < 160000 ||
                    roomLevel === 7 && hits < 320000 ||
                    roomLevel === 8 && hits < 640000
                ) ||

                // very rich with energy
                fortification.room.storage && fortification.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_HIGH &&
                (
                    roomLevel === 4 && hits < 400000 ||
                    roomLevel === 5 && hits < 800000 ||
                    roomLevel === 6 && hits < 1600000 ||
                    roomLevel === 7 && hits < 3200000 ||
                    roomLevel === 8 && hits < fortification.hitsMax
                ) ||

                // badly damaged
                roomLevel === 1 && hits < 500 ||
                roomLevel === 2 && hits < 1000 ||
                roomLevel === 3 && hits < 2000 ||
                roomLevel === 4 && hits < 4000 ||
                roomLevel === 5 && hits < 8000 ||
                roomLevel === 6 && hits < 16000 ||
                roomLevel === 7 && hits < 32000 ||
                roomLevel === 8 && hits < 64000
            );
    },

    /**@return {boolean}*/
    IsProductionChain: function (factory, resourceTypeNeeded, resourceTypeProduced, resourceBasic) {
        return factory.room.storage.store.getUsedCapacity(resourceTypeNeeded) > 0
            || factory.room.storage.store.getUsedCapacity(resourceTypeProduced) > 0
            || factory.room.storage.store.getUsedCapacity(resourceBasic) > 0
            || factory.room.terminal.store.getUsedCapacity(resourceTypeNeeded) > 0
            || factory.room.terminal.store.getUsedCapacity(resourceTypeProduced) > 0
            || factory.room.terminal.store.getUsedCapacity(resourceBasic) > 0
            || factory.store.getUsedCapacity(resourceTypeNeeded) > 0
            || factory.store.getUsedCapacity(resourceTypeProduced) > 0
            || factory.store.getUsedCapacity(resourceBasic) > 0;
    },

};
module.exports = Util;
