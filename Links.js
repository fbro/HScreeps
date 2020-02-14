let Util = require('Util');
const Links = {
    run: function () {

        for (const memRoomKey in Memory.MemRooms) {
            const memRoom = Memory.MemRooms[memRoomKey];
            const gameRoom = Game.rooms[memRoomKey];
            let storageLink = undefined;
            let controllerLink = undefined;
            let harvesterLinks = [];
            if (memRoom.links && memRoom.links.StorageLinkId && memRoom.links.ControllerLinkId && memRoom.links.HarvesterLinksId.length === memRoom.SourceNumber) {
                storageLink = Game.getObjectById(memRoom.links.StorageLinkId);
                controllerLink = Game.getObjectById(memRoom.links.ControllerLinkId);
                harvesterLinks[0] = Game.getObjectById(memRoom.links.HarvesterLinksId[0]);
                if (memRoom.links.HarvesterLinksId[1]) {
                    harvesterLinks[1] = Game.getObjectById(memRoom.links.HarvesterLinksId[1]);
                }
            } else if (gameRoom && gameRoom.controller !== undefined && gameRoom.controller.my && gameRoom.storage) {
                const links = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_LINK;
                    }
                });
                let storageLinkId = undefined;
                let controllerLinkId = undefined;
                let harvesterLinksId = [];
                for (let i = 0; i < links.length; i++) {
                    if (links[i].pos.findInRange(FIND_MY_STRUCTURES, 1, {
                        filter: (s) => {
                            return s.structureType === STRUCTURE_STORAGE;
                        }
                    }).length > 0) {
                        storageLink = links[i];
                        storageLinkId = storageLink.id;
                    } else if (links[i].pos.findInRange(FIND_STRUCTURES, 2, {
                        filter: (s) => {
                            return s.structureType === STRUCTURE_CONTROLLER;
                        }
                    }).length > 0) {
                        controllerLink = links[i];
                        controllerLinkId = controllerLink.id;
                    } else if (links[i].pos.findInRange(FIND_SOURCES, 2).length > 0) {
                        harvesterLinks.push(links[i]);
                        harvesterLinksId.push(links[i].id);
                    }
                }
                memRoom.links = {
                    'StorageLinkId': storageLinkId,
                    'ControllerLinkId': controllerLinkId,
                    'HarvesterLinksId': harvesterLinksId
                };
                //Util.Info('Links', 'Links', 'added in ' + memRoomKey + ' storage: ' + storageLinkId + ' controller ' + controllerLinkId + ' harvester ' + harvesterLinksId.length + ' roomLevel ' + memRoom.RoomLevel);
            }
            if ((storageLink || controllerLink) && harvesterLinks.length > 0) {
                LinkTransfer(storageLink, controllerLink, harvesterLinks);
            }
        }

        function LinkTransfer(storageLink, controllerLink, harvesterLinks) {
            let hasTransferredToControllerLink = false;
            for (let i = 0; i < harvesterLinks.length; i++) {
                if (harvesterLinks[i].store.getUsedCapacity(RESOURCE_ENERGY) >= 700) {
                    if (!hasTransferredToControllerLink && controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) < 500) {
                        harvesterLinks[i].transferEnergy(controllerLink);
                        hasTransferredToControllerLink = true;
                    } else if (storageLink && storageLink.store.getUsedCapacity(RESOURCE_ENERGY) < 600) {
                        harvesterLinks[i].transferEnergy(storageLink);
                    }
                }
            }
        }
    }
};
module.exports = Links;