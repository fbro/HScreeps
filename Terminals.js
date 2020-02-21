let Util = require('Util');
const Terminals = {
    run: function () {

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

        function TerminalActions(terminals){
            let marketDealSendCount = 0;
            for (const terminalKey in terminals) {
                const terminal = terminals[terminalKey];
                if (terminal.cooldown === 0) {
                    if(terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.TERMINAL_STORAGE_ENERGY_LOW){
                        DistributeResources(terminal, terminals);
                        marketDealSendCount = SellExcessResource(terminal, marketDealSendCount);
                        marketDealSendCount = BuyResources(terminal, marketDealSendCount);
                        marketDealSendCount = BuyLabResources(terminal, marketDealSendCount);
                    }
                }
            }
        }

        // distribute ALL available resources to all terminals 2k each and only to 5k - except with energy 50k each and only to 100k
        function DistributeResources(fromTerminal, terminals) {
            for (const resourceType in fromTerminal.store) { // for each resource type
                let fromAmount = fromTerminal.store[resourceType];
                let target;
                if(resourceType === RESOURCE_SWITCH || resourceType === RESOURCE_PHLEGM || resourceType === RESOURCE_TUBE || resourceType === RESOURCE_CONCENTRATE) { // SWITCH, PHLEGM, TUBE or CONCENTRATE should only be sent to a terminal that has a factory of level 2
                    DistributeFactoryCommodities(fromTerminal, resourceType, fromAmount, 2);
                } else if(resourceType === RESOURCE_SILICON || resourceType === RESOURCE_BIOMASS || resourceType === RESOURCE_METAL || resourceType === RESOURCE_MIST) { // SILICON, BIOMASS, METAL or MIST should only be sent to a terminal that has a factory that uses SILICON, BIOMASS, METAL or MIST
                    DistributeFactoryCommodities(fromTerminal, resourceType, fromAmount);
                } else{
                    if (resourceType === RESOURCE_ENERGY) {
                        target = Util.TERMINAL_TARGET_ENERGY;
                    } else {
                        target = Util.TERMINAL_TARGET_RESOURCE;
                    }
                    for (const toTerminalKey in terminals) {
                        const toTerminal = terminals[toTerminalKey];
                        const toAmount = toTerminal.store[resourceType];
                        if (fromAmount > (target + 500/*buffer to prevent many small send*/)
                            && toAmount < target
                            && toTerminal.id !== fromTerminal.id
                        ) { // is allowed to send this resource to another terminal
                            let sendAmount = fromAmount - target; // possible send amount
                            const resourcesNeeded = (toAmount - target) * -1;
                            if (sendAmount > resourcesNeeded) {
                                sendAmount = resourcesNeeded; // does not need more resources than this
                            }
                            const result = fromTerminal.send(resourceType, sendAmount, toTerminal.pos.roomName);
                            Util.Info('Terminals', 'DistributeResources', sendAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result + ' resourcesNeeded ' + resourcesNeeded);
                            toTerminal.store[resourceType] += sendAmount;
                            fromTerminal.store[resourceType] -= sendAmount;
                            fromAmount -= sendAmount;
                            break;
                        }
                    }
                }
            }
        }

        // factory commodities are not distributed like the other resources should be
        /**@return {number}*/
        function DistributeFactoryCommodities(fromTerminal, resourceType, fromAmount, factoryLevel = 0) {
            const fromFactory = fromTerminal.room.find(FIND_MY_STRUCTURES, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_FACTORY && (factoryLevel === s.level || factoryLevel === 0);
                }
            })[0];
            if(!fromFactory) {
                for (const toTerminalKey in terminals) {
                    const toTerminal = terminals[toTerminalKey];
                    if (toTerminal.id !== fromTerminal.id
                        && toTerminal.store.getUsedCapacity(resourceType) < Util.TERMINAL_TARGET_RESOURCE // do not transfer anymore commodities if toTerminal already has more than TERMINAL_STORAGE_HIGH_TRANSFER
                        && toTerminal.room.find(FIND_MY_STRUCTURES, {
                        filter: function (s) {
                            return s.structureType === STRUCTURE_FACTORY && (factoryLevel === s.level || factoryLevel === 0);
                        }
                    })[0]) {
                        const result = fromTerminal.send(resourceType, fromAmount, toTerminal.pos.roomName);
                        Util.Info('Terminals', 'DistributeResources', fromAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result);
                        break;
                    }
                }
            }
        }

        /**@return {number}*/
        function SellExcessResource(fromTerminal, marketDealSendCount) {
            for (const resourceType in fromTerminal.store) { // for each resource type
                let fromAmount = fromTerminal.store.getUsedCapacity(resourceType);
                let max;
                if (resourceType === RESOURCE_ENERGY) {
                    max = Util.TERMINAL_MAX_ENERGY;
                } else if(resourceType === RESOURCE_TISSUE){
                    max = 0; // right now i am selling out on tissue
                } else if (resourceType === RESOURCE_POWER
                    || resourceType === RESOURCE_SILICON // deposit
                    || resourceType === RESOURCE_WIRE // factory lvl 0
                    || resourceType === RESOURCE_SWITCH // factory lvl 1

                    || resourceType === RESOURCE_BIOMASS // deposit
                    || resourceType === RESOURCE_CELL // factory lvl 0
                    || resourceType === RESOURCE_PHLEGM // factory lvl 1

                    || resourceType === RESOURCE_METAL // deposit
                    || resourceType === RESOURCE_ALLOY // factory lvl 0
                    || resourceType === RESOURCE_TUBE // factory lvl 1

                    || resourceType === RESOURCE_MIST // deposit
                    || resourceType === RESOURCE_CONDENSATE // factory lvl 0
                    || resourceType === RESOURCE_CONCENTRATE // factory lvl 1
                ) { // will never sell out on these resources
                    max = Number.MAX_SAFE_INTEGER;
                } else {
                    max = Util.TERMINAL_MAX_RESOURCE;
                }
                if (marketDealSendCount <= 10 && fromAmount > max) { // is allowed to sell this resource
                    const resourceHistory = Game.market.getHistory(resourceType);
                    const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                        && order.type === ORDER_BUY
                        /*&& Game.market.calcTransactionCost(500, fromTerminal.pos.roomName, order.roomName) <= 500*/
                        && (!resourceHistory[0] || resourceHistory[0].avgPrice <= order.price || resourceType === RESOURCE_ENERGY && fromTerminal.room.storage && fromTerminal.room.storage[RESOURCE_ENERGY] > 800000)
                        && order.remainingAmount > 0
                    );
                    if (orders.length > 0) {
                        orders.sort(comparePriceExpensiveFirst);
                        const order = orders[0];
                        let sendAmount = fromAmount - max; // possible send amount
                        if (sendAmount > order.remainingAmount) {
                            sendAmount = order.remainingAmount; // does not need more resources than this
                        }
                        const result = Game.market.deal(order.id, sendAmount, fromTerminal.pos.roomName);
                        if(result === OK) {
                            marketDealSendCount++;
                        }
                        Util.Info('Terminals', 'SellExcessResource', sendAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' marketDealSendCount ' + marketDealSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + order.price * sendAmount + ' fromAmount ' + fromAmount);
                    }
                }
            }
            return marketDealSendCount;
        }

        /**@return {number}*/
        function BuyResources(terminal, marketDealSendCount) {
            // buy resources to make sure that there are at least 500 Hydrogen, Oxygen, Utrium, Keanium, Lemergium, Zynthium and Catalyst in each terminal
            const basicResourceList = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_KEANIUM, RESOURCE_LEMERGIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];
            for (const basicResourceKey in basicResourceList) {
                const basicResource = basicResourceList[basicResourceKey];
                const usedCapacity = terminal.store.getUsedCapacity(basicResource);
                if (usedCapacity === 0 && marketDealSendCount <= 10 && terminal.room.storage.store.getUsedCapacity(basicResource) === 0) {
                    marketDealSendCount = BuyResource(terminal, basicResource, 500, marketDealSendCount);
                }
            }
            // buy power
            const usedPowerCapacity = terminal.store.getUsedCapacity(RESOURCE_POWER);
            if (usedPowerCapacity === 0 && marketDealSendCount <= 10 && terminal.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.TERMINAL_STORAGE_ENERGY_LOW_TRANSFER) {
                marketDealSendCount = BuyResource(terminal, RESOURCE_POWER, 1000, marketDealSendCount, 1, 1);
            }
            return marketDealSendCount;
        }

        function BuyLabResources(terminal, marketDealSendCount){
            // find FillLabMineralJobs flags
            const labFlags = terminal.room.find(FIND_FLAGS, {filter : function (flag){return flag.color === COLOR_PURPLE && flag.secondaryColor === COLOR_PURPLE}});
            for(const labFlagKey in labFlags){
                const labFlag = labFlags[labFlagKey];
                const mineral = labFlag.name.split(/[-]+/).filter(function (e) {
                    return e;
                })[1];
                const usedMineralCapacity = terminal.store.getUsedCapacity(mineral);
                if (usedMineralCapacity < 500 && marketDealSendCount <= 10 && terminal.room.storage.store.getUsedCapacity(mineral) === 0) {
                    marketDealSendCount = BuyResource(terminal, mineral, 500 - usedMineralCapacity, marketDealSendCount, 4, 4);
                }
            }
            return marketDealSendCount;
        }



        /**@return {number}*/
        function BuyResource(terminal, resourceType, amount, marketDealSendCount,
                             avgPrice = 1.5, // set if one wants a another acceptable average price
                             maxPrice = undefined // set if one should use a fixed price to buy under
        ) {
            const resourceHistory = Game.market.getHistory(resourceType);
            const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                && order.type === ORDER_SELL
                && Game.market.calcTransactionCost(500, terminal.pos.roomName, order.roomName) <= 500
                && ((resourceHistory[0].avgPrice * avgPrice) >= order.price && (maxPrice && maxPrice >= order.price || !maxPrice))
                && order.remainingAmount > 0
            );
            if (orders.length > 0) {
                orders.sort(comparePriceCheapestFirst);
                Util.Info('Terminals', 'BuyResource', 'WTB ' + amount + ' ' + resourceType + ' from ' + terminal + ' ' + JSON.stringify(orders) + ' avg price ' + resourceHistory[0].avgPrice);
                const order = orders[0];
                if(order.remainingAmount < amount){
                    amount = order.remainingAmount;
                }
                const result = Game.market.deal(order.id, amount, terminal.pos.roomName);
                if(result === OK) {
                    marketDealSendCount++;
                }
                Util.InfoLog('Terminals', 'BuyResource', amount + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' marketDealSendCount ' + marketDealSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + (order.price * amount));

            }
            return marketDealSendCount;
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