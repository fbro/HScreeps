const Terminals = {
    run: function() {

        for(const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey]; // visible room
            if(gameRoom.terminal){
                SellResources(gameRoom);
            }
        }

        function SellResources(room){
            // try to sell stuff
            const MIN_RESOURCE_AMOUNT = 1000;
            const MAX_TRANSFER_ENERGY_COST = 500;
            let MIN_PRICE_E = 0.1;
            if(room.storage && room.storage.store[RESOURCE_ENERGY] > 500000){
                MIN_PRICE_E = 0.01;
            }
            const MIN_PRICE_U = 0.08;
            const MIN_PRICE_O = 0.09;
            const MIN_PRICE_H = 0.1;

            const MIN_PRICE_GO = 0.3;
            const MIN_PRICE_UH = 0.3;
            const MIN_PRICE_KO = 0.3;
            const MIN_PRICE_LO = 0.3;
            const MIN_PRICE_ZH = 0.3;
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

                            || (order.price >= MIN_PRICE_GO && resourceType === RESOURCE_GHODIUM_OXIDE)
                            || (order.price >= MIN_PRICE_UH && resourceType === RESOURCE_UTRIUM_HYDRIDE)
                            || (order.price >= MIN_PRICE_KO && resourceType === RESOURCE_KEANIUM_OXIDE)
                            || (order.price >= MIN_PRICE_LO && resourceType === RESOURCE_LEMERGIUM_OXIDE)
                            || (order.price >= MIN_PRICE_ZH && resourceType === RESOURCE_ZYNTHIUM_HYDRIDE)
                        )));
                }
            }
            for(const orderCount in orders){
                const order = orders[orderCount];
                const transferEnergyRealCost = Game.market.calcTransactionCost(order.amount, room.name, order.roomName);
                if(transferEnergyRealCost <= room.terminal.store[RESOURCE_ENERGY]){
                    const dealResult = Game.market.deal(order.id, order.amount, room.name);
                    if(dealResult === 0){
                        console.log("Terminals, deal success " + order.resourceType + ", " + order.amount + ", room: " + order.roomName);
                        if(!Memory.buyOrdersHistory){Memory.buyOrdersHistory = {};}
                        Memory.buyOrdersHistory["(" + order.amount + "," + order.resourceType + ")" + room.name + "-" + order.id] = {order: order, 'energyUsed': transferEnergyRealCost, 'fromRoom': room.name};
                    }else{
                        console.log("Terminals, ERROR deal failed " + order.resourceType + ", " + order.amount + ", room: " + order.roomName);
                    }
                }else{
                    console.log("terminal, not enough energy " + room.name + ", transfer cost: " + transferEnergyRealCost + ", terminal energy: " + room.terminal.store[RESOURCE_ENERGY]);
                }
            }

        }
    }
};
module.exports = Terminals;