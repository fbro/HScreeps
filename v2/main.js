let CreateJobs = require('CreateJobs');
let AssignJobs = require('AssignJobs');
let ExecuteJobs = require('ExecuteJobs');
let Towers = require('Towers');
let Links = require('Links');

module.exports.loop = function () {

    if(!Memory.MemRooms){
        Memory.MemRooms = [];
    }
    Towers.run();
    if(Game.time % 5 === 0){


        // TODO remove after testing
        for(const memRoomCount in Memory.MemRooms) {
            const memRoom = Memory.MemRooms[memRoomCount];
            let jobCounter = 0;
            let takenJobCounter = 0;
            for(const roomJobKey in memRoom.RoomJobs) {
                const roomJob = memRoom.RoomJobs[roomJobKey];
                //console.log(roomJobKey + " " + JSON.stringify(roomJob));
                jobCounter++;
                if(roomJob.Creep !== "vacant"){takenJobCounter++;}
            }
            console.log(memRoomCount + " " + memRoom.RoomNumber + " total " + jobCounter + " taken " + takenJobCounter + " " + JSON.stringify(memRoom));
        }

        if (Game.time % 10 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket TODO change to 30
            CreateJobs.run();
            Links.run();
        }
        AssignJobs.run();
    }
    ExecuteJobs.run();
};


// TODO:
// TEST !!!!!!!!!!!!!!!!!!!!!!!
// add more jobs...
// add terminal logic
// add constructions

// pickup dropped resources on its path if possible
// place its stuff in nearby container if possible
// and if bypassing an empty spawn/extension and you carry energy

// all **idle** creeps should move to storage and place all its content in storage
// recycle creeps if there are many idle!