let MemRooms = require('v2/MemRooms');

module.exports.loop = function () {

    if(!Memory.MemRooms){
        Memory.MemRooms = [];
    }

    if (Game.time % 30 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket
        MemRooms.run(); // TODO
    }
};