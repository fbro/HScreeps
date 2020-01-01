let CreateJobs = require('CreateJobs');
let AssignJobs = require('AssignJobs');
let ExecuteJobs = require('ExecuteJobs');
let Towers = require('Towers');
let Links = require('Links');
let Terminals = require('Terminals');
let Factories = require('Factories');
let PowerSpawns = require('PowerSpawns');
let Logs = require('Logs');
let Observers = require('Observers');
let PowerCreeps = require('PowerCreeps');

module.exports.loop = function () {
    if (!Memory.MemRooms) {
        Memory.MemRooms = {};
    }
    if (Game.time % 10 === 0) {
        if (Game.time % 30 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket
            CreateJobs.run();
            Links.run();
            if (Game.time % 9000 === 0) {
                console.log('--------------- main reset of memory ---------------');
                delete Memory.Paths;
                const foundCreeps = {};
                for (const memRoomKey in Memory.MemRooms) {
                    const memRoom = Memory.MemRooms[memRoomKey];
                    memRoom.links = undefined;
                    // search through MaxCreeps to see if they all have an alive creep and that there are only one of each creep names in MaxCreeps
                    for (const creepTypesKey in memRoom.MaxCreeps) {
                        for (const creepKey in memRoom.MaxCreeps[creepTypesKey]) {
                            if(creepKey !== 'M'){
                                let foundCreep = false;
                                for (const creepName in Memory.creeps) {
                                    if(creepName === creepKey){
                                        foundCreep = true;
                                        for (const foundCreepsKey in foundCreeps) {
                                            if(foundCreepsKey === creepKey){
                                                foundCreep = false;
                                                break;
                                            }
                                        }
                                        foundCreeps[creepKey] = memRoomKey;
                                        break;
                                    }
                                }
                                if(!foundCreep){
                                    Logs.Error('Lingering MaxCreeps found and removed', creepKey + ' in ' + memRoomKey);
                                    memRoom.MaxCreeps[creepTypesKey][creepKey] = undefined;
                                }
                            }
                        }
                    }
                    if (memRoom.RoomLevel <= 0 && Object.keys(memRoom.RoomJobs).length === 0) {
                        // room is unowned and there are no jobs in it - remove the room
                        Memory.MemRooms[memRoomKey] = undefined;
                        Logs.Info('removed unused room', memRoomKey);
                    }
                }
            }
            Terminals.run();
            Factories.run();
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

// TODO Move interroom simplification - try and move in hallways!!!
// TODO power bank harvesting - avoid enemy rooms
// avoid enemy rooms when traveling long distances


// if doing long distance work creep should make sure it has enough timeToLive to do the job
// add constructions
// add renewCreep functionality
// cache paths to be reused by creeps
// recycle creeps if there are many idle!
// monitor creeps and see if they can work more quickly by optimizing its actions - remove 'pausing' ticks