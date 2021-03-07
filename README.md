# HScreeps

My code for the game Screeps, it is OS based with "jobs" in Game.memory

main loop:

**create jobs** - creates jobs that are placed in Game.memory.MemRooms

**assign jobs** - assign the jobs in each room, flag jobs may be occupied by creeps that originate from other rooms

**execute jobs** - do the actual action and keep doing the job until return code != 0

###Flag jobs manual:

**Create distant creep jobs** at a position by placing a flag

-   primary color orange - scout and pos actions and hallway action
    -   Orange for tagging a controller with a scout - flag name is tag message
    -   Yellow for scout at pos
-   primary color red - aggressive jobs
    -   red for warrior at pos
    -   blue for gunner at pos
    -   green for medic at pos
-   primary color green - claimer actions
    -   green for claimer claim room on controller (error: C1 suicides at spawn)
    -   yellow for reserve room
    -   orange claimer at pos (error: flag color not found)

**Summon Operator** in room

-   primary blue secondary orange on powerspawn will spawn operater with flagname

**Activate observer**

-   primary orange secondary red placed on observer will activate the observer to scan surrounding rooms for power and deposits

**lab flag actions**

-   primary color purple
    -   purple flag directly on lab, naming rules: GET-L-roomname = get lemergium from all rooms, BUY-L-roomname = get lemergium from all rooms or then buy it from the terminal
    -   white flag directly on lab, naming rules: EMPTY-GH-roomname = create the mineral and allows it to be emptied from the nearby lab to this lab
