const Terminals = {
    run: function(room) {
        // TODO

        // try to sell stuff
        const MIN_RESOURCE_AMOUNT = 1000;
        const MAX_TRANSFER_ENERGY_COST = 500;
        const MIN_PRICE = 0.08;
        const orders = [];
        for (const resourceType in room.terminal.store) {
            if (resourceType !== RESOURCE_ENERGY && room.terminal.store[resourceType] >= MIN_RESOURCE_AMOUNT) {
                orders.push(...Game.market.getAllOrders(order => order.resourceType === resourceType
                    && order.type === ORDER_SELL
                    && Game.market.calcTransactionCost(MIN_RESOURCE_AMOUNT, room.room.name, order.roomName) <= MAX_TRANSFER_ENERGY_COST
                    && order.price > MIN_PRICE));
            }
        }
        for(const orderCount in orders){
            const order = orders[orderCount];
            const transferEnergyRealCost = Game.market.calcTransactionCost(order.amount, room.name, order.roomName);
            if(transferEnergyRealCost < room.terminal.store[RESOURCE_ENERGY]){
                const dealResult = Game.market.deal(order.id, order.amount, room.name);
                if(dealResult === 0){
                    console.log("Terminals, deal success " + order.resourceType + ", " + order.amount + ", room: " + order.roomName);
                }else{
                    console.log("Terminals, ERROR deal failed " + order.resourceType + ", " + order.amount + ", room: " + order.roomName);
                }
            }
        }
    }
};
module.exports = Terminals;