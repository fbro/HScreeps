const Util = {
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
    FreeSpaces: function(pos) { // get the number of free spaces around a pos
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
