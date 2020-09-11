let Util = require('Util');
const Constructions = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my) {
                const roomTerrain = gameRoom.getTerrain();
                build(gameRoom, roomTerrain);
            }
        }

        function build(gameRoom, roomTerrain) {
            switch (true) {
                case gameRoom.controller.level >= 1 :
                    //ConstructContainers(gameRoom, roomTerrain);
                case gameRoom.controller.level >= 2 :
                    ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_EXTENSION);
                case gameRoom.controller.level >= 3 :
                    ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_TOWER);
                    ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_SPAWN);
                case gameRoom.controller.level >= 6 :
                    ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_SPAWN);
                    break;
            }
        }

        function ConstructContainers(gameRoom, terrain){ // TODO add source containers
            const controllerContainer = gameRoom.controller.pos.findInRange(FIND_STRUCTURES, 1, {
                 filter: (s) => s.structureType === STRUCTURE_CONTAINER
             })[0];
            if(!controllerContainer){
                ConstructAroundPos(gameRoom, terrain, gameRoom.controller.pos, STRUCTURE_CONTAINER);
            }
        }

        function ConstructAroundPos(gameRoom, terrain, centerPos, structureType){
            for (let y = centerPos.y - 1; y < centerPos.y + 1; y++) {
                for (let x = centerPos.x - 1; x < centerPos.x + 1; x++) {
                    const terrainAtPos = terrain.get(x, y);
                    if(terrainAtPos !== TERRAIN_MASK_WALL){
                        const result = gameRoom.createConstructionSite(x, y, structureType);
                        Util.InfoLog('Constructions', 'ConstructAroundPos', x + ',' + y + ',' +  + ' to protect ' + structureType + ' result ' + result);
                        return;
                    }
                }
            }
        }

        function ConstructCoreBuilding(gameRoom, roomTerrain, structureType){
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, structureType);
            if (!numberOfPossibleConstructions) {
                return;
            }
            const spawns = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN;
                }
            });
            if(spawns.length > 0){
                BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, spawns[0].pos);
            }
        }

        function ConstructRampartsOn(gameRoom, roomTerrain, structureType){
            const structuresToPlaceRampartOn = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            for(const structuresToPlaceRampartOnCount in structuresToPlaceRampartOn){
                const structure = structuresToPlaceRampartOn[structuresToPlaceRampartOnCount];
                const structuresOnPos = structure.pos.lookFor(LOOK_STRUCTURES);
                let foundRampart = false;
                for(const structuresOnPosCount in structuresOnPos) {
                    const structureOnPos = structuresOnPos[structuresOnPosCount];
                    if(structureOnPos.structureType === STRUCTURE_RAMPART){
                        foundRampart = true;
                        break;
                    }
                }
                if(!foundRampart){
                    const result = gameRoom.createConstructionSite(structure.pos.x, structure.pos.y, STRUCTURE_RAMPART);
                    Util.InfoLog('Constructions', 'ConstructRampartsOn', structure.pos  + ' to protect ' + structureType + ' result ' + result);
                }
            }
        }

        function BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, buildPosition) {
            let shiftPointer = -1;
            let scanWidth = 3;
            while (numberOfPossibleConstructions) { // try adding constructionSites in a larger pattern
                for (let swy = shiftPointer; swy < scanWidth; swy++) { // scan width pointer for y plane
                    const yp = buildPosition.y + swy;
                    for (let swx = shiftPointer + (shiftPointer % 2 ? (swy % 2 ? 0 : 1) : swy % 2); swx < scanWidth; swx = swx + 2) { // scan width pointer for x plane
                        const xp = buildPosition.x + swx;
                        if(xp < 45 && yp < 45 && xp >= 5 && yp >= 5){
                            const newBuildPos = new RoomPosition(xp, yp, gameRoom.name);
                            const terrain = roomTerrain.get(newBuildPos.x, newBuildPos.y);
                            if ((!terrain || terrain === 2)) { // plan and swamp is buildable
                                const lookAtObjects = gameRoom.lookAt(newBuildPos.x, newBuildPos.y);
                                const hasStructure = _.find(lookAtObjects, function (lookObject) {
                                    return lookObject.type === LOOK_STRUCTURES || lookObject.type === LOOK_CONSTRUCTION_SITES;
                                });
                                if (!hasStructure) {
                                    let hasNearbyWall = HasNearbyWall(roomTerrain, newBuildPos);
                                    if(!hasNearbyWall) {
                                        const unwantedNearbyStructures = newBuildPos.findInRange(FIND_STRUCTURES, 1, {
                                            filter: function (structure) {
                                                return structure.structureType !== STRUCTURE_SPAWN
                                                    && structure.structureType !== STRUCTURE_EXTENSION
                                                    && structure.structureType !== STRUCTURE_TOWER
                                                    && structure.structureType !== STRUCTURE_CONTAINER
                                                    && structure.structureType !== STRUCTURE_ROAD;
                                            }
                                        });
                                        if(unwantedNearbyStructures.length === 0){
                                            const nearbySources = newBuildPos.findInRange(FIND_SOURCES, 1);
                                            if(nearbySources.length === 0) {
                                                const nearbyMineral = newBuildPos.findInRange(FIND_MINERALS, 1);
                                                if(nearbyMineral.length === 0) {
                                                    const result = gameRoom.createConstructionSite(newBuildPos.x, newBuildPos.y, structureType);
                                                    if (result === OK) {
                                                        Util.InfoLog('Constructions', 'buildExtensions', gameRoom.name + ' at (' + newBuildPos.x + ',' + newBuildPos.y + ')');
                                                        numberOfPossibleConstructions--;
                                                        if (numberOfPossibleConstructions <= 0) {
                                                            return;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                shiftPointer--; //move the placement pattern further out
                scanWidth = scanWidth + 2;
            }
        }

        /**@return {boolean}*/
        function HasNearbyWall(terrain, pos){
            for(let terrainX = pos.x - 1; terrainX <= pos.x + 1; terrainX++){
                for(let terrainY = pos.y - 1; terrainY <= pos.y + 1; terrainY++){
                    const NearbyTerrain = terrain.get(terrainX, terrainY);
                    if(NearbyTerrain === TERRAIN_MASK_WALL){
                        return true;
                    }
                }
            }
            return false;
        }

        /**@return {Number}*/
        function GetNumberOfPossibleConstructions(gameRoom, structureType) {
            const numberOfBuildableStructures = Util.FindNumberOfBuildableStructures(gameRoom, structureType);
            const extensions = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            const extensionConstructionSites = gameRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            //Util.Info('Constructions', 'GetNumberOfPossibleConstructions', 'numberOfBuildableStructures ' + numberOfBuildableStructures + ' extensions.length ' + extensions.length + ' extensionConstructionSites.length ' + extensionConstructionSites.length);
            return numberOfBuildableStructures - (extensions.length + extensionConstructionSites.length);
        }


    }
};
module.exports = Constructions;