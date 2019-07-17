const Links = {
    run: function () {

        for(const memRoomKey in Memory.MemRooms) {
            const memRoom = Memory.MemRooms[memRoomKey];
            const gameRoom = Game.rooms[memRoomKey];
            let storageLink = undefined;
            let controllerLink = undefined;
            let harvesterLinks = [];
            if(memRoom.links){
                storageLink = Game.getObjectById(memRoom.links.StorageLinkId);
                controllerLink = Game.getObjectById(memRoom.links.ControllerLinkId);
                harvesterLinks[0] = Game.getObjectById(memRoom.links.HarvesterLinksId[0]);
                if(memRoom.links.HarvesterLinksId[1]){
                    harvesterLinks[1] = Game.getObjectById(memRoom.links.HarvesterLinksId[1]);
                }
            }else if(gameRoom.controller !== undefined && gameRoom.controller.my && gameRoom.storage){
                const sources = gameRoom.find(FIND_SOURCES); // 1 or 2 sources will exist
                const links = gameRoom.find(STRUCTURE_LINK);
                let harvesterLinksId = [];
                for(let i = 0; i < links.length; i++){
                    if(links[i].isNearTo(gameRoom.storage)){
                        storageLink = links[i];
                    }else if(links[i].isNearTo(gameRoom.controller)){
                        controllerLink = links[i];
                    }else if(links[i].isNearTo(sources[0])){
                        harvesterLinks.push(links[i]);
                        harvesterLinksId.push(links[i].id);
                    }else if(sources.length > 1 && links[i].isNearTo(sources[1])){
                        harvesterLinks.push(links[i]);
                        harvesterLinksId.push(links[i].id);
                    }
                }
                memRoom.links = {'StorageLinkId': storageLink.id, 'ControllerLinkId': controllerLink.id, 'HarvesterLinksId': harvesterLinksId};
            }
            LinkTransfer(storageLink, controllerLink, harvesterLinks);
        }

        function LinkTransfer(storageLink, controllerLink, harvesterLinks){
            let hasTransferredToControllerLink = false;
            for(let i = 0; i < harvesterLinks.length; i++){
                if(harvesterLinks[i].energy <= 700){
                    if(!hasTransferredToControllerLink && controllerLink.energy < 500){
                        harvesterLinks[i].transferEnergy(controllerLink);
                        hasTransferredToControllerLink = true;
                    }else if(storageLink.energy < 600){
                        harvesterLinks[i].transferEnergy(storageLink);
                    }
                }
            }
        }
    }
};
module.exports = Links;