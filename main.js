let Towers = require('Towers');
let CreateJobs = require('CreateJobs');
let CreateFlagJobs = require('CreateFlagJobs');
let AssignJobs = require('AssignJobs');
let DoJobs = require('DoJobs');
let Links = require('Links');
let Terminals = require('Terminals');
let Constructions = require('Constructions');

module.exports.loop = function () {
    if (Memory.openJobs === undefined) {
        Memory.openJobs = [];
    }
    if (Memory.closedJobs === undefined) {
        Memory.closedJobs = [];
    }
    if (Memory.links === undefined) {
        Memory.links = [];
    }
    Towers.run();
    if (Game.time % 30 === 0) {
        for (let roomCount in Game.rooms) {
            let room = Game.rooms[roomCount];
            if (room.controller !== undefined && room.controller.my) {
                CreateJobs.run(room);
                Links.run(room);
                if(room.terminal !== undefined){
                    Terminals.run(room);
                }
            }
        }
        CreateFlagJobs.run();
        Constructions.run(); // TODO
    }else{
        if (Game.time % 3 === 0) {
            AssignJobs.run();
        }
    }
    DoJobs.run();
};