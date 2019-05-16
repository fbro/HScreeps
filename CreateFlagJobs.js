const CreateFlagJobs = {
    run: function() {
        for (const flagName in Game.flags) {
            const flag = Game.flags[flagName];
            let jobName;
            if(flag.color === COLOR_ORANGE && flag.secondaryColor === COLOR_ORANGE){ // scout tag
                jobName = "TagController";
            }else if(flag.color === COLOR_ORANGE && flag.secondaryColor === COLOR_YELLOW){ // scout tag
                jobName = "ScoutPos";
            }else if(flag.color === COLOR_GREEN && flag.secondaryColor === COLOR_GREEN){ // claimer tag
                jobName = "ClaimController";
            }

            if (jobName) { // flag found with appropriate colors
                let foundJob = false;
                for(let i = 0; i < Memory.openJobs.length; i++) { // check if the flag job already exists
                    if(Memory.openJobs[i].flagName !== undefined && Memory.openJobs[i].pos.roomName === flag.pos.roomName && Memory.openJobs[i].pos.x === flag.pos.x && Memory.openJobs[i].pos.y === flag.pos.y){
                        foundJob = true;
                        break;
                    }
                }
                if(!foundJob){
                    for(let i = 0; i < Memory.closedJobs.length; i++) { // check if the flag job already exists
                        if(Memory.closedJobs[i].flagName !== undefined && Memory.closedJobs[i].pos.roomName === flag.pos.roomName && Memory.closedJobs[i].pos.x === flag.pos.x && Memory.closedJobs[i].pos.y === flag.pos.y){
                            foundJob = true;
                            break;
                        }
                    }
                }
                if(!foundJob){ // only add once
                    const flagJobOBJ = {'name': jobName, 'flagName': flagName, 'pos': flag.pos, 'creeps': []};
                    Memory.openJobs.push(flagJobOBJ);
                    console.log("CreateFlagJobs, new flag " + jobName + " " + JSON.stringify(flag))
                }
            }
        }
    }
};
module.exports = CreateFlagJobs;