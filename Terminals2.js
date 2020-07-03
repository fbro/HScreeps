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

                marketDealCount = GetFactoryResources(terminal, terminals, memRoom, marketDealCount); // first try and get from other terminals then try and buy from the market

                marketDealCount = GetLabResources(terminal, terminals, marketDealCount); // first try and get from other terminals then try and buy from the market

                GetEnergy(terminal, terminals);

                marketDealCount = SellExcess(terminal, marketDealCount);
            }
        }

        function GetFactoryResources(toTerminal, terminals, memRoom, marketDealCount){
            if(memRoom && memRoom.FctrId && memRoom.FctrId !== '-'){
                const factory = Game.getObjectById(memRoom.FctrId);
                if(factory && factory.level){
                    for (const resourceType in toTerminal.store) {
                        let fromAmount = toTerminal.store[resourceType];

                    }
                }
            }
            // TODO set cooldown if sending
            // TODO set new amount both places if sending
            // TODO set cooldown if buying
            // TODO set new amount if buying
            return marketDealCount;
        }

        function GetLabResources(toTerminal, terminals, marketDealCount){
            const flags = toTerminal.room.find(FIND_FLAGS, {
                filter: function (flag) {
                    return flag.color === COLOR_PURPLE && flag.secondaryColor === COLOR_PURPLE;
                }
            });
            if(flags.length > 0){
                for(const flagKey in flags){
                    const flagNameArray = flagKey.split(/[-]+/).filter(function (e) {return e;});
                    const resourceType = flagNameArray[1];
                    const amount = Util.TERMINAL_TARGET_RESOURCE - toTerminal.store.getUsedCapacity(resourceType);
                    if(amount > 0){
                        let didSend = false;
                        for(const fromTerminalKey in terminals) {
                            const fromTerminal = terminals[fromTerminalKey];
                            didSend = TrySendResource(amount, resourceType, fromTerminal, toTerminal);
                            if(didSend){
                                break;
                            }
                        }
                        if(!didSend){
                            const shouldBuy = flagNameArray[0].equals("BUY"); // if "GET" then shouldBuy = false
                            if(marketDealCount >= 10 || toTerminal.cooldown || !shouldBuy){
                                return marketDealCount;
                            }
                            const didBuy = TryBuyResource(toTerminal, resourceType, amount);
                            if(didBuy){
                                marketDealCount++;
                                break; // when buying on the market one can only buy once per terminal
                            }
                        }
                    }
                }
            }
            return marketDealCount;
        }

        function GetEnergy(toTerminal, terminals){
            if(toTerminal.store.getUsedCapacity(RESOURCE_ENERGY) === 0 && toTerminal.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) === 0){
                for(const fromTerminalKey in terminals){
                    const fromTerminal = terminals[fromTerminalKey];
                    if(fromTerminal.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.STORAGE_ENERGY_MEDIUM){
                        const didSend = TrySendResource(Util.STORAGE_ENERGY_LOW, RESOURCE_ENERGY, fromTerminal, toTerminal);
                        if(didSend){
                            return;
                        }
                    }
                }
            }
        }

        function SellExcess(terminal, marketDealCount){
            if(marketDealCount >= 10 || terminal.cooldown){
                return marketDealCount;
            }
            for(const resourceType in terminal.store){
                const max = (resourceType === RESOURCE_ENERGY ? Util.TERMINAL_MAX_ENERGY : Util.TERMINAL_MAX_RESOURCE);
                if(terminal.store.getUsedCapacity(resourceType) > max){
                    const amount = terminal.store.getUsedCapacity(resourceType) - max;
                    const didSell = TrySellResource(terminal, resourceType, amount);
                    if(didSell){
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
        function TryBuyResource(terminal, resourceType, amount){
            const highestBuyingValue = 50; // a hard cap to protect against very expensive purchases
            const resourceHistory = Game.market.getHistory(resourceType);
            const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                && order.type === ORDER_SELL
                && (!resourceHistory[0]
                    || IsOutdated(resourceHistory[resourceHistory.length - 1].date)
                    || (resourceHistory[resourceHistory.length - 1].avgPrice * 1.5) >= order.price
                )  && highestBuyingValue > order.price
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
        function TrySellResource(terminal, resourceType, amount){
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
        function TrySendResource(amount, resourceType, fromTerminal, toTerminal){
            if(!fromTerminal.cooldown && fromTerminal.id !== toTerminal.id) { // && fromTerminal.store.getUsedCapacity(resourceType) >= Util.STORAGE_ENERGY_MEDIUM
                const result = fromTerminal.send(resourceType, amount, toTerminal.pos.roomName);
                Util.Info('Terminals', 'TrySendResource', amount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result);
                if(result === OK){
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