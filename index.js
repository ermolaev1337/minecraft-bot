/*
 * Never spend hours mining from ground to bedrock again!
 *
 * Learn how to create a simple bot that is capable of digging the block
 * below his feet and then going back up by creating a dirt column to the top.
 *
 * As always, you can send the bot commands using chat messages, and monitor
 * his inventory at any time.
 *
 * Remember that in survival mode he might not have enough dirt to get back up,
 * so be sure to teach him a few more tricks before leaving him alone at night.
 */
const R = require('ramda');
const mineflayer = require('mineflayer');
const vec3 = require('vec3');
const {pathfinder, Movements} = require('mineflayer-pathfinder');
const {GoalNear, GoalBlock, GoalXZ, GoalY, GoalInvert, GoalFollow} = require('mineflayer-pathfinder').goals;

let lastMessage;
let lastTarget;

function createBot() {
    const bot = mineflayer.createBot({
        host: '25.34.72.213',
        port: 25565,
        username: process.argv[2],
    });
    bot.loadPlugin(pathfinder);


    function sayItems(items = bot.inventory.items()) {
        const output = items.map(itemToString).join(', ');
        if (output) {
            bot.chat(output)
        } else {
            bot.chat('У меня на кармане только насика пакет да бутылочка манаги(((')
        }
    }

    function dig() {
        if (bot.targetDigBlock) {
            console.log(`already digging ${bot.targetDigBlock.name}`)
        } else {
            var target = bot.blockAt(bot.entity.position.offset(0, -1, 0));
            if (target && bot.canDigBlock(target)) {
                console.log(target, onDiggingCompleted)
            } else {
                console.log('cannot dig')
            }
        }

        function onDiggingCompleted(err) {
            if (err) {
                console.log(err.stack);
                return
            }
            bot.chat(`finished digging ${target.name}`)
        }
    }

    function build() {
        const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        const jumpY = Math.floor(bot.entity.position.y) + 1.0;
        bot.setControlState('jump', true);
        bot.on('move', placeIfHighEnough);

        let tryCount = 0;

        function placeIfHighEnough() {
            if (bot.entity.position.y > jumpY) {
                bot.placeBlock(referenceBlock, vec3(0, 1, 0), (err) => {
                    if (err) {
                        tryCount++;
                        if (tryCount > 10) {
                            bot.chat(err.message);
                            bot.setControlState('jump', false);
                            bot.removeListener('move', placeIfHighEnough);
                            return
                        }
                        return
                    }
                    bot.setControlState('jump', false);
                    bot.removeListener('move', placeIfHighEnough);
                    bot.chat('Placing a block was successful')
                })
            }
        }
    }

    function goToSleep() {
        const bed = bot.findBlock({
            matching: block => bot.isABed(block)
        })
        if (bed) {
            bot.sleep(bed, (err) => {
                if (err) {
                    bot.chat(`I can't sleep: ${err.message}`)
                } else {
                    bot.chat("I'm sleeping")
                }
            })
        } else {
            bot.chat('No nearby bed')
        }
    }

    function wakeUp() {
        bot.wake((err) => {
            if (err) {
                bot.chat(`I can't wake up: ${err.message}`)
            } else {
                bot.chat('I woke up')
            }
        })
    }

    async function superDig(bot, defaultMove, x1, y1, x2, y2, zMax) {
        console.log(`Пытаюсь прокопать от ${x1}-${y1} до ${x2}-${y2} с высоты ${zMax}`);
        bot.pathfinder.setMovements(defaultMove);
        bot.pathfinder.setGoal(new GoalBlock(x1, zMax, y1))
        await new Promise(resolve => {
            bot.once('goal_reached', (goal) => {
                resolve()
            });
        })

        const Z = R.reverse(R.range(0, zMax));
        const X = R.range(x1, x2);
        const Y = R.range(y1, y2);
        for await (const z of Z) {
            for await (const x of X) {
                for await (const y of Y) {
                    bot.pathfinder.setMovements(defaultMove);
                    bot.pathfinder.setGoal(new GoalBlock(x, z, y));
                    await new Promise(resolve => {
                        bot.once('goal_reached', (goal) => {
                            resolve()
                        });
                    })
                    dig();
                }
            }

        }

    }

    function equipDirt() {
        const mcData = require('minecraft-data')(bot.version);
        let itemsByName;
        if (bot.supportFeature('itemsAreNotBlocks')) {
            itemsByName = 'itemsByName'
        } else if (bot.supportFeature('itemsAreAlsoBlocks')) {
            itemsByName = 'blocksByName'
        }
        const id = mcData[itemsByName].diamond_pickaxe.id;
        bot.equip(id, 'hand', (err) => {
            if (err) {
                bot.chat(`unable to equip dirt: ${err.message}`)
            } else {
                bot.chat('equipped dirt')
            }
        })
    }

    function itemToString(item) {
        if (item) {
            return `${item.name} x ${item.count}`
        } else {
            return '(nothing)'
        }
    }

    function handleCommands(defaultMove, target, message) {
        switch (message) {
            case 'к ноге':
                if (!target) {
                    bot.chat('Мне отрезали уши, а не выкололи глаза, но я один хуй тебя не вижу(((');
                    return
                }
                bot.chat('Бегу, бегу, мой хозяин, я твой Мишенька!');
                const p = target.position;

                bot.pathfinder.setMovements(defaultMove);
                bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1))
                break;
            case 'по пятам':
                bot.chat('След взял, хозяин!');
                bot.pathfinder.setMovements(defaultMove);
                bot.pathfinder.setGoal(new GoalFollow(target, 3), true)
                break;
            case 'съебался':
                bot.chat('С Ваших глаз долой((');
                bot.pathfinder.setMovements(defaultMove);
                bot.pathfinder.setGoal(new GoalInvert(new GoalFollow(target, 5)), true)
                break;
            case 'стоп':
                bot.chat('Как вкопанный!');
                bot.pathfinder.setGoal(null)
                break;
            case 'кто сосет хуй':
                bot.chat('Видимо, я сосу хуй(');
                break;
            case 'съебался по-настоящему':
                bot.chat('Обратно в могилу, эх, лады(');
                bot.end()
                break;
            case 'реконнект':
                bot.chat('Переподключаюсь');
                bot.quit('Переподключение...')
                break;
            case 'ты где':
                bot.chat(`Уже бегу, хозяин! Мои коорединаты ${bot.entity.position.x} ${bot.entity.position.y} ${bot.entity.position.z}`);
                break;
            case 'loaded':
                bot.waitForChunksToLoad(() => {
                    bot.chat('Я Миша Бондарь, где мои уши?! Где я?! Егор?! Я В БЕУЗХОМ АДУ')
                });
                break;
            case 'list':
                sayItems();
                break;
            case 'dig':
                dig();
                break;
            case 'build':
                build();
                break;
            case 'equip pickaxe':
                equipDirt();
                break;
            case 'sleep':
                goToSleep()
                break
            case 'wakeup':
                wakeUp()
                break
            default:
                if (message.startsWith('беги')) {
                    bot.chat('Уже бегу');

                    const cmd = message.split(' ');

                    if (cmd.length === 4) { // goto x y zуу
                        const x = parseInt(cmd[1], 10);
                        const y = parseInt(cmd[2], 10);
                        const z = parseInt(cmd[3], 10);

                        bot.pathfinder.setMovements(defaultMove);
                        bot.pathfinder.setGoal(new GoalBlock(x, y, z))
                    } else if (cmd.length === 3) { // goto x z
                        const x = parseInt(cmd[1], 10);
                        const z = parseInt(cmd[2], 10);

                        bot.pathfinder.setMovements(defaultMove);
                        bot.pathfinder.setGoal(new GoalXZ(x, z))
                    } else if (cmd.length === 2) { // goto y
                        const y = parseInt(cmd[1], 10);

                        bot.pathfinder.setMovements(defaultMove);
                        bot.pathfinder.setGoal(new GoalY(y))
                    }
                } else if (message.startsWith('корчевать')) {
                    const cmd = message.split(' ');
                    superDig(
                        bot,
                        defaultMove,
                        parseInt(cmd[1], 10),
                        parseInt(cmd[2], 10),
                        parseInt(cmd[3], 10),
                        parseInt(cmd[4], 10),
                        parseInt(cmd[5], 10)
                    )
                }
        }
    }

    bot.once('spawn', () => {
        // mineflayerViewer(bot, { port: 3007, firstPerson: true })
        bot.chat('Всем здорово, я - Миша. Петля на шее, уши в кармане, манага в стакане!')

        // Once we've spawn, it is safe to access mcData because we know the version
        const mcData = require('minecraft-data')(bot.version);

        // We create different movement generators for different type of activity
        const defaultMove = new Movements(bot, mcData);

        bot.on('path_update', (r) => {
            console.debug(`Я дойду до точки за ${r.path.length} моих деревенских шажков`)
        });


        bot.on('chat', (username, message) => {
            if (message !== 'съебался по-настоящему' && message !== 'реконнект')
                lastMessage = message;
            lastTarget = bot.players[username] ? bot.players[username].entity : null;
            handleCommands(defaultMove, lastTarget, message)
        })

        if (lastMessage) {
            bot.chat('Помнится, Вы говорили...');
            bot.chat(lastMessage);
            handleCommands(defaultMove, lastTarget, lastMessage);
        }
    })


    bot.on('error', (err) => console.log(err))
    bot.on('end', createBot)
}

createBot();