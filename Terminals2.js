let Util = require('Util');
const Terminals = {
    run: function () {

        // TODO proposed new structure:
        // load up all your terminals
        // loop through them and remove them when they have done an action
        // look for action:
            // possible actions are for each resource
            // distributeFactory if resource is factory then distribute after factory rules
            // distributeLab if resource is used for labs then distribute after lab rules
            // distribute to other rooms in general
            // sellExcess if distribute is not possible and there is too much of that resource then try and sell
        // buy resource only if really needed:
            // buyLab - buy if the labs in the room needs a resource and NO OTHER TERMINAL has that
            // buyFactory - buy if the factory in the room needs a resource and NO OTHER TERMINAL has that

        // remember to edit the amount of resources when sending to handle the next terminals available information

        const terminals = LoadMyTerminals();
        TerminalActions(terminals);

        function LoadMyTerminals() {
            let terminals = [];
            for (const gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey];
                if (gameRoom.terminal && gameRoom.terminal.my) {
                    terminals.push(gameRoom.terminal);
                }
            }
            return terminals;
        }

        function TerminalActions(terminals) {
            for (const terminalKey in terminals) {
                const terminal = terminals[terminalKey];
                const memRoom = Memory.MemRooms[terminal.pos.roomName];

                GetFactoryResources(terminal, terminals, memRoom); // first try and get from other terminals then try and buy from the market

                GetLabResources(terminal, terminals); // first try and get from other terminals then try and buy from the market

                DistributeEnergy(terminal, terminals);

                SellExcess(terminal, terminals);
            }
        }

        function GetFactoryResources(terminal, terminals, memRoom){

            if(memRoom && memRoom.FctrId && memRoom.FctrId !== '-'){
                const factory = Game.getObjectById(memRoom.FctrId);
                if(factory && factory.level){
                    for (const resourceType in terminal.store) {
                        let fromAmount = terminal.store[resourceType];

                    }
                }
            }
            // TODO set cooldown if sending
            // TODO set new amount both places if sending
            // TODO set cooldown if buying
            // TODO set new amount if buying
        }

        function GetLabResources(terminal, terminals){

            const flags = terminal.room.find(FIND_FLAGS, {
                filter: function (flag) {
                    return flag.color === COLOR_PURPLE && flag.secondaryColor === COLOR_PURPLE;
                }
            });
            if(flags.length > 0){
                // look at
                // TODO
            }

            // TODO set cooldown if sending
            // TODO set new amount both places if sending
            // TODO set cooldown if buying
            // TODO set new amount if buying
        }

        function DistributeEnergy(terminal, terminals){
            // TODO set cooldown if sending
            // TODO set new amount both places if sending

            if(terminal.store.getUsedCapacity(RESOURCE_ENERGY) === 0 && terminal.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) === 0){
                for(const tKey in terminals){
                    const t = terminals[tKey];
                    if(t.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.STORAGE_ENERGY_MEDIUM){
                        trySendResource(Util.STORAGE_ENERGY_LOW, RESOURCE_ENERGY, t, terminal);
                    }
                }
            }
        }

        function SellExcess(terminal, terminals){
            // TODO set cooldown if selling
            // TODO set new amount if selling
        }

        function trySendResource(amount, resourceType, fromTerminal, toTerminal){
            if(!fromTerminal.cooldown && fromTerminal.id !== toTerminal.id){ // && fromTerminal.store.getUsedCapacity(resourceType) >= Util.STORAGE_ENERGY_MEDIUM
                const result = fromTerminal.send(resourceType, amount, toTerminal.pos.roomName);
                Util.Info('Terminals', 'trySendResource', amount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result);
                if(result === OK){
                    fromTerminal.cooldown = 10;
                    fromTerminal.store[resourceType] = fromTerminal.store[resourceType] - amount;
                    toTerminal.store[resourceType] = toTerminal.store[resourceType] + amount;
                }
            }
        }

        function comparePriceCheapestFirst(a, b) {
            if (a.price < b.price) {
                return -1;
            }
            if (a.price > b.price) {
                return 1;
            }
            return 0;
        }

        function comparePriceExpensiveFirst(a, b) {
            if (a.price > b.price) {
                return -1;
            }
            if (a.price < b.price) {
                return 1;
            }
            return 0;
        }
    }
};
module.exports = Terminals;