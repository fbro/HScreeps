const Logs = {
    Error: function (messageId, message) {
        console.log('!!--------------- ' + messageId + ' ' + Game.shard.name  + ' ---------------!!');
        console.log('Logs Error ' + message);
        console.log('!!--------------- ' + messageId + ' ' + Game.shard.name  + ' ---------------!!');
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
    Info: function (messageId, message) {
        console.log('Logs Info ' + messageId + ' ' + Game.shard.name + ' | ' + message);
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
    Warning: function (messageId, message) {
        console.log('WARNING! ' + messageId + ' ' + Game.shard.name + ' | ' + message);
    }
};
module.exports = Logs;