let CreateJobs = require('v2/CreateJobs');
let AssignJobs = require('v2/AssignJobs');
let ExecuteJobs = require('v2/ExecuteJobs');
let Towers = require('v2/Towers');
let Links = require('v2/Links');

module.exports.loop = function () {

    if(!Memory.MemRooms){
        Memory.MemRooms = [];
    }
    Towers.run();
    if(Game.time % 5 === 0){
        if (Game.time % 30 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket
            CreateJobs.run();
            Links.run();
        }
        AssignJobs.run();
    }
    ExecuteJobs.run();
};


// TODO:
// TEST !!!!!!!!!!!!!!!!!!!!!!!
// add more jobs...
// add terminal logic
// add constructions

// pickup dropped resources on its path if possible
// place its stuff in nearby container if possible
// and if bypassing an empty spawn/extension and you carry energy

// all **idle** creeps should move to storage and place all its content in storage
// recycle creeps if there are many idle!