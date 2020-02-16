const Util = {
    // if over target - terminal should send to another owned room that has under the target
    TERMINAL_TARGET_RESOURCE: 3000,
    TERMINAL_TARGET_ENERGY: 30000,
    // if over max - then try and sell
    TERMINAL_MAX_RESOURCE: 6000,
    TERMINAL_MAX_ENERGY: 90000,
    // if storage contains more or equal of high then creep should transfer to terminal until high_transfer is in terminal
    TERMINAL_STORAGE_ENERGY_HIGH: 300000,
    TERMINAL_STORAGE_ENERGY_HIGH_TRANSFER: 100000,
    TERMINAL_STORAGE_ENERGY_MEDIUM: 100000,
    TERMINAL_STORAGE_ENERGY_MEDIUM_TRANSFER: 80000,
    TERMINAL_STORAGE_ENERGY_LOW: 10000, // abort transfer when storage is lower than this
    TERMINAL_STORAGE_ENERGY_LOW_TRANSFER: 50000,

    TERMINAL_STORAGE_HIGH: 10000,
    TERMINAL_STORAGE_HIGH_TRANSFER: 8000,
    TERMINAL_STORAGE_MEDIUM: 6000,
    TERMINAL_STORAGE_MEDIUM_TRANSFER: 6000,
    TERMINAL_STORAGE_LOW: 0, // abort transfer when storage is lower than this
    TERMINAL_STORAGE_LOW_TRANSFER: 6000,

    SPAWN_LARGE_B_WHEN_STORAGE_ENERGY: 100000, // large builders are only allowed when the room has the required energy - the drawback is that upgrade controller takes alot of energy
    SPAWN_EXTRA_B_WHEN_STORAGE_ENERGY: 600000, // allow a spawn of an extra builder when the room is flooding with excess energy

    // job type int enum
    OBJECT_JOB : 1,
    FLAG_JOB : 2,

    MINIMUM_ENERGY_REQUIRED : 200,  // the smallest creep that a spawn can create

    DO_EXTRACTING_WHEN_STORAGE_OVER_ENERGY : 50000, // do not extract minerals when low on storage energy
    DO_EXTRACTING_WHEN_STORAGE_UNDER_MINERAL : 200000, // stop extracting mineral when one has more than this
    RAMPART_WALL_MAX_HITS_WHEN_STORAGE_ENERGY : 600000, // when storage energy is over this value then go crazy with upgrading ramparts and walls
    RAMPART_WALL_HITS_U_LVL8 : 100000,
    RAMPART_WALL_HITS_O_LVL8 : 2000000,

    ErrorLog: function (functionParentName, functionName, message) {
        const messageId = functionParentName + ' ' + functionName;
        console.log('!!--------------- ' + messageId + ' ---------------!!');
        console.log(message);
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
        console.log('----------------- ' + messageId + '----------------- ');
        console.log(message);
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
        console.log('WARNING! ' + functionParentName + ' ' + functionName + ' | ' + message);
    },
    /**@return {number}*/
    FreeSpaces: function (pos) { // get the number of free spaces around a pos
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
};
module.exports = Util;
