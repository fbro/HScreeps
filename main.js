let CreateJobs = require('CreateJobs');
let AssignJobs = require('AssignJobs');
let ExecuteJobs = require('ExecuteJobs');
let Towers = require('Towers');
let Links = require('Links');
let Terminals = require('Terminals');
let PowerSpawns = require('PowerSpawns');
let Logs = require('Logs');
let Observers = require('Observers');
let PowerCreeps = require('PowerCreeps');

module.exports.loop = function () {
    if (!Memory.MemRooms) {
        Memory.MemRooms = new Object();
    }
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
                    memRoom.links = undefined;
                    if (memRoom.RoomLevel <= 0 && Object.keys(memRoom.RoomJobs).length === 0) {
                        // room is unowned and there are no jobs in it - remove the room
                        console.log('-------- removing unused room ' + memRoomKey + ' from Memory --------');
                        Memory.MemRooms[memRoomKey] = undefined;
                        Logs.Info('removed unused room', memRoomKey);
                    }
                }
            }
        }
        AssignJobs.run();
    }
    ExecuteJobs.run();
    for (const gameRoomKey in Game.rooms) {
        const gameRoom = Game.rooms[gameRoomKey];
        Towers.run(gameRoom);
        Observers.run(gameRoom, gameRoomKey);
        PowerSpawns.run(gameRoom);
    }
    PowerCreeps.run();
};

// TODO:

// add more jobs:
// TODO HarvestDeposit

// TODO power bank harvesting - avoid enemy rooms

// TODO add ruin as alternate resource pickup

// avoid enemy rooms when traveling long distances
// if doing long distance work creep should make sure it has enough timeToLive to do the job
// handle links at room exits for remote harvests
// add constructions
// add renewCreep functionality
// cache paths to be reused by creeps
// recycle creeps if there are many idle!
// monitor creeps and see if they can work more quickly by optimizing its actions - remove "pausing" ticks