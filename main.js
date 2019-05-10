let Towers = require('Towers');
let CreateJobs = require('CreateJobs');
let CreateFrontierJobs = require('CreateFrontierJobs');
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

    Towers.run(); // TODO
    let modCounter = 0;
    for (let roomCount in Game.rooms) {
        if (Game.time % 20 === modCounter) {
            let room = Game.rooms[roomCount];
            if (room.controller !== undefined && room.controller.my) {
                CreateJobs.run(room); // TODO protector jobs
                Links.run(room);
                Terminals.run(room);
            } else {
                CreateFrontierJobs.run(room); // TODO
            }
        }
        modCounter = (modCounter + 1) % 20;
    }
    if (Game.time % 3 === 0) {
        AssignOpenJobs.run();
    }
    DoClosedJobs.run(); // TODO on the road actions

    Constructions.run(); // TODO
};