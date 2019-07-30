let CreateJobs = require('CreateJobs');
let AssignJobs = require('AssignJobs');
let ExecuteJobs = require('ExecuteJobs');
let Towers = require('Towers');
let Links = require('Links');

module.exports.loop = function () {

    if(!Memory.MemRooms){
        Memory.MemRooms = new Object();
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
    // spawn is crazy
    // memRooms disappears
    // jobs are not executed
// add more jobs...
// add terminal logic
// add constructions

// pickup dropped resources on its path if possible
// place its stuff in nearby container if possible
// and if bypassing an empty spawn/extension and you carry energy

// all **idle** creeps should move to storage and place all its content in storage
// recycle creeps if there are many idle!