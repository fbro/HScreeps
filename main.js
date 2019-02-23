let Towers = require('Towers');
let CreateJobs = require('CreateJobs');
let CreateFrontierJobs = require('CreateFrontierJobs');
let AssignOpenJobs = require('AssignOpenJobs');
let DoClosedJobs = require('DoClosedJobs');
let Links = require('Links');
let Terminals = require('Terminals');
let Constructions = require('Constructions');

module.exports.loop = function () {
    Towers.run();
    let modCounter = 0;
    for (let roomCount in Game.rooms) {
        let room = Game.rooms[roomCount];
        if (Game.time % 100 == modCounter) {
            if(room.controller.my){
                CreateJobs.run(room);
            }else{
                CreateFrontierJobs.run(room);
            }
        }
        modCounter = modCounter + 1;
    }
    AssignOpenJobs.run();
    DoClosedJobs.run();
    Links.run();
    Terminals.run();
    Constructions.run();
};