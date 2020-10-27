let Util = require('Util');
const Constructions = {
    run: function () {

        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my) {
                const roomTerrain = gameRoom.getTerrain();
                //const startCpu = Game.cpu.getUsed();
                build(gameRoom, roomTerrain);
                //const elapsed = Game.cpu.getUsed() - startCpu;
                //Util.Info('Constructions', '', elapsed + ' ' + gameRoom.name + ' ' + gameRoom.controller.level);
            }
        }

        function build(gameRoom, roomTerrain) {
            const level = gameRoom.controller.level;
            if (level >= 1) {
                const flags = gameRoom.find(FIND_FLAGS, {
                    filter: function (flag) { // construction flags
                        return flag.color === COLOR_GREEN && flag.secondaryColor === COLOR_GREY; // construct first spawn
                    }
                });
                if (flags.length > 0) {
                    ConstructFirstSpawnAtFlag(gameRoom, flags);
                }
                ConstructContainerAt(gameRoom, roomTerrain, FIND_SOURCES);
                if (level >= 2) {
                    ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_EXTENSION, 5);
                    if (Memory.MemRooms[gameRoom.name] && !Memory.MemRooms[gameRoom.name].CtrlConId) {
                        ConstructContainerAt(gameRoom, roomTerrain, FIND_STRUCTURES, STRUCTURE_CONTROLLER);
                    }
                    if (level >= 3) {
                        if (Memory.MemRooms[gameRoom.name] && Util.FindNumberOfBuildableStructures(gameRoom, STRUCTURE_TOWER) > Memory.MemRooms[gameRoom.name].TowerIds.length) {
                            ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_TOWER, 4);
                        }
                        if (level >= 4) {
                            if (!gameRoom.storage) {
                                ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_STORAGE, 0);
                            }
                            ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_SPAWN);
                            if (level >= 5) {
                                ConstructLinks(gameRoom, roomTerrain);
                                ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_STORAGE);
                                ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_TOWER);
                                if (level >= 6) {
                                    ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_SPAWN, 0);
                                    ConstructExtractor(gameRoom);
                                    ConstructContainerAt(gameRoom, roomTerrain, FIND_MINERALS);
                                    if (!gameRoom.terminal) {
                                        ConstructAtStorage(gameRoom, roomTerrain, STRUCTURE_TERMINAL);
                                    }
                                    if (level >= 7) {
                                        ConstructAtStorage(gameRoom, roomTerrain, STRUCTURE_FACTORY);
                                        ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_TERMINAL);
                                        ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_CONTAINER);
                                        if (level === 8) {
                                            ConstructAtStorage(gameRoom, roomTerrain, STRUCTURE_POWER_SPAWN);
                                            ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_OBSERVER, 8);
                                            ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_NUKER, 8);
                                            ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_FACTORY);
                                            ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_POWER_SPAWN);
                                            ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_OBSERVER);
                                            ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_NUKER);
                                            ConstructPerimeter(gameRoom);
                                            ConstructLabs(gameRoom, roomTerrain); // TODO
                                        }
                                    }
                                }
                            }
                        }
                        ConstructRoads(gameRoom, roomTerrain);
                    }
                }
                Memory.MemRooms[gameRoom.name].Built = gameRoom.controller.level;
            }
        }

        //region construct functions

        function ConstructFirstSpawnAtFlag(gameRoom, flags) {
            const constructSpawnFlag = _.filter(flags, function (flag) {
                return flag.color === COLOR_GREEN && flag.secondaryColor === COLOR_GREY;
            })[0];
            if (constructSpawnFlag) {
                const structures = gameRoom.find(FIND_STRUCTURES, {
                    filter: function (structure) {
                        return !structure.my && structure.structureType !== STRUCTURE_CONTAINER;
                    }
                });
                const constructions = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                    filter: function (construction) {
                        return !construction.my;
                    }
                });
                for (const structureKey in structures) {
                    structures[structureKey].destroy();
                }
                for (const constructionKey in constructions) {
                    constructions[constructionKey].remove();
                }
                const defenderFlagName = "Defend build site " + gameRoom.name;
                const defenderFlag = constructSpawnFlag.pos.findInRange(FIND_FLAGS, 1, {
                    filter: function (flag) {
                        return flag.name === defenderFlagName && flag.color === COLOR_RED && flag.secondaryColor === COLOR_RED;
                    }
                })[0];
                if (!defenderFlag) {
                    gameRoom.createFlag(constructSpawnFlag.pos.x, constructSpawnFlag.pos.y + 1, defenderFlagName, COLOR_RED, COLOR_RED);
                    Util.InfoLog('Constructions', 'ConstructFirstSpawnAtFlag', defenderFlagName);
                }else{
                    const spawnConstruction = constructSpawnFlag.pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
                    if(!spawnConstruction || spawnConstruction.structureType !== STRUCTURE_SPAWN){
                        const spawnStructure = constructSpawnFlag.pos.lookFor(LOOK_STRUCTURES)[0];
                        if(spawnStructure && spawnStructure.structureType === STRUCTURE_SPAWN){
                            constructSpawnFlag.remove();
                            defenderFlag.remove();
                        }else{
                            const result = gameRoom.createConstructionSite(constructSpawnFlag.pos.x, constructSpawnFlag.pos.y, STRUCTURE_SPAWN);
                            if (result === OK) {
                                Util.InfoLog('Constructions', 'ConstructFirstSpawnAtFlag', constructSpawnFlag.pos + ' result ' + result);
                            }
                        }
                    }
                }
            }
        }

        function ConstructContainerAt(gameRoom, terrain, findType, structureType = undefined) {
            if (Memory.MemRooms[gameRoom.name].Built && Memory.MemRooms[gameRoom.name].Built === gameRoom.controller.level) {
                return;
            }

            const targets = gameRoom.find(findType, {
                filter: function (target) {
                    return !structureType || target.structureType === structureType;
                }
            });
            for (const targetCount in targets) {
                const target = targets[targetCount];
                if (!FindExistingStructure(target.pos, STRUCTURE_CONTAINER, 1)) {
                    ConstructAroundPos(gameRoom, terrain, target.pos, STRUCTURE_CONTAINER);
                }
            }
            Util.Info('Constructions', 'ConstructContainerAt', gameRoom.name + ' ' + findType + ' ' + (structureType ? structureType : ''));
        }

        function ConstructCoreBuilding(gameRoom, roomTerrain, structureType, acceptedNumOfNearbyWalls) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, structureType);
            if (!numberOfPossibleConstructions) {
                return;
            }
            const spawn = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN;
                }
            })[0];
            if (spawn) {
                BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, spawn.pos, acceptedNumOfNearbyWalls);
            }
            Util.Info('Constructions', 'ConstructCoreBuilding', gameRoom.name + ' ' + structureType + ' spawn used ' + spawn);
        }

        function ConstructRampartsOn(gameRoom, roomTerrain, structureType) {
            if (Memory.MemRooms[gameRoom.name].Built && Memory.MemRooms[gameRoom.name].Built === gameRoom.controller.level) {
                return;
            }
            const structuresToPlaceRampartOn = gameRoom.find(FIND_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            for (const structuresToPlaceRampartOnCount in structuresToPlaceRampartOn) {
                const structure = structuresToPlaceRampartOn[structuresToPlaceRampartOnCount];
                const structuresOnPos = structure.pos.look();
                let foundRampart = false;
                for (const structuresOnPosCount in structuresOnPos) {
                    const structureOnPos = structuresOnPos[structuresOnPosCount];
                    if (structureOnPos.structure && structureOnPos.structure.structureType === STRUCTURE_RAMPART
                        || structureOnPos.constructionSite && structureOnPos.constructionSite.structureType === STRUCTURE_RAMPART) {
                        foundRampart = true;
                        break;
                    }
                }
                if (!foundRampart) {
                    const result = gameRoom.createConstructionSite(structure.pos.x, structure.pos.y, STRUCTURE_RAMPART);
                    Util.InfoLog('Constructions', 'ConstructRampartsOn', structure.pos + ' to protect ' + structureType + ' result ' + result);
                }
            }
            Util.Info('Constructions', 'ConstructRampartsOn', gameRoom.name + ' ' + structureType + ' structuresToPlaceRampartOn ' + structuresToPlaceRampartOn);
        }

        function ConstructRoads(gameRoom, roomTerrain) {
            if (Memory.MemRooms[gameRoom.name].Built && Memory.MemRooms[gameRoom.name].Built === gameRoom.controller.level) {
                return;
            }
            let structures = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN
                        || structure.structureType === STRUCTURE_EXTENSION
                        || structure.structureType === STRUCTURE_TOWER
                        || structure.structureType === STRUCTURE_TERMINAL
                        || structure.structureType === STRUCTURE_STORAGE
                        || structure.structureType === STRUCTURE_FACTORY
                        || structure.structureType === STRUCTURE_NUKER
                        || structure.structureType === STRUCTURE_POWER_SPAWN;
                }
            });
            let constructions = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                filter: function (construction) {
                    return construction.structureType === STRUCTURE_SPAWN
                        || construction.structureType === STRUCTURE_EXTENSION
                        || construction.structureType === STRUCTURE_TOWER
                        || construction.structureType === STRUCTURE_TERMINAL
                        || construction.structureType === STRUCTURE_STORAGE
                        || construction.structureType === STRUCTURE_FACTORY
                        || construction.structureType === STRUCTURE_NUKER
                        || construction.structureType === STRUCTURE_POWER_SPAWN;
                }
            });
            structures = structures.concat(constructions);
            const spawns = [];
            for (const structureCount in structures) {
                const structure = structures[structureCount];
                if (roomTerrain.get(structure.pos.x + 1, structure.pos.y) !== TERRAIN_MASK_WALL) {
                    gameRoom.createConstructionSite(structure.pos.x + 1, structure.pos.y, STRUCTURE_ROAD);
                }
                if (roomTerrain.get(structure.pos.x - 1, structure.pos.y) !== TERRAIN_MASK_WALL) {
                    gameRoom.createConstructionSite(structure.pos.x - 1, structure.pos.y, STRUCTURE_ROAD);
                }
                if (roomTerrain.get(structure.pos.x, structure.pos.y + 1) !== TERRAIN_MASK_WALL) {
                    gameRoom.createConstructionSite(structure.pos.x, structure.pos.y + 1, STRUCTURE_ROAD);
                }
                if (roomTerrain.get(structure.pos.x, structure.pos.y - 1) !== TERRAIN_MASK_WALL) {
                    gameRoom.createConstructionSite(structure.pos.x, structure.pos.y - 1, STRUCTURE_ROAD);
                }
                if (structure.structureType === STRUCTURE_SPAWN) {
                    spawns.push(structure);
                }
            }
            // build roads from main spawn to controller, storage, terminal, extractor and sources
            const spawn = spawns[0];
            if (!spawn) {
                return;
            }
            BuildRoadTo(gameRoom, spawn, gameRoom.controller);
            if (gameRoom.storage) {
                BuildRoadTo(gameRoom, spawn, gameRoom.storage);
            }
            if (gameRoom.terminal) {
                BuildRoadTo(gameRoom, spawn, gameRoom.terminal);
            }
            const extractor = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_EXTRACTOR;
                }
            })[0];
            if (extractor) {
                BuildRoadTo(gameRoom, spawn, extractor);
            }
            const sources = gameRoom.find(FIND_SOURCES);
            for (const sourceCount in sources) {
                const source = sources[sourceCount];
                BuildRoadTo(gameRoom, spawn, source);
                // build roads around each source
                for (let y = source.pos.y - 1; y <= source.pos.y + 1; y++) {
                    for (let x = source.pos.x - 1; x <= source.pos.x + 1; x++) {
                        const terrainAtPos = roomTerrain.get(x, y);
                        if (terrainAtPos !== TERRAIN_MASK_WALL && (y !== source.pos.y || x !== source.pos.x)) {
                            const result = gameRoom.createConstructionSite(x, y, STRUCTURE_ROAD);
                            if (result === OK) {
                                Util.InfoLog('Constructions', 'ConstructRoads', 'around source ' + x + ',' + y + ',' + gameRoom.name);
                            }
                        }
                    }
                }
            }
            Util.Info('Constructions', 'ConstructRoads', gameRoom.name);
        }

        function ConstructLinks(gameRoom, terrain) {
            if (Memory.MemRooms[gameRoom.name]
                && Memory.MemRooms[gameRoom.name].Links
                && Memory.MemRooms[gameRoom.name].Links.StorageLinkId
                && Memory.MemRooms[gameRoom.name].Links.ControllerLinkId
                && Memory.MemRooms[gameRoom.name].Links.HarvesterLinksId.length >= 2) {
                return;
            }
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_LINK);
            if (!numberOfPossibleConstructions) {
                return;
            }
            const container = FindExistingStructure(gameRoom.controller.pos, STRUCTURE_CONTAINER, 1);
            if (container && !FindExistingStructure(container.pos, STRUCTURE_LINK, 1)) {
                const result = ConstructAroundPos(gameRoom, terrain, container.pos, STRUCTURE_LINK);
                if (result === OK) {
                    numberOfPossibleConstructions--;
                    if (numberOfPossibleConstructions <= 0) {
                        return;
                    }
                }
            }
            const sources = gameRoom.find(FIND_SOURCES);
            for (const sourceCount in sources) {
                const source = sources[sourceCount];
                const container = FindExistingStructure(source.pos, STRUCTURE_CONTAINER, 1);
                if (container && !FindExistingStructure(container.pos, STRUCTURE_LINK, 1)) {
                    const result = ConstructAroundPos(gameRoom, terrain, container.pos, STRUCTURE_LINK);
                    if (result === OK) {
                        numberOfPossibleConstructions--;
                        if (numberOfPossibleConstructions <= 0) {
                            return;
                        }
                    }
                }
            }
            if (gameRoom.storage && !FindExistingStructure(gameRoom.storage.pos, STRUCTURE_LINK, 1)) {
                const result = ConstructAroundPos(gameRoom, terrain, gameRoom.storage.pos, STRUCTURE_LINK, 1, true);
                if (result === OK) {
                    numberOfPossibleConstructions--;
                    if (numberOfPossibleConstructions <= 0) {
                        return;
                    }
                }
            }
            Util.Info('Constructions', 'ConstructLinks', gameRoom.name);
        }

        function ConstructExtractor(gameRoom) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_EXTRACTOR);
            if (!numberOfPossibleConstructions) {
                return;
            }
            const mineral = gameRoom.find(FIND_MINERALS)[0];
            if (mineral) {
                const look = mineral.pos.look();
                const extractor = _.find(look, function (s) {
                    return s.type === LOOK_STRUCTURES || s.type === LOOK_CONSTRUCTION_SITES;
                }); // can only be extractor or the construction of extractor
                if (!extractor) {
                    const result = gameRoom.createConstructionSite(mineral.pos.x, mineral.pos.y, STRUCTURE_EXTRACTOR);
                    if (result === OK) {
                        Util.InfoLog('Constructions', 'ConstructExtractor', mineral.pos);
                    }
                }
            }
            Util.Info('Constructions', 'ConstructExtractor', gameRoom.name + ' mineral ' + mineral);
        }

        function ConstructAtStorage(gameRoom, roomTerrain, structureType) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, structureType);
            if (!numberOfPossibleConstructions) {
                return;
            }
            if (gameRoom.storage && !FindExistingStructure(gameRoom.storage.pos, structureType, 1)) {
                ConstructAroundPos(gameRoom, roomTerrain, gameRoom.storage.pos, structureType, 1, true);
                const extensionsAtStorage = gameRoom.storage.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                    filter: (s) => s.structureType === STRUCTURE_EXTENSION
                });
                for (const extensionAtStorageCount in extensionsAtStorage) {
                    const extensionAtStorage = extensionsAtStorage[extensionAtStorageCount];
                    const result = extensionAtStorage.destroy();
                    Util.InfoLog('Constructions', 'ConstructAtStorage', 'destroyed extension near storage ' + gameRoom.storage.pos + ' result ' + result);
                }
            }
            Util.Info('Constructions', 'ConstructAtStorage', gameRoom.name + ' structureType ' + structureType);
        }

        function ConstructPerimeter(gameRoom) {
            if (Memory.MemRooms[gameRoom.name].Built && Memory.MemRooms[gameRoom.name].Built === gameRoom.controller.level) {
                return;
            }
            let coreStructures = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN
                        || structure.structureType === STRUCTURE_EXTENSION
                        || structure.structureType === STRUCTURE_TOWER
                        || structure.structureType === STRUCTURE_TERMINAL
                        || structure.structureType === STRUCTURE_FACTORY
                        || structure.structureType === STRUCTURE_POWER_SPAWN
                        || structure.structureType === STRUCTURE_NUKER
                        || structure.structureType === STRUCTURE_OBSERVER;
                }
            });
            let constructions = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                filter: function (construction) {
                    return construction.structureType === STRUCTURE_SPAWN
                        || construction.structureType === STRUCTURE_EXTENSION
                        || construction.structureType === STRUCTURE_TOWER
                        || construction.structureType === STRUCTURE_TERMINAL
                        || construction.structureType === STRUCTURE_FACTORY
                        || construction.structureType === STRUCTURE_POWER_SPAWN
                        || construction.structureType === STRUCTURE_NUKER
                        || construction.structureType === STRUCTURE_OBSERVER;
                }
            });
            coreStructures = coreStructures.concat(constructions);
            const map = {};
            for (let i = 0; i < 50; i++) {
                map[i] = {};
                for (let e = 0; e < 50; e++) {
                    map[i][e] = 0;
                }
            }
            for (const coreStructureKey in coreStructures) {
                const coreStructure = coreStructures[coreStructureKey];
                for (let i = -3; i <= 3; i++) {
                    for (let e = -3; e <= 3; e++) {
                        if (i === -3 || i === 3 || e === -3 || e === 3) {
                            map[i + coreStructure.pos.x][e + coreStructure.pos.y]++;
                        } else {
                            map[i + coreStructure.pos.x][e + coreStructure.pos.y] = 10;
                        }
                    }
                }
            }

            console.log("     0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 11 12 13 14 15 16 17 18 19 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49");
            for (let i = 0; i < 50; i++) {
                let row = (i < 10 ? " " + i : i) + ":";
                for (let e = 0; e < 50; e++) {
                    row = row + " " + (map[i][e] < 10 ? "0" + map[i][e] : map[i][e]);
                    if (map[i][e] !== 0 && map[i][e] < 5) {
                        const buildPos = new RoomPosition(i, e, gameRoom.name);
                        buildPos.createConstructionSite(STRUCTURE_RAMPART);
                    }
                }
                console.log(row);
            }
        }

        function ConstructLabs(gameRoom, roomTerrain) {
            // TODO construct labs
            Util.Info('Constructions', 'ConstructLabs', gameRoom.name + ' TODO!')
        }

        //endregion

        //region helper functions

        function FindExistingStructure(targetPos, structureType, radius) {
            let structure = targetPos.findInRange(FIND_STRUCTURES, radius, {
                filter: (s) => s.structureType === structureType
            })[0];
            if (!structure) {
                structure = targetPos.findInRange(FIND_CONSTRUCTION_SITES, radius, {
                    filter: (s) => s.structureType === structureType
                })[0];
            }
            return structure;
        }

        /**@return {Boolean}*/
        function BuildRoadTo(gameRoom, fromStructure, toStructure) {
            let donePlacingRoads = true;
            const roadConstructions = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_ROAD;
                }
            });
            const pathSteps = gameRoom.findPath(fromStructure.pos, toStructure.pos, {
                swampCost: 5, plainCost: 4, ignoreCreeps: true, range: 1,
                costCallback: function (roomName, costMatrix) {
                    for (const roadConstructionCount in roadConstructions) {
                        const roadConstruction = roadConstructions[roadConstructionCount];
                        costMatrix.set(roadConstruction.pos.x, roadConstruction.pos.y, 1);
                    }
                }
            });
            for (const pathStepCount in pathSteps) {
                const pathStep = pathSteps[pathStepCount];
                const result = gameRoom.createConstructionSite(pathStep.x, pathStep.y, STRUCTURE_ROAD);
                if (result === OK) {
                    Util.InfoLog('Constructions', 'BuildRoadTo', 'from ' + fromStructure + ' to ' + (toStructure.structureType ? toStructure.structureType : toStructure.id) + ' ' + pathStep.x + ',' + pathStep.y + ',' + gameRoom.name);
                } else if (result !== ERR_INVALID_TARGET) {
                    donePlacingRoads = false;
                }
            }
            return donePlacingRoads;
        }

        function ConstructAroundPos(gameRoom, terrain, centerPos, structureType, radius = 1, isCheckered = false) {
            let spawn = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN;
                }
            })[0];
            if (!spawn) {
                spawn = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                    filter: function (structure) {
                        return structure.structureType === STRUCTURE_SPAWN;
                    }
                })[0];
            }
            if (spawn) {
                let bestPos;
                let bestRange = Number.MAX_SAFE_INTEGER;
                for (let y = centerPos.y - radius; y <= centerPos.y + radius; y++) {
                    for (let x = isCheckered ? (((y - centerPos.y) % 2) ? centerPos.x - radius : centerPos.x) : centerPos.x - radius; x <= centerPos.x + radius; (isCheckered ? x = x + 2 : x++)) {
                        const terrainAtPos = terrain.get(x, y);
                        if (terrainAtPos !== TERRAIN_MASK_WALL) {
                            const lookAtObjects = gameRoom.lookAt(x, y);
                            const hasStructure = _.find(lookAtObjects, function (lookObject) {
                                return lookObject.type === LOOK_STRUCTURES && (structureType !== STRUCTURE_CONTAINER || lookObject.structureType !== STRUCTURE_ROAD)
                                    || lookObject.type === LOOK_CONSTRUCTION_SITES;
                            });
                            if (!hasStructure) {
                                const range = spawn.pos.findPathTo(x, y);

                                if (!bestPos || range < bestRange) {
                                    bestPos = new RoomPosition(x, y, gameRoom.name);
                                    bestRange = range;
                                }
                            }
                        }
                    }
                }

                if (bestPos) {
                    const result = gameRoom.createConstructionSite(bestPos.x, bestPos.y, structureType);
                    Util.InfoLog('Constructions', 'ConstructAroundPos', bestPos.x + ',' + bestPos.y + ',' + bestPos.roomName + ' structureType ' + structureType + ' result ' + result);
                    return result;
                }
            }
        }

        function BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, buildPosition, acceptedNumOfNearbyWalls) {
            let shiftPointer = -1;
            let scanWidth = 3;
            while (numberOfPossibleConstructions) { // try adding constructionSites in a larger pattern
                for (let swy = shiftPointer; swy < scanWidth; swy++) { // scan width pointer for y plane
                    const yp = buildPosition.y + swy;
                    for (let swx = shiftPointer + (shiftPointer % 2 ? (swy % 2 ? 0 : 1) : swy % 2); swx < scanWidth; swx = swx + 2) { // scan width pointer for x plane
                        const xp = buildPosition.x + swx;
                        if (xp < 45 && yp < 45 && xp >= 5 && yp >= 5) {
                            const newBuildPos = new RoomPosition(xp, yp, gameRoom.name);
                            const terrain = roomTerrain.get(newBuildPos.x, newBuildPos.y);
                            if ((!terrain || terrain === 2)) { // plan and swamp is buildable
                                const lookAtObjects = gameRoom.lookAt(newBuildPos.x, newBuildPos.y);
                                const hasStructure = _.find(lookAtObjects, function (lookObject) {
                                    return lookObject.type === LOOK_STRUCTURES || lookObject.type === LOOK_CONSTRUCTION_SITES;
                                });
                                if (!hasStructure) {
                                    let numOfNearbyWalls = NumOfNearbyWalls(roomTerrain, newBuildPos);
                                    if (numOfNearbyWalls <= acceptedNumOfNearbyWalls) {
                                        const unwantedNearbyStructures = newBuildPos.findInRange(FIND_STRUCTURES, 1, {
                                            filter: function (structure) {
                                                return structure.structureType !== STRUCTURE_SPAWN
                                                    && structure.structureType !== STRUCTURE_EXTENSION
                                                    && structure.structureType !== STRUCTURE_TOWER
                                                    && structure.structureType !== STRUCTURE_TERMINAL
                                                    && structure.structureType !== STRUCTURE_FACTORY
                                                    && structure.structureType !== STRUCTURE_POWER_SPAWN
                                                    && structure.structureType !== STRUCTURE_NUKER
                                                    && structure.structureType !== STRUCTURE_OBSERVER
                                                    && structure.structureType !== STRUCTURE_LINK
                                                    && structure.structureType !== STRUCTURE_CONTAINER
                                                    && structure.structureType !== STRUCTURE_ROAD
                                                    && structure.structureType !== STRUCTURE_RAMPART;
                                            }
                                        });
                                        if (unwantedNearbyStructures.length === 0) {
                                            const nearbySources = newBuildPos.findInRange(FIND_SOURCES, 1);
                                            if (nearbySources.length === 0) {
                                                const nearbyMineral = newBuildPos.findInRange(FIND_MINERALS, 1);
                                                if (nearbyMineral.length === 0) {
                                                    const result = gameRoom.createConstructionSite(newBuildPos.x, newBuildPos.y, structureType);
                                                    if (result === OK) {
                                                        Util.InfoLog('Constructions', 'buildExtensions', gameRoom.name + ' at (' + newBuildPos.x + ',' + newBuildPos.y + ')');
                                                        numberOfPossibleConstructions--;
                                                        if (numberOfPossibleConstructions <= 0) {
                                                            return;
                                                        }
                                                    } else {
                                                        Util.Warning('Constructions', 'buildExtensions', gameRoom.name + ' at (' + newBuildPos.x + ',' + newBuildPos.y + ') result ' + result);
                                                        return;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else if ((xp >= 100 || xp < -50) && (yp >= 100 || yp < -50)) {
                            Util.ErrorLog('Constructions', 'buildExtensions', 'looped too far out! ' + xp + ',' + yp + ',' + gameRoom.name);
                            return;
                        }
                    }
                }
                shiftPointer--; //move the placement pattern further out
                scanWidth = scanWidth + 2;
            }
        }

        /**@return {Number}*/
        function NumOfNearbyWalls(terrain, pos) {
            let numOfNearbyWalls = 0;
            for (let terrainX = pos.x - 1; terrainX <= pos.x + 1; terrainX++) {
                for (let terrainY = pos.y - 1; terrainY <= pos.y + 1; terrainY++) {
                    const NearbyTerrain = terrain.get(terrainX, terrainY);
                    if (NearbyTerrain === TERRAIN_MASK_WALL) {
                        numOfNearbyWalls++;
                    }
                }
            }
            return numOfNearbyWalls;
        }

        /**@return {Number}*/
        function GetNumberOfPossibleConstructions(gameRoom, structureType) {
            const numberOfBuildableStructures = Util.FindNumberOfBuildableStructures(gameRoom, structureType);
            const structure = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            const structureConstructionSites = gameRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            return numberOfBuildableStructures - (structure.length + structureConstructionSites.length);
        }

        //endregion
    }
};
module.exports = Constructions;