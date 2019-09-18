const Terminals = {
    run: function () {

        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey]; // visible room
            if (gameRoom.terminal && gameRoom.terminal.my  && gameRoom.terminal.cooldown === 0 && gameRoom.terminal.store[RESOURCE_ENERGY] >= 10000) {
                SellResources(gameRoom);
            }
            if(gameRoom.terminal && gameRoom.terminal.my  && gameRoom.terminal.store[RESOURCE_ENERGY] < 10000){
                GetEnergyFromOtherTerminals(gameRoom);
            }
        }
        function GetEnergyFromOtherTerminals(room){
            for (const gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey];
                if(gameRoom.name !== room.name && gameRoom.terminal && gameRoom.terminal.my && gameRoom.terminal.cooldown === 0 && gameRoom.terminal.store[RESOURCE_ENERGY] >= 100000){
                    let result = gameRoom.terminal.send(RESOURCE_ENERGY, 50000, room.name);
                    console.log('Terminals GetEnergyFromOtherTerminals get energy ' + result + ' in ' + room.name + ' from ' + gameRoom.name);
                }
            }
        }

        function SellResources(room) {
            // try to sell stuff
            const MIN_RESOURCE_AMOUNT = 500;
            const MAX_TRANSFER_ENERGY_COST = 500;
            let MIN_PRICE_E = 0.1;
            if (room.storage && room.storage.store[RESOURCE_ENERGY] > 500000) {
                MIN_PRICE_E = 0.007;
            }
            const MIN_PRICE_U = 0.07;
            const MIN_PRICE_O = 0.09;
            const MIN_PRICE_H = 0.1;
            const MIN_PRICE_K = 0.05;

            const MIN_PRICE_GO = 0.2;
            const MIN_PRICE_UH = 0.2;
            const MIN_PRICE_KO = 0.2;
            const MIN_PRICE_LO = 0.2;
            const MIN_PRICE_ZH = 0.2;
            const orders = [];
            for (const resourceType in room.terminal.store) {
                if (room.terminal.store[resourceType] > 0) {
                    orders.push(...Game.market.getAllOrders(order => order.resourceType === resourceType
                        && order.type === ORDER_BUY
                        && Game.market.calcTransactionCost(MIN_RESOURCE_AMOUNT, room.name, order.roomName) <= MAX_TRANSFER_ENERGY_COST
                        && (
                            (order.price >= MIN_PRICE_E && resourceType === RESOURCE_ENERGY)
                            // my raw resources
                            || (order.price >= MIN_PRICE_U && resourceType === RESOURCE_UTRIUM)
                            || (order.price >= MIN_PRICE_O && resourceType === RESOURCE_OXYGEN)
                            || (order.price >= MIN_PRICE_H && resourceType === RESOURCE_HYDROGEN)
                            || (order.price >= MIN_PRICE_K && resourceType === RESOURCE_KEANIUM)

                            || (order.price >= MIN_PRICE_GO && resourceType === RESOURCE_GHODIUM_OXIDE)
                            || (order.price >= MIN_PRICE_UH && resourceType === RESOURCE_UTRIUM_HYDRIDE)
                            || (order.price >= MIN_PRICE_KO && resourceType === RESOURCE_KEANIUM_OXIDE)
                            || (order.price >= MIN_PRICE_LO && resourceType === RESOURCE_LEMERGIUM_OXIDE)
                            || (order.price >= MIN_PRICE_ZH && resourceType === RESOURCE_ZYNTHIUM_HYDRIDE)
                        )));
                }
            }
            let successfulDeal = 0;
            for (const orderCount in orders) {
                const order = orders[orderCount];
                const transferEnergyRealCost = Game.market.calcTransactionCost(order.amount, room.name, order.roomName);
                let amountToTransfer = room.terminal.store[order.resourceType];
                if(successfulDeal >= 10){
                    console.log('Terminals SellResources maximum number of deals in tick reached ' + successfulDeal + ' in ' + room.name);
                    break;
                }else if (transferEnergyRealCost <= room.terminal.store[RESOURCE_ENERGY] && amountToTransfer > 0) {
                    if(order.resourceType === RESOURCE_ENERGY){
                        amountToTransfer = room.terminal.store[RESOURCE_ENERGY] / 2;
                        if(amountToTransfer > order.amount){
                            amountToTransfer = order.amount;
                        }
                    }else if(amountToTransfer > order.amount){
                        amountToTransfer = order.amount;
                    }
                    const dealResult = Game.market.deal(order.id, amountToTransfer, room.name);
                    if (dealResult === 0) {
                        console.log('Terminals SellResources deal success ' + order.resourceType + ' ' + amountToTransfer + ' from ' + room.name + ' to ' + order.roomName);
                        if (!Memory.buyOrdersHistory) {
                            Memory.buyOrdersHistory = {};
                        }
                        Memory.buyOrdersHistory['(' + amountToTransfer + ',' + order.resourceType + ',' + (order.price * amountToTransfer) + ')' + room.name + '-' + order.roomName + '_' + order.id] = {
                            order: order,
                            'energyUsed': transferEnergyRealCost,
                            'fromRoom': room.name
                        };
                        successfulDeal++;
                    } else {
                        console.log('Terminals SellResources deal failed ' + order.resourceType + ' ' + amountToTransfer + ' from ' + room.name + ' to ' + order.roomName + ' code ' + dealResult + ' transfer cost ' + transferEnergyRealCost + ' terminal energy ' + room.terminal.store[RESOURCE_ENERGY]);
                    }
                } else {
                    console.log('Terminals SellResources not enough energy ' + order.resourceType + ' ' + order.amount + ' from ' + room.name + ' to ' + order.roomName + ' transfer cost ' + transferEnergyRealCost + ' terminal energy ' + room.terminal.store[RESOURCE_ENERGY]);
                }
            }

        }
    }
};
module.exports = Terminals;