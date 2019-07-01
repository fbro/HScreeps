let CreateJobs = require('v2/CreateJobs');
let AssignJobs = require('v2/AssignJobs');

module.exports.loop = function () {

    if(!Memory.MemRooms){
        Memory.MemRooms = [];
    }

    if(Game.time % 5 === 0){
        if (Game.time % 30 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket
            CreateJobs.run();
        }
        AssignJobs.run(); // TODO
    }
};