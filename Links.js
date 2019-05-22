const Links = {
    run: function(room) {
        if(room.controller.level >= 5){
            let linkAtController = undefined;
            let linkAtStorage = undefined;
            let harvesterLinks = [];
            for(let i = 0; i < Memory.links.length; i++){
                if(Memory.links[i].room === room.name){ // already saved in memory
                    linkAtController = Game.getObjectById(Memory.links[i].linkAtController);
                    linkAtStorage = Game.getObjectById(Memory.links[i].linkAtStorage);
                    for(let e = 0; e < Memory.links[i].harvesterLinks.length; e++){
                        harvesterLinks.push(Game.getObjectById(Memory.links[i].harvesterLinks[e]));
                    }
                    break;
                }
            }
            if(!linkAtController && !linkAtStorage && harvesterLinks.length === 0){ // room links not in memory, try and find them
                const links = room.find(FIND_MY_STRUCTURES, {
                    filter: (link) => {
                        return (link.structureType === STRUCTURE_LINK);}});
                for (const linkCount in links) {
                    const link = links[linkCount];
                    if (link.pos.findInRange(FIND_MY_STRUCTURES, 2, {filter: (structure) => {return structure.structureType == STRUCTURE_CONTROLLER;}})[0]) {
                        linkAtController = link; // link with high priority, this link should not give its energy
                    }else if(link.pos.findInRange(FIND_MY_STRUCTURES, 1, {filter: (structure) => {return structure.structureType == STRUCTURE_STORAGE;}})[0]) {
                        linkAtStorage = link; // if linkAtController is full transfer to the storageLink
                    }else {
                        harvesterLinks.push(link);
                    }
                }
                let harvesterLinkIDs = [];
                for(let i = 0; i < harvesterLinks.length; i++){
                    harvesterLinkIDs.push(harvesterLinks[i].id);
                }
                if(linkAtController && linkAtStorage && harvesterLinks.length === 0 && harvesterLinks.length > 0){
                    const linksInRoom = {'room': room.name, 'linkAtController': linkAtController.id, 'linkAtStorage': linkAtStorage.id, 'harvesterLinks': harvesterLinkIDs};
                    console.log("Links added to memory: " + JSON.stringify(linksInRoom));
                    Memory.links.push(linksInRoom);
                }
            }

            //console.log("linkAtController " + JSON.stringify(linkAtController));
            //console.log("linkAtStorage " + JSON.stringify(linkAtStorage));
            for(const harvesterLinkCount in harvesterLinks){
                const harvesterLink = harvesterLinks[harvesterLinkCount];
                //console.log("harvesterLink " + harvesterLinkCount + " " + JSON.stringify(harvesterLink));
                if(harvesterLink !== undefined && harvesterLink.cooldown === 0){
                    if(linkAtController !== undefined && linkAtController.energy <= 750){
                        harvesterLink.transferEnergy(linkAtController);
                    }else if(linkAtStorage !== undefined && linkAtStorage.energy <= 750){
                        harvesterLink.transferEnergy(linkAtStorage);
                    }
                }
            }
        }
    }
};
module.exports = Links;