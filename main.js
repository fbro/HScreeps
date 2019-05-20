let Towers = require('Towers');
let CreateJobs = require('CreateJobs');
let CreateFlagJobs = require('CreateFlagJobs');
let AssignOpenJobs = require('AssignOpenJobs');
let DoClosedJobs = require('DoClosedJobs');
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
    let modCounter = 0;
    for (let roomCount in Game.rooms) {
        if (Game.time % 20 === modCounter) {
            let room = Game.rooms[roomCount];
            if (room.controller !== undefined && room.controller.my) {
                CreateJobs.run(room);
                Links.run(room);
                if(room.terminal !== undefined){
                    Terminals.run(room);
                }
            }
        }
        modCounter = (modCounter + 1) % 20;
    }
    if (Game.time % 3 === 0) {
        AssignOpenJobs.run();
    }
    if (Game.time % 2 === 0) {
        CreateFlagJobs.run();
        Constructions.run(); // TODO
    }
    DoClosedJobs.run();

};