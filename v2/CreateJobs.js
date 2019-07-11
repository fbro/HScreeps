const CreateJobs = {
    run: function () {
        // CreateJobs
        //   Rooms - [RoomName] - array of rooms where the key is the room name
        //     RoomLevel - 0 to 8
        //     RoomJobs - [JobName(x,y)] - user friendly name
        //       JobId - real id
        //       JobType - int enum - OBJECT_JOB = 1, FLAG_JOB = 2
        //       CreepType - T, H, B...
        //       Creep - CreepName

        /* jobs:
        * Source
        * Controller
        * Repair
        * Construction
        * FillSpawnExtension
        *
        * FillTower
        *
        * ResourceDrop
        * FillStorage
        *
        * FillTerminalMineral
        * FillTerminalEnergy
        * EmptyLabMineral
        * FillLabMineral
        * FillLabEnergy
        * Extractor
        *
        * FillPowerSpawnPowerUnits
        * FillPowerSpawnEnergy
        * */

        // job type int enum
        const OBJECT_JOB = 1;
        const FLAG_JOB = 2;

        UpdateObjJobs();
        UpdateFlagJobs();

        // adds new rooms that i own
        // updates my rooms which had its level changed
        // removes rooms that i do not own anymore
        function UpdateObjJobs(){
            for(const gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey]; // visible room
                if (gameRoom.controller) { // has a controller - is ownable
                    let isFullUpdate = true; // if room does not exist or controller level have changed
                    let oldMemRoom = [];
                    for(const memRoomKey in Memory.MemRooms) {
                        const memRoom = Memory.MemRooms[memRoomKey]; // memory room
                        if(gameRoomKey === memRoomKey){ // I have it in memory!
                            oldMemRoom = memRoom;
                            if(gameRoom.controller.my){ // still my room
                                if(gameRoom.controller.level !== memRoom.RoomLevel){ // room found and room has changed level - also update the room
                                    isFullUpdate = true;
                                    console.log("CreateJobs, UpdateObjJobs: " + gameRoomKey + " changed level from " + memRoom.RoomLevel + " to " + gameRoom.controller.level);
                                }else{ // room found and it is my room and it has not changed level - do not update just refresh
                                    isFullUpdate = false;
                                }
                            }else{ // not my room anymore
                                console.log("CreateJobs, UpdateObjJobs: do not own " + gameRoom.name + " anymore. removing room from mem");
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

        function UpdateFlagJobs(){
            for(const gameFlagKey in Game.flags) {
                const gameFlag = Game.flags[gameFlagKey];
                if(Memory.MemRooms[gameFlag.pos.roomName] === undefined){ // room does not exist - create it
                    Memory.MemRooms[gameFlag.pos.roomName] = CreateRoom(gameFlag.pos.roomName, 0, []);
                }
                let jobName;
                if(gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_ORANGE){ // scout tag
                    jobName = "TagController";
                }else if(gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_YELLOW){ // scout at pos
                    jobName = "ScoutPos";
                }else if(gameFlag.color === COLOR_GREEN && gameFlag.secondaryColor === COLOR_GREEN){ // claimer claim
                    jobName = "ClaimController";
                }else if(gameFlag.color === COLOR_GREEN && gameFlag.secondaryColor === COLOR_YELLOW){ // claimer reserve
                    jobName = "ReserveController";
                }else if(gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_RED){ // warrior at pos
                    jobName = "GuardPos";
                }
                if(Memory.MemRooms[gameFlag.pos.roomName].RoomJobs[jobName + '-' + gameFlagKey] === undefined){ // if exist do not recreate
                    CreateJob(Memory.MemRooms[gameFlag.pos.roomName].RoomJobs, jobName + '-' + gameFlagKey, gameFlagKey, FLAG_JOB);
                }
            }
        }

        function UpdateJobsInRoom(gameRoom, oldRoomJobs, isFullUpdate){
            let roomJobs = [];
            switch (gameRoom.controller.level) {
                case 8:
                // TODO FillPowerSpawnEnergy
                // TODO FillPowerSpawnPowerUnits
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
                        CreateJob(roomJobs, 'Controller(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')', gameRoom.controller.id, OBJECT_JOB, 'B');
                        if(gameRoom.controller.level < 8){ // not at max level - more creeps on the controller job
                            CreateJob(roomJobs, 'Controller1(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')', gameRoom.controller.id, OBJECT_JOB, 'B');
                            CreateJob(roomJobs, 'Controller2(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')', gameRoom.controller.id, OBJECT_JOB, 'B');
                        }
                        // Source
                        const sources = gameRoom.find(FIND_SOURCES);
                        for (const sourceKey in sources) {
                            const source = sources[sourceKey];
                            new RoomVisual(gameRoom.name).text("🏭💼", source.pos.x, source.pos.y);
                            CreateJob(roomJobs, 'Source(' + source.pos.x + ',' + source.pos.y + ')', source.id, OBJECT_JOB, 'H');
                        }
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
                CreateRoom(gameRoom.name, gameRoom.controller.level, roomJobs);
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
                CreateJob(roomJobs, 'FillStorage' + fillStorage.structureType.substring(10) + '(' + fillStorage.pos.x + ',' + fillStorage.pos.y + ')', fillStorage.id, OBJECT_JOB), 'T';
            }
        }

        function ResourceDropJobs(gameRoom, roomJobs){
            const resourceDrops = gameRoom.find(FIND_DROPPED_RESOURCES, {filter: (drop) => {return (drop.amount > 50);}});
            for (const resourceDropKey in resourceDrops) {
                const resourceDrop = resourceDrops[resourceDropKey];
                new RoomVisual(gameRoom.name).text("💰💼", resourceDrop.pos.x, resourceDrop.pos.y);
                CreateJob(roomJobs, 'ResourceDrop' + resourceDrop.resourceType.substring(9) + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.amount + ')', resourceDrop.id, OBJECT_JOB, 'T');
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
                CreateJob(roomJobs, 'FillTower(' + fillTower.pos.x + ',' + fillTower.pos.y + ')', fillTower.id, OBJECT_JOB, 'T');
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
                CreateJob(roomJobs, 'FillSpawnExtension(' + fillSpawnExtension.pos.x + ',' + fillSpawnExtension.pos.y + ')', fillSpawnExtension.id, OBJECT_JOB, 'T');
            }
        }

        function ConstructionJobs(gameRoom, roomJobs){
            const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES);
            for (const constructionKey in constructions) {
                const construction = constructions[constructionKey];
                new RoomVisual(gameRoom.name).text("🏗💼", construction.pos.x, construction.pos.y);
                CreateJob(roomJobs, 'Construction' + construction.structureType.substring(10) + '(' + construction.pos.x + ',' + construction.pos.y + ')', construction.id, OBJECT_JOB, 'B');
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
                CreateJob(roomJobs, 'Repair' + repair.structureType.substring(10) + '(' + repair.pos.x + ',' + repair.pos.y + ')', repair.id, OBJECT_JOB, 'B');
            }
        }

        function CreateRoom(roomName, level, roomJobs){
            Memory.MemRooms[roomName] =
                {
                    'RoomLevel': level,
                    'RoomJobs': roomJobs,
                };
        }

        function CreateJob(roomJobs, roomJobKey, jobId, jobType, creepType){
            roomJobs[roomJobKey] = {'JobId': jobId, 'JobType': jobType, 'CreepType': creepType, 'Creep': 'vacant'};
        }
    }
};
module.exports = CreateJobs;