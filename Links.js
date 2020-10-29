let Util = require('Util');
const Links = {
    run: function () {

        for (const memRoomKey in Memory.MemRooms) {
            const memRoom = Memory.MemRooms[memRoomKey];
            const gameRoom = Game.rooms[memRoomKey];
            let storageLink;
            let controllerLink;
            let harvesterLinks = [];
            if (memRoom && memRoom.Links && memRoom.Links.StorageLinkId && memRoom.Links.ControllerLinkId && memRoom.Links.HarvesterLinksId.length === memRoom.SourceNumber) {
                storageLink = Game.getObjectById(memRoom.Links.StorageLinkId);
                controllerLink = Game.getObjectById(memRoom.Links.ControllerLinkId);
                harvesterLinks[0] = Game.getObjectById(memRoom.Links.HarvesterLinksId[0]);
                if (memRoom.Links.HarvesterLinksId[1]) {
                    harvesterLinks[1] = Game.getObjectById(memRoom.Links.HarvesterLinksId[1]);
                }
            } else if (gameRoom && gameRoom.controller && gameRoom.controller.my && gameRoom.storage) {
                const links = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_LINK;
                    }
                });
                let storageLinkId;
                let controllerLinkId;
                let harvesterLinksId = [];
                for (let i = 0; i < links.length; i++) {
                    if (links[i].pos.findInRange(FIND_MY_STRUCTURES, 1, {
                        filter: (s) => {
                            return s.structureType === STRUCTURE_STORAGE;
                        }
                    }).length > 0) {
                        storageLink = links[i];
                        storageLinkId = storageLink.id;
                    } else {
                        let container = links[i].pos.findInRange(FIND_STRUCTURES, 1, {
                            filter: (s) => {
                                return s.structureType === STRUCTURE_CONTAINER;
                            }
                        })[0];

                        if (container && container.pos.findInRange(FIND_STRUCTURES, 1, {
                            filter: (s) => {
                                return s.structureType === STRUCTURE_CONTROLLER;
                            }
                        }).length > 0) {
                            controllerLink = links[i];
                            controllerLinkId = controllerLink.id;
                        } else if (container && container.pos.findInRange(FIND_SOURCES, 1).length > 0) {
                            harvesterLinks.push(links[i]);
                            harvesterLinksId.push(links[i].id);
                        }
                    }
                }
                memRoom.Links = {
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
                if (harvesterLinks[i] && harvesterLinks[i].store.getUsedCapacity(RESOURCE_ENERGY) >= (LINK_CAPACITY / 2)) {
                    if (!hasTransferredToControllerLink && controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) < LINK_CAPACITY) {
                        harvesterLinks[i].transferEnergy(controllerLink);
                        hasTransferredToControllerLink = true;
                    } else if (storageLink && storageLink.store.getUsedCapacity(RESOURCE_ENERGY) < LINK_CAPACITY) {
                        harvesterLinks[i].transferEnergy(storageLink);
                    }
                }
            }
        }
    }
};
module.exports = Links;