const CreateJobs = {
    run: function () {
        // CreateJobs
        //   Rooms - [RoomName]
        //     RoomLevel
        //     RoomJobs - [JobName(x,y)]
        //       JobId
        //       JobCreeps -[CreepName]
        //       JobType - int enum - OBJECT_JOB = 1, FLAG_JOB = 2, IDLE_JOB = 3

        // job type int enum
        const OBJECT_JOB = 1;
        const FLAG_JOB = 2; // TODO
        const IDLE_JOB = 3;

        UpdateAllJobs();

        // adds new rooms that i own
        // updates my rooms which had its level changed
        // removes rooms that i do not own anymore
        function UpdateAllJobs(){
            for (let gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey]; // visible room
                if (gameRoom.controller) { // has a controller - is ownable
                    let isFullUpdate = true; // if room does not exist or controller level have changed
                    let oldMemRoom = [];
                    for (let memRoomKey in Memory.MemRooms) {
                        const memRoom = Memory.MemRooms[memRoomKey]; // memory room
                        if(gameRoomKey === memRoomKey){ // I have it in memory!
                            oldMemRoom = memRoom;
                            if(gameRoom.controller.my){ // still my room
                                if(gameRoom.controller.level !== memRoom.RoomLevel){ // room found and room has changed level - also update the room
                                    isFullUpdate = true;
                                    console.log("CreateJobs, UpdateAllJobs: " + gameRoomKey + " changed level from " + memRoom.RoomLevel + " to " + gameRoom.controller.level);
                                }else{ // room found and it is my room and it has not changed level - do not update just refresh
                                    isFullUpdate = false;
                                }
                            }else{ // not my room anymore
                                console.log("CreateJobs, UpdateAllJobs: do not own " + gameRoom.name + " anymore. removing room from mem");
                                Memory.MemRooms[gameRoom.name] = undefined; // remove room - I do no own it anymore
                                isFullUpdate = false;
                            }
                            break;
                        }
                    }
                    if(gameRoom.controller.my){
                        UpdateJobsInRoom(gameRoom, oldMemRoom.RoomJobs, isFullUpdate);
                    }
                }
            }
        }

        function UpdateJobsInRoom(gameRoom, oldRoomJobs, isFullUpdate){
            let roomJobs = [];
            switch (gameRoom.controller.level) {
                case 8:
                // TODO Observer
                // TODO PowerSpawn
                case 7:
                case 6:
                // TODO Extractor
                // TODO FillLabEnergy
                // TODO FillLabMineral
                // TODO EmptyLabMineral
                // TODO FillTerminalEnergy
                // TODO FillTerminalMineral
                case 5:
                case 4:
                    if(gameRoom.storage !== undefined){
                        // FillStorage
                        FillStorageJobs(gameRoom, roomJobs);
                        // ResourceDrop
                        ResourceDropJobs(gameRoom, roomJobs);
                    }
                case 3:
                    // FillTower
                    FillTowerJobs(gameRoom, roomJobs);
                case 2:
                case 1:
                    // FillSpawnExtension
                    FillSpawnExtensionJobs(gameRoom, roomJobs);
                    // Construction
                    ConstructionJobs(gameRoom, roomJobs);
                    // Repair
                    RepairJobs(gameRoom, roomJobs);
                    if(isFullUpdate){
                        // Controller
                        new RoomVisual(gameRoom.name).text("💼", gameRoom.controller.pos.x, gameRoom.controller.pos.y);
                        roomJobs['Controller(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')'] = {'JobId': gameRoom.controller.id, 'JobCreeps': [], 'JobType': OBJECT_JOB};
                        // Source
                        const sources = gameRoom.find(FIND_SOURCES);
                        for (const sourceKey in sources) {
                            const source = sources[sourceKey];
                            new RoomVisual(gameRoom.name).text("🏭💼", source.pos.x, source.pos.y);
                            roomJobs['Source(' + source.pos.x + ',' + source.pos.y + ')'] = {'JobId': source.id, 'JobCreeps': [], 'JobType': OBJECT_JOB};
                        }
                        roomJobs['Idle'] = {'JobCreeps': [], 'JobType': IDLE_JOB};
                    }
                    break;
                default:
                    console.log("CreateJobs, UpdateJobsInRoom: ERROR! level not found");
            }

            for(const oldRoomJobKey in oldRoomJobs){ // if a job with similar key already existed in room then use that job to reuse creep on job
                const oldRoomJob = oldRoomJobs[oldRoomJobKey];
                for(const roomJobKey in roomJobs){
                    if(oldRoomJobKey === roomJobKey){
                        roomJobs[roomJobKey] = oldRoomJob;
                    }
                }
            }

            if(isFullUpdate) {
                Memory.MemRooms[gameRoom.name] =
                    {
                        'RoomLevel': gameRoom.controller.level,
                        'RoomJobs': roomJobs,
                        'RoomFlagJobs': [],
                    };
            }else{
                Memory.MemRooms[gameRoom.name].RoomJobs = roomJobs;
            }
        }

        function FillStorageJobs(gameRoom, roomJobs){
            const fillStorages = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_CONTAINER && s.energy >= 1900)
                        || (s.structureType === STRUCTURE_LINK && s.energy >= 700 && s.room.storage.pos.inRangeTo(s, 1));
                }
            });
            for (const fillStorageKey in fillStorages) {
                const fillStorage = fillStorages[fillStorageKey];
                new RoomVisual(gameRoom.name).text("⚡💼", fillStorage.pos.x, fillStorage.pos.y);
                roomJobs['FillStorage' + fillStorage.structureType.substring(10) + '(' + fillStorage.pos.x + ',' + fillStorage.pos.y + ')'] = {'JobId': fillStorage.id, 'JobCreeps': [], 'JobType': OBJECT_JOB};
            }
        }

        function FillTowerJobs(gameRoom, roomJobs){
            const fillTowers = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_TOWER) && s.energy < s.energyCapacity);
                }
            });
            for (const fillTowerKey in fillTowers) {
                const fillTower = fillTowers[fillTowerKey];
                new RoomVisual(gameRoom.name).text("⚡💼", fillTower.pos.x, fillTower.pos.y);
                roomJobs['FillTower(' + fillTower.pos.x + ',' + fillTower.pos.y + ')'] = {'JobId': fillTower.id, 'JobCreeps': [], 'JobType': OBJECT_JOB};
            }
        }

        function FillSpawnExtensionJobs(gameRoom, roomJobs){
            const fillSpawnExtensions = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.energy < s.energyCapacity);
                }
            });
            for (const fillSpawnExtensionKey in fillSpawnExtensions) {
                const fillSpawnExtension = fillSpawnExtensions[fillSpawnExtensionKey];
                new RoomVisual(gameRoom.name).text("⚡💼", fillSpawnExtension.pos.x, fillSpawnExtension.pos.y);
                roomJobs['FillSpawnExtension(' + fillSpawnExtension.pos.x + ',' + fillSpawnExtension.pos.y + ')'] = {'JobId': fillSpawnExtension.id, 'JobCreeps': [], 'JobType': OBJECT_JOB};
            }
        }

        function ResourceDropJobs(gameRoom, roomJobs){
            const resourceDrops = gameRoom.find(FIND_DROPPED_RESOURCES, {filter: (drop) => {return (drop.amount > 50);}});
            for (const resourceDropKey in resourceDrops) {
                const resourceDrop = resourceDrops[resourceDropKey];
                new RoomVisual(gameRoom.name).text("💰💼", resourceDrop.pos.x, resourceDrop.pos.y);
                roomJobs['ResourceDrop' + resourceDrop.resourceType.substring(9) + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.amount + ')'] = {'JobId': resourceDrop.id, 'JobCreeps': [], 'JobType': OBJECT_JOB};
            }
        }

        function ConstructionJobs(gameRoom, roomJobs){
            const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES);
            for (const constructionKey in constructions) {
                const construction = constructions[constructionKey];
                new RoomVisual(gameRoom.name).text("🏗💼", construction.pos.x, construction.pos.y);
                roomJobs['Construction' + construction.structureType.substring(10) + '(' + construction.pos.x + ',' + construction.pos.y + ')'] = {'JobId': construction.id, 'JobCreeps': [], 'JobType': OBJECT_JOB};
            }
        }

        function RepairJobs(gameRoom, roomJobs){
            const repairs = gameRoom.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (
                        s.hits < s.hitsMax / 1.5 // health at 75%
                        &&
                        (
                            (
                                s.structureType === STRUCTURE_RAMPART && (gameRoom.controller.level < 8 && s.hits < 1000 || gameRoom.controller.level === 8 && s.hits < 100000) ||
                                s.structureType === STRUCTURE_WALL && (gameRoom.controller.level < 8 && s.hits < 1000 || gameRoom.controller.level === 8 && s.hits < 100000) ||
                                s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax / 2
                            )
                            ||
                            (
                                s.structureType !== STRUCTURE_RAMPART &&
                                s.structureType !== STRUCTURE_WALL &&
                                s.structureType !== STRUCTURE_ROAD
                            )
                        )
                    );
                }
            });
            for (const repairKey in repairs) {
                const repair = repairs[repairKey];
                new RoomVisual(gameRoom.name).text("🛠💼", repair.pos.x, repair.pos.y);
                roomJobs['Repair' + repair.structureType.substring(10) + '(' + repair.pos.x + ',' + repair.pos.y + ')'] = {'JobId': repair.id, 'JobCreeps': [], 'JobType': OBJECT_JOB};
            }
        }

    }
};
module.exports = CreateJobs;