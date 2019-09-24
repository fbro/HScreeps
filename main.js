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
    if (!Memory.MemRooms) {
        Memory.MemRooms = new Object();
    }
    Towers.run();
    if (Game.time % 10 === 0) {
        if (Game.time % 30 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket
            CreateJobs.run();
            Links.run();
            Terminals.run();
            if (Game.time % 9000 === 0) {
                console.log('--------------- main reset of memory ---------------');
                for (const memRoomKey in Memory.MemRooms) {
                    const memRoom = Memory.MemRooms[memRoomKey];
                    memRoom.AttachedRooms = undefined;
                    memRoom.PrimaryRoom = undefined;
                    Memory.buyOrdersHistory = {'lastReset':Game.time};
                    memRoom.links = undefined;
                }
            }
        }
        AssignJobs.run();
    }
    ExecuteJobs.run();
};




// TODO:

// add more jobs:
// TODO FillLabMineral
// TODO EmptyLabMineral
// TODO FillPowerSpawnEnergy
// TODO FillPowerSpawnPowerUnits

// add constructions
// add renewCreep functionality
// cache paths to be reused by creeps
// recycle creeps if there are many idle!

// TODO cleanup remove jobImportance on jobs - controller1,2 jobs should be moved further down
// TODO problem with how jobs now are preserved - priority does not shift this means that controller1,2 jobs has a larger priority than they should

// TODO inefficient problem - creeps can be one tick quicker if I try and do the action after the movement