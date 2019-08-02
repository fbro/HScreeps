let CreateJobs = require('CreateJobs');
let AssignJobs = require('AssignJobs');
let ExecuteJobs = require('ExecuteJobs');
let Towers = require('Towers');
let Links = require('Links');
let Terminals = require('Terminals');

module.exports.loop = function () {

    /*for(const creepName in Memory.creeps) {
        const gameCreep = Game.creeps[creepName];
        if(gameCreep === undefined){
            console.log('debug-cleanup creep removed ' + creepName);
            delete Memory.creeps[creepName];
        }
    }*/
    if(!Memory.MemRooms){
        Memory.MemRooms = new Object();
    }
    Towers.run();
    if(Game.time % 5 === 0){
        if (Game.time % 30 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket
            CreateJobs.run();
            Links.run();
            Terminals.run();
        }
        AssignJobs.run();
    }
    ExecuteJobs.run();
};


// TODO:
// add more jobs
// add constructions

// pickup dropped resources on its path if possible
// place its stuff in nearby container if possible

// all **idle** creeps should move to storage and place all its content in storage
// recycle creeps if there are many idle!