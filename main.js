let Towers = require('Towers');
let CreateJobs = require('CreateJobs');
let CreateFlagJobs = require('CreateFlagJobs');
let AssignJobs = require('AssignJobs');
let DoJobs = require('DoJobs');
let Links = require('Links');
let Terminals = require('Terminals');
let Constructions = require('Constructions');

module.exports.loop = function () {

    if(!Memory.openJobs){
        Memory.openJobs = [];
        Memory.closedJobs = [];
        Memory.links = [];
        Memory.buyOrdersHistory = [];
    }

    Towers.run();
    if (Game.time % 30 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket
        for (let roomCount in Game.rooms) {
            let room = Game.rooms[roomCount];
            if (room.controller && room.controller.my) {
                CreateJobs.run(room);
                Links.run(room);
                if(room.terminal){
                    Terminals.run(room);
                }
            }
        }
        CreateFlagJobs.run();
        Constructions.run(); // TODO
    }
    if (Game.time % 5 === 0){
        AssignJobs.run();
    }
    DoJobs.run();
};