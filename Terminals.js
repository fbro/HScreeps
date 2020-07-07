let Util = require('Util');
const Terminals = {
    run: function () {

        const terminals = LoadMyTerminals();
        TerminalActions(terminals);

        //region terminal actions

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
            let marketDealCount = 0;
            for (const terminalKey in terminals) {
                const terminal = terminals[terminalKey];
                const memRoom = Memory.MemRooms[terminal.pos.roomName];

                GetFactoryResources(terminal, terminals, memRoom); // try and get from other terminals

                marketDealCount = GetLabResources(terminal, terminals, marketDealCount); // first try and get from other terminals then try and buy from the market

                GetEnergy(terminal, terminals);

                marketDealCount = SellExcess(terminal, marketDealCount);
            }
        }

        function GetFactoryResources(toTerminal, terminals, memRoom) {
            if (memRoom && memRoom.FctrId && memRoom.FctrId !== '-') {
                const factory = Game.getObjectById(memRoom.FctrId);
                if (factory) {
                    const resourcesNeeded = [RESOURCE_ENERGY];
                    switch (factory.level) { // factory level
                        case(0):
                            switch (true) { // production chain
                                case(IsProductionChain(factory, RESOURCE_METAL, RESOURCE_ALLOY, RESOURCE_METAL)): // Mechanical chain
                                    resourcesNeeded.push(RESOURCE_ZYNTHIUM);
                                    resourcesNeeded.push(RESOURCE_METAL);
                                    resourcesNeeded.push(RESOURCE_UTRIUM);
                                    resourcesNeeded.push(RESOURCE_OXYGEN);
                                    resourcesNeeded.push(RESOURCE_HYDROGEN);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_BIOMASS, RESOURCE_CELL, RESOURCE_BIOMASS)): // Biological chain
                                    resourcesNeeded.push(RESOURCE_LEMERGIUM);
                                    resourcesNeeded.push(RESOURCE_BIOMASS);
                                    resourcesNeeded.push(RESOURCE_OXYGEN);
                                    resourcesNeeded.push(RESOURCE_HYDROGEN);
                                    resourcesNeeded.push(RESOURCE_ZYNTHIUM);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_SILICON, RESOURCE_WIRE, RESOURCE_SILICON)): // Electronical chain
                                    resourcesNeeded.push(RESOURCE_UTRIUM);
                                    resourcesNeeded.push(RESOURCE_SILICON);
                                    resourcesNeeded.push(RESOURCE_OXYGEN);
                                    resourcesNeeded.push(RESOURCE_HYDROGEN);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_MIST, RESOURCE_CONDENSATE, RESOURCE_MIST)): // Mystical chain
                                    resourcesNeeded.push(RESOURCE_KEANIUM);
                                    resourcesNeeded.push(RESOURCE_MIST);
                                    resourcesNeeded.push(RESOURCE_HYDROGEN);
                                    resourcesNeeded.push(RESOURCE_OXYGEN);
                                    break;
                            }
                            break;
                        case(1):
                            switch (true) { // production chain
                                case(IsProductionChain(factory, RESOURCE_ALLOY, RESOURCE_TUBE, RESOURCE_METAL)): // Mechanical chain
                                    resourcesNeeded.push(RESOURCE_ALLOY);
                                    resourcesNeeded.push(RESOURCE_ZYNTHIUM_BAR);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_CELL, RESOURCE_PHLEGM, RESOURCE_BIOMASS)): // Biological chain
                                    resourcesNeeded.push(RESOURCE_CELL);
                                    resourcesNeeded.push(RESOURCE_OXIDANT);
                                    resourcesNeeded.push(RESOURCE_LEMERGIUM_BAR);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_WIRE, RESOURCE_SWITCH, RESOURCE_SILICON)): // Electronical chain
                                    resourcesNeeded.push(RESOURCE_WIRE);
                                    resourcesNeeded.push(RESOURCE_OXIDANT);
                                    resourcesNeeded.push(RESOURCE_UTRIUM_BAR);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_CONDENSATE, RESOURCE_CONCENTRATE, RESOURCE_MIST)): // Mystical chain
                                    resourcesNeeded.push(RESOURCE_CONDENSATE);
                                    resourcesNeeded.push(RESOURCE_KEANIUM_BAR);
                                    resourcesNeeded.push(RESOURCE_REDUCTANT);
                                    break;
                            }
                            break;
                        case(2):
                            switch (true) { // production chain
                                case(IsProductionChain(factory, RESOURCE_ALLOY, RESOURCE_FIXTURES, RESOURCE_METAL)): // Mechanical chain
                                    resourcesNeeded.push(RESOURCE_COMPOSITE);
                                    resourcesNeeded.push(RESOURCE_ALLOY);
                                    resourcesNeeded.push(RESOURCE_OXIDANT);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_PHLEGM, RESOURCE_TISSUE, RESOURCE_BIOMASS)): // Biological chain
                                    resourcesNeeded.push(RESOURCE_PHLEGM);
                                    resourcesNeeded.push(RESOURCE_CELL);
                                    resourcesNeeded.push(RESOURCE_REDUCTANT);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_SWITCH, RESOURCE_TRANSISTOR, RESOURCE_SILICON)): // Electronical chain
                                    resourcesNeeded.push(RESOURCE_SWITCH);
                                    resourcesNeeded.push(RESOURCE_WIRE);
                                    resourcesNeeded.push(RESOURCE_REDUCTANT);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_CONCENTRATE, RESOURCE_EXTRACT, RESOURCE_MIST)): // Mystical chain
                                    resourcesNeeded.push(RESOURCE_CONCENTRATE);
                                    resourcesNeeded.push(RESOURCE_CONDENSATE);
                                    resourcesNeeded.push(RESOURCE_OXIDANT);
                                    break;
                            }
                            break;
                        case(3):
                            switch (true) { // production chain
                                case(IsProductionChain(factory, RESOURCE_FIXTURES, RESOURCE_FRAME, RESOURCE_METAL)): // Mechanical chain
                                    resourcesNeeded.push(RESOURCE_FIXTURES);
                                    resourcesNeeded.push(RESOURCE_TUBE);
                                    resourcesNeeded.push(RESOURCE_REDUCTANT);
                                    resourcesNeeded.push(RESOURCE_ZYNTHIUM_BAR);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_TISSUE, RESOURCE_MUSCLE, RESOURCE_BIOMASS)): // Biological chain
                                    resourcesNeeded.push(RESOURCE_TISSUE);
                                    resourcesNeeded.push(RESOURCE_PHLEGM);
                                    resourcesNeeded.push(RESOURCE_ZYNTHIUM_BAR);
                                    resourcesNeeded.push(RESOURCE_REDUCTANT);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_TRANSISTOR, RESOURCE_MICROCHIP, RESOURCE_SILICON)): // Electronical chain
                                    resourcesNeeded.push(RESOURCE_TRANSISTOR);
                                    resourcesNeeded.push(RESOURCE_COMPOSITE); // not added in lower factory yet!
                                    resourcesNeeded.push(RESOURCE_WIRE);
                                    resourcesNeeded.push(RESOURCE_PURIFIER); // not added in lower factory yet!
                                    break;
                                case(IsProductionChain(factory, RESOURCE_EXTRACT, RESOURCE_SPIRIT, RESOURCE_MIST)): // Mystical chain
                                    resourcesNeeded.push(RESOURCE_EXTRACT);
                                    resourcesNeeded.push(RESOURCE_CONCENTRATE);
                                    resourcesNeeded.push(RESOURCE_REDUCTANT);
                                    resourcesNeeded.push(RESOURCE_PURIFIER); // not added in lower factory yet!
                                    break;
                            }
                            break;
                        case(4):
                            switch (true) { // production chain
                                case(IsProductionChain(factory, RESOURCE_FIXTURES, RESOURCE_HYDRAULICS, RESOURCE_METAL)): // Mechanical chain
                                    resourcesNeeded.push(RESOURCE_LIQUID); // not added in lower factory yet!
                                    resourcesNeeded.push(RESOURCE_FIXTURES);
                                    resourcesNeeded.push(RESOURCE_TUBE);
                                    resourcesNeeded.push(RESOURCE_PURIFIER); // not added in lower factory yet!
                                    break;
                                case(IsProductionChain(factory, RESOURCE_MUSCLE, RESOURCE_ORGANOID, RESOURCE_BIOMASS)): // Biological chain
                                    resourcesNeeded.push(RESOURCE_MUSCLE);
                                    resourcesNeeded.push(RESOURCE_TISSUE);
                                    resourcesNeeded.push(RESOURCE_PURIFIER); // not added in lower factory yet!
                                    resourcesNeeded.push(RESOURCE_OXIDANT);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_MICROCHIP, RESOURCE_CIRCUIT, RESOURCE_SILICON)): // Electronical chain
                                    resourcesNeeded.push(RESOURCE_MICROCHIP);
                                    resourcesNeeded.push(RESOURCE_TRANSISTOR);
                                    resourcesNeeded.push(RESOURCE_SWITCH);
                                    resourcesNeeded.push(RESOURCE_OXIDANT);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_SPIRIT, RESOURCE_EMANATION, RESOURCE_MIST)): // Mystical chain
                                    resourcesNeeded.push(RESOURCE_SPIRIT);
                                    resourcesNeeded.push(RESOURCE_EXTRACT);
                                    resourcesNeeded.push(RESOURCE_CONCENTRATE);
                                    resourcesNeeded.push(RESOURCE_KEANIUM_BAR);
                                    break;
                            }
                            break;
                        case(5):
                            switch (true) { // production chain
                                case(IsProductionChain(factory, RESOURCE_HYDRAULICS, RESOURCE_MACHINE, RESOURCE_METAL)): // Mechanical chain
                                    resourcesNeeded.push(RESOURCE_HYDRAULICS);
                                    resourcesNeeded.push(RESOURCE_FRAME);
                                    resourcesNeeded.push(RESOURCE_FIXTURES);
                                    resourcesNeeded.push(RESOURCE_TUBE);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_ORGANOID, RESOURCE_ORGANISM, RESOURCE_BIOMASS)): // Biological chain
                                    resourcesNeeded.push(RESOURCE_ORGANOID);
                                    resourcesNeeded.push(RESOURCE_LIQUID); // not added in lower factory yet!
                                    resourcesNeeded.push(RESOURCE_TISSUE);
                                    resourcesNeeded.push(RESOURCE_CELL);
                                    break;
                                case(IsProductionChain(factory, RESOURCE_CIRCUIT, RESOURCE_DEVICE, RESOURCE_SILICON)): // Electronical chain
                                    resourcesNeeded.push(RESOURCE_CIRCUIT);
                                    resourcesNeeded.push(RESOURCE_MICROCHIP);
                                    resourcesNeeded.push(RESOURCE_CRYSTAL); // not added in lower factory yet!
                                    resourcesNeeded.push(RESOURCE_GHODIUM_MELT); // not added in lower factory yet!
                                    break;
                                case(IsProductionChain(factory, RESOURCE_EMANATION, RESOURCE_ESSENCE, RESOURCE_MIST)): // Mystical chain
                                    resourcesNeeded.push(RESOURCE_EMANATION);
                                    resourcesNeeded.push(RESOURCE_SPIRIT);
                                    resourcesNeeded.push(RESOURCE_CRYSTAL); // not added in lower factory yet!
                                    resourcesNeeded.push(RESOURCE_GHODIUM_MELT); // not added in lower factory yet!
                                    break;
                            }
                            break;
                    }
                    for(const resourceNeedKey in resourcesNeeded){
                        const resourceNeed = resourcesNeeded[resourceNeedKey];
                        const amount = Util.TERMINAL_MAX_RESOURCE - toTerminal.store.getUsedCapacity(resourceNeed);
                        if (amount > 0) {
                            for (const fromTerminalKey in terminals) {
                                let didSend = false;
                                const fromTerminal = terminals[fromTerminalKey];
                                didSend = TrySendResource(amount, resourceNeed, fromTerminal, toTerminal);
                                if (didSend) {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        function GetLabResources(toTerminal, terminals, marketDealCount) {
            const flags = toTerminal.room.find(FIND_FLAGS, {
                filter: function (flag) {
                    return flag.color === COLOR_PURPLE && flag.secondaryColor === COLOR_PURPLE;
                }
            });
            if (flags.length > 0) {
                for (const flagKey in flags) {
                    const flagNameArray = flagKey.split(/[-]+/).filter(function (e) {
                        return e;
                    });
                    const resourceType = flagNameArray[1];
                    const amount = Util.TERMINAL_TARGET_RESOURCE - toTerminal.store.getUsedCapacity(resourceType);
                    if (amount > 0) {
                        let didSend = false;
                        for (const fromTerminalKey in terminals) { // try to get resource from other terminal
                            const fromTerminal = terminals[fromTerminalKey];
                            didSend = TrySendResource(amount, resourceType, fromTerminal, toTerminal);
                            if (didSend) {
                                break;
                            }
                        }
                        if (!didSend && flagNameArray[0].equals("BUY")) { // try to buy resource
                            if (marketDealCount >= 10 || toTerminal.cooldown) {
                                return marketDealCount;
                            }
                            const didBuy = TryBuyResource(toTerminal, resourceType, amount);
                            if (didBuy) {
                                marketDealCount++;
                                break; // when buying on the market one can only buy once per terminal
                            }
                        }
                    }
                }
            }
            return marketDealCount;
        }

        function GetEnergy(toTerminal, terminals) {
            if (toTerminal.store.getUsedCapacity(RESOURCE_ENERGY) === 0 && toTerminal.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                for (const fromTerminalKey in terminals) {
                    const fromTerminal = terminals[fromTerminalKey];
                    if (fromTerminal.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.STORAGE_ENERGY_MEDIUM) {
                        const didSend = TrySendResource(Util.STORAGE_ENERGY_LOW, RESOURCE_ENERGY, fromTerminal, toTerminal);
                        if (didSend) {
                            return;
                        }
                    }
                }
            }
        }

        function SellExcess(terminal, marketDealCount) {
            if (marketDealCount >= 10 || terminal.cooldown) {
                return marketDealCount;
            }
            for (const resourceType in terminal.store) {
                const max = SetMaxResource(resourceType);
                if (terminal.store.getUsedCapacity(resourceType) > max) {
                    const amount = terminal.store.getUsedCapacity(resourceType) - max;
                    const didSell = TrySellResource(terminal, resourceType, amount);
                    if (didSell) {
                        marketDealCount++;
                        break; // when selling on the market one can only sell once per terminal
                    }
                }
            }
            return marketDealCount;
        }

        //endregion

        //region helper functions

        /**@return {boolean}*/
        function IsProductionChain(factory, resourceTypeNeeded, resourceTypeProduced, resourceBasic) {
            if (factory.room.storage.store.getUsedCapacity(resourceTypeNeeded) > 0
                || factory.room.storage.store.getUsedCapacity(resourceTypeProduced) > 0
                || factory.room.storage.store.getUsedCapacity(resourceBasic) > 0
                || factory.room.terminal.store.getUsedCapacity(resourceTypeNeeded) > 0
                || factory.room.terminal.store.getUsedCapacity(resourceTypeProduced) > 0
                || factory.room.terminal.store.getUsedCapacity(resourceBasic) > 0
                || factory.store.getUsedCapacity(resourceTypeNeeded) > 0
                || factory.store.getUsedCapacity(resourceTypeProduced) > 0
                || factory.store.getUsedCapacity(resourceBasic) > 0) {
                return true;
            }
            return false;
        }

        /**@return {number}*/
        function SetMaxResource(resourceType) {
            switch (resourceType) {
                case RESOURCE_ENERGY :
                    return Util.TERMINAL_MAX_ENERGY;

                case RESOURCE_POWER       : // power

                // Electronical
                case RESOURCE_SILICON     : // deposit
                case RESOURCE_WIRE        : // factory lvl 0
                case RESOURCE_SWITCH      : // factory lvl 1
                case RESOURCE_TRANSISTOR  : // factory lvl 2
                case RESOURCE_MICROCHIP   : // factory lvl 3
                case RESOURCE_CIRCUIT     : // factory lvl 4

                // Biological
                case RESOURCE_BIOMASS     : // deposit
                case RESOURCE_CELL        : // factory lvl 0
                case RESOURCE_PHLEGM      : // factory lvl 1
                // sell RESOURCE_TISSUE        factory lvl 2
                case RESOURCE_MUSCLE      : // factory lvl 3
                case RESOURCE_ORGANOID    : // factory lvl 4

                // Mechanical
                case RESOURCE_METAL       : // deposit
                case RESOURCE_ALLOY       : // factory lvl 0
                case RESOURCE_TUBE        : // factory lvl 1
                case RESOURCE_FIXTURES    : // factory lvl 2
                // sell RESOURCE_FRAME         factory lvl 3
                case RESOURCE_HYDRAULICS  : // factory lvl 4

                // Mystical
                case RESOURCE_MIST        : // deposit
                case RESOURCE_CONDENSATE  : // factory lvl 0
                case RESOURCE_CONCENTRATE : // factory lvl 1
                case RESOURCE_EXTRACT     : // factory lvl 2
                case RESOURCE_SPIRIT      : // factory lvl 3
                case RESOURCE_EMANATION   : // factory lvl 4

                // Common higher commodities
                case RESOURCE_COMPOSITE   : // factory lvl 1
                case RESOURCE_CRYSTAL     : // factory lvl 2
                case RESOURCE_LIQUID      : // factory lvl 3
                    return Number.MAX_SAFE_INTEGER;

                case RESOURCE_TISSUE : // factory lvl 2
                case RESOURCE_FRAME  : // factory lvl 3
                    return 0;

                default :
                    return Util.TERMINAL_MAX_RESOURCE;
            }
        }

        /**@return {boolean}*/
        function TryBuyResource(terminal, resourceType, amount) {
            const highestBuyingValue = 50; // a hard cap to protect against very expensive purchases
            const resourceHistory = Game.market.getHistory(resourceType);
            const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                && order.type === ORDER_SELL
                && (!resourceHistory[0]
                    || IsOutdated(resourceHistory[resourceHistory.length - 1].date)
                    || (resourceHistory[resourceHistory.length - 1].avgPrice * 1.5) >= order.price
                ) && highestBuyingValue > order.price
                && order.remainingAmount > 0
            );
            if (orders.length > 0) {
                orders.sort(comparePriceCheapestFirst);
                const order = orders[0];
                Util.Info('Terminals', 'TryBuyResource', 'WTB ' + amount + ' ' + resourceType + ' from ' + terminal + ' ' + JSON.stringify(order) + ' avg price ' + resourceHistory[0].avgPrice);
                if (amount > order.remainingAmount) {
                    amount = order.remainingAmount;  // cannot buy more resources than this
                }
                const result = Game.market.deal(order.id, amount, terminal.pos.roomName);
                Util.Info('Terminals', 'TryBuyResource', amount + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + order.price * amount + ' terminal Amount ' + terminal.store.getUsedCapacity(resourceType));
                if (result === OK) {
                    terminal.cooldown = 10;
                    terminal.store[resourceType] = terminal.store[resourceType] + amount;
                    return true;
                }
            }
            return false;
        }

        /**@return {boolean}*/
        function TrySellResource(terminal, resourceType, amount) {
            let lowestSellingValue = 0.1; // if the mineral has a lower selling value than this then it is not worth the computational value to mine and sell
            const resourceHistory = Game.market.getHistory(resourceType);
            const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                && order.type === ORDER_BUY
                && (!resourceHistory[0]
                    || IsOutdated(resourceHistory[resourceHistory.length - 1].date)
                    || (resourceHistory[resourceHistory.length - 1].avgPrice / 1.5/*medium price fall is okay*/) <= order.price)
                && lowestSellingValue <= order.price
                && order.remainingAmount > 0
            );
            if (orders.length > 0) {
                orders.sort(comparePriceExpensiveFirst);
                const order = orders[0];
                if (amount > order.remainingAmount) {
                    amount = order.remainingAmount; // cannot sell more resources than this
                }
                const result = Game.market.deal(order.id, amount, terminal.pos.roomName);
                Util.Info('Terminals', 'TrySellResource', amount + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + order.price * amount + ' terminal Amount ' + terminal.store.getUsedCapacity(resourceType));
                if (result === OK) {
                    terminal.cooldown = 10;
                    terminal.store[resourceType] = terminal.store[resourceType] - amount;
                    return true;
                }
            }
            return false;
        }

        /**@return {boolean}*/
        function TrySendResource(amount, resourceType, fromTerminal, toTerminal) {
            if (!fromTerminal.cooldown && fromTerminal.id !== toTerminal.id) {
                const result = fromTerminal.send(resourceType, amount, toTerminal.pos.roomName);
                Util.Info('Terminals', 'TrySendResource', amount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result);
                if (result === OK) {
                    fromTerminal.cooldown = 10;
                    fromTerminal.store[resourceType] = fromTerminal.store[resourceType] - amount;
                    toTerminal.store[resourceType] = toTerminal.store[resourceType] + amount;
                    return true;
                }
            }
            return false;
        }

        /**@return {boolean}*/
        function IsOutdated(date1, date2 = Date.now(), millisecondsToWait = 86400000/*24h*/) {
            const elapsed = date2 - Date.parse(date1); // date1 format: "2019-06-24"
            if (elapsed > millisecondsToWait) {
                //Util.Info('Terminals', 'IsOutdated', 'date ' + date1 + ' elapsed ' + elapsed + ' parsed date ' + Date.parse(date1) + ' now ' + date2);
                return true;
            }
            return false;
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

        //endregion
    }
};
module.exports = Terminals;