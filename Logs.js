const Logs = {
    Error: function (messageId, message) {
        console.log('!!--------------- ' + messageId + ' ---------------!!');
        console.log('Logs Error ' + message);
        console.log('!!--------------- ' + messageId + ' ---------------!!');
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
        console.log('Logs Info ' + messageId + ' | ' + message);
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
    }
};
module.exports = Logs;