const MemRooms = {
    run: function () {

        UpdateMemRooms();

        // adds new rooms that i own
        // updates my rooms which had its level change
        // removes rooms that i do not own anymore
        function UpdateMemRooms(){
            for (let gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey]; // visible room
                if (gameRoom.controller) { // has a controller - is ownable
                    let updateMemRoom = true;
                    for (let memRoomKey in Memory.MemRooms) {
                        const memRoom = Game.rooms[gameRoomKey]; // memory room
                        if(gameRoomKey === memRoomKey){ // I have it in memory!
                            if(gameRoom.controller.my){ // still my room
                                if(gameRoom.controller.level !== memRoom.RoomLevel){ // room found and room has changed level - also update the room
                                    updateMemRoom = true;
                                }else{ // room found and it is my room and it has not changed level - do not update
                                    updateMemRoom = false;
                                }
                            }else{ // not my room anymore
                                console.log("MemRooms, UpdateMemRooms: do no own " + gameRoom.name + " anymore. removing room from mem");
                                Memory.MemRooms[gameRoom.name] = undefined; // remove room - I do no own it anymore
                                updateMemRoom = false;
                            }
                            break;
                        }
                    }
                    if(updateMemRoom && gameRoom.controller.my){
                        CreateDefaultJobs(gameRoom);

                    }
                }
            }
        }

        function CreateDefaultJobs(gameRoom){

            let RoomObjJobs = [];
            switch (gameRoom.controller.level) {
                case 1:
                    gameRoom.find(FIND_SOURCES);
                    RoomObjJobs.push();
                    break;
                case 2:
                    break;
                case 3:
                    break;
                case 4:
                    break;
                case 5:
                    break;
                case 6:
                    break;
                case 7:
                    break;
                case 8:
                    break;
                default:
                    console.log("MemRooms, createDefaultJobs: ERROR! level not found");


            Memory.MemRooms[gameRoom.name] =
                {
                    'RoomLevel': gameRoom.controller.level,
                    'RoomObjJobs': [],
                    'RoomFlagJobs': [],
                };
        }
    }
};
module.exports = MemRooms;