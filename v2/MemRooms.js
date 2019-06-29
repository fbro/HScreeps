const MemRooms = {
    run: function () {
        // MemRooms
        //   Rooms - [RoomName]
        //     RoomLevel
        //     RoomObjJobs - [ObjJobName(x,y)]
        //       JobObjId
        //       JobObjCreeps -[CreepName]
        //     RoomFlagJobs - [FlagJobName(x,y)]
        //       JobFlagId
        //       JobFlagCreeps -[CreepName]

        UpdateMemoryRooms();

        // adds new rooms that i own
        // updates my rooms which had its level changed
        // removes rooms that i do not own anymore
        function UpdateMemoryRooms(){
            for (let gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey]; // visible room
                if (gameRoom.controller) { // has a controller - is ownable
                    let updateMemRoom = true;
                    let oldMemRoom = [];
                    for (let memRoomKey in Memory.MemRooms) {
                        const memRoom = Memory.MemRooms[memRoomKey]; // memory room
                        if(gameRoomKey === memRoomKey){ // I have it in memory!
                            oldMemRoom = memRoom;
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
                        CreateDefaultJobs(gameRoom, oldMemRoom.RoomObjJobs);
                    }
                }
            }
        }

        function CreateDefaultJobs(gameRoom, oldRoomObjJobs){
            let roomObjJobs = [];
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
                        RefreshFillStorageJobs(gameRoom, roomObjJobs);
                        // ResourceDrop
                        RefreshResourceDropJobs(gameRoom, roomObjJobs);
                    }
                case 3:
                    // FillTower
                    RefreshFillTowerJobs(gameRoom, roomObjJobs);
                case 2:
                case 1:
                    // Controller
                    new RoomVisual(gameRoom.name).text("💼", gameRoom.controller.pos.x, gameRoom.controller.pos.y);
                    roomObjJobs['Controller(' + gameRoom.controller.pos.x + ',' + gameRoom.controller.pos.y + ')'] = {'JobObjId': gameRoom.controller.id, 'JobObjCreeps': []};
                    // FillSpawnExtension
                    RefreshFillSpawnExtensionJobs(gameRoom, roomObjJobs);
                    // Construction
                    RefreshConstructionJobs(gameRoom, roomObjJobs);
                    // Repair
                    RefreshRepairJobs(gameRoom, roomObjJobs);
                    // Source
                    const sources = gameRoom.find(FIND_SOURCES);
                    for (const sourceKey in sources) {
                        const source = sources[sourceKey];
                        new RoomVisual(gameRoom.name).text("🏭💼", source.pos.x, source.pos.y);
                        roomObjJobs['Source(' + source.pos.x + ',' + source.pos.y + ')'] = {'JobObjId': source.id, 'JobObjCreeps': []};
                    }
                    roomObjJobs['Idle'] = {'JobObjCreeps': []};
                    break;
                default:
                    console.log("MemRooms, createDefaultJobs: ERROR! level not found");
            }

            for(const oldRoomObjJobKey in oldRoomObjJobs){ // if a job with similar key already existed in room then use that job to reuse creep on job
                const oldRoomObjJob = oldRoomObjJobs[oldRoomObjJobKey];
                for(const roomObjJobKey in roomObjJobs){
                    if(oldRoomObjJobKey === roomObjJobKey){
                        roomObjJobs[roomObjJobKey] = oldRoomObjJob;
                    }
                }
            }

            Memory.MemRooms[gameRoom.name] =
                {
                    'RoomLevel': gameRoom.controller.level,
                    'RoomObjJobs': roomObjJobs,
                    'RoomFlagJobs': [],
                };
        }

        function RefreshFillStorageJobs(gameRoom, roomObjJobs){
            const fillStorages = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_CONTAINER && s.energy >= 1900)
                        || (s.structureType === STRUCTURE_LINK && s.energy >= 700 && s.room.storage.pos.inRangeTo(s, 1));
                }
            });
            for (const fillStorageKey in fillStorages) {
                const fillStorage = fillStorages[fillStorageKey];
                new RoomVisual(gameRoom.name).text("⚡💼", fillStorage.pos.x, fillStorage.pos.y);
                roomObjJobs['FillStorage' + fillStorage.structureType.substring(10) + '(' + fillStorage.pos.x + ',' + fillStorage.pos.y + ')'] = {'JobObjId': fillStorage.id, 'JobObjCreeps': []};
            }
        }
        function RefreshFillTowerJobs(gameRoom, roomObjJobs){
            const fillTowers = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_TOWER) && s.energy < s.energyCapacity);
                }
            });
            for (const fillTowerKey in fillTowers) {
                const fillTower = fillTowers[fillTowerKey];
                new RoomVisual(gameRoom.name).text("⚡💼", fillTower.pos.x, fillTower.pos.y);
                roomObjJobs['FillTower(' + fillTower.pos.x + ',' + fillTower.pos.y + ')'] = {'JobObjId': fillTower.id, 'JobObjCreeps': []};
            }
        }
        function RefreshFillSpawnExtensionJobs(gameRoom, roomObjJobs){
            const fillSpawnExtensions = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return ((s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.energy < s.energyCapacity);
                }
            });
            for (const fillSpawnExtensionKey in fillSpawnExtensions) {
                const fillSpawnExtension = fillSpawnExtensions[fillSpawnExtensionKey];
                new RoomVisual(gameRoom.name).text("⚡💼", fillSpawnExtension.pos.x, fillSpawnExtension.pos.y);
                roomObjJobs['FillSpawnExtension(' + fillSpawnExtension.pos.x + ',' + fillSpawnExtension.pos.y + ')'] = {'JobObjId': fillSpawnExtension.id, 'JobObjCreeps': []};
            }
        }
        function RefreshResourceDropJobs(gameRoom, roomObjJobs){
            const resourceDrops = gameRoom.find(FIND_DROPPED_RESOURCES, {filter: (drop) => {return (drop.amount > 50);}});
            for (const resourceDropKey in resourceDrops) {
                const resourceDrop = resourceDrops[resourceDropKey];
                new RoomVisual(gameRoom.name).text("💰💼", resourceDrop.pos.x, resourceDrop.pos.y);
                roomObjJobs['ResourceDrop' + resourceDrop.resourceType.substring(9) + '(' + resourceDrop.pos.x + ',' + resourceDrop.pos.y + ',' + resourceDrop.amount + ')'] = {'JobObjId': resourceDrop.id, 'JobObjCreeps': []};
            }
        }
        function RefreshConstructionJobs(gameRoom, roomObjJobs){
            const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES);
            for (const constructionKey in constructions) {
                const construction = constructions[constructionKey];
                new RoomVisual(gameRoom.name).text("🏗💼", construction.pos.x, construction.pos.y);
                roomObjJobs['Construction' + construction.structureType.substring(10) + '(' + construction.pos.x + ',' + construction.pos.y + ')'] = {'JobObjId': construction.id, 'JobObjCreeps': []};
            }
        }
        function RefreshRepairJobs(gameRoom, roomObjJobs){
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
                roomObjJobs['Repair' + repair.structureType.substring(10) + '(' + repair.pos.x + ',' + repair.pos.y + ')'] = {'JobObjId': repair.id, 'JobObjCreeps': []};
            }
        }

    }
};
module.exports = MemRooms;