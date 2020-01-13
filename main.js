let CreateJobs = require('CreateJobs');
let AssignJobs = require('AssignJobs');
let ExecuteJobs = require('ExecuteJobs');
let Towers = require('Towers');
let Links = require('Links');
let Terminals = require('Terminals');
let Factories = require('Factories');
let PowerSpawns = require('PowerSpawns');
let Util = require('Util');
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
                Util.Info('Main', 'Main', '--------------- main reset of memory ---------------');
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
                                    Util.ErrorLog('Main', 'Main', 'Lingering MaxCreeps found and removed ' + creepKey + ' in ' + memRoomKey);
                                    memRoom.MaxCreeps[creepTypesKey][creepKey] = undefined;
                                }
                            }
                        }
                    }
                    if (memRoom.RoomLevel <= 0 && Object.keys(memRoom.RoomJobs).length === 0) {
                        // room is unowned and there are no jobs in it - remove the room
                        Memory.MemRooms[memRoomKey] = undefined;
                        Util.InfoLog('Main', 'Main', 'removed unused room ' + memRoomKey);
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

// TODOs:
// TODO - map pathfinding problem ERR_NO_PATH happens at room exits
// TODO powerbank creeps gets -7 - maybe when object disappears
// TODO when removing unused room remember to clean up MaxCreeps!

// TODO remove deposit after 70 cooldown does not work
// TODO remove powerbank flag does not work

// lab reactions
// RenewPowerCreep: only looks for renew sources in the current room

// attack NPC strongholds
// harvest middle rooms
// harvest neutral rooms

// if doing long distance work creep should make sure it has enough timeToLive to do the job
// add constructions
// add renewCreep functionality
// recycle creeps if there are many idle!
// monitor creeps and see if they can work more quickly by optimizing its actions - remove 'pausing' ticks