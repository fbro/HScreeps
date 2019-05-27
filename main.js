let Towers = require('Towers');
let CreateJobs = require('CreateJobs');
let CreateFlagJobs = require('CreateFlagJobs');
let AssignJobs = require('AssignJobs');
let DoJobs = require('DoJobs');
let Links = require('Links');
let Terminals = require('Terminals');
let Constructions = require('Constructions');

module.exports.loop = function () {
    Towers.run();
    if (Game.time % 31 === 0) {
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
    }else if (Game.time % 7 === 0){
        AssignJobs.run();
    }else if(Game.time % 47 === 0){
        CreateFlagJobs.run();
    }else if(Game.time % 103 === 0){
        Constructions.run(); // TODO
    }else if(Game.time % 281 === 0){
        for (let roomCount in Game.rooms) {
            let room = Game.rooms[roomCount];
            if (room.controller && room.controller.my && room.terminal) {
                Terminals.run(room);
            }
        }
    }
    DoJobs.run();
};