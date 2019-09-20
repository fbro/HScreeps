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

// TODO transporters should look at a job and set it to done if it looks complete - need to do this because of job persistence


// TODO rewrite MaxCreeps system to instead of using counting then using creep names to monitor if a creep dies it gets "removed" from the right MaxCreeps-room if the creep has moved to another room
// TODO add code to rescue stranded idle creeps from other rooms - is done but could be rewritten if i rewrite MaxCreeps

// TODO cleanup remove jobImportance on jobs - controller1,2 jobs should be moved further down
// TODO problem with how jobs now are preserved - priority does not shift this means that controller1,2 jobs has a larger priority than they should